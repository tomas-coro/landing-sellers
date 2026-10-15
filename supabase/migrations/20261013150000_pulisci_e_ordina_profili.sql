-- Mantiene nell'app solo i cinque profili operativi concordati, corregge i
-- nomi mostrati e riallinea a chi ha venduto i clienti creati da Tomas.

begin;

update public.profili
set nome = case id
  when '6abedc44-a330-42a2-bc90-b90fae133b37'::uuid then 'Tomas'
  when 'dc0449f5-506c-45aa-a90c-0cd3409e743d'::uuid then 'Alessandro'
  when 'e0219b06-e086-4e3f-a002-c76c4e399b23'::uuid then 'Nicola'
  when 'c73d3908-5bbe-4a76-b4d3-89ceeead6edf'::uuid then 'Nicholas Cerma'
  when '1c7e4a4a-3043-4126-a924-238dfdeca8c6'::uuid then 'Selim'
end
where id in (
  '6abedc44-a330-42a2-bc90-b90fae133b37'::uuid,
  'dc0449f5-506c-45aa-a90c-0cd3409e743d'::uuid,
  'e0219b06-e086-4e3f-a002-c76c4e399b23'::uuid,
  'c73d3908-5bbe-4a76-b4d3-89ceeead6edf'::uuid,
  '1c7e4a4a-3043-4126-a924-238dfdeca8c6'::uuid
);

update public.clienti c
set venditore_id = v.venditore_id
from public.vendite v
where c.venditore_id = '6abedc44-a330-42a2-bc90-b90fae133b37'::uuid
  and v.cliente_id = c.id
  and v.stato = 'attiva'
  and v.venditore_id <> c.venditore_id;

-- Elimina anche i due clienti QA gia nel cestino; le relative note, vendite e
-- rate di test vengono rimosse dalle foreign key con on delete cascade.
delete from public.clienti
where id in (
  'd9b1f20a-774b-4c21-b023-9ac4a63ec4bb'::uuid,
  'b235c3ac-dde4-4e49-8043-d10b934c7d92'::uuid
);

-- Account tecnici creati durante i test.
-- L'account admin info@landingevolution.it resta attivo ma non compare tra i venditori.
delete from auth.users u
where u.id in (
  'a1eab3a9-8811-4e65-91e0-29b007a3ae40'::uuid,
  'd997d748-1cd2-4b4b-ab8e-fb70fa79e0cd'::uuid,
  '13609504-65ce-4948-aded-e06497f4bb3f'::uuid
)
and not exists (
  select 1
  from public.profili p
  where p.id = u.id
    and p.ruolo = 'admin'
);

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
