-- supabase/test_web_push.sql
-- SOLO TEST: nessuna modifica permanente.
--
-- v3: questa dashboard non mostra un pannello "Messages" separato (solo
-- "Results"), quindi i RAISE NOTICE delle versioni precedenti erano
-- invisibili. Qui ogni check scrive la sua riga in una variabile testo
-- (v_report) invece che con RAISE NOTICE, e alla fine il blocco fa
-- "raise exception" passando l'INTERO report come messaggio d'errore:
-- il testo dell'errore SI VEDE per intero nel pannello Results (l'abbiamo
-- gia' verificato con l'esecuzione precedente). Quell'errore rosso finale
-- e' voluto ed e' anche il meccanismo di pulizia: non essendo catturato,
-- annulla tutto cio' che il blocco ha scritto (i due utenti finti in
-- auth.users e le subscription di test), senza bisogno di alcun commit.
--
-- Tutto il file resta UN SOLO statement (un blocco "do $$ ... $$"), quindi
-- non dipende da come questa dashboard smista statement multipli sul pool
-- di connessioni.
--
-- Ogni check e' un "begin ... exception when others ... end" annidato
-- (savepoint implicito di plpgsql): un check che fallisce non blocca gli
-- altri, aggiunge solo una riga FAIL al report.
--
-- Dati di test: utenti A/B con UUID ripetuti (111...1 / 222...2) ed email
-- @invalid.test (TLD riservato, non instrada mai email reali), endpoint
-- "https://webpush-test.invalid/...". Nulla che assomigli a un utente vero.
--
-- ATTENZIONE (unico punto che non posso verificare da qui): l'inserimento
-- diretto in auth.users e' necessario per il vincolo FK user_id ->
-- auth.users(id) e per simulare due utenti autenticati senza un signup
-- pubblico. Se questo progetto ha un trigger su auth.users che manda una
-- email/webhook reale alla creazione di un utente, scatterebbe comunque
-- durante il test, prima del rollback: le sue scritture nel DB vengono
-- annullate, un eventuale effetto esterno no. Se sai che esiste un
-- trigger del genere, dimmelo prima di lanciare lo script.

do $$
declare
  v_report text := '';
  v_setup_ok boolean := false;
  v_original_role text := current_user::text;
  v_exists boolean;
  v_extra int;
  v_missing int;
  v_idx1 boolean;
  v_idx2 boolean;
  v_rls boolean;
  v_sel boolean;
  v_upd boolean;
  v_del boolean;
  v_cnt int;
  v_secdef boolean;
  v_conf text[];
  v_anon boolean;
  v_auth boolean;
  v_public boolean;
  v_args text;
  v_row public.web_push_subscriptions;
  v_active_ep1 boolean;
  v_active_ep2 boolean;
  v_user_id uuid;
  v_active boolean;
  v_sel_cnt int;
  v_upd_cnt int;
  v_del_cnt int;
begin
  v_report := v_report || '=== TEST WEB PUSH (ruolo di connessione: ' || v_original_role || ') ===' || E'\n';

  -- =====================================================================
  -- PARTE A - check statici su schema / RLS / policy / grant (1-14)
  -- =====================================================================

  begin
    select exists(
      select 1 from information_schema.tables
      where table_schema='public' and table_name='web_push_subscriptions'
    ) into v_exists;
    if v_exists then v_report := v_report || '1) PASS: tabella public.web_push_subscriptions esiste' || E'\n';
    else v_report := v_report || '1) FAIL: tabella non trovata' || E'\n'; end if;
  exception when others then v_report := v_report || '1) FAIL: errore - ' || sqlerrm || E'\n';
  end;

  begin
    select count(*) into v_extra from (
      select column_name, data_type from information_schema.columns
      where table_schema='public' and table_name='web_push_subscriptions'
      except
      select * from (values
        ('id','uuid'),('user_id','uuid'),('endpoint','text'),('p256dh','text'),
        ('auth','text'),('created_at','timestamp with time zone'),
        ('updated_at','timestamp with time zone'),('last_seen_at','timestamp with time zone'),
        ('active','boolean')
      ) as expected(column_name, data_type)
    ) s;
    select count(*) into v_missing from (
      select * from (values
        ('id','uuid'),('user_id','uuid'),('endpoint','text'),('p256dh','text'),
        ('auth','text'),('created_at','timestamp with time zone'),
        ('updated_at','timestamp with time zone'),('last_seen_at','timestamp with time zone'),
        ('active','boolean')
      ) as expected(column_name, data_type)
      except
      select column_name, data_type from information_schema.columns
      where table_schema='public' and table_name='web_push_subscriptions'
    ) s;
    if v_extra = 0 and v_missing = 0 then
      v_report := v_report || '2) PASS: colonne e tipi corrispondono allo schema atteso' || E'\n';
    else
      v_report := v_report || '2) FAIL: differenze - non attese/diverse: ' || v_extra::text || ', mancanti: ' || v_missing::text || E'\n';
    end if;
  exception when others then v_report := v_report || '2) FAIL: errore - ' || sqlerrm || E'\n';
  end;

  begin
    select exists (
      select 1 from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
      where tc.table_schema='public' and tc.table_name='web_push_subscriptions'
        and tc.constraint_type='UNIQUE' and kcu.column_name='endpoint'
    ) into v_exists;
    if v_exists then v_report := v_report || '3) PASS: endpoint ha vincolo UNIQUE' || E'\n';
    else v_report := v_report || '3) FAIL: nessun vincolo UNIQUE su endpoint' || E'\n'; end if;
  exception when others then v_report := v_report || '3) FAIL: errore - ' || sqlerrm || E'\n';
  end;

  begin
    select exists (
      select 1
      from information_schema.table_constraints tc
      join information_schema.referential_constraints rc
        on tc.constraint_name = rc.constraint_name and tc.table_schema = rc.constraint_schema
      join information_schema.key_column_usage kcu
        on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name
      where tc.table_schema='public' and tc.table_name='web_push_subscriptions'
        and tc.constraint_type='FOREIGN KEY'
        and kcu.column_name='user_id'
        and ccu.table_schema='auth' and ccu.table_name='users' and ccu.column_name='id'
        and rc.delete_rule='CASCADE'
    ) into v_exists;
    if v_exists then v_report := v_report || '4) PASS: FK user_id -> auth.users(id) ON DELETE CASCADE presente' || E'\n';
    else v_report := v_report || '4) FAIL: FK mancante o non ON DELETE CASCADE' || E'\n'; end if;
  exception when others then v_report := v_report || '4) FAIL: errore - ' || sqlerrm || E'\n';
  end;

  begin
    select exists(select 1 from pg_indexes where schemaname='public' and tablename='web_push_subscriptions' and indexname='web_push_subscriptions_user_id_idx') into v_idx1;
    select exists(select 1 from pg_indexes where schemaname='public' and tablename='web_push_subscriptions' and indexname='web_push_subscriptions_user_id_active_idx') into v_idx2;
    if v_idx1 and v_idx2 then v_report := v_report || '5) PASS: indici su user_id e (user_id,active) presenti' || E'\n';
    else v_report := v_report || '5) FAIL: indice mancante - user_id_idx=' || v_idx1::text || ', user_id_active_idx=' || v_idx2::text || E'\n'; end if;
  exception when others then v_report := v_report || '5) FAIL: errore - ' || sqlerrm || E'\n';
  end;

  begin
    select relrowsecurity into v_rls from pg_class
    where relname='web_push_subscriptions' and relnamespace = 'public'::regnamespace;
    if v_rls then v_report := v_report || '6) PASS: RLS abilitata su web_push_subscriptions' || E'\n';
    else v_report := v_report || '6) FAIL: RLS NON abilitata' || E'\n'; end if;
  exception when others then v_report := v_report || '6) FAIL: errore - ' || sqlerrm || E'\n';
  end;

  begin
    select exists(select 1 from pg_policies where schemaname='public' and tablename='web_push_subscriptions' and cmd='SELECT' and qual ilike '%auth.uid()%') into v_sel;
    select exists(select 1 from pg_policies where schemaname='public' and tablename='web_push_subscriptions' and cmd='UPDATE' and qual ilike '%auth.uid()%' and with_check ilike '%auth.uid()%') into v_upd;
    select exists(select 1 from pg_policies where schemaname='public' and tablename='web_push_subscriptions' and cmd='DELETE' and qual ilike '%auth.uid()%') into v_del;
    if v_sel and v_upd and v_del then
      v_report := v_report || '7) PASS: policy SELECT/UPDATE/DELETE presenti e vincolate a auth.uid()' || E'\n';
    else
      v_report := v_report || '7) FAIL: select=' || v_sel::text || ', update=' || v_upd::text || ', delete=' || v_del::text || E'\n';
    end if;
  exception when others then v_report := v_report || '7) FAIL: errore - ' || sqlerrm || E'\n';
  end;

  begin
    select count(*) into v_cnt from pg_policies where schemaname='public' and tablename='web_push_subscriptions' and cmd='INSERT';
    if v_cnt = 0 then v_report := v_report || '8) PASS: nessuna policy INSERT diretta' || E'\n';
    else v_report := v_report || '8) FAIL: trovate ' || v_cnt::text || ' policy INSERT non attese' || E'\n'; end if;
  exception when others then v_report := v_report || '8) FAIL: errore - ' || sqlerrm || E'\n';
  end;

  begin
    select exists(
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='register_web_push_subscription'
    ) into v_exists;
    if v_exists then v_report := v_report || '9) PASS: funzione register_web_push_subscription esiste' || E'\n';
    else v_report := v_report || '9) FAIL: funzione non trovata' || E'\n'; end if;
  exception when others then v_report := v_report || '9) FAIL: errore - ' || sqlerrm || E'\n';
  end;

  begin
    select prosecdef into v_secdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='register_web_push_subscription';
    if v_secdef then v_report := v_report || '10) PASS: funzione e'' SECURITY DEFINER' || E'\n';
    else v_report := v_report || '10) FAIL: funzione NON e'' SECURITY DEFINER' || E'\n'; end if;
  exception when others then v_report := v_report || '10) FAIL: errore - ' || sqlerrm || E'\n';
  end;

  begin
    select proconfig into v_conf from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='register_web_push_subscription';
    if v_conf is not null and 'search_path=' = any(v_conf) then
      v_report := v_report || '11) PASS: search_path impostato a vuoto sulla funzione' || E'\n';
    else
      v_report := v_report || '11) FAIL: search_path non risulta vuoto/impostato - proconfig=' || coalesce(v_conf::text,'NULL') || E'\n';
    end if;
  exception when others then v_report := v_report || '11) FAIL: errore - ' || sqlerrm || E'\n';
  end;

  begin
    v_anon := has_function_privilege('anon', 'public.register_web_push_subscription(text,text,text)', 'EXECUTE');
    v_auth := has_function_privilege('authenticated', 'public.register_web_push_subscription(text,text,text)', 'EXECUTE');
    v_public := has_function_privilege('public', 'public.register_web_push_subscription(text,text,text)', 'EXECUTE');
    if not v_anon then v_report := v_report || '12) PASS: anon NON puo'' eseguire la RPC' || E'\n';
    else v_report := v_report || '12) FAIL: anon PUO'' eseguire la RPC (grave)' || E'\n'; end if;
    if v_auth then v_report := v_report || '13) PASS: authenticated PUO'' eseguire la RPC' || E'\n';
    else v_report := v_report || '13) FAIL: authenticated NON puo'' eseguire la RPC' || E'\n'; end if;
    if v_public then v_report := v_report || 'extra) FAIL: PUBLIC puo'' ancora eseguire la RPC (grave)' || E'\n';
    else v_report := v_report || 'extra) PASS: PUBLIC non ha EXECUTE sulla RPC' || E'\n'; end if;
  exception when others then v_report := v_report || '12/13) FAIL: errore - ' || sqlerrm || E'\n';
  end;

  begin
    select pg_get_function_arguments(p.oid) into v_args
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='register_web_push_subscription';
    if v_args ilike '%user_id%' then
      v_report := v_report || '14) FAIL: la funzione accetta un parametro user_id - firma: ' || v_args || E'\n';
    else
      v_report := v_report || '14) PASS: nessun parametro user_id - firma: ' || v_args || E'\n';
    end if;
  exception when others then v_report := v_report || '14) FAIL: errore - ' || sqlerrm || E'\n';
  end;

  -- =====================================================================
  -- SETUP - due utenti di test SOLO dentro questa esecuzione (auth.users)
  -- =====================================================================

  begin
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
      recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at,
      last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
      created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token,
      phone_change_sent_at, email_change_token_current, email_change_confirm_status,
      banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous
    ) values
      ('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
       'webpush-test-a@invalid.test','test-not-a-real-hash',now(),null,'',null,'',null,'','',null,
       null,'{}'::jsonb,'{}'::jsonb,false,now(),now(),null,null,'','',null,'',0,null,'',null,false,null,false),
      ('22222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
       'webpush-test-b@invalid.test','test-not-a-real-hash',now(),null,'',null,'',null,'','',null,
       null,'{}'::jsonb,'{}'::jsonb,false,now(),now(),null,null,'','',null,'',0,null,'',null,false,null,false);
    v_setup_ok := true;
    v_report := v_report || 'setup) PASS: utenti di test A (...1111) e B (...2222) creati SOLO in questa esecuzione' || E'\n';
  exception when others then
    v_report := v_report || 'setup) FAIL: impossibile creare utenti di test in auth.users - ' || sqlerrm || E'\n';
    v_report := v_report || 'setup) i check 15-23 verranno SALTATI di conseguenza; i check 1-14 restano validi' || E'\n';
  end;

  -- =====================================================================
  -- PARTE B - check comportamentali (15-23), solo se il setup e' riuscito
  -- =====================================================================

  if v_setup_ok then

    perform set_config('request.jwt.claims', json_build_object('sub','11111111-1111-4111-8111-111111111111')::text, true);
    perform set_config('role', 'authenticated', true);

    begin
      insert into public.web_push_subscriptions (user_id, endpoint, p256dh, auth)
      values ('11111111-1111-4111-8111-111111111111', 'https://webpush-test.invalid/ep-1', 'x', 'y');
      v_report := v_report || '15) FAIL: insert diretto e'' riuscito (avrebbe dovuto essere negato dalla RLS)' || E'\n';
    exception when others then
      v_report := v_report || '15) PASS: insert diretto negato (errore atteso: ' || sqlerrm || ')' || E'\n';
    end;

    begin
      select * into v_row from public.register_web_push_subscription(
        'https://webpush-test.invalid/ep-1', 'p256dh-1a', 'auth-1a');
      if v_row.user_id::text = '11111111-1111-4111-8111-111111111111' and v_row.active = true then
        v_report := v_report || '16) PASS: RPC ha registrato la subscription EP1 per A (active=true)' || E'\n';
      else
        v_report := v_report || '16) FAIL: user_id=' || v_row.user_id::text || ', active=' || v_row.active::text || E'\n';
      end if;
    exception when others then v_report := v_report || '16) FAIL: errore inatteso - ' || sqlerrm || E'\n';
    end;

    begin
      select * into v_row from public.register_web_push_subscription(
        'https://webpush-test.invalid/ep-1', 'p256dh-1a-v2', 'auth-1a-v2');
      select count(*) into v_cnt from public.web_push_subscriptions where endpoint = 'https://webpush-test.invalid/ep-1';
      if v_cnt = 1 and v_row.p256dh = 'p256dh-1a-v2' and v_row.auth = 'auth-1a-v2'
         and v_row.user_id::text = '11111111-1111-4111-8111-111111111111' then
        v_report := v_report || '17) PASS: seconda chiamata sullo stesso endpoint e'' idempotente (1 riga, dati aggiornati)' || E'\n';
      else
        v_report := v_report || '17) FAIL: righe per EP1 = ' || v_cnt::text || E'\n';
      end if;
    exception when others then v_report := v_report || '17) FAIL: errore inatteso - ' || sqlerrm || E'\n';
    end;

    begin
      perform public.register_web_push_subscription('https://webpush-test.invalid/ep-2', 'p256dh-2a', 'auth-2a');
      v_report := v_report || 'setup) device 2 (EP2) registrato per A, usato dal check 21' || E'\n';
    exception when others then
      v_report := v_report || 'setup) FAIL: registrazione device 2 fallita - ' || sqlerrm || E'\n';
    end;

    begin
      update public.web_push_subscriptions set active = false
      where endpoint = 'https://webpush-test.invalid/ep-1';
      select active into v_active_ep1 from public.web_push_subscriptions where endpoint = 'https://webpush-test.invalid/ep-1';
      select active into v_active_ep2 from public.web_push_subscriptions where endpoint = 'https://webpush-test.invalid/ep-2';
      if v_active_ep1 = false and v_active_ep2 = true then
        v_report := v_report || '20) PASS: disattivazione ha toccato solo EP1 (EP2 resta active=true)' || E'\n';
      else
        v_report := v_report || '20) FAIL: EP1 active=' || v_active_ep1::text || ', EP2 active=' || v_active_ep2::text || E'\n';
      end if;
    exception when others then v_report := v_report || '20) FAIL: errore inatteso - ' || sqlerrm || E'\n';
    end;

    perform set_config('request.jwt.claims', json_build_object('sub','22222222-2222-4222-8222-222222222222')::text, true);
    perform set_config('role', 'authenticated', true);

    begin
      select * into v_row from public.register_web_push_subscription(
        'https://webpush-test.invalid/ep-1', 'p256dh-1b', 'auth-1b');
      if v_row.user_id::text = '22222222-2222-4222-8222-222222222222' then
        v_report := v_report || '18) PASS: EP1 riassegnato da A a B' || E'\n';
      else
        v_report := v_report || '18) FAIL: user_id dopo la riassegnazione = ' || v_row.user_id::text || E'\n';
      end if;
      if v_row.active = true then
        v_report := v_report || '19) PASS: active torna true alla (ri)registrazione, anche partendo da false' || E'\n';
      else
        v_report := v_report || '19) FAIL: active dopo la registrazione = ' || v_row.active::text || E'\n';
      end if;
    exception when others then
      v_report := v_report || '18) FAIL: errore inatteso - ' || sqlerrm || E'\n';
      v_report := v_report || '19) FAIL: errore inatteso - ' || sqlerrm || E'\n';
    end;

    perform set_config('role', v_original_role, true);

    begin
      select user_id, active into v_user_id, v_active
      from public.web_push_subscriptions where endpoint = 'https://webpush-test.invalid/ep-2';
      if v_user_id::text = '11111111-1111-4111-8111-111111111111' and v_active = true then
        v_report := v_report || '21) PASS: device 2 di A (EP2) resta active=true e di proprieta'' di A, mai toccato' || E'\n';
      else
        v_report := v_report || '21) FAIL: EP2 user_id=' || v_user_id::text || ', active=' || v_active::text || E'\n';
      end if;
    exception when others then v_report := v_report || '21) FAIL: errore inatteso - ' || sqlerrm || E'\n';
    end;

    perform set_config('request.jwt.claims', json_build_object('sub','11111111-1111-4111-8111-111111111111')::text, true);
    perform set_config('role', 'authenticated', true);

    begin
      select count(*) into v_sel_cnt from public.web_push_subscriptions where endpoint = 'https://webpush-test.invalid/ep-1';
      update public.web_push_subscriptions set active = false where endpoint = 'https://webpush-test.invalid/ep-1';
      get diagnostics v_upd_cnt = row_count;
      delete from public.web_push_subscriptions where endpoint = 'https://webpush-test.invalid/ep-1';
      get diagnostics v_del_cnt = row_count;
      if v_sel_cnt = 0 and v_upd_cnt = 0 and v_del_cnt = 0 then
        v_report := v_report || '22a) PASS: A non vede/aggiorna/elimina EP1 (ora di B) - select=' || v_sel_cnt::text || ', update=' || v_upd_cnt::text || ', delete=' || v_del_cnt::text || E'\n';
      else
        v_report := v_report || '22a) FAIL: A ha ancora accesso a EP1 - select=' || v_sel_cnt::text || ', update=' || v_upd_cnt::text || ', delete=' || v_del_cnt::text || E'\n';
      end if;
    exception when others then v_report := v_report || '22a) FAIL: errore inatteso - ' || sqlerrm || E'\n';
    end;

    perform set_config('request.jwt.claims', json_build_object('sub','22222222-2222-4222-8222-222222222222')::text, true);
    perform set_config('role', 'authenticated', true);

    begin
      select count(*) into v_sel_cnt from public.web_push_subscriptions where endpoint = 'https://webpush-test.invalid/ep-2';
      update public.web_push_subscriptions set active = false where endpoint = 'https://webpush-test.invalid/ep-2';
      get diagnostics v_upd_cnt = row_count;
      delete from public.web_push_subscriptions where endpoint = 'https://webpush-test.invalid/ep-2';
      get diagnostics v_del_cnt = row_count;
      if v_sel_cnt = 0 and v_upd_cnt = 0 and v_del_cnt = 0 then
        v_report := v_report || '22b) PASS: B non vede/aggiorna/elimina EP2 (di A) - select=' || v_sel_cnt::text || ', update=' || v_upd_cnt::text || ', delete=' || v_del_cnt::text || E'\n';
      else
        v_report := v_report || '22b) FAIL: B ha ancora accesso a EP2 - select=' || v_sel_cnt::text || ', update=' || v_upd_cnt::text || ', delete=' || v_del_cnt::text || E'\n';
      end if;
    exception when others then v_report := v_report || '22b) FAIL: errore inatteso - ' || sqlerrm || E'\n';
    end;

    perform set_config('request.jwt.claims', 'null', true);
    perform set_config('role', 'anon', true);

    begin
      select * into v_row from public.register_web_push_subscription(
        'https://webpush-test.invalid/ep-anon', 'x', 'y');
      v_report := v_report || '23) FAIL: anon e'' riuscito a chiamare la RPC (grave)' || E'\n';
    exception when others then
      v_report := v_report || '23) PASS: anon non riesce a chiamare la RPC (errore atteso: ' || sqlerrm || ')' || E'\n';
    end;

    perform set_config('role', v_original_role, true);
  else
    v_report := v_report || '15-23) SKIPPED: setup utenti di test fallito, vedi sopra' || E'\n';
  end if;

  v_report := v_report || '=== FINE TEST - ROLLBACK in corso (nessuna modifica viene mantenuta) ===';

  raise exception '%', v_report;
end $$;
