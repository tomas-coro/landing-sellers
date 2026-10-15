-- Corregge venditori_team_corrente: il team di un venditore senza ruolo economico
-- (Nicola, Nicholas, Selim) tornava vuoto per un NULL nel controllo accesso globale.

begin;

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
      -- coalesce: per chi ha ruolo_economico vuoto (Nicola, Nicholas, Selim) la
      -- condizione valeva NULL e `not accesso_globale` non era mai vero,
      -- lasciando il team vuoto e nascondendo i clienti del venditore.
      coalesce(p.ruolo = 'developer' or p.ruolo_economico = 'referente', false) as accesso_globale
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
  ),
  visibili as (
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
  )
  select visibili.id, visibili.nome, visibili.livello
  from visibili
  order by case visibili.id
    when '6abedc44-a330-42a2-bc90-b90fae133b37'::uuid then 1
    when 'dc0449f5-506c-45aa-a90c-0cd3409e743d'::uuid then 2
    when 'e0219b06-e086-4e3f-a002-c76c4e399b23'::uuid then 3
    when 'c73d3908-5bbe-4a76-b4d3-89ceeead6edf'::uuid then 4
    when '1c7e4a4a-3043-4126-a924-238dfdeca8c6'::uuid then 5
    else 6
  end, visibili.nome;
$$;

commit;
