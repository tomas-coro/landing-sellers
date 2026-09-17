-- Landing Sellers
-- Più vendite attive per cliente + snapshot configurazione commerciale.
--
-- Non modifica né cancella i campi legacy presenti su clienti.
-- Le nuove vendite salvano la propria configurazione commerciale.

drop index if exists public.vendite_unica_attiva_cliente_idx;

alter table public.vendite
  add column if not exists configurazione_commerciale jsonb
  not null default '{}'::jsonb;

comment on column public.vendite.configurazione_commerciale is
  'Snapshot della configurazione commerciale della singola vendita: formula, extra, durata, sconti, dominio, sicurezza, rinnovi e altre condizioni concordate.';

create or replace function public.registra_vendita_completa(
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
begin
  if jsonb_typeof(coalesce(p_configurazione, '{}'::jsonb)) <> 'object' then
    raise exception 'Configurazione commerciale non valida';
  end if;

  v_vendita_id := public.registra_vendita_economica(
    p_vendita,
    p_costi,
    p_partecipanti,
    p_pagamento
  );

  update public.vendite
  set configurazione_commerciale =
        coalesce(p_configurazione, '{}'::jsonb)
  where id = v_vendita_id;

  return v_vendita_id;
end;
$$;

revoke all on function public.registra_vendita_completa(
  jsonb, jsonb, jsonb, jsonb, jsonb
) from public, anon;

grant execute on function public.registra_vendita_completa(
  jsonb, jsonb, jsonb, jsonb, jsonb
) to authenticated;
