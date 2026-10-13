-- Gerarchia commerciale: ogni venditore puo' consultare i clienti propri e
-- dei venditori sotto di lui. Le modifiche restano regolate dai permessi CRM
-- esistenti; questa migration amplia solo la lettura.

begin;

alter table public.profili
  add column if not exists responsabile_id uuid
  references public.profili(id) on delete set null;

alter table public.profili
  drop constraint if exists profili_responsabile_diverso_check;

alter table public.profili
  add constraint profili_responsabile_diverso_check
  check (responsabile_id is null or responsabile_id <> id);

create index if not exists profili_responsabile_id_idx
  on public.profili(responsabile_id);

-- Struttura attuale: Alessandro > Nicola, Nicholas > Selim.
update public.profili p
set responsabile_id = 'dc0449f5-506c-45aa-a90c-0cd3409e743d'::uuid
from auth.users u
where u.id = p.id
  and lower(u.email) in (
    'nicola.paolonimb@gmail.com',
    'cermanicholas@gmail.com'
  );

update public.profili p
set responsabile_id = nicholas.id
from auth.users u,
  lateral (
    select nu.id
    from auth.users nu
    where lower(nu.email) = 'cermanicholas@gmail.com'
    limit 1
  ) nicholas
where u.id = p.id
  and lower(u.email) = 'selimmehadzic2002@gmail.com';

create or replace function public.venditori_team_corrente()
returns table (id uuid, nome text, livello integer)
language sql
security definer
set search_path = public
stable
as $$
  with recursive team as (
    select p.id, p.nome, 0 as livello, array[p.id] as percorso
    from public.profili p
    where p.id = auth.uid()

    union all

    select p.id, p.nome, team.livello + 1, team.percorso || p.id
    from public.profili p
    join team on p.responsabile_id = team.id
    where not p.id = any(team.percorso)
  )
  select team.id, team.nome, team.livello
  from team
  order by team.livello, team.nome;
$$;

revoke all on function public.venditori_team_corrente() from public, anon;
grant execute on function public.venditori_team_corrente() to authenticated;

create or replace function public.venditore_nel_team_corrente(p_venditore_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.venditori_team_corrente() team
    where team.id = p_venditore_id
  );
$$;

revoke all on function public.venditore_nel_team_corrente(uuid) from public, anon;
grant execute on function public.venditore_nel_team_corrente(uuid) to authenticated;

drop policy if exists clienti_select on public.clienti;
create policy clienti_select on public.clienti
for select using (
  public.venditore_nel_team_corrente(venditore_id)
  or public.is_admin()
  or exists (
    select 1 from public.profili p
    where p.id = auth.uid()
      and p.ruolo_economico in ('referente', 'produzione')
  )
  or exists (
    select 1 from public.vendite v
    where v.cliente_id = clienti.id
      and v.venditore_id = auth.uid()
  )
);

drop policy if exists vendite_select on public.vendite;
create policy vendite_select on public.vendite
for select using (
  public.venditore_nel_team_corrente(venditore_id)
  or creato_da = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.profili p
    where p.id = auth.uid()
      and p.ruolo_economico in ('referente', 'produzione')
  )
);

drop policy if exists pagamenti_select on public.pagamenti;
create policy pagamenti_select on public.pagamenti
for select using (
  exists (
    select 1 from public.vendite v
    where v.id = pagamenti.vendita_id
      and (
        public.venditore_nel_team_corrente(v.venditore_id)
        or v.creato_da = auth.uid()
        or public.is_admin()
      )
  )
  or exists (
    select 1 from public.profili p
    where p.id = auth.uid()
      and p.ruolo_economico in ('referente', 'produzione')
  )
);

drop policy if exists vendita_partecipanti_select on public.vendita_partecipanti;
create policy vendita_partecipanti_select on public.vendita_partecipanti
for select using (
  profilo_id = auth.uid()
  or exists (
    select 1 from public.vendite v
    where v.id = vendita_partecipanti.vendita_id
      and (
        public.venditore_nel_team_corrente(v.venditore_id)
        or v.creato_da = auth.uid()
        or public.is_admin()
      )
  )
  or exists (
    select 1 from public.profili p
    where p.id = auth.uid()
      and p.ruolo_economico in ('referente', 'produzione')
  )
);

drop policy if exists note_select on public.note;
create policy note_select on public.note
for select using (
  exists (
    select 1 from public.clienti c
    where c.id = note.cliente_id
      and (
        public.venditore_nel_team_corrente(c.venditore_id)
        or public.is_admin()
        or exists (
          select 1 from public.profili p
          where p.id = auth.uid()
            and p.ruolo_economico in ('referente', 'produzione')
        )
        or exists (
          select 1 from public.vendite v
          where v.cliente_id = c.id
            and v.venditore_id = auth.uid()
        )
      )
  )
);

drop policy if exists attivita_clienti_select on public.attivita_clienti;
create policy attivita_clienti_select on public.attivita_clienti
for select using (
  exists (
    select 1 from public.clienti c
    where c.id = attivita_clienti.cliente_id
      and (
        public.venditore_nel_team_corrente(c.venditore_id)
        or public.is_admin()
        or exists (
          select 1 from public.profili p
          where p.id = auth.uid()
            and p.ruolo_economico in ('referente', 'produzione')
        )
        or exists (
          select 1 from public.vendite v
          where v.cliente_id = c.id
            and v.venditore_id = auth.uid()
        )
      )
  )
);

commit;
