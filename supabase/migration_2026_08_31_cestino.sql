-- supabase/migration_2026_08_31_cestino.sql
-- Da eseguire una volta sola nell'SQL Editor di Supabase (dashboard progetto).
-- Pulizia automatica del cestino: i clienti soft-eliminati (cancellato_il
-- valorizzato) vengono cancellati definitivamente dal database 30 giorni
-- dopo l'eliminazione. Le note collegate spariscono da sole (on delete
-- cascade, gia' presente in schema.sql).

create extension if not exists pg_cron;

create function public.pulisci_cestino_clienti()
returns void
language sql
security definer set search_path = public
as $$
  delete from public.clienti
  where cancellato_il is not null
    and cancellato_il < now() - interval '30 days';
$$;

-- Gira ogni giorno alle 3:00 UTC.
select cron.schedule(
  'pulisci-cestino-clienti-giornaliero',
  '0 3 * * *',
  $$select public.pulisci_cestino_clienti();$$
);
