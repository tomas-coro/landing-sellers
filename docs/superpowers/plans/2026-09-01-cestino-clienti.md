# Vista Cestino clienti Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere una vista Cestino self-service che mostra i clienti soft-eliminati (`cancellato_il` valorizzato) con countdown ai 30 giorni e un bottone per ripristinarli, chiudendo il buco tra la promessa fatta nel popup di eliminazione ("puoi recuperarlo entro 30 giorni") e la UI attuale, che non offre nessun modo di farlo.

**Architecture:** Stessa architettura del resto dell'app - stato Alpine.js centralizzato in `js/app.js` (`appState()`), query dirette a Supabase filtrate dalle RLS esistenti, nessuna modifica al database. Riuso totale dei componenti CSS gia' esistenti (`card-cliente`, `iconbtn`, `empty`, `err`, `topbar`, `content`).

**Tech Stack:** HTML/CSS/JS vanilla, Alpine.js (CDN), Supabase JS client (CDN), `node --test` per la logica pura.

## Global Constraints

- Nessuna modifica alle RLS: la policy `clienti_update` esistente (`venditore_id = auth.uid() or public.is_admin()`) gia' copre sia il venditore proprietario sia l'admin.
- Nessun popup di conferma per il ripristino (azione non distruttiva).
- Stesso pattern di gestione errori del resto del file: nessun fallback silenzioso, ogni errore Supabase popola una stringa mostrata inline.
- Nessuna nuova classe CSS: riuso di `card-cliente`, `cc-top`, `iconbtn`, `empty`, `err`, `topbar`, `content`, `btn`/`btn-ghost` gia' presenti in `css/style.css`.

---

### Task 1: Logica pura countdown cestino

**Files:**
- Modify: `js/validators.js`
- Test: `test/validators.test.js`

**Interfaces:**
- Produce: `giorniResiduiCestino(cancellatoIl, oggi = new Date())` -> numero intero di giorni mancanti prima della cancellazione definitiva (30 giorni da `cancellatoIl`, mai negativo). Usata dal Task 3 (markup vista cestino).

- [ ] **Step 1: Scrivere i test**

Aggiungi in fondo a `test/validators.test.js` (dopo l'ultimo test esistente, `classeUrgenza ritorna vuoto oltre i 3 giorni`):

```js
const { giorniResiduiCestino } = require('../js/validators.js');

test('giorniResiduiCestino ritorna 30 il giorno stesso della cancellazione', () => {
  const oggi = new Date('2026-09-01T10:00:00');
  assert.strictEqual(giorniResiduiCestino('2026-09-01T09:00:00', oggi), 30);
});

test('giorniResiduiCestino conta i giorni trascorsi', () => {
  const oggi = new Date('2026-09-30T10:00:00');
  assert.strictEqual(giorniResiduiCestino('2026-09-01T09:00:00', oggi), 1);
});

test('giorniResiduiCestino non va mai sotto zero oltre i 30 giorni', () => {
  const oggi = new Date('2026-10-05T10:00:00');
  assert.strictEqual(giorniResiduiCestino('2026-09-01T09:00:00', oggi), 0);
});
```

Nota: la riga `const { giorniResiduiCestino } = require('../js/validators.js');` va aggiunta come nuovo `require` in coda al file (non serve toccare il require in cima, Node permette piu' destructuring dallo stesso modulo). In alternativa, per coerenza con lo stile del file, aggiungi `giorniResiduiCestino` al destructuring gia' presente in cima al file (riga 3):

```js
const { formattaStato, validaClienteForm, classeUrgenza, giorniResiduiCestino } = require('../js/validators.js');
```

e rimuovi il require duplicato in fondo.

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `node --test test/validators.test.js`
Expected: FAIL - `giorniResiduiCestino is not a function` (o `is not defined`)

- [ ] **Step 3: Implementare la funzione in js/validators.js**

Aggiungi dopo `classeUrgenza` (dopo la riga `}` che chiude quella funzione, prima di `validaClienteForm`):

```js
function giorniResiduiCestino(cancellatoIl, oggi = new Date()) {
  const soloData = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffGiorni = Math.round((soloData(oggi) - soloData(new Date(cancellatoIl))) / 86400000);
  return Math.max(0, 30 - diffGiorni);
}
```

Aggiorna l'ultima riga del file (`module.exports`) includendo la nuova funzione:

```js
if (typeof module !== 'undefined') {
  module.exports = { formattaStato, validaClienteForm, ETICHETTE_STATO, classeStato, formattaData, formattaMese, formattaEuro, classeUrgenza, giorniResiduiCestino };
}
```

- [ ] **Step 4: Eseguire di nuovo i test**

Run: `node --test test/validators.test.js`
Expected: PASS, tutti i test passano (quelli esistenti + i 3 nuovi).

- [ ] **Step 5: Commit**

```bash
cd "/Users/skafiskafnjak/Library/Mobile Documents/com~apple~CloudDocs/new project/PROGETTI AI/LANDING EVOLUTION/landing-sellers"
git add js/validators.js test/validators.test.js
git commit -m "feat: countdown giorni residui prima della cancellazione dal cestino"
```

---

### Task 2: Stato e metodi cestino in app.js

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consuma: `window.supabaseClient` (client Supabase gia' inizializzato), `this.isAdmin`, `this.filtroVenditoreId`, `this.sessione` (stato gia' esistente in `appState()`), `this.caricaClienti()` (Task esistente, ricarica la lista principale dopo un ripristino).
- Produce: `this.cestino` (array), `this.erroreCestino` (string), `this.apriCestino()`, `this.ripristinaCliente(clienteId)` - usati dal Task 3 (markup).

- [ ] **Step 1: Aggiungere lo stato**

In `js/app.js`, dentro l'oggetto ritornato da `appState()`, subito dopo la riga `confermaEliminazione: false,` (circa riga 27), aggiungi:

```js
    cestino: [],
    erroreCestino: '',
```

- [ ] **Step 2: Aggiungere i metodi**

Subito dopo il metodo `confermaEliminaCliente()` esistente (che termina con `this.view = 'lista'; },` intorno alla riga 215), aggiungi:

```js
    async caricaCestino() {
      this.erroreCestino = '';
      let query = window.supabaseClient.from('clienti').select('*')
        .not('cancellato_il', 'is', null)
        .order('cancellato_il', { ascending: false });
      if (this.isAdmin && this.filtroVenditoreId) {
        query = query.eq('venditore_id', this.filtroVenditoreId);
      } else if (!this.isAdmin) {
        query = query.eq('venditore_id', this.sessione.user.id);
      }
      const { data, error } = await query;
      if (error) { this.erroreCestino = 'Errore nel caricare il cestino: ' + error.message; return; }
      this.cestino = data;
    },

    async apriCestino() {
      this.view = 'cestino';
      await this.caricaCestino();
    },

    async ripristinaCliente(clienteId) {
      const { error } = await window.supabaseClient.from('clienti')
        .update({ cancellato_il: null }).eq('id', clienteId);
      if (error) { this.erroreCestino = 'Ripristino fallito: ' + error.message; return; }
      await this.caricaCestino();
      await this.caricaClienti();
    },
```

- [ ] **Step 3: Verifica manuale - metodi esposti**

Con un server locale attivo (`python3 -m http.server 8000` dentro la cartella del progetto), apri `http://localhost:8000`, fai login, apri la console (F12) e digita:

```js
document.querySelector('#app').__x.$data.apriCestino
```

Expected: stampa `ƒ apriCestino() {...}` (la funzione esiste ed e' collegata allo stato Alpine). Se stampa `undefined`, controlla che il blocco incollato al passo 2 sia dentro l'oggetto ritornato da `appState()` e non fuori.

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "feat: stato e metodi per caricare e ripristinare il cestino clienti"
```

---

### Task 3: Markup vista cestino

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consuma: `this.cestino`, `this.erroreCestino`, `this.apriCestino()`, `this.ripristinaCliente(id)` (Task 2); `formattaData(data)`, `giorniResiduiCestino(cancellatoIl)` (Task 1, gia' caricato globalmente via `<script src="js/validators.js">`).

- [ ] **Step 1: Aggiungere l'icona Cestino nell'header della lista clienti**

In `index.html`, dentro il blocco `<!-- LISTA CLIENTI -->`, nel `<div class="brandbar">`, subito prima del bottone "Controlla aggiornamenti" (circa riga 70), aggiungi:

```html
          <button class="iconbtn" @click="apriCestino()" aria-label="Cestino">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
```

- [ ] **Step 2: Aggiungere la view cestino**

Subito dopo la chiusura del `<div x-show="view === 'lista'">` (cerca `</div>` che chiude quel blocco, prima del commento `<!-- POPUP CONFERMA ELIMINAZIONE -->`), aggiungi:

```html
    <!-- CESTINO -->
    <div x-show="view === 'cestino'">
      <div class="brandbar">
        <div class="brand"><span class="bdot"></span><span>LANDING EVOLUTION</span></div>
      </div>
      <div class="topbar">
        <button type="button" class="linkback" @click="view = 'lista'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>Torna alla lista
        </button>
        <h1 style="font-size:19px">Cestino</h1>
      </div>
      <div class="content">
        <p x-show="erroreCestino" x-text="erroreCestino" class="err" style="margin-bottom:14px"></p>

        <template x-for="cliente in cestino" :key="cliente.id">
          <div class="card-cliente">
            <div class="cc-top">
              <strong x-text="cliente.nome"></strong>
              <button type="button" class="btn btn-ghost" style="width:auto;padding:8px 14px;font-size:12.5px" @click="ripristinaCliente(cliente.id)">Ripristina</button>
            </div>
            <span class="cc-next">Eliminato il <span x-text="formattaData(cliente.cancellato_il)"></span> - rimosso tra <span x-text="giorniResiduiCestino(cliente.cancellato_il)"></span> giorni</span>
          </div>
        </template>

        <div x-show="cestino.length === 0 && !erroreCestino" class="empty">
          <div class="glyph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></div>
          <p>Cestino vuoto.<br>I clienti eliminati compaiono qui per 30 giorni.</p>
        </div>
      </div>
    </div>
```

- [ ] **Step 3: Verifica manuale - navigazione e caricamento**

Con il server locale attivo, fai login come venditore, apri la lista clienti, elimina un cliente di prova (bottone elimina nella scheda cliente -> conferma). Torna alla lista, clicca l'icona Cestino appena aggiunta nell'header. Expected: la view cambia, il cliente appena eliminato appare con testo "Eliminato il {data di oggi} - rimosso tra 30 giorni".

- [ ] **Step 4: Verifica manuale - ripristino**

Nella vista Cestino, clicca "Ripristina" sul cliente di prova. Expected: il cliente sparisce dalla lista del cestino (query ricaricata), premi "Torna alla lista": il cliente e' di nuovo visibile nella lista clienti normale con lo stato che aveva prima dell'eliminazione.

- [ ] **Step 5: Verifica manuale - stato vuoto**

Con il cestino vuoto (dopo il ripristino del passo precedente, se non ci sono altri clienti eliminati), apri di nuovo la vista Cestino. Expected: messaggio "Cestino vuoto. I clienti eliminati compaiono qui per 30 giorni." al posto della lista.

- [ ] **Step 6: Eseguire l'intera suite di test automatici**

Run: `node --test test/*.test.js`
Expected: PASS, tutti i test passano (nessuna regressione dal markup, che non tocca codice testato).

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: vista cestino con ripristino self-service dei clienti eliminati"
```

---

## Self-review

**Copertura spec:** navigazione da icona nell'header (Task 3 Step 1), scoping venditore/admin identico a `caricaClienti()` (Task 2 Step 2, stessa logica `filtroVenditoreId`/`sessione.user.id`), countdown 30 giorni (Task 1), ripristino senza popup di conferma (Task 2 Step 2, nessun modale coinvolto), stato vuoto (Task 3 Step 2), gestione errori inline senza fallback silenziosi (`erroreCestino` in ogni metodo Task 2). Tutte le sezioni dello spec `docs/superpowers/specs/2026-09-01-cestino-clienti-design.md` hanno un task corrispondente. Fuori scope dello spec (cancellazione manuale immediata, ricerca nel cestino, notifiche) correttamente esclusi da questo piano.

**Placeholder:** nessuno - ogni step ha codice completo, nessun "TBD" o "handle edge cases" generico.

**Coerenza tipi/nomi:** `giorniResiduiCestino(cancellatoIl, oggi)`, `caricaCestino()`, `apriCestino()`, `ripristinaCliente(clienteId)`, `cestino`, `erroreCestino` sono definiti una volta (Task 1/2) e riusati con lo stesso nome nel Task 3 senza variazioni. `formattaData` e `card-cliente`/`cc-top`/`cc-next`/`empty`/`err` riusano funzioni e classi CSS gia' esistenti nel progetto, non ridefinite.
