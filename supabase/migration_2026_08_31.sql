-- supabase/migration_2026_08_31.sql
-- Da eseguire una volta sola nell'SQL Editor di Supabase (dashboard progetto).
-- Aggiunge: URL del sito, soft delete cliente, data di pubblicazione automatica.

alter table public.clienti
  add column sito_url text default '',
  add column cancellato_il timestamptz,
  add column pubblicato_il timestamptz;

-- Valorizza pubblicato_il in automatico la prima volta che un cliente
-- passa a stato 'pubblicato' (serve per raggruppare le vendite per mese).
-- Non lo tocca piu' se il cliente torna indietro di stato e poi ripubblica.
create function public.valorizza_pubblicato_il()
returns trigger
language plpgsql
as $$
begin
  if new.stato = 'pubblicato' and old.stato is distinct from 'pubblicato' and new.pubblicato_il is null then
    new.pubblicato_il := now();
  end if;
  return new;
end;
$$;

create trigger trg_valorizza_pubblicato_il
  before update on public.clienti
  for each row execute function public.valorizza_pubblicato_il();

-- Utente admin "LandingEvolution": crealo dal dashboard Supabase
-- (Authentication > Users > Add user), poi lancia questa riga sostituendo
-- l'email con quella usata:
-- update public.profili set ruolo = 'admin'
--   where id = (select id from auth.users where email = 'info@landingevolution.it');
