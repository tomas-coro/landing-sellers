-- Correzione della migration 20260926190000: quel backfill aveva creato
-- righe pagamento_partecipanti anche per pagamenti legati a vendite con
-- stato 'annullata'. La card Home ("Incassato") esclude pero' le vendite
-- non 'attiva' dal calcolo (venditeAttive in calcolaStatisticheVenditore,
-- js/app.js:339) - per restare coerenti con quella logica, le vendite
-- annullate non devono contribuire all'incassato storico. Si rimuovono qui
-- solo le righe create dal backfill precedente (identificate dal tag nella
-- nota), mai righe genuine pre-esistenti.
delete from pagamento_partecipanti pp
using pagamenti p, vendite v
where pp.pagamento_id = p.id
  and p.vendita_id = v.id
  and v.stato <> 'attiva'
  and pp.note_quota like 'Backfill 2026-09-26:%';
