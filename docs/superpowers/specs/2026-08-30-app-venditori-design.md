# App venditori Landing Evolution - design

Data: 2026-08-30

## Scopo

PWA installabile per i venditori di Landing Evolution: ogni venditore vede la lista dei propri clienti, apre una scheda dedicata per cliente, ci scrive note, cambia lo stato della trattativa e manda il cliente al `brief.html` esistente per iniziare il progetto. Un account admin (Tomas) vede tutti i clienti di tutti i venditori.

Questo documento copre solo l'MVP: login + lista clienti + scheda + note + link brief. Fuori scope per ora: offline, report/statistiche, notifiche, self-signup venditori.

## Decisioni prese (da grill-me)

- Backend: **Supabase** (Postgres + Auth), niente PHP.
- Venditori: pochi account fissi, creati a mano dall'admin in Supabase Auth. Niente self-signup.
- Un cliente e' assegnato a **un solo venditore**.
- Il link al brief e' sempre lo stesso `brief.html` esistente, nessuna precompilazione: lo compila il venditore insieme al cliente.
- Note: private per venditore, l'admin vede tutte le note di tutti.
- Login: email + password via Supabase Auth.
- Creazione clienti: sia admin sia venditori possono aggiungerne di nuovi; il venditore che lo crea ne resta il proprietario.
- Repo/cartella: progetto separato da LANDING EVOLUTION (nome definitivo da confermare - placeholder `venditori-landing-evolution`), pubblicato su GitHub Pages con **repo pubblico** (la sicurezza dei dati sta nel login + RLS Supabase, non nel nascondere il codice).
- Offline: non serve per l'MVP, l'app richiede sempre connessione.
- Stack: **vanilla JS + Alpine.js via CDN**, zero build/npm, coerente con la preferenza per stack semplici. Nessun framework/bundler.

## Architettura

- **Frontend**: PWA statica (HTML/CSS/JS + Alpine.js da CDN), GitHub Pages, repo pubblico separato da LANDING EVOLUTION.
- **Backend**: Supabase (Postgres + Auth). Il browser parla direttamente con Supabase via `supabase-js` (chiave anon pubblica), nessun server intermedio.
- **Auth**: Supabase Auth email+password. Account creati a mano dall'admin.
- **Ruoli**: `venditore` e `admin`, salvati in una tabella `profili` collegata a `auth.users`.
- **Sicurezza dati**: Row Level Security (RLS) su Postgres filtra le righe in base a chi e' loggato. Il codice JS pubblico non espone dati: senza login valido, zero righe restituite.

## Schema dati

```
profili
  id          uuid  PK, = auth.users.id
  nome        text
  ruolo       text  'venditore' | 'admin'

clienti
  id                   uuid  PK
  venditore_id         uuid  FK -> profili.id  (chi lo segue)
  nome                 text  (nome attivita'/cliente)
  referente            text
  telefono             text
  email                text
  piva                 text
  iban                 text
  importo_abbonamento  numeric
  stato                text  'contattato'|'brief_mandato'|'in_lavorazione'|'pubblicato'
  prossimo_contatto    date  (nullable)
  creato_il            timestamptz  default now()

note
  id            uuid  PK
  cliente_id    uuid  FK -> clienti.id
  venditore_id  uuid  FK -> profili.id  (chi ha scritto la nota)
  testo         text
  creata_il     timestamptz  default now()
```

Nota di sicurezza: `iban` e' dato bancario sensibile (GDPR). Protetto dalle stesse regole RLS di tutto il resto della riga cliente; Supabase cripta il DB a riposo. Da rivalutare solo se questi dati finissero un giorno in export o report condivisi - non previsto nell'MVP.

### Regole RLS

- `clienti`: un venditore vede/modifica solo righe dove `venditore_id = auth.uid()`. Un admin (ruolo letto da `profili`) vede/modifica tutte le righe.
- `note`: stessa logica, filtrata tramite `cliente_id` -> `clienti.venditore_id = auth.uid()`, oppure admin.
- Il link al brief non e' un campo nel DB: e' sempre lo stesso URL fisso a `brief.html`.

## Pagine e flusso

Navigazione semplice, mostra/nascondi con Alpine (niente router pesante), 4 schermate:

1. **Login** (`index.html`) - email + password verso Supabase Auth. Se gia' loggato, salta dritto alla lista.
2. **Lista clienti** - schermata principale. Card per cliente: nome, stato (badge colorato), prossimo contatto. Bottone "+ Nuovo cliente" in alto. L'admin ha in piu' un filtro per venditore.
3. **Scheda cliente** (tap su una card) - tutti i campi (dati, P.IVA, IBAN, importo), lista note (piu' recente in cima) con campo per aggiungerne una nuova, bottone "Manda a brief" che apre `brief.html` in nuova scheda, bottone per cambiare stato pipeline.
4. **Nuovo cliente** - form con gli stessi campi, salvato assegnato automaticamente al venditore loggato.

### PWA

`manifest.json` + icona per "aggiungi a home". Service worker minimo solo per l'installabilita' (nessuna cache offline, come deciso).

## Gestione errori

- **Login fallito**: messaggio inline sotto il form, "Email o password errati". Nessun redirect a pagina d'errore dedicata.
- **Sessione scaduta**: redirect automatico a login con messaggio "Sessione scaduta, rientra".
- **Salvataggio fallito** (rete assente, RLS che blocca, campo obbligatorio mancante): messaggio inline vicino al form/bottone che ha fallito. I dati gia' inseriti restano nel form, nessuna perdita di quanto scritto.
- **Niente fallback silenziosi**: se una query fallisce, l'errore si vede a schermo. Mai una lista vuota silenziosa che sembra "nessun cliente" quando in realta' e' un errore di rete/permessi.

## Fuori scope (MVP)

- Funzionamento offline / service worker con cache dati.
- Report, statistiche, dashboard aggregate.
- Notifiche push o promemoria automatici sul "prossimo contatto".
- Self-signup venditori o gestione ruoli da UI (si fa a mano su Supabase).
- Precompilazione o integrazione diretta del brief dentro l'app (resta un link esterno a `brief.html`).
