-- Landing Sellers
-- V5 - fatturazione mista, quote reali e salvataggio atomico vendita
-- 2026-09-09

-- ============================================================
-- VENDITE: FATTURAZIONE ALESSANDRO -> CLIENTE
-- ============================================================

alter table public.vendite
  add column if not exists modalita_fatturazione_admin text
    not null default 'nessuna',
  add column if not exists importo_fatturato_admin numeric(12,2)
    not null default 0,
  add column if not exists percentuale_tasse_admin numeric(5,2)
    not null default 40;

alter table public.vendite
  drop constraint if exists vendite_modalita_fatturazione_admin_check,
  add constraint vendite_modalita_fatturazione_admin_check
    check (modalita_fatturazione_admin in ('totale', 'mista', 'nessuna')),
  drop constraint if exists vendite_importo_fatturato_admin_check,
  add constraint vendite_importo_fatturato_admin_check
    check (importo_fatturato_admin >= 0),
  drop constraint if exists vendite_importo_fatturato_admin_max_check,
  add constraint vendite_importo_fatturato_admin_max_check
    check (importo_fatturato_admin <= importo_vendita),
  drop constraint if exists vendite_percentuale_tasse_admin_check,
  add constraint vendite_percentuale_tasse_admin_check
    check (percentuale_tasse_admin between 0 and 100);


-- ============================================================
-- PARTECIPANTI: FATTURAZIONE + QUOTA EFFETTIVA
-- ============================================================

alter table public.vendita_partecipanti
  add column if not exists modalita_fatturazione text
    not null default 'nessuna',
  add column if not exists importo_fatturato numeric(12,2)
    not null default 0,
  add column if not exists quota_calcolata numeric(12,2),
  add column if not exists quota_effettiva numeric(12,2),
  add column if not exists quota_override boolean
    not null default false,
  add column if not exists note_quota text;

alter table public.vendita_partecipanti
  drop constraint if exists vendita_partecipanti_modalita_fatturazione_check,
  add constraint vendita_partecipanti_modalita_fatturazione_check
    check (modalita_fatturazione in ('totale', 'mista', 'nessuna')),
  drop constraint if exists vendita_partecipanti_importo_fatturato_check,
  add constraint vendita_partecipanti_importo_fatturato_check
    check (importo_fatturato >= 0),
  drop constraint if exists vendita_partecipanti_quota_calcolata_check,
  add constraint vendita_partecipanti_quota_calcolata_check
    check (quota_calcolata is null or quota_calcolata >= 0),
  drop constraint if exists vendita_partecipanti_quota_effettiva_check,
  add constraint vendita_partecipanti_quota_effettiva_check
    check (quota_effettiva is null or quota_effettiva >= 0);

-- Compatibilità con eventuali snapshot V4 già presenti.
update public.vendita_partecipanti
set
  modalita_fatturazione =
    case when fa_fattura then 'totale' else 'nessuna' end,
  importo_fatturato =
    case when fa_fattura then quota_finale else 0 end,
  quota_calcolata = coalesce(quota_calcolata, quota_finale),
  quota_effettiva = coalesce(quota_effettiva, quota_finale)
where
  quota_calcolata is null
  or quota_effettiva is null;


-- ============================================================
-- RPC ATOMICA: VENDITA + COSTI + PARTECIPANTI + PAGAMENTO
-- ============================================================
--
-- Il frontend non esegue più insert separati che potrebbero lasciare
-- una vendita salvata a metà. Tutto avviene nella stessa transazione.
--
-- Permette inoltre a Tomas/collaboratori di registrare una vendita in cui
-- il venditore commerciale è Alessandro, purché chi registra sia incluso
-- tra i partecipanti economici (oppure sia admin).

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
    raise exception 'Cliente, venditore o admin mancanti';
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
      and p.ruolo = 'admin'
  ) then
    raise exception 'Admin economico non valido';
  end if;

  if not exists (
    select 1
    from public.profili p
    where p.id = v_venditore_id
  ) then
    raise exception 'Venditore non valido';
  end if;

  if jsonb_typeof(coalesce(p_partecipanti, '[]'::jsonb)) <> 'array' then
    raise exception 'Partecipanti non validi';
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
  ) then
    raise exception 'Admin assente dalla ripartizione';
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
    percentuale_tasse_admin
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
    coalesce((p_vendita->>'percentuale_tasse_admin')::numeric, 40)
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
    if coalesce((p_pagamento->>'importo')::numeric, 0) <= 0 then
      raise exception 'Importo pagamento non valido';
    end if;

    insert into public.pagamenti (
      vendita_id,
      incassato_da,
      creato_da,
      importo,
      stato,
      data_scadenza,
      data_pagamento,
      metodo,
      note
    ) values (
      v_vendita_id,
      coalesce(
        nullif(p_pagamento->>'incassato_da', '')::uuid,
        v_admin_id
      ),
      v_user,
      (p_pagamento->>'importo')::numeric,
      coalesce(nullif(p_pagamento->>'stato', ''), 'incassato'),
      nullif(p_pagamento->>'data_scadenza', '')::date,
      nullif(p_pagamento->>'data_pagamento', '')::date,
      nullif(trim(p_pagamento->>'metodo'), ''),
      nullif(trim(p_pagamento->>'note'), '')
    );
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
