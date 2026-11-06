-- Landing Sellers
-- Il nome della vendita vive nella configurazione commerciale
-- (configurazione_commerciale.nome_vendita): la colonna vendite.nome creata
-- da 20261106130000 non serve e non e' mai stata scritta.
alter table public.vendite
  drop constraint if exists vendite_nome_lunghezza_chk;

alter table public.vendite
  drop column if exists nome;
