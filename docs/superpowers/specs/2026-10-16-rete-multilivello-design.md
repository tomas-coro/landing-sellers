# Rete multilivello: vendita condivisa e quota di rete 10%

Data: 2026-10-16. Stato: design approvato da Tomas, in attesa di revisione della specifica.

## Obiettivo

Due regole economiche nuove sulla rete venditori (albero `profili.responsabile_id`):

1. **Vendita condivisa**: chi ha qualcuno sotto puo' dividere al 50% la quota di vendita con un suo diretto sottostante.
2. **Quota di rete 10%**: il responsabile diretto (se non e' la radice Alessandro) riceve in automatico il 10% della quota di chi sta sotto. Oggi equivale a lv3 verso lv2.

Fuori scope (rimandato): soglie di promozione lv3 verso lv2 e competizione tra venditori ("definiremo poi").

## Regole di calcolo

Definizioni: "quota venditore" = `quotaFinale` del partecipante che ha venduto, come la calcola `economic-engine.js`, per ogni pagamento incassato.

### Vendita condivisa
- Chi registra la vendita la condivide solo con un suo **diretto sottostante** (`responsabile_id` = chi registra). Alessandro con Nicola e Nicholas, Nicholas con Selim. Mai con un nipote.
- La quota venditore si divide 50/50 tra chi registra e il collega. Entrambi la vedono nel resoconto.
- Nella vendita condivisa **il 10% non scatta** (il gestore e' gia' partecipante o il caso non esiste).
- Il bonus 12% (solo Alessandro/Tomas, con 2 partecipanti) non cambia. La divisione avviene **dopo** il motore, quindi il numero di partecipanti del motore non cresce.

### Quota di rete 10%
- A ogni incasso: se il venditore ha un responsabile diretto che non e' la radice, il 10% della sua quota effettiva va a quel responsabile. Si sottrae alla quota del venditore.
- Un solo livello su, nessuna cascata.
- Il 10% matura per rata incassata, in proporzione, come `quota_effettiva`.
- Pagamenti incassati prima del rilascio: nessun ricalcolo.

## Dati

- `vendite.condivisa_con uuid null` (riferisce `profili.id`): collega della vendita condivisa. Vuoto = non condivisa. Modificabile finche' non e' incassata la prima rata.
- Divisione 50/50: post-elaborazione in un punto solo, dopo `economic-engine.js`, che spezza la quota del venditore in due righe `pagamento_partecipanti`. Il motore resta invariato.
- Nuova tabella `pagamento_quote_rete` (separata da `pagamento_partecipanti` per non far comparire il gestore tra i partecipanti della vendita e non far trapelare nulla al venditore): `pagamento_id`, `da_profilo_id` (venditore), `a_profilo_id` (gestore), `importo`, `ricevuta_il` (stesso meccanismo di conferma dei trasferimenti esistenti).
- Il venditore sotto vede la quota gia' al netto: la riga rete non compare nel suo `quota_effettiva` lordo, solo la sottrazione e' applicata.

## Sicurezza (RLS)

- `pagamento_quote_rete`: lettura per `a_profilo_id` e per chi sta sopra nella catena (Alessandro, Tomas via admin). Mai per `da_profilo_id`.
- Scrittura solo da funzione server (RPC di registrazione pagamento), non dal client.
- Intervento di accessi: va annotato nel registro sicurezza (vedi AGENTS.md).

## Schermate

- **Modulo vendita**: interruttore "Vendita condivisa" con scelta del collega, visibile solo a chi ha qualcuno sotto.
- **Agenda e notifica**: al gestore "quota da riscattare su vendita di Selim"; conferma con la stessa UI dei trasferimenti da confermare.
- **Rete vendita**: Alessandro e Tomas vedono "Nicholas ha preso X da una vendita di Selim".
- **Resoconto venditore**: in vendita condivisa, mostra la propria meta' e la meta' del collega.

## Da verificare nel piano di implementazione

- Dove vive oggi la logica di registrazione pagamento (RPC `registra_pagamento_economico` e successive) per innestare la post-elaborazione e il 10%.
- Se `calcolaStatisticheVenditore` (generato, venduto, incassato) deve contare la quota di rete ricevuta come "generato" del gestore.
- Test: casi di vendita singola lv3, condivisa lv2+lv3, condivisa Alessandro+lv2, rata parziale.
- Bump `service-worker.js` e `?v=` in `index.html` a ogni deploy.
