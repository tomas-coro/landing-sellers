-- Landing Sellers
-- Cambio stato cliente tramite RPC con permessi CRM operativi.
-- Non amplia UPDATE generico su public.clienti.

create or replace function public.imposta_stato_cliente(
  p_cliente_id uuid,
  p_stato text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;

  if p_stato is null or p_stato not in (
    'contattato',
    'brief_mandato',
    'in_lavorazione',
    'pubblicato'
  ) then
    raise exception 'Stato non valido';
  end if;

  if not exists (
    select 1
    from public.clienti c
    where c.id = p_cliente_id
      and (
        c.venditore_id = auth.uid()
        or public.is_admin()
        or exists (
          select 1
          from public.profili p
          where p.id = auth.uid()
            and p.ruolo_economico in ('referente', 'produzione')
        )
        or exists (
          select 1
          from public.vendite v
          where v.cliente_id = c.id
            and v.venditore_id = auth.uid()
        )
      )
  ) then
    raise exception 'Cliente non accessibile';
  end if;

  update public.clienti
  set stato = p_stato
  where id = p_cliente_id;
end;
$$;

revoke all
on function public.imposta_stato_cliente(uuid, text)
from public, anon;

grant execute
on function public.imposta_stato_cliente(uuid, text)
to authenticated;
