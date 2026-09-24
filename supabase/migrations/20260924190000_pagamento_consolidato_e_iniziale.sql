-- Landing Sellers
-- Consolida due problemi architetturali dei pagamenti:
--
-- 1) PAGAMENTO INIZIALE: registra_vendita_economica sapeva solo inserire un
--    pagamento "grezzo" (tabella pagamenti), non lo snapshot economico
--    completo (pagamento_calcoli + pagamento_partecipanti) che rende un
--    pagamento indistinguibile da uno registrato con Incassa.
--
-- 2) COERENZA INCASSA: registra_pagamento_economico non verificava che la
--    modalita_fatturazione e la quota_override dei partecipanti del
--    pagamento coincidessero con la configurazione CONSOLIDATA della
--    vendita (vendita_partecipanti). Il client poteva quindi salvare una
--    ripartizione diversa da quella decisa alla registrazione della
--    vendita. Non si confrontano gli importi assoluti (importo_fatturato,
--    quota_effettiva): sono scalati sull'importo della singola rata.
--
-- Per non duplicare la logica di inserimento snapshot tra
-- registra_pagamento_economico e registra_vendita_economica, viene
-- estratta in una funzione condivisa _registra_snapshot_pagamento.
--
-- Aggiunge anche vendite.applica_bonus_venditore: era una scelta
-- dell'utente in "Registra vendita" (bonus 12% al venditore quando la
-- vendita ha 2 soli partecipanti) mai persistita, quindi ogni pagamento
-- successivo la ricalcolava con il default (true) invece di quella
-- realmente scelta alla vendita. Default true = comportamento storico
-- invariato per le vendite legacy.

alter table public.vendite
  add column if not exists applica_bonus_venditore boolean
  not null default true;

comment on column public.vendite.applica_bonus_venditore is
  'Scelta consolidata alla registrazione della vendita: se applicare il bonus 12% al venditore quando la vendita ha 2 soli partecipanti. Non modificabile dal flusso Incassa.';


-- ============================================================
-- FUNZIONE CONDIVISA: snapshot economico di un pagamento
-- ============================================================

create or replace function public._registra_snapshot_pagamento(
  p_pagamento_id uuid,
  p_vendita_id uuid,
  p_importo numeric,
  p_calcolo jsonb,
  p_partecipanti jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_importo_snapshot numeric(12,2);
  v_importo_costi numeric(12,2);
  v_margine numeric(12,2);
  v_importo_tasse numeric(12,2);
  v_netto numeric(12,2);
  v_totale_quote numeric(12,2);
  v_numero_partecipanti integer;
  v_numero_snapshot integer;
  v_numero_referenti integer;
begin
  if jsonb_typeof(coalesce(p_calcolo, '{}'::jsonb)) <> 'object' then
    raise exception 'Snapshot economico non valido';
  end if;

  if jsonb_typeof(coalesce(p_partecipanti, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_partecipanti, '[]'::jsonb)) = 0 then
    raise exception 'Partecipanti pagamento mancanti';
  end if;

  v_importo_snapshot :=
    coalesce((p_calcolo ->> 'importo_pagamento')::numeric, 0);

  v_importo_costi :=
    coalesce((p_calcolo ->> 'importo_costi')::numeric, 0);

  v_margine :=
    coalesce((p_calcolo ->> 'margine')::numeric, 0);

  v_importo_tasse :=
    coalesce((p_calcolo ->> 'importo_tasse')::numeric, 0);

  v_netto :=
    coalesce((p_calcolo ->> 'netto_distribuibile')::numeric, 0);

  if abs(v_importo_snapshot - p_importo) > 0.01 then
    raise exception 'Importo snapshot diverso dal pagamento';
  end if;

  if v_importo_costi < 0
     or v_margine < 0
     or v_importo_tasse < 0
     or v_netto < 0 then
    raise exception 'Valori economici negativi non validi';
  end if;

  if abs(v_margine - greatest(0, p_importo - v_importo_costi)) > 0.01 then
    raise exception 'Margine pagamento non coerente';
  end if;

  if abs(v_netto - greatest(0, v_margine - v_importo_tasse)) > 0.01 then
    raise exception 'Netto distribuibile non coerente';
  end if;

  if jsonb_typeof(
    coalesce(p_calcolo -> 'costi_snapshot', '[]'::jsonb)
  ) <> 'array' then
    raise exception 'Snapshot costi non valido';
  end if;

  select count(*)
  into v_numero_partecipanti
  from public.vendita_partecipanti vp
  where vp.vendita_id = p_vendita_id;

  select count(distinct elemento ->> 'profilo_id')
  into v_numero_snapshot
  from jsonb_array_elements(p_partecipanti) elemento;

  if v_numero_partecipanti = 0
     or v_numero_snapshot <> v_numero_partecipanti then
    raise exception 'Partecipanti pagamento non coerenti con la vendita';
  end if;

  if jsonb_array_length(p_partecipanti) <> v_numero_snapshot then
    raise exception 'Partecipanti duplicati nel pagamento';
  end if;

  -- Il pagamento deve usare la STESSA configurazione consolidata della
  -- vendita: stesso ruolo e stessa modalita_fatturazione (chi fattura).
  -- Gli importi assoluti (importo_fatturato, quota_effettiva) non si
  -- confrontano qui: sono scalati sull'importo della singola rata, non
  -- sull'intera vendita. Il confronto su quota_override si limita ai
  -- collaboratori: il referente assorbe sempre il residuo economico del
  -- pagamento (vedi economic-engine.calcolaSnapshotPagamento), quindi il
  -- suo quota_override viene normalizzato a false su ogni rata anche
  -- quando in vendita_partecipanti risulta true - non è un'incongruenza
  -- da bloccare.
  if exists (
    select 1
    from jsonb_array_elements(p_partecipanti) elemento
    left join public.vendita_partecipanti vp
      on vp.vendita_id = p_vendita_id
     and vp.profilo_id = (elemento ->> 'profilo_id')::uuid
    where vp.id is null
       or coalesce(elemento ->> 'ruolo', '') <>
          coalesce(vp.ruolo, '')
       or coalesce(nullif(elemento ->> 'modalita_fatturazione', ''), 'nessuna') <>
          coalesce(
            nullif(vp.modalita_fatturazione, ''),
            case when vp.fa_fattura then 'totale' else 'nessuna' end
          )
       or (
         coalesce(elemento ->> 'ruolo', '') <> 'referente'
         and coalesce((elemento ->> 'quota_override')::boolean, false) <>
             coalesce(vp.quota_override, false)
       )
  ) then
    raise exception 'Partecipante non coerente con la configurazione consolidata della vendita';
  end if;

  select count(*)
  into v_numero_referenti
  from jsonb_array_elements(p_partecipanti) elemento
  where elemento ->> 'ruolo' = 'referente';

  if v_numero_referenti <> 1 then
    raise exception 'Referente economico pagamento non valido';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_partecipanti) elemento
    where coalesce(elemento ->> 'modalita_fatturazione', 'nessuna')
          not in ('nessuna', 'mista', 'totale')
       or coalesce((elemento ->> 'importo_fatturato')::numeric, 0) < 0
       or coalesce((elemento ->> 'quota_base')::numeric, 0) < 0
       or coalesce((elemento ->> 'quota_teorica')::numeric, 0) < 0
       or coalesce((elemento ->> 'importo_riduzione')::numeric, 0) < 0
       or coalesce((elemento ->> 'bonus_admin')::numeric, 0) < 0
       or coalesce((elemento ->> 'quota_calcolata')::numeric, 0) < 0
       or coalesce((elemento ->> 'quota_effettiva')::numeric, 0) < 0
  ) then
    raise exception 'Valori partecipante pagamento non validi';
  end if;

  select coalesce(
    sum((elemento ->> 'quota_effettiva')::numeric),
    0
  )
  into v_totale_quote
  from jsonb_array_elements(p_partecipanti) elemento;

  if abs(v_totale_quote - v_netto) > 0.01 then
    raise exception 'Le quote del pagamento non quadrano';
  end if;

  if exists (
    select 1
    from public.pagamento_calcoli pc
    where pc.pagamento_id = p_pagamento_id
  ) then
    raise exception 'Snapshot economico pagamento già presente';
  end if;

  insert into public.pagamento_calcoli (
    pagamento_id,
    importo_pagamento,
    importo_costi,
    margine,
    percentuale_tasse,
    percentuale_fatturata_admin,
    importo_tasse,
    netto_distribuibile,
    costi_snapshot
  )
  values (
    p_pagamento_id,
    v_importo_snapshot,
    v_importo_costi,
    v_margine,
    coalesce((p_calcolo ->> 'percentuale_tasse')::numeric, 0),
    coalesce((p_calcolo ->> 'percentuale_fatturata_admin')::numeric, 0),
    v_importo_tasse,
    v_netto,
    coalesce(p_calcolo -> 'costi_snapshot', '[]'::jsonb)
  );

  insert into public.pagamento_partecipanti (
    pagamento_id,
    profilo_id,
    ruolo,
    modalita_fatturazione,
    importo_fatturato,
    quota_base,
    quota_teorica,
    percentuale_riduzione,
    importo_riduzione,
    bonus_admin,
    quota_calcolata,
    quota_effettiva,
    quota_override,
    note_quota
  )
  select
    p_pagamento_id,
    (elemento ->> 'profilo_id')::uuid,
    nullif(elemento ->> 'ruolo', ''),
    coalesce(nullif(elemento ->> 'modalita_fatturazione', ''), 'nessuna'),
    coalesce((elemento ->> 'importo_fatturato')::numeric, 0),
    coalesce((elemento ->> 'quota_base')::numeric, 0),
    coalesce((elemento ->> 'quota_teorica')::numeric, 0),
    coalesce((elemento ->> 'percentuale_riduzione')::numeric, 0),
    coalesce((elemento ->> 'importo_riduzione')::numeric, 0),
    coalesce((elemento ->> 'bonus_admin')::numeric, 0),
    coalesce((elemento ->> 'quota_calcolata')::numeric, 0),
    coalesce((elemento ->> 'quota_effettiva')::numeric, 0),
    coalesce((elemento ->> 'quota_override')::boolean, false),
    nullif(trim(elemento ->> 'note_quota'), '')
  from jsonb_array_elements(p_partecipanti) elemento;
end;
$$;

-- Funzione interna: nessun grant a authenticated. Scrive
-- pagamento_calcoli/pagamento_partecipanti senza verificare
-- l'autorizzazione sulla vendita (quel controllo lo fa
-- registra_pagamento_vendita più a monte) - deve restare raggiungibile
-- solo dalle funzioni SECURITY DEFINER che la chiamano internamente,
-- mai chiamabile direttamente da un utente autenticato.
revoke all on function public._registra_snapshot_pagamento(
  uuid, uuid, numeric, jsonb, jsonb
) from public, anon, authenticated;


-- ============================================================
-- registra_pagamento_economico: riusa la funzione condivisa
-- ============================================================

create or replace function public.registra_pagamento_economico(
  p_vendita_id uuid,
  p_importo numeric,
  p_data_pagamento date default null,
  p_metodo text default null,
  p_note text default null,
  p_pagamento_previsto_id uuid default null,
  p_calcolo jsonb default '{}'::jsonb,
  p_partecipanti jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pagamento_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;

  -- La funzione esistente mantiene in un solo punto:
  -- autorizzazioni, residuo e conversione delle rate previste.
  v_pagamento_id := public.registra_pagamento_vendita(
    p_vendita_id,
    p_importo,
    'incassato',
    null,
    p_data_pagamento,
    p_metodo,
    p_note,
    p_pagamento_previsto_id
  );

  perform public._registra_snapshot_pagamento(
    v_pagamento_id,
    p_vendita_id,
    p_importo,
    p_calcolo,
    p_partecipanti
  );

  return v_pagamento_id;
end;
$$;

revoke all on function public.registra_pagamento_economico(
  uuid, numeric, date, text, text, uuid, jsonb, jsonb
) from public, anon;

grant execute on function public.registra_pagamento_economico(
  uuid, numeric, date, text, text, uuid, jsonb, jsonb
) to authenticated;


-- ============================================================
-- registra_vendita_economica: persiste applica_bonus_venditore e,
-- se richiesto, lo snapshot completo del pagamento iniziale
-- ============================================================

create or replace function public.registra_vendita_economica(
  p_vendita jsonb,
  p_costi jsonb default '[]'::jsonb,
  p_partecipanti jsonb default '[]'::jsonb,
  p_pagamento jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_vendita_id uuid;
  v_cliente_id uuid;
  v_venditore_id uuid;
  v_admin_id uuid;
  v_importo numeric(12,2);
  v_elemento jsonb;
  v_pagamento_id uuid;
  v_importo_pagamento numeric(12,2);
begin
  if v_user is null then
    raise exception 'Utente non autenticato';
  end if;

  if p_vendita is null then
    raise exception 'Dati vendita mancanti';
  end if;

  v_cliente_id := nullif(p_vendita->>'cliente_id', '')::uuid;
  v_venditore_id := nullif(p_vendita->>'venditore_id', '')::uuid;
  v_admin_id := nullif(p_vendita->>'admin_id', '')::uuid;
  v_importo := coalesce((p_vendita->>'importo_vendita')::numeric, 0);

  if v_cliente_id is null or v_venditore_id is null or v_admin_id is null then
    raise exception 'Cliente, venditore o referente economico mancanti';
  end if;

  if v_importo <= 0 then
    raise exception 'Importo vendita non valido';
  end if;

  if not exists (
    select 1
    from public.clienti c
    where c.id = v_cliente_id
      and c.cancellato_il is null
  ) then
    raise exception 'Cliente non valido';
  end if;

  if jsonb_typeof(coalesce(p_costi, '[]'::jsonb)) <> 'array' then
    raise exception 'Costi non validi';
  end if;

  if jsonb_typeof(coalesce(p_partecipanti, '[]'::jsonb)) <> 'array' then
    raise exception 'Partecipanti non validi';
  end if;

  if jsonb_array_length(coalesce(p_partecipanti, '[]'::jsonb)) = 0 then
    raise exception 'Nessun partecipante indicato';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(coalesce(p_partecipanti, '[]'::jsonb)) e
  ) <> (
    select count(distinct nullif(e->>'profilo_id', ''))
    from jsonb_array_elements(coalesce(p_partecipanti, '[]'::jsonb)) e
  ) then
    raise exception 'Partecipanti duplicati';
  end if;

  if not exists (
    select 1
    from public.profili p
    where p.id = v_admin_id
      and p.ruolo = 'venditore'
      and p.ruolo_economico = 'referente'
  ) then
    raise exception 'Referente economico non valido';
  end if;

  if not exists (
    select 1
    from public.profili p
    where p.id = v_venditore_id
      and p.ruolo = 'venditore'
  ) then
    raise exception 'Venditore non valido';
  end if;

  if not public.is_admin() and not exists (
    select 1
    from jsonb_array_elements(coalesce(p_partecipanti, '[]'::jsonb)) e
    where nullif(e->>'profilo_id', '')::uuid = v_user
  ) then
    raise exception 'Chi registra deve essere incluso tra i partecipanti';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(coalesce(p_partecipanti, '[]'::jsonb)) e
    where nullif(e->>'profilo_id', '')::uuid = v_admin_id
      and e->>'ruolo' = 'referente'
  ) then
    raise exception 'Referente economico assente dalla ripartizione';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(coalesce(p_partecipanti, '[]'::jsonb)) e
    where nullif(e->>'profilo_id', '')::uuid = v_venditore_id
  ) then
    raise exception 'Venditore assente dalla ripartizione';
  end if;

  insert into public.vendite (
    cliente_id,
    venditore_id,
    admin_id,
    creato_da,
    servizio,
    descrizione,
    importo_vendita,
    stato,
    data_vendita,
    modalita_fatturazione_admin,
    importo_fatturato_admin,
    percentuale_tasse_admin,
    applica_bonus_venditore
  ) values (
    v_cliente_id,
    v_venditore_id,
    v_admin_id,
    v_user,
    coalesce(nullif(trim(p_vendita->>'servizio'), ''), 'Servizio registrato'),
    nullif(trim(p_vendita->>'descrizione'), ''),
    v_importo,
    'attiva',
    coalesce(nullif(p_vendita->>'data_vendita', '')::date, current_date),
    coalesce(nullif(p_vendita->>'modalita_fatturazione_admin', ''), 'nessuna'),
    coalesce((p_vendita->>'importo_fatturato_admin')::numeric, 0),
    coalesce((p_vendita->>'percentuale_tasse_admin')::numeric, 40),
    coalesce((p_vendita->>'applica_bonus_venditore')::boolean, true)
  )
  returning id into v_vendita_id;

  for v_elemento in
    select value
    from jsonb_array_elements(coalesce(p_costi, '[]'::jsonb))
  loop
    insert into public.costi_vendita (
      vendita_id,
      descrizione,
      importo
    ) values (
      v_vendita_id,
      coalesce(nullif(trim(v_elemento->>'descrizione'), ''), 'Costo'),
      coalesce((v_elemento->>'importo')::numeric, 0)
    );
  end loop;

  for v_elemento in
    select value
    from jsonb_array_elements(coalesce(p_partecipanti, '[]'::jsonb))
  loop
    insert into public.vendita_partecipanti (
      vendita_id,
      profilo_id,
      ruolo,
      fa_fattura,
      quota_base,
      percentuale_tasse,
      importo_tasse,
      percentuale_riduzione,
      importo_riduzione,
      importo_trasferito_admin,
      quota_finale,
      saldato,
      data_saldo,
      modalita_fatturazione,
      importo_fatturato,
      quota_calcolata,
      quota_effettiva,
      quota_override,
      note_quota
    ) values (
      v_vendita_id,
      nullif(v_elemento->>'profilo_id', '')::uuid,
      nullif(v_elemento->>'ruolo', ''),
      coalesce((v_elemento->>'fa_fattura')::boolean, false),
      coalesce((v_elemento->>'quota_base')::numeric, 0),
      coalesce((v_elemento->>'percentuale_tasse')::numeric, 0),
      coalesce((v_elemento->>'importo_tasse')::numeric, 0),
      coalesce((v_elemento->>'percentuale_riduzione')::numeric, 0),
      coalesce((v_elemento->>'importo_riduzione')::numeric, 0),
      coalesce((v_elemento->>'importo_trasferito_admin')::numeric, 0),
      coalesce((v_elemento->>'quota_finale')::numeric, 0),
      coalesce((v_elemento->>'saldato')::boolean, false),
      nullif(v_elemento->>'data_saldo', '')::date,
      coalesce(nullif(v_elemento->>'modalita_fatturazione', ''), 'nessuna'),
      coalesce((v_elemento->>'importo_fatturato')::numeric, 0),
      coalesce((v_elemento->>'quota_calcolata')::numeric, 0),
      coalesce((v_elemento->>'quota_effettiva')::numeric, 0),
      coalesce((v_elemento->>'quota_override')::boolean, false),
      nullif(trim(v_elemento->>'note_quota'), '')
    );
  end loop;

  if p_pagamento is not null then
    v_importo_pagamento := coalesce((p_pagamento->>'importo')::numeric, 0);

    if v_importo_pagamento <= 0 then
      raise exception 'Importo pagamento non valido';
    end if;

    -- Stessa RPC di autorizzazione/residuo usata da Incassa: la vendita e
    -- i partecipanti appena inseriti sono già visibili in questa stessa
    -- transazione.
    v_pagamento_id := public.registra_pagamento_vendita(
      v_vendita_id,
      v_importo_pagamento,
      coalesce(nullif(p_pagamento->>'stato', ''), 'incassato'),
      nullif(p_pagamento->>'data_scadenza', '')::date,
      nullif(p_pagamento->>'data_pagamento', '')::date,
      nullif(trim(p_pagamento->>'metodo'), ''),
      nullif(trim(p_pagamento->>'note'), ''),
      null
    );

    -- Lo snapshot economico (calcolo + partecipanti) è opzionale solo per
    -- compatibilità con chiamate legacy che passano un pagamento "grezzo":
    -- il flusso app.js attuale lo invia sempre per un pagamento incassato.
    if (p_pagamento ? 'calcolo') and (p_pagamento ? 'partecipanti') then
      perform public._registra_snapshot_pagamento(
        v_pagamento_id,
        v_vendita_id,
        v_importo_pagamento,
        p_pagamento -> 'calcolo',
        p_pagamento -> 'partecipanti'
      );
    end if;
  end if;

  return v_vendita_id;
end;
$$;

revoke all
on function public.registra_vendita_economica(jsonb, jsonb, jsonb, jsonb)
from public, anon;

grant execute
on function public.registra_vendita_economica(jsonb, jsonb, jsonb, jsonb)
to authenticated;
