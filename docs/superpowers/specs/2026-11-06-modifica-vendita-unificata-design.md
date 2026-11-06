# Modifica vendita unificata - design

Data: 06/11/2026. Stato: da approvare.

## Problema

Nella scheda cliente la vendita si modifica da tre punti con poteri diversi:

| Punto | Funzione | Cosa cambia |
|---|---|---|
| Matita in alto | `apriModificaCliente` (js/app-cliente.js) | Anagrafica, brief, selezione servizi. NON importo, pagamenti, rate |
| "Modifica servizi" (accordion Servizi e pacchetto) | `apriEditorServiziCliente` / RPC `aggiorna_servizi_cliente` | Solo servizi e descrizione, prezzo storico invariato |
| "Modifica vendita" (dettaglio vendita) | `modificaVenditaCliente` (js/app-economia.js) / RPC `sostituisci_vendita` | Tutto: servizi, formula, pagamento, importo, partecipanti, rate |

Solo il terzo corregge davvero la vendita. Gli altri due sono incompleti.

## Decisioni prese (06/11/2026)

1. Un solo editor di vendita: quello di `modificaVenditaCliente`.
2. Cambiando i servizi il prezzo si ricalcola dal listino, con importo modificabile a mano (e' gia' cosi' nel configuratore).
3. Regola unica: si modifica finche' non ci sono incassi. Il database blocca tutti, admin compreso, dopo il primo incasso (`sostituisci_vendita`). Scelta A: nessuna modifica al database.
4. Vendita separata da brief e azione: la matita resta per anagrafica, brief, prossima azione, note.

## Comportamento

**Vendita attiva senza incassi**
- "Modifica servizi" e "Modifica vendita" chiamano entrambi `modificaVenditaCliente()`.
- Nel form della matita si toglie la sezione servizi/prezzo e si mette un pulsante "Modifica vendita" che chiama la stessa funzione.

**Vendita attiva con incassi**
- "Modifica vendita" e' nascosto. Resta il messaggio, corretto: "Ci sono incassi registrati: la vendita non si puo' piu' modificare" (oggi dice "chiedi all'admin", falso).
- "Modifica servizi" resta, ma apre solo l'editor descrittivo (`aggiorna_servizi_cliente`): corregge servizi e descrizione senza toccare importo e rate. Il testo lo dice.

**Cliente senza vendita attiva**
- La matita mantiene la sezione prezzo (serve a impostare l'offerta). Nessun cambio.

## File toccati

- `index.html`: pulsanti "Modifica servizi" e "Modifica vendita", sezione servizi/prezzo nel form matita, testo del messaggio.
- `js/app-cliente.js`: instradamento di "Modifica servizi" in base alla presenza di incassi.
- `js/app-economia.js`: nessuna logica nuova; `modificaVenditaCliente` resta il punto unico.
- `test/annulla-vendita.test.js` e nuovo test: i tre punti usano la stessa funzione; con incassi il pulsante vendita non c'e'.
- Service worker: bump versione al deploy.

## Fuori scopo

- Nessuna migrazione, nessun cambio permessi: niente voce nel registro sicurezza.
- Nessuna modifica a "Modifica brief e azione" e "Aggiungi motivazione".

## Verifica

- `node --test test/` verde.
- Prova a mano nell'app: cliente senza incassi (modifica da entrambi i pulsanti, cambio servizio, importo ricalcolato, rate rifatte) e cliente con incasso (solo editor servizi, messaggio corretto).
