-- Aggancia le quote di rete (10%) ai percorsi del pagamento.
-- Le definizioni sono copie integrali delle ultime versioni in vigore, con
-- SOLO le righe di rete aggiunte:
--   _registra_snapshot_pagamento  da 20260924190000_pagamento_consolidato_e_iniziale
--   modifica_pagamento_economico  da 20260925183000_allinea_modifica_pagamento_consolidato
--   annulla_incasso_economico     da 20260927120000_annulla_incasso_in_rata_prevista
--   _imposta_incassato_pagamento  da 20261009120000_conferme_trasferimenti_quote
-- ATTENZIONE: dopo 20261008160000_pagamenti_registrati_solo_admin le due
-- funzioni pubbliche modifica/annulla sono wrapper con controllo is_admin();
-- il corpo reale vive in *_admin_impl, quindi si ridefiniscono quelle (i
-- wrapper restano intatti, non si tocca il controllo di autorizzazione).

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

  -- Quote di rete (10% al responsabile del gestore): dopo i partecipanti.
  perform public._applica_quote_rete(p_pagamento_id);
end;
$$;

revoke all on function public._registra_snapshot_pagamento(
  uuid, uuid, numeric, jsonb, jsonb
) from public, anon, authenticated;


create or replace function public.modifica_pagamento_economico_admin_impl(
  p_pagamento_id uuid,
  p_importo numeric,
  p_data_pagamento date default null,
  p_metodo text default null,
  p_note text default null,
  p_calcolo jsonb default '{}'::jsonb,
  p_partecipanti jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_vendita_id uuid;
  v_stato_attuale text;
  v_totale numeric(12,2);
  v_incassato_altri numeric(12,2);
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
  if v_user is null then
    raise exception 'Utente non autenticato';
  end if;

  if coalesce(p_importo, 0) <= 0 then
    raise exception 'Importo pagamento non valido';
  end if;

  select p.vendita_id, p.stato
  into v_vendita_id, v_stato_attuale
  from public.pagamenti p
  join public.vendite v on v.id = p.vendita_id
  where p.id = p_pagamento_id
    and (
      v.venditore_id = v_user
      or v.creato_da = v_user
      or public.is_admin()
    )
  for update of p;

  if v_vendita_id is null then
    raise exception 'Pagamento non disponibile';
  end if;

  if v_stato_attuale = 'annullato' then
    raise exception 'Non è possibile modificare un pagamento annullato';
  end if;

  select v.importo_vendita into v_totale
  from public.vendite v
  where v.id = v_vendita_id
  for update;

  select coalesce(sum(p.importo), 0)
  into v_incassato_altri
  from public.pagamenti p
  where p.vendita_id = v_vendita_id
    and p.stato in ('previsto', 'incassato')
    and p.id <> p_pagamento_id;

  if v_incassato_altri + p_importo > v_totale then
    raise exception 'Importo superiore al residuo';
  end if;

  -- Snapshot economico: richiesto solo per pagamenti incassati.
  if v_stato_attuale = 'incassato' then
    if jsonb_typeof(p_calcolo) <> 'object' then
      raise exception 'Snapshot economico non valido';
    end if;

    if jsonb_typeof(p_partecipanti) <> 'array'
       or jsonb_array_length(p_partecipanti) = 0 then
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
    where vp.vendita_id = v_vendita_id;

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

    -- Stessa configurazione consolidata usata in registrazione:
    -- ruolo, modalità di fatturazione e quota_override devono
    -- corrispondere alla vendita.
    --
    -- Il referente è escluso dal confronto quota_override perché
    -- assorbe il residuo economico della singola rata.
    if exists (
      select 1
      from jsonb_array_elements(p_partecipanti) elemento
      left join public.vendita_partecipanti vp
        on vp.vendita_id = v_vendita_id
       and vp.profilo_id = (elemento ->> 'profilo_id')::uuid
      where vp.id is null
         or coalesce(elemento ->> 'ruolo', '') <>
            coalesce(vp.ruolo, '')
         or coalesce(
              nullif(
                elemento ->> 'modalita_fatturazione',
                ''
              ),
              'nessuna'
            ) <>
            coalesce(
              nullif(vp.modalita_fatturazione, ''),
              case
                when vp.fa_fattura then 'totale'
                else 'nessuna'
              end
            )
         or (
           coalesce(elemento ->> 'ruolo', '') <> 'referente'
           and coalesce(
             (elemento ->> 'quota_override')::boolean,
             false
           ) <>
           coalesce(vp.quota_override, false)
         )
    ) then
      raise exception
        'Partecipante non coerente con la configurazione consolidata della vendita';
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
  end if;

  update public.pagamenti
  set importo = p_importo,
      data_pagamento = case
        when v_stato_attuale = 'incassato'
          then coalesce(p_data_pagamento, data_pagamento, current_date)
        else data_pagamento
      end,
      metodo = nullif(trim(p_metodo), ''),
      note = nullif(trim(p_note), '')
  where id = p_pagamento_id;

  if v_stato_attuale = 'incassato' then
    -- _applica_quote_rete non e' idempotente: prima le righe di rete.
    delete from public.pagamento_quote_rete
    where pagamento_id = p_pagamento_id;

    delete from public.pagamento_partecipanti
    where pagamento_id = p_pagamento_id;

    delete from public.pagamento_calcoli
    where pagamento_id = p_pagamento_id;

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

    perform public._applica_quote_rete(p_pagamento_id);
  end if;

  return p_pagamento_id;
end;
$$;

revoke all on function public.modifica_pagamento_economico_admin_impl(
  uuid, numeric, date, text, text, jsonb, jsonb
) from public, anon, authenticated;


create or replace function public.annulla_incasso_economico_admin_impl(
  p_pagamento_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_pagamento_id uuid;
begin
  if v_user is null then
    raise exception 'Utente non autenticato';
  end if;

  select p.id
  into v_pagamento_id
  from public.pagamenti p
  join public.vendite v on v.id = p.vendita_id
  where p.id = p_pagamento_id
    and p.stato = 'incassato'
    and (
      v.venditore_id = v_user
      or v.creato_da = v_user
      or public.is_admin()
    )
  for update of p;

  if v_pagamento_id is null then
    raise exception 'Incasso non disponibile';
  end if;

  delete from public.pagamento_quote_rete
  where pagamento_id = v_pagamento_id;

  delete from public.pagamento_partecipanti
  where pagamento_id = v_pagamento_id;

  delete from public.pagamento_calcoli
  where pagamento_id = v_pagamento_id;

  update public.pagamenti
  set stato = 'previsto',
      data_scadenza = coalesce(data_scadenza, data_pagamento, current_date),
      data_pagamento = null,
      metodo = null,
      incassato_da = null
  where id = v_pagamento_id;

  return v_pagamento_id;
end;
$$;

revoke all on function public.annulla_incasso_economico_admin_impl(uuid)
from public, anon, authenticated;


create or replace function public._imposta_incassato_pagamento(
  p_pagamento_id uuid,
  p_incassato_da uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_data timestamptz;
begin
  if p_incassato_da is null or not exists (
    select 1
    from public.pagamento_partecipanti pp
    where pp.pagamento_id = p_pagamento_id
      and pp.profilo_id = p_incassato_da
  ) then
    raise exception 'Partecipante che ha incassato non valido';
  end if;

  update public.pagamenti
  set incassato_da = p_incassato_da
  where id = p_pagamento_id
    and stato = 'incassato'
  returning coalesce(data_pagamento::timestamptz, creato_il)
  into v_data;

  if v_data is null then
    raise exception 'Incasso non disponibile';
  end if;

  -- Una correzione del pagamento ricalcola le quote: le conferme precedenti
  -- non possono restare valide. Solo chi detiene già il denaro è regolato.
  update public.pagamento_partecipanti
  set ricevuta_il = case
    when profilo_id = p_incassato_da then v_data
    else null
  end
  where pagamento_id = p_pagamento_id;

  -- Stessa regola per le quote di rete: e' regolata solo se chi ha incassato
  -- e' proprio il destinatario della quota.
  update public.pagamento_quote_rete
  set ricevuta_il = case
    when a_profilo_id = p_incassato_da then v_data
    else null
  end
  where pagamento_id = p_pagamento_id;
end;
$$;

revoke all on function public._imposta_incassato_pagamento(uuid, uuid)
from public, anon, authenticated;
