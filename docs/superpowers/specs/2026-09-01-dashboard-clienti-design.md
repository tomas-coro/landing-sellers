# Design: dashboard lista clienti, pacchetto/prezzo, scheda cliente ad accordion

Data: 2026-09-01

## Problema

Tre punti deboli nella gestione clienti di un venditore:

1. La lista clienti mostra una sola card "Totale generato" e nessuna vista d'insieme sulla pipeline (quanti clienti in ciascuno stato), né un modo di ordinare i clienti oltre a ricerca testo e filtro-stato.
2. Il form "Nuovo cliente" ha un solo campo `importo_abbonamento`: non c'è modo di annotare subito nome del pacchetto/piano, note sul prezzo o data di rinnovo - né di rimandarlo a dopo in modo esplicito (oggi si può lasciare vuoto, ma non ci sono altri campi da compilare più avanti).
3. La scheda cliente è una singola pagina lunga (stato, dati di contatto, link, note tutti in sequenza): troppo scroll per trovare l'informazione che serve in quel momento.

## Modello dati

Aggiungo tre colonne opzionali a `public.clienti` (nessuna nuova tabella - resta un solo prezzo per cliente, arricchito di dettagli):

```sql
alter table public.clienti
  add column nome_pacchetto text default '',
  add column note_prezzo text default '',
  add column data_rinnovo date;
```

Migration: `supabase/migration_2026_09_01_pacchetti.sql`.

Tutti e tre i campi sono facoltativi, nessun vincolo `not null`, nessuna nuova regola in `js/validators.js` a parte un controllo di formato se `data_rinnovo` è valorizzata (deve essere una data valida, nessun vincolo su passato/futuro).

## Lista clienti → dashboard

Sostituisco l'attuale card singola "Totale generato" con due blocchi in cima alla vista `lista` (sopra ricerca e filtri):

- **Pipeline**: i chip filtro-stato già esistenti (`filtro-stati` / `chip-stato`) mostrano anche il conteggio, es. `Contattato · 4`. Il conteggio è calcolato sui clienti del venditore corrente (non filtrati da ricerca/stato attivo, così il quadro resta stabile mentre si filtra). Nessuna nuova UI: i chip esistenti fanno doppio lavoro da filtro e da riepilogo pipeline.
- **Incassi**: la card "Totale generato" + andamento mensile esistente (`stack-card` con `totaleGenerato()` e `andamentoMensile()`), solo restyle come blocco dashboard più prominente in cima alla pagina.

Vista `admin` (dashboard multi-venditore): nessuna modifica, resta come oggi.

## Ordinamento

Nuova riga di chip sotto la ricerca, sopra i chip di stato: **Nome**, **Importo**, **Prossimo contatto**, **Più recenti**.

- Stato in `appState.ordinamento` (stringa: `nome` | `importo` | `prossimo_contatto` | `creato_il`) + `appState.ordinamentoDesc` (bool).
- Tap su un chip già attivo inverte `ordinamentoDesc`; tap su un chip diverso lo attiva con la direzione di default (Nome: A→Z, Importo: decrescente, Prossimo contatto: più urgente prima, Più recenti: più recente prima).
- Applicato dentro `clientiFiltrati()`, dopo i filtri di ricerca/stato esistenti, prima del render.
- Clienti senza `prossimo_contatto` o `importo_abbonamento` valorizzato vanno sempre in fondo, qualunque sia la direzione.

## Nuovo cliente

Sotto il campo "Importo abbonamento" esistente, tre campi nuovi, tutti facoltativi:

- **Nome pacchetto/piano** (input testo, placeholder "Es. Sito base")
- **Note prezzo** (textarea corta, placeholder "Es. scontato i primi 3 mesi")
- **Data rinnovo** (input date)

Nessuno di questi è obbligatorio: il form resta salvabile con solo il Nome cliente, esattamente come oggi. Chi non li compila alla creazione li aggiunge in un secondo momento dalla scheda cliente (stesso form di modifica, `apriModificaCliente`).

## Scheda cliente → accordion

La scheda passa da pagina unica a 4 blocchi collassabili (accordion, un solo blocco aperto per gruppo - non esclusivo tra loro, l'utente può aprirne più di uno):

1. **Stato** - aperto di default. Stato attuale (pill) + `stato-grid` per cambiarlo.
2. **Pacchetto e pagamento** - aperto di default solo se `importo_abbonamento` o `nome_pacchetto` sono già valorizzati, altrimenti chiuso. Contiene: importo, nome pacchetto, note prezzo, data rinnovo.
3. **Contatti** - chiuso di default. Referente, telefono, email, P.IVA, IBAN, link al sito.
4. **Note** - aperto di default. Form nuova nota + storico note.

Motivazione ordine/default: un venditore apre la scheda quasi sempre per cambiare stato o leggere/aggiungere una nota; dati anagrafici e prezzo si consultano meno spesso e restano a un tap di distanza invece di occupare subito lo schermo.

Il pulsante "Manda a brief" resta sempre visibile in cima, fuori dagli accordion (è un'azione, non un'informazione da consultare).

Stato UI: `appState.schedaAperture` - oggetto `{ stato: bool, pacchetto: bool, contatti: bool, note: bool }`, inizializzato in `apriScheda()` con i default sopra (pacchetto calcolato in base ai dati del cliente).

## Errori e validazione

Nessun cambiamento ai pattern esistenti: si riusano `erroreClienti`, `erroriNuovoCliente`, `erroreScheda`. Unica aggiunta: validazione formato per `data_rinnovo` in `js/validators.js`, sullo stesso modello di `sito_url`/`importo_abbonamento`.

## Test

Il progetto ha test manuali in `test/validators.test.js` e `test/auth.test.js` (nessun framework, script diretti). Aggiungo casi in `test/validators.test.js` solo per `data_rinnovo` (formato valido/non valido) - `nome_pacchetto` e `note_prezzo` sono testo libero senza vincoli, non serve validarli.

## Fuori scope

- Pacchetti multipli per cliente (un cliente = un prezzo, come oggi).
- Contatore "contatti urgenti" dedicato in dashboard (resta solo il badge `urg-*` sulla singola card, come oggi).
- Modifiche alla vista `admin`.
