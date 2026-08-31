-- supabase/policies.sql

create function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profili
    where id = auth.uid() and ruolo = 'admin'
  );
$$;

alter table public.profili enable row level security;
alter table public.clienti enable row level security;
alter table public.note enable row level security;

-- profili: ognuno legge solo il proprio profilo, l'admin legge tutti
create policy profili_select on public.profili
  for select using (id = auth.uid() or public.is_admin());

-- clienti: select/update/delete filtrati per proprietario o admin
create policy clienti_select on public.clienti
  for select using (venditore_id = auth.uid() or public.is_admin());

create policy clienti_update on public.clienti
  for update using (venditore_id = auth.uid() or public.is_admin());

create policy clienti_delete on public.clienti
  for delete using (venditore_id = auth.uid() or public.is_admin());

-- insert: un venditore puo' creare solo clienti assegnati a se stesso,
-- l'admin puo' assegnarli a chiunque
create policy clienti_insert on public.clienti
  for insert with check (venditore_id = auth.uid() or public.is_admin());

-- note: stessa logica, passando per il cliente collegato
create policy note_select on public.note
  for select using (
    exists (
      select 1 from public.clienti c
      where c.id = note.cliente_id
        and (c.venditore_id = auth.uid() or public.is_admin())
    )
  );

create policy note_insert on public.note
  for insert with check (
    venditore_id = auth.uid()
    and exists (
      select 1 from public.clienti c
      where c.id = note.cliente_id
        and (c.venditore_id = auth.uid() or public.is_admin())
    )
  );
