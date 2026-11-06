-- Landing Sellers
-- Piu' vendite attive sullo stesso cliente (es. due domini = due contratti).
--
-- 1. Via l'indice che ammetteva una sola vendita attiva per cliente.
-- 2. Via il trigger cliente -> vendita: con due vendite attive riscriverebbe
--    i campi contratto di una sola (l'ultima). La modifica del cliente tocca
--    solo il cliente; la vendita si modifica da sola (sostituisci_vendita).
-- 3. Nome per vendita (es. "Sito shop - dominio.it") per distinguerle.
--
-- NOTA: le funzioni di registrazione vendita continuano a copiare sul cliente
-- i campi contratto dell'ultima vendita (specchio legacy). Rinnovi e notifiche
-- devono leggere dalla singola vendita, non dal cliente.
--
-- Applicare con query mirata (supabase db query --linked -f), NON db push.

drop index if exists public.vendite_unica_attiva_cliente_idx;

drop trigger if exists trg_sincronizza_vendita_da_cliente on public.clienti;
drop function if exists public.sincronizza_vendita_da_cliente();

alter table public.vendite
  add column if not exists nome text;

alter table public.vendite
  drop constraint if exists vendite_nome_lunghezza_chk;

alter table public.vendite
  add constraint vendite_nome_lunghezza_chk
  check (nome is null or char_length(nome) <= 80);

comment on column public.vendite.nome is
  'Nome breve della vendita, utile quando un cliente ha piu contratti attivi (es. "Sito shop - dominio.it").';
