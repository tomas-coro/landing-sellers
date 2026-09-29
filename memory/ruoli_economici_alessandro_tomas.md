---
name: ruoli-economici-alessandro-tomas
description: Come funzionano i ruoli economici Alessandro (referente) e Tomas (developer) e perché compaiono su tutti i clienti - regola di business, non bug
metadata:
  type: project
---

Tomas fa i siti (ruolo `developer`), Alessandro gestisce vendita/produzione/costi per TUTTI i clienti dell'azienda (ruolo `venditore`, `ruolo_economico: 'referente'`) - confermato da Tomas il 2026-09-26, coerente con `supabase/migrations/20260912204037_alessandro_responsabile_produzione.sql`.

**Regola di business**: Alessandro deve vedere quanto gli rende OGNI cliente (quanto ha pagato, la sua quota), anche sui clienti dove non è lui il venditore diretto (es. clienti venduti da altri come Nicola Paoloni) - perché comunque percepisce una quota su quelle vendite come referente economico. Non è un accesso "di supervisione" opzionale, è un guadagno reale suo.

**Bug reale trovato e corretto (2026-09-26, migration `20260926180000_visibilita_economica_referente_produzione.sql`)**: la policy RLS `clienti_select` dava già questa visibilità estesa a chi ha `ruolo_economico in ('referente','produzione')`, ma `vendite_select`/`pagamenti_select`/`vendita_partecipanti_select` non erano mai state allineate - risultato, Alessandro vedeva il cliente ma tutti i dati economici (contratto/incassato/valore) risultavano vuoti per i clienti non suoi. Vedi anche [[project-landing-sellers]].

**Come si legge la Home dopo il fix**: tile "Venduto" = solo le vendite dove Alessandro è il venditore diretto (metrica personale). Tile "Generato"/"Incassato" = la sua quota reale su TUTTE le vendite dell'azienda, incluse quelle vendute da altri (metrica di guadagno, quella che conta per lui come referente). Le due metriche sono diverse per disegno, non un'inconsistenza.
