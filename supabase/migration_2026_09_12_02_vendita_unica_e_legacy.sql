-- Una sola vendita attiva per cliente e correzione dei dati legacy verificati.

-- Panificio Argento: conserva l'incasso sulla vendita storica corretta da 240 €.
update public.pagamenti
set vendita_id = 'f7b7a876-3336-477f-99cd-fa1dbf074de6'
where vendita_id = '27e61745-fe1e-4400-94c1-70a6ab4aaad9';

update public.vendite
set stato = 'annullata'
where id = '27e61745-fe1e-4400-94c1-70a6ab4aaad9'
  and stato = 'attiva';

-- Adioro: contratto biennale annuale attivato con la vendita del 15/08/2026.
-- Il trigger esistente calcola data_rinnovo; i prezzi storici non vengono toccati.
update public.clienti
set data_attivazione = coalesce(data_attivazione, date '2026-08-15'),
    periodicita_contratto = coalesce(periodicita_contratto, 'annuale')
where id = 'ca165c65-18a6-4048-b5a7-9e8eaa08ebb0';

create unique index if not exists vendite_unica_attiva_cliente_idx
on public.vendite (cliente_id)
where stato = 'attiva';
