-- Landing Sellers
-- Allinea i permessi CRM operativi alla visibilità corrente dei clienti.
-- Non amplia genericamente UPDATE su public.clienti.

-- ============================================================
-- NOTE
-- ============================================================

drop policy if exists note_select on public.note;

create policy note_select
on public.note
for select
using (
  exists (
    select 1
    from public.clienti c
    where c.id = note.cliente_id
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
  )
);

drop policy if exists note_insert on public.note;

create policy note_insert
on public.note
for insert
with check (
  venditore_id = auth.uid()
  and exists (
    select 1
    from public.clienti c
    where c.id = note.cliente_id
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
  )
);


-- ============================================================
-- PROSSIMO CONTATTO
-- ============================================================
-- Funzione limitata al solo campo prossimo_contatto.
-- Evitiamo di ampliare UPDATE sull'intera anagrafica cliente.

create or replace function public.imposta_prossimo_contatto_cliente(
  p_cliente_id uuid,
  p_data date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
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
  set prossimo_contatto = p_data
  where id = p_cliente_id;
end;
$$;

revoke all
on function public.imposta_prossimo_contatto_cliente(uuid, date)
from public, anon;

grant execute
on function public.imposta_prossimo_contatto_cliente(uuid, date)
to authenticated;
