-- Traccia chi ha materialmente incassato dal cliente e le conferme delle
-- quote trasferite agli altri partecipanti economici.

alter table public.pagamento_partecipanti
  add column if not exists ricevuta_il timestamptz;

comment on column public.pagamento_partecipanti.ricevuta_il is
  'Conferma del destinatario di aver ricevuto la propria quota. Chi ha incassato non deve confermare.';

-- Lo storico precedente alla funzione è considerato già regolato, per non
-- trasformare tutti i vecchi incassi in promemoria arretrati.
update public.pagamento_partecipanti pp
set ricevuta_il = coalesce(p.data_pagamento::timestamptz, p.creato_il)
from public.pagamenti p
where p.id = pp.pagamento_id
  and p.stato = 'incassato'
  and pp.ricevuta_il is null;

-- Tarantella è il primo incasso da seguire col nuovo flusso: il venditore
-- terzo ha incassato e Tomas/Alessandro devono confermare le loro quote.
update public.pagamenti p
set incassato_da = vp.profilo_id
from public.vendite v
join public.clienti c on c.id = v.cliente_id
join public.vendita_partecipanti vp
  on vp.vendita_id = v.id
 and vp.ruolo = 'venditore'
where p.vendita_id = v.id
  and p.stato = 'incassato'
  and lower(c.nome) like '%tarantella%';

update public.pagamento_partecipanti pp
set ricevuta_il = null
from public.pagamenti p
join public.vendite v on v.id = p.vendita_id
join public.clienti c on c.id = v.cliente_id
where pp.pagamento_id = p.id
  and p.stato = 'incassato'
  and lower(c.nome) like '%tarantella%'
  and pp.profilo_id is distinct from p.incassato_da
  and pp.quota_effettiva > 0;

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
end;
$$;

revoke all on function public._imposta_incassato_pagamento(uuid, uuid)
from public, anon, authenticated;

create or replace function public.registra_pagamento_con_trasferimenti(
  p_vendita_id uuid,
  p_importo numeric,
  p_data_pagamento date default null,
  p_metodo text default null,
  p_note text default null,
  p_pagamento_previsto_id uuid default null,
  p_calcolo jsonb default '{}'::jsonb,
  p_partecipanti jsonb default '[]'::jsonb,
  p_incassato_da uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pagamento_id uuid;
begin
  v_pagamento_id := public.registra_pagamento_economico(
    p_vendita_id, p_importo, p_data_pagamento, p_metodo, p_note,
    p_pagamento_previsto_id, p_calcolo, p_partecipanti
  );

  perform public._imposta_incassato_pagamento(
    v_pagamento_id,
    p_incassato_da
  );

  return v_pagamento_id;
end;
$$;

revoke all on function public.registra_pagamento_con_trasferimenti(
  uuid, numeric, date, text, text, uuid, jsonb, jsonb, uuid
) from public, anon;

grant execute on function public.registra_pagamento_con_trasferimenti(
  uuid, numeric, date, text, text, uuid, jsonb, jsonb, uuid
) to authenticated;

create or replace function public.modifica_pagamento_con_trasferimenti(
  p_pagamento_id uuid,
  p_importo numeric,
  p_data_pagamento date default null,
  p_metodo text default null,
  p_note text default null,
  p_calcolo jsonb default '{}'::jsonb,
  p_partecipanti jsonb default '[]'::jsonb,
  p_incassato_da uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.modifica_pagamento_economico(
    p_pagamento_id, p_importo, p_data_pagamento, p_metodo, p_note,
    p_calcolo, p_partecipanti
  );

  perform public._imposta_incassato_pagamento(
    p_pagamento_id,
    p_incassato_da
  );

  return p_pagamento_id;
end;
$$;

revoke all on function public.modifica_pagamento_con_trasferimenti(
  uuid, numeric, date, text, text, jsonb, jsonb, uuid
) from public, anon;

grant execute on function public.modifica_pagamento_con_trasferimenti(
  uuid, numeric, date, text, text, jsonb, jsonb, uuid
) to authenticated;

create or replace function public.registra_vendita_con_trasferimenti(
  p_vendita jsonb,
  p_configurazione jsonb default '{}'::jsonb,
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
  v_vendita_id uuid;
  v_pagamento_id uuid;
begin
  v_vendita_id := public.registra_vendita_completa(
    p_vendita, p_configurazione, p_costi, p_partecipanti, p_pagamento
  );

  if p_pagamento is not null then
    select p.id
    into v_pagamento_id
    from public.pagamenti p
    where p.vendita_id = v_vendita_id
      and p.stato = 'incassato'
    order by p.creato_il desc
    limit 1;

    perform public._imposta_incassato_pagamento(
      v_pagamento_id,
      nullif(p_pagamento ->> 'incassato_da', '')::uuid
    );
  end if;

  return v_vendita_id;
end;
$$;

revoke all on function public.registra_vendita_con_trasferimenti(
  jsonb, jsonb, jsonb, jsonb, jsonb
) from public, anon;

grant execute on function public.registra_vendita_con_trasferimenti(
  jsonb, jsonb, jsonb, jsonb, jsonb
) to authenticated;

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
    and p.stato = 'incassato'
    and p.incassato_da is distinct from auth.uid()
  returning pp.id into v_quota_id;

  if v_quota_id is null then
    raise exception 'Quota da confermare non disponibile';
  end if;

  return p_pagamento_id;
end;
$$;

revoke all on function public.conferma_quota_pagamento(uuid)
from public, anon;

grant execute on function public.conferma_quota_pagamento(uuid)
to authenticated;
