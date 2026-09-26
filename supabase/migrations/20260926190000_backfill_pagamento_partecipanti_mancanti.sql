-- Backfill: crea le righe mancanti in pagamento_partecipanti per i pagamenti
-- incassati PRIMA dell'introduzione della tabella (migration
-- 20260914121000_ripartizione_economica_pagamenti.sql). Quei pagamenti non
-- hanno mai avuto una riga di ripartizione per partecipante, quindi la vista
-- "Il tuo incassato" (che somma pagamento_partecipanti.quota_effettiva) li
-- ignora, mentre la card Home (che usa vendita_partecipanti.quota_finale,
-- gia' backfillata a suo tempo) li conta - da qui la discrepanza tra i due
-- numeri (es. 565,20€ in Home vs 135,50€ nel grafico "Il tuo incassato").
--
-- La quota di ciascun partecipante per un pagamento viene calcolata con la
-- STESSA proporzione gia' usata da calcolaStatisticheVenditore() in
-- js/app.js: quota_finale della vendita * (importo del pagamento /
-- importo_vendita), cosi' il totale per vendita torna identico a quanto
-- gia' mostrato in Home.
insert into pagamento_partecipanti (
  pagamento_id, profilo_id, ruolo, quota_base, quota_calcolata, quota_effettiva, note_quota
)
select
  p.id as pagamento_id,
  vp.profilo_id,
  vp.ruolo,
  vp.quota_base,
  round(vp.quota_finale * (p.importo / v.importo_vendita), 2) as quota_calcolata,
  round(vp.quota_finale * (p.importo / v.importo_vendita), 2) as quota_effettiva,
  'Backfill 2026-09-26: quota_finale prorata su importo pagamento / importo_vendita (pagamento pre-esistente alla tabella pagamento_partecipanti)' as note_quota
from pagamenti p
join vendite v on v.id = p.vendita_id
join vendita_partecipanti vp on vp.vendita_id = v.id
where p.stato = 'incassato'
  and coalesce(v.importo_vendita, 0) > 0
  and not exists (
    select 1 from pagamento_partecipanti pp
    where pp.pagamento_id = p.id and pp.profilo_id = vp.profilo_id
  );
