-- Corregge un errore di inserimento su vendite con formula mensile: per
-- queste vendite importo_vendita deve contenere il totale annuale del
-- contratto (canone mensile x 12), come per tutte le altre vendite attive
-- (es. Panificio Argento: 20 EUR/mese -> importo_vendita 240). Due vendite
-- erano invece rimaste con il solo canone di un mese.
--
-- Mr Smoky (5ca0feb3-ec7b-4e6f-8eb7-88ca0d14cd7e): 35 -> 420.
-- Le quote dei partecipanti (quota_base, quota_finale, quota_calcolata,
-- quota_effettiva) erano state calcolate sul valore sbagliato: vengono
-- scalate x12 nella stessa proporzione gia' registrata. Nessun pagamento
-- risulta incassato su questa vendita, quindi non tocca importi gia'
-- versati.
--
-- Giuly Style (a966ea86-ec19-4e13-aef9-3cc9ddab0761): 20 -> 240. Le quote
-- dei partecipanti erano gia' a 0 (vendita legacy senza commissione
-- assegnata): restano a 0, si corregge solo importo_vendita per pulizia
-- dati futuri.

update public.vendite
set importo_vendita = 420.00
where id = '5ca0feb3-ec7b-4e6f-8eb7-88ca0d14cd7e'
  and importo_vendita = 35.00;

update public.vendite
set importo_vendita = 240.00
where id = 'a966ea86-ec19-4e13-aef9-3cc9ddab0761'
  and importo_vendita = 20.00;

update public.vendita_partecipanti
set quota_base = 30.00,
    quota_finale = 33.60,
    quota_calcolata = 33.60,
    quota_effettiva = 33.60
where id = 'a0367c5a-3ad6-4ac0-a520-ad4330e44b3c'
  and vendita_id = '5ca0feb3-ec7b-4e6f-8eb7-88ca0d14cd7e'
  and quota_finale = 2.80;

update public.vendita_partecipanti
set quota_base = 30.00,
    quota_finale = 26.40,
    quota_calcolata = 26.40,
    quota_effettiva = 26.40
where id = 'c3c18198-fe0c-4992-a58c-7e02d11332d6'
  and vendita_id = '5ca0feb3-ec7b-4e6f-8eb7-88ca0d14cd7e'
  and quota_finale = 2.20;
