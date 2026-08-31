-- supabase/test_rls.sql
-- Test di isolamento: simula venditore A, venditore B e admin loggati,
-- verifica che ognuno veda/modifichi solo cio' che deve.

begin;

-- Simula il venditore A loggato
select set_config('request.jwt.claims',
  json_build_object('sub', 'VENDITORE_A_ID')::text, true);
set local role authenticated;

insert into public.clienti (venditore_id, nome)
values ('VENDITORE_A_ID', 'Cliente di A');

-- Deve restituire 1 riga (solo il proprio cliente)
select count(*) as deve_essere_1 from public.clienti;

commit;

begin;

-- Simula il venditore B: non deve vedere il cliente di A
select set_config('request.jwt.claims',
  json_build_object('sub', 'VENDITORE_B_ID')::text, true);
set local role authenticated;

select count(*) as deve_essere_0 from public.clienti
where nome = 'Cliente di A';

-- Venditore B prova a inserire un cliente assegnato a A: deve fallire
-- (atteso: ERROR new row violates row-level security policy)
insert into public.clienti (venditore_id, nome)
values ('VENDITORE_A_ID', 'Cliente rubato');

rollback;

begin;

-- Simula l'admin: deve vedere tutto
select set_config('request.jwt.claims',
  json_build_object('sub', 'ADMIN_ID')::text, true);
set local role authenticated;

select count(*) as deve_essere_maggiore_di_0 from public.clienti;

commit;

-- pulizia dato di test creato dal venditore A (fuori da qualunque simulazione,
-- eseguito come service role/postgres, che bypassa RLS)
delete from public.clienti where nome = 'Cliente di A';
