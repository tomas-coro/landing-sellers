-- supabase/test_push_devices.sql
-- Test della RPC register_push_device: verifica che risolva la collisione
-- token tra utenti diversi sullo stesso dispositivo senza mai fidarsi di
-- un user_id passato dal client. Da eseguire manualmente nell'SQL Editor
-- di Supabase DOPO aver applicato migration_2026_09_02_push_devices.sql
-- (mai su produzione senza controllare prima cosa c'e' gia' in tabella).
--
-- Stesso pattern di simulazione usato in test_rls.sql: set_config sul
-- claim JWT 'sub' + set local role authenticated, cosi' auth.uid() dentro
-- la RPC vede l'utente "loggato" di ogni blocco.
--
-- IMPORTANTE prima di eseguire:
-- 1) 'VENDITORE_A_ID' e 'VENDITORE_B_ID' NON sono UUID validi cosi' come
--    scritti: sostituiscili con gli UUID di due righe REALI e diverse di
--    auth.users (auth.uid() castiga il claim 'sub' a uuid, e push_devices
--    ha una FK verso auth.users, quindi con id inventati falliscono sia il
--    cast sia l'insert).
-- 2) Esegui i blocchi UNO ALLA VOLTA (non incollare tutto il file insieme):
--    il blocco 6 solleva un'eccezione di proposito (ERROR not
--    authenticated) per verificare il rifiuto della chiamata non
--    autenticata; se lo esegui insieme al resto in un client che interrompe
--    lo script al primo errore, la DELETE di pulizia in fondo non parte.

begin;

-- 1) Utente A registra il token X -> successo, riga creata per A.
select set_config('request.jwt.claims',
  json_build_object('sub', 'VENDITORE_A_ID')::text, true);
set local role authenticated;

select public.register_push_device('TOKEN_X', 'ios');

-- Deve restituire 1 riga, user_id = VENDITORE_A_ID, active = true
select user_id, platform, active from public.push_devices where token = 'TOKEN_X';

commit;

begin;

-- 2) A registra di nuovo lo stesso token -> nessun duplicato (idempotenza),
-- resta la stessa riga, solo i timestamp e active vengono aggiornati.
select set_config('request.jwt.claims',
  json_build_object('sub', 'VENDITORE_A_ID')::text, true);
set local role authenticated;

select public.register_push_device('TOKEN_X', 'ios');

-- Deve restituire 1 (una sola riga per il token, non due)
select count(*) as deve_essere_1 from public.push_devices where token = 'TOKEN_X';

commit;

begin;

-- 3) A fa logout: disattiva i propri dispositivi (update diretto, non RPC,
-- coerente con fareLogout() in app.js).
select set_config('request.jwt.claims',
  json_build_object('sub', 'VENDITORE_A_ID')::text, true);
set local role authenticated;

update public.push_devices set active = false, updated_at = now()
where user_id = 'VENDITORE_A_ID'::uuid;

-- Deve risultare false
select active as deve_essere_false from public.push_devices where token = 'TOKEN_X';

commit;

begin;

-- 4) Utente B, stesso dispositivo: APNs/FCM restituisce di nuovo TOKEN_X.
-- Con l'upsert diretto pre-fix questo falliva silenziosamente (RLS negava
-- l'update sulla riga di A). Con la RPC deve riuscire: il token passa a B.
select set_config('request.jwt.claims',
  json_build_object('sub', 'VENDITORE_B_ID')::text, true);
set local role authenticated;

select public.register_push_device('TOKEN_X', 'ios');

-- Deve restituire 1 riga, user_id = VENDITORE_B_ID, active = true
select user_id, active from public.push_devices where token = 'TOKEN_X';

commit;

begin;

-- 5) B registra di nuovo lo stesso token -> ancora nessun duplicato.
select set_config('request.jwt.claims',
  json_build_object('sub', 'VENDITORE_B_ID')::text, true);
set local role authenticated;

select public.register_push_device('TOKEN_X', 'ios');

select count(*) as deve_essere_1 from public.push_devices where token = 'TOKEN_X';

commit;

begin;

-- 6) Nessun utente autenticato (claim JWT assente): la RPC deve rifiutare
-- la chiamata (atteso: ERROR not authenticated).
select set_config('request.jwt.claims', '{}', true);
set local role authenticated;

select public.register_push_device('TOKEN_Y', 'ios');

rollback;

-- 7) La RPC non accetta user_id: la sua firma è (p_token text, p_platform
-- text), quindi non esiste alcuna chiamata che permetta a un utente di
-- indicare arbitrariamente un altro user_id. Verifica "a occhio" sulla
-- definizione della funzione (deve fallire per numero/nome di argomenti
-- sbagliato, non per un problema di permessi):
-- select public.register_push_device('TOKEN_Z', 'ios', 'VENDITORE_A_ID');
-- atteso: ERROR function public.register_push_device(text, text, text)
-- does not exist. Nessuna riga viene toccata.

-- pulizia dati di test (fuori da qualunque simulazione, come postgres/service
-- role, che bypassa RLS)
delete from public.push_devices where token in ('TOKEN_X', 'TOKEN_Y');
