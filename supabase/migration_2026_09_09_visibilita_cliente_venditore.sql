-- Il venditore commerciale vede la scheda dei clienti delle proprie vendite.

drop policy if exists clienti_select on public.clienti;

create policy clienti_select on public.clienti
for select using (
  venditore_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1
    from public.vendite v
    where v.cliente_id = clienti.id
      and v.venditore_id = auth.uid()
  )
);

drop policy if exists note_select on public.note;

create policy note_select on public.note
for select using (
  exists (
    select 1
    from public.clienti c
    where c.id = note.cliente_id
  )
);
