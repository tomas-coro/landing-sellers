-- Landing Sellers
-- Soft-delete e ripristino clienti con permessi CRM operativi.
-- Non amplia UPDATE generico su public.clienti.

create or replace function public.sposta_cliente_nel_cestino(
  p_cliente_id uuid
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
  set cancellato_il = now()
  where id = p_cliente_id
    and cancellato_il is null;
end;
$$;

revoke all
on function public.sposta_cliente_nel_cestino(uuid)
from public, anon;

grant execute
on function public.sposta_cliente_nel_cestino(uuid)
to authenticated;


create or replace function public.ripristina_cliente_dal_cestino(
  p_cliente_id uuid
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
  set cancellato_il = null
  where id = p_cliente_id
    and cancellato_il is not null;
end;
$$;

revoke all
on function public.ripristina_cliente_dal_cestino(uuid)
from public, anon;

grant execute
on function public.ripristina_cliente_dal_cestino(uuid)
to authenticated;
