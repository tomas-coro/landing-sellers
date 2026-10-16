-- Completa il passaggio a data+ora anche per l'azione "Fatto" e applica lo
-- stesso perimetro del salvataggio: soltanto il venditore diretto.

drop function if exists public.completa_contatto_cliente(uuid, date);
drop function if exists public.completa_contatto_cliente(uuid, timestamptz);

create function public.completa_contatto_cliente(
  p_cliente_id uuid,
  p_data timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data timestamptz;
begin
  select c.prossimo_contatto
  into v_data
  from public.clienti c
  join public.profili p on p.id = auth.uid()
  where c.id = p_cliente_id
    and c.venditore_id = auth.uid()
    and p.ruolo not in ('admin', 'developer')
    and coalesce(p.ruolo_economico, '') <> 'produzione';

  if not found then
    raise exception 'Ricontatto non consentito';
  end if;

  if v_data is null then
    raise exception 'Nessun prossimo contatto da completare';
  end if;

  if p_data is not null and v_data is distinct from p_data then
    raise exception 'Il prossimo contatto è stato modificato';
  end if;

  insert into public.attivita_clienti (
    cliente_id,
    attore_id,
    tipo,
    valore_precedente,
    valore_nuovo
  ) values (
    p_cliente_id,
    auth.uid(),
    'contatto_completato',
    v_data::text,
    'completato'
  );

  perform set_config('landing_sellers.contatto_completato', '1', true);

  update public.clienti
  set prossimo_contatto = null
  where id = p_cliente_id;
end;
$$;

revoke all
on function public.completa_contatto_cliente(uuid, timestamptz)
from public, anon;

grant execute
on function public.completa_contatto_cliente(uuid, timestamptz)
to authenticated;
