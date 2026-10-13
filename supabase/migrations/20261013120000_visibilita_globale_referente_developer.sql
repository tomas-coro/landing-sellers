-- Alessandro (referente) e Tomas (developer) vedono e filtrano tutti i
-- venditori. Gli altri ricevono soltanto il proprio sotto-albero commerciale.

create or replace function public.venditori_team_corrente()
returns table (id uuid, nome text, livello integer)
language sql
security definer
set search_path = public
stable
as $$
  with recursive utente as (
    select
      p.id,
      p.ruolo = 'developer' or p.ruolo_economico = 'referente' as accesso_globale
    from public.profili p
    where p.id = auth.uid()
  ),
  team as (
    select p.id, p.nome, 0 as livello, array[p.id] as percorso
    from public.profili p
    where p.id = auth.uid()

    union all

    select p.id, p.nome, team.livello + 1, team.percorso || p.id
    from public.profili p
    join team on p.responsabile_id = team.id
    where not p.id = any(team.percorso)
  )
  select
    p.id,
    p.nome,
    case when p.id = auth.uid() then 0 else 1 end as livello
  from public.profili p
  cross join utente
  where utente.accesso_globale
    and p.ruolo in ('venditore', 'developer')

  union all

  select team.id, team.nome, team.livello
  from team
  cross join utente
  where not utente.accesso_globale

  order by livello, nome;
$$;
