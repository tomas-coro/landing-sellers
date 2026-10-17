-- I codici venditore sono Nome + progressivo globale. I numeri non vengono
-- riutilizzati; Alessandro e Tomas mantengono i due codici aziendali riservati.

begin;

alter table public.profili
  alter column codice_referente drop expression;

update public.profili
set codice_referente = case id
  when 'e0219b06-e086-4e3f-a002-c76c4e399b23'::uuid then 'Nicola001'
  when 'c73d3908-5bbe-4a76-b4d3-89ceeead6edf'::uuid then 'Nicholas002'
  when '1c7e4a4a-3043-4126-a924-238dfdeca8c6'::uuid then 'Selim003'
  when 'dc0449f5-506c-45aa-a90c-0cd3409e743d'::uuid then 'LandingTop000'
  when '6abedc44-a330-42a2-bc90-b90fae133b37'::uuid then 'LandingDev000'
end
where id in (
  'e0219b06-e086-4e3f-a002-c76c4e399b23'::uuid,
  'c73d3908-5bbe-4a76-b4d3-89ceeead6edf'::uuid,
  '1c7e4a4a-3043-4126-a924-238dfdeca8c6'::uuid,
  'dc0449f5-506c-45aa-a90c-0cd3409e743d'::uuid,
  '6abedc44-a330-42a2-bc90-b90fae133b37'::uuid
);

-- Copre eventuali profili tecnici gia' presenti senza alterare la sequenza
-- concordata Nicola/Nicholas/Selim.
with altri as (
  select
    id,
    regexp_replace(split_part(btrim(nome), ' ', 1), '[^[:alnum:]]', '', 'g')
      || lpad((row_number() over (order by nome, id) + 3)::text, 3, '0') as codice
  from public.profili
  where id not in (
    'e0219b06-e086-4e3f-a002-c76c4e399b23'::uuid,
    'c73d3908-5bbe-4a76-b4d3-89ceeead6edf'::uuid,
    '1c7e4a4a-3043-4126-a924-238dfdeca8c6'::uuid,
    'dc0449f5-506c-45aa-a90c-0cd3409e743d'::uuid,
    '6abedc44-a330-42a2-bc90-b90fae133b37'::uuid
  )
)
update public.profili p
set codice_referente = altri.codice
from altri
where p.id = altri.id;

create sequence public.codice_referente_seq;

select setval(
  'public.codice_referente_seq',
  greatest(
    3,
    coalesce(
      (select max(substring(codice_referente from '([0-9]+)$')::bigint)
       from public.profili),
      3
    )
  ),
  true
);

create or replace function public.assegna_codice_referente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_numero bigint;
  v_nome text;
begin
  if new.id = 'dc0449f5-506c-45aa-a90c-0cd3409e743d'::uuid then
    new.codice_referente := 'LandingTop000';
  elsif new.id = '6abedc44-a330-42a2-bc90-b90fae133b37'::uuid then
    new.codice_referente := 'LandingDev000';
  elsif tg_op = 'INSERT' then
    v_numero := nextval('public.codice_referente_seq');
    v_nome := regexp_replace(split_part(btrim(new.nome), ' ', 1), '[^[:alnum:]]', '', 'g');
    new.codice_referente := coalesce(nullif(v_nome, ''), 'Venditore')
      || lpad(v_numero::text, greatest(3, length(v_numero::text)), '0');
  else
    new.codice_referente := old.codice_referente;
  end if;
  return new;
end;
$$;

create trigger trg_assegna_codice_referente
  before insert or update of codice_referente on public.profili
  for each row execute function public.assegna_codice_referente();

alter table public.profili
  alter column codice_referente set not null;

commit;
