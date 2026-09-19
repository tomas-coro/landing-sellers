-- supabase/migration_2026_09_19_schedula_notifiche_rinnovi.sql
--
-- Gap trovato: l'edge function supabase/functions/check-renewals/index.ts
-- calcola le scadenze dovute e invia gia' la push tramite send-web-push,
-- ma non era mai stata collegata a nessun cron/trigger - il codice esisteva,
-- semplicemente non veniva mai eseguito in automatico.
--
-- Questa migration aggiunge SOLO il collegamento: un job pg_cron che invoca
-- l'edge function via HTTP (pg_net) ogni giorno, 10 minuti dopo
-- sincronizza_rinnovi() (2:15, vedi migration_2026_09_03_rinnovi_contratti.sql)
-- cosi' data_rinnovo e' gia' aggiornata quando check-renewals gira.
--
-- AZIONE MANUALE RICHIESTA PRIMA DI ESEGUIRE QUESTO FILE (una tantum, da fare
-- SOLO dalla dashboard Supabase - SQL Editor, mai da un file committato):
--
--   select vault.create_secret(
--     '<SERVICE_ROLE_KEY_REALE>',
--     'service_role_key',
--     'Service role key usata dal cron per chiamare le edge function'
--   );
--
-- La service role key si trova in Project Settings -> API -> service_role.
-- Senza questo secret in Vault il job fallisce silenziosamente (l'header
-- Authorization sarebbe vuoto e check-renewals risponderebbe 403).

create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'landing-sellers-check-renewals',
  '25 2 * * *',
  $$
  select net.http_post(
    url := 'https://mptbmhqnsvpiflzjzbea.supabase.co/functions/v1/check-renewals',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
