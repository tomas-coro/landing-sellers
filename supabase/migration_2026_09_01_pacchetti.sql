-- supabase/migration_2026_09_01_pacchetti.sql
-- Da eseguire una volta sola nell'SQL Editor di Supabase (dashboard progetto).
-- Aggiunge dettagli facoltativi di pacchetto/prezzo al cliente. Resta un solo
-- prezzo per cliente (importo_abbonamento, gia' esistente): questi campi
-- arricchiscono quel prezzo, non lo sostituiscono ne' introducono pacchetti
-- multipli.

alter table public.clienti
  add column nome_pacchetto text default '',
  add column note_prezzo text default '',
  add column data_rinnovo date;
