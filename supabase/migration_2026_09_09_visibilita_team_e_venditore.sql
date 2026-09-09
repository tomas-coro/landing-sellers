-- Referente e produzione vedono tutti i clienti; gli altri venditori
-- vedono i clienti assegnati o collegati alle proprie vendite.

drop policy if exists clienti_select on public.clienti;

create policy clienti_select on public.clienti
for select using (
  venditore_id = auth.uid()
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
    where v.cliente_id = clienti.id
      and v.venditore_id = auth.uid()
  )
);
