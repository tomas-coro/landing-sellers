alter table public.pagamento_partecipanti
  add column if not exists consegnata_il timestamptz,
  add column if not exists consegna_gruppo_id uuid;

create index if not exists pagamento_partecipanti_consegna_gruppo_idx
  on public.pagamento_partecipanti(consegna_gruppo_id)
  where consegna_gruppo_id is not null;

create or replace function public._tipo_quote_omogeneo(p_quota_ids uuid[])
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tipi text[];
begin
  select array_agg(distinct
    case
      when pc.percentuale_fatturata_admin is null then 'sconosciuto'
      when pc.percentuale_fatturata_admin >= 100 then 'fatturato'
      when pc.percentuale_fatturata_admin <= 0 then 'cash'
      else 'misto'
    end)
  into v_tipi
  from public.pagamento_partecipanti pp
  left join public.pagamento_calcoli pc on pc.pagamento_id = pp.pagamento_id
  where pp.id = any(p_quota_ids);

  if v_tipi is null or array_length(v_tipi, 1) <> 1 then
    raise exception 'Seleziona solo quote fatturate oppure solo quote cash';
  end if;
  if v_tipi[1] in ('misto', 'sconosciuto') and array_length(p_quota_ids, 1) > 1 then
    raise exception 'Le quote con fatturato e cash misti si gestiscono una alla volta';
  end if;
  return v_tipi[1];
end;
$$;

revoke all on function public._tipo_quote_omogeneo(uuid[]) from public, anon, authenticated;

create or replace function public.segna_quote_consegnate(p_quota_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_gruppo uuid := gen_random_uuid();
  v_aggiornate integer;
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;

  select array_agg(distinct x) into v_ids from unnest(p_quota_ids) as x;
  if v_ids is null or array_length(v_ids, 1) = 0 then
    raise exception 'Nessuna quota selezionata';
  end if;

  perform public._tipo_quote_omogeneo(v_ids);

  if (
    select count(distinct pp.profilo_id)
    from public.pagamento_partecipanti pp
    where pp.id = any(v_ids)
  ) <> 1 then
    raise exception 'Una consegna va a un solo destinatario';
  end if;

  update public.pagamento_partecipanti pp
  set consegnata_il = now(),
      consegna_gruppo_id = v_gruppo
  from public.pagamenti p
  where pp.pagamento_id = p.id
    and pp.id = any(v_ids)
    and p.incassato_da = auth.uid()
    and p.stato = 'incassato'
    and pp.profilo_id is distinct from p.incassato_da
    and pp.quota_effettiva > 0
    and pp.ricevuta_il is null
    and pp.consegnata_il is null;

  get diagnostics v_aggiornate = row_count;
  if v_aggiornate <> array_length(v_ids, 1) then
    raise exception 'Alcune quote non sono disponibili da consegnare';
  end if;

  return v_gruppo;
end;
$$;

create or replace function public.annulla_consegna_gruppo(p_gruppo uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_righe integer;
  v_aggiornate integer;
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;

  select count(*) into v_righe
  from public.pagamento_partecipanti pp
  join public.pagamenti p on p.id = pp.pagamento_id
  where pp.consegna_gruppo_id = p_gruppo
    and p.incassato_da = auth.uid();

  if v_righe = 0 then
    raise exception 'Consegna non trovata';
  end if;

  if exists (
    select 1
    from public.pagamento_partecipanti pp
    where pp.consegna_gruppo_id = p_gruppo
      and pp.ricevuta_il is not null
  ) then
    raise exception 'Consegna gia confermata dal destinatario';
  end if;

  update public.pagamento_partecipanti pp
  set consegnata_il = null,
      consegna_gruppo_id = null
  from public.pagamenti p
  where pp.pagamento_id = p.id
    and pp.consegna_gruppo_id = p_gruppo
    and p.incassato_da = auth.uid()
    and pp.ricevuta_il is null;

  get diagnostics v_aggiornate = row_count;
  if v_aggiornate <> v_righe then
    raise exception 'Consegna non annullabile';
  end if;
end;
$$;

create or replace function public.conferma_gruppo_consegna(p_gruppo uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aggiornate integer;
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;

  update public.pagamento_partecipanti pp
  set ricevuta_il = now()
  where pp.consegna_gruppo_id = p_gruppo
    and pp.profilo_id = auth.uid()
    and pp.ricevuta_il is null
    and pp.consegnata_il is not null;

  get diagnostics v_aggiornate = row_count;
  if v_aggiornate = 0 then
    raise exception 'Nessuna consegna da confermare';
  end if;
  return v_aggiornate;
end;
$$;

create or replace function public.rifiuta_gruppo_consegna(p_gruppo uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aggiornate integer;
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;

  update public.pagamento_partecipanti pp
  set consegnata_il = null,
      consegna_gruppo_id = null
  where pp.consegna_gruppo_id = p_gruppo
    and pp.profilo_id = auth.uid()
    and pp.ricevuta_il is null
    and pp.consegnata_il is not null;

  get diagnostics v_aggiornate = row_count;
  if v_aggiornate = 0 then
    raise exception 'Nessuna consegna da rifiutare';
  end if;
  return v_aggiornate;
end;
$$;

create or replace function public.conferma_quote_ricevute(p_quota_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_gruppo uuid := gen_random_uuid();
  v_aggiornate integer;
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;

  select array_agg(distinct x) into v_ids from unnest(p_quota_ids) as x;
  if v_ids is null or array_length(v_ids, 1) = 0 then
    raise exception 'Nessuna quota selezionata';
  end if;

  perform public._tipo_quote_omogeneo(v_ids);

  if (
    select count(distinct p.incassato_da)
    from public.pagamento_partecipanti pp
    join public.pagamenti p on p.id = pp.pagamento_id
    where pp.id = any(v_ids)
  ) <> 1 then
    raise exception 'Una conferma riguarda un solo pagatore';
  end if;

  update public.pagamento_partecipanti pp
  set ricevuta_il = now(),
      consegna_gruppo_id = v_gruppo
  from public.pagamenti p
  where pp.pagamento_id = p.id
    and pp.id = any(v_ids)
    and pp.profilo_id = auth.uid()
    and p.stato = 'incassato'
    and p.incassato_da is distinct from auth.uid()
    and pp.quota_effettiva > 0
    and pp.ricevuta_il is null
    and pp.consegna_gruppo_id is null;

  get diagnostics v_aggiornate = row_count;
  if v_aggiornate <> array_length(v_ids, 1) then
    raise exception 'Alcune quote non sono disponibili da confermare';
  end if;

  return v_gruppo;
end;
$$;

create or replace function public.annulla_conferma_gruppo(p_gruppo uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aggiornate integer;
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;

  update public.pagamento_partecipanti pp
  set ricevuta_il = null,
      consegna_gruppo_id = case
        when pp.consegnata_il is null then null
        else pp.consegna_gruppo_id
      end
  where pp.consegna_gruppo_id = p_gruppo
    and pp.profilo_id = auth.uid()
    and pp.ricevuta_il is not null;

  get diagnostics v_aggiornate = row_count;
  if v_aggiornate = 0 then
    raise exception 'Nessuna conferma da annullare';
  end if;
  return v_aggiornate;
end;
$$;

create or replace function public.conferma_quota_pagamento(
  p_pagamento_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quota_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;

  update public.pagamento_partecipanti pp
  set ricevuta_il = now()
  from public.pagamenti p
  where pp.pagamento_id = p.id
    and pp.pagamento_id = p_pagamento_id
    and pp.profilo_id = auth.uid()
    and pp.quota_effettiva > 0
    and pp.ricevuta_il is null
    and pp.consegna_gruppo_id is null
    and p.stato = 'incassato'
    and p.incassato_da is distinct from auth.uid()
  returning pp.id into v_quota_id;

  if v_quota_id is null then
    raise exception 'Quota da confermare non disponibile';
  end if;

  return p_pagamento_id;
end;
$$;

create or replace function public.annulla_conferma_quota_pagamento(
  p_pagamento_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quota_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;

  update public.pagamento_partecipanti pp
  set ricevuta_il = null
  from public.pagamenti p
  where pp.pagamento_id = p.id
    and pp.pagamento_id = p_pagamento_id
    and pp.profilo_id = auth.uid()
    and pp.quota_effettiva > 0
    and pp.ricevuta_il is not null
    and pp.consegna_gruppo_id is null
    and p.stato = 'incassato'
    and p.incassato_da is distinct from auth.uid()
  returning pp.id into v_quota_id;

  if v_quota_id is null then
    raise exception 'Conferma da annullare non disponibile';
  end if;

  return p_pagamento_id;
end;
$$;

revoke all on function public.segna_quote_consegnate(uuid[]) from public, anon;
revoke all on function public.annulla_consegna_gruppo(uuid) from public, anon;
revoke all on function public.conferma_gruppo_consegna(uuid) from public, anon;
revoke all on function public.rifiuta_gruppo_consegna(uuid) from public, anon;
revoke all on function public.conferma_quote_ricevute(uuid[]) from public, anon;
revoke all on function public.annulla_conferma_gruppo(uuid) from public, anon;

grant execute on function public.segna_quote_consegnate(uuid[]) to authenticated;
grant execute on function public.annulla_consegna_gruppo(uuid) to authenticated;
grant execute on function public.conferma_gruppo_consegna(uuid) to authenticated;
grant execute on function public.rifiuta_gruppo_consegna(uuid) to authenticated;
grant execute on function public.conferma_quote_ricevute(uuid[]) to authenticated;
grant execute on function public.annulla_conferma_gruppo(uuid) to authenticated;
