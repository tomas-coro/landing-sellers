# Dashboard clienti, pacchetto/prezzo, scheda ad accordion - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trasformare la lista clienti in una dashboard (pipeline + incassi, con ordinamento), aggiungere campi facoltativi di pacchetto/prezzo al cliente, e riorganizzare la scheda cliente in sezioni ad accordion.

**Architecture:** App statica esistente (Alpine.js + Supabase, un solo `index.html` con tutte le viste, logica in `js/app.js`, helper puri in `js/validators.js`). Nessun nuovo file JS/CSS separato: si estende lo stato Alpine esistente (`appState()`) e si aggiungono classi CSS coerenti con quelle già in `css/style.css` (`.stack-card`, `.chip-stato`, `.stato-current`). Nessuna nuova tabella DB: tre colonne opzionali in più su `clienti`.

**Tech Stack:** Alpine.js 3 (CDN), Supabase JS v2 (CDN), CSS vanilla, Node `node:test` per i test di `validators.js`.

## Global Constraints

- Tutti i campi nuovi (`nome_pacchetto`, `note_prezzo`, `data_rinnovo`) sono facoltativi: il form resta salvabile con solo il Nome cliente.
- Nessuna nuova tabella: un solo prezzo per cliente, arricchito di dettagli.
- Vista `admin` (dashboard multi-venditore) non va toccata.
- Testo utente sempre in italiano, coerente con le etichette esistenti.
- Niente trattino lungo (em/en dash) in codice, commenti o testo UI: solo `-`.
- Segui lo spec: `docs/superpowers/specs/2026-09-01-dashboard-clienti-design.md`.

---

## File Structure

- `supabase/migration_2026_09_01_pacchetti.sql` - nuova migration, colonne opzionali su `clienti`.
- `supabase/schema.sql` - aggiornato con le stesse colonne, per restare lo specchio dello stato finale del DB.
- `js/validators.js` - nuova funzione `validaDataRinnovo` + integrazione in `validaClienteForm`.
- `test/validators.test.js` - nuovi casi per la validazione di `data_rinnovo`.
- `js/app.js` - `formModuloVuoto()`, `apriModificaCliente()` estesi con i 3 campi; nuovi metodi `conteggiPerStato()`, `impostaOrdinamento()`, `clientiFiltrati()` esteso con sort; `apriScheda()` e nuovo metodo `toggleAccordion()` per lo stato dell'accordion scheda.
- `index.html` - form "Nuovo cliente" con i 3 campi in più; riga chip di ordinamento nella lista; chip-stato con conteggio; scheda cliente riorganizzata in 4 blocchi accordion.
- `css/style.css` - nuove classi `.accordion-section`, `.accordion-header`, `.accordion-body`.

---

### Task 1: Migration DB + validazione data_rinnovo

**Files:**
- Create: `supabase/migration_2026_09_01_pacchetti.sql`
- Modify: `supabase/schema.sql:11-20` (blocco colonne tabella `clienti`)
- Modify: `js/validators.js:62-74` (`validaClienteForm`)
- Test: `test/validators.test.js`

**Interfaces:**
- Produces: `validaClienteForm(dati)` accetta ora anche `dati.data_rinnovo` (stringa `YYYY-MM-DD` o vuota/null) e popola `errori.data_rinnovo` se non valida.

- [ ] **Step 1: Scrivi i test che falliscono per la validazione di `data_rinnovo`**

Aggiungi in fondo a `test/validators.test.js` (dopo l'ultimo `test(...)` esistente, riga 34):

```js
test('validaClienteForm accetta data_rinnovo assente', () => {
  const r = validaClienteForm({ nome: 'X' });
  assert.strictEqual(r.valido, true);
  assert.strictEqual(r.errori.data_rinnovo, undefined);
});

test('validaClienteForm accetta data_rinnovo valida', () => {
  const r = validaClienteForm({ nome: 'X', data_rinnovo: '2026-12-01' });
  assert.strictEqual(r.valido, true);
});

test('validaClienteForm rifiuta data_rinnovo non valida', () => {
  const r = validaClienteForm({ nome: 'X', data_rinnovo: 'non-una-data' });
  assert.strictEqual(r.valido, false);
  assert.strictEqual(r.errori.data_rinnovo, 'La data di rinnovo non è valida');
});
```

- [ ] **Step 2: Esegui i test e verifica che i due nuovi casi falliscano**

Run: `node --test test/validators.test.js`
Expected: FAIL sul caso "rifiuta data_rinnovo non valida" (oggi `errori.data_rinnovo` non esiste mai, quindi `r.valido` resta `true`).

- [ ] **Step 3: Aggiungi la validazione in `js/validators.js`**

Modifica `validaClienteForm` (righe 62-74) aggiungendo il controllo prima del `return`:

```js
function validaClienteForm(dati) {
  const errori = {};
  if (!dati.nome || !dati.nome.trim()) {
    errori.nome = 'Il nome cliente è obbligatorio';
  }
  if (dati.importo_abbonamento != null && dati.importo_abbonamento < 0) {
    errori.importo_abbonamento = 'L\'importo non può essere negativo';
  }
  if (dati.sito_url && dati.sito_url.trim() && !/^https?:\/\//i.test(dati.sito_url.trim())) {
    errori.sito_url = 'L\'URL deve iniziare con http:// o https://';
  }
  if (dati.data_rinnovo && isNaN(new Date(dati.data_rinnovo).getTime())) {
    errori.data_rinnovo = 'La data di rinnovo non è valida';
  }
  return { valido: Object.keys(errori).length === 0, errori };
}
```

- [ ] **Step 4: Esegui i test e verifica che passino tutti**

Run: `node --test test/validators.test.js`
Expected: PASS su tutti i test, incluso il file `test/auth.test.js` non toccato (esegui `node --test` senza argomenti per lanciare l'intera suite).

- [ ] **Step 5: Scrivi la migration SQL**

Crea `supabase/migration_2026_09_01_pacchetti.sql`:

```sql
-- supabase/migration_2026_09_01_pacchetti.sql
-- Da eseguire una volta sola nell'SQL Editor di Supabase (dashboard progetto).
-- Aggiunge dettagli facoltativi di pacchetto/prezzo al cliente. Resta un solo
-- prezzo per cliente (importo_abbonamento, gia' esistente): questi campi
-- arricchiscono quel prezzo, non lo sostituiscono ne' introducono pacchetti
-- multipli.

alter table public.clienti
  add column nome_pacchetto text default '',
  add column note_prezzo text default '',
  add column data_rinnovo date;
```

- [ ] **Step 6: Aggiorna `supabase/schema.sql` con le stesse colonne**

In `supabase/schema.sql`, dentro `create table public.clienti (...)` (righe 11-20), aggiungi le tre colonne subito dopo `importo_abbonamento numeric default 0,` (riga 19):

```sql
  importo_abbonamento numeric default 0,
  nome_pacchetto text default '',
  note_prezzo text default '',
  data_rinnovo date,
```

- [ ] **Step 7: Commit**

```bash
git add supabase/migration_2026_09_01_pacchetti.sql supabase/schema.sql js/validators.js test/validators.test.js
git commit -m "feat: aggiungi campi facoltativi pacchetto/prezzo al cliente"
```

---

### Task 2: Campi pacchetto nel form Nuovo/Modifica cliente

**Files:**
- Modify: `js/app.js:2-5` (`formModuloVuoto`)
- Modify: `js/app.js:138-149` (`apriModificaCliente`)
- Modify: `index.html:230-234` (form "Nuovo cliente", dopo il campo Importo)

**Interfaces:**
- Consumes: `validaClienteForm(dati)` da Task 1 (già valida `data_rinnovo` se presente).
- Produces: `nuovoClienteForm` ora ha le chiavi `nome_pacchetto`, `note_prezzo`, `data_rinnovo` accanto a `importo_abbonamento`. `salvaCliente()` (già esistente, righe 151-174) non richiede modifiche: fa già `insert`/`update` con `{ ...this.nuovoClienteForm }`, quindi propaga da sola i nuovi campi.

- [ ] **Step 1: Estendi `formModuloVuoto()`**

In `js/app.js:2-5`, sostituisci:

```js
function formModuloVuoto() {
  return { nome: '', referente: '', telefono: '', email: '',
    piva: '', iban: '', sito_url: '', importo_abbonamento: null };
}
```

con:

```js
function formModuloVuoto() {
  return { nome: '', referente: '', telefono: '', email: '',
    piva: '', iban: '', sito_url: '', importo_abbonamento: null,
    nome_pacchetto: '', note_prezzo: '', data_rinnovo: null };
}
```

- [ ] **Step 2: Estendi `apriModificaCliente()`**

In `js/app.js:138-149`, sostituisci il blocco di assegnazione `this.nuovoClienteForm`:

```js
      this.nuovoClienteForm = {
        nome: c.nome || '', referente: c.referente || '', telefono: c.telefono || '',
        email: c.email || '', piva: c.piva || '', iban: c.iban || '',
        sito_url: c.sito_url || '', importo_abbonamento: c.importo_abbonamento
      };
```

con:

```js
      this.nuovoClienteForm = {
        nome: c.nome || '', referente: c.referente || '', telefono: c.telefono || '',
        email: c.email || '', piva: c.piva || '', iban: c.iban || '',
        sito_url: c.sito_url || '', importo_abbonamento: c.importo_abbonamento,
        nome_pacchetto: c.nome_pacchetto || '', note_prezzo: c.note_prezzo || '',
        data_rinnovo: c.data_rinnovo || null
      };
```

- [ ] **Step 3: Aggiungi i campi nel form HTML**

In `index.html`, dopo il blocco del campo "Importo abbonamento" (righe 230-234, che termina con `</div>` prima di `<p x-show="erroriNuovoCliente.generale"...`), inserisci:

```html
          <div class="field">
            <label>Nome pacchetto/piano</label>
            <input x-model="nuovoClienteForm.nome_pacchetto" placeholder="Es. Sito base">
          </div>
          <div class="field">
            <label>Note prezzo</label>
            <textarea x-model="nuovoClienteForm.note_prezzo" placeholder="Es. scontato i primi 3 mesi"></textarea>
          </div>
          <div class="field">
            <label>Data rinnovo</label>
            <input type="date" x-model="nuovoClienteForm.data_rinnovo">
            <p x-show="erroriNuovoCliente.data_rinnovo" x-text="erroriNuovoCliente.data_rinnovo" class="err"></p>
          </div>
```

- [ ] **Step 4: Verifica manuale**

Apri l'app in locale (es. `python3 -m http.server` dalla root del progetto, poi `http://localhost:8000`), fai login, apri "Nuovo cliente": verifica che i 3 campi nuovi compaiano dopo "Importo abbonamento", che il form si salvi anche lasciandoli vuoti, e che aprendo "Modifica" su un cliente esistente i campi restino vuoti senza errori in console.

- [ ] **Step 5: Commit**

```bash
git add js/app.js index.html
git commit -m "feat: aggiungi campi pacchetto/prezzo al form cliente"
```

---

### Task 3: Ordinamento lista clienti

**Files:**
- Modify: `js/app.js:7-41` (blocco stato in `appState()`)
- Modify: `js/app.js:96-104` (`clientiFiltrati`)
- Modify: `index.html:110-115` (dopo la riga `.filtro-stati` esistente)
- Modify: `css/style.css` (nessuna nuova classe: si riusa `.filtro-stati`/`.chip-stato`)

**Interfaces:**
- Produces: `appState.ordinamento` (`'nome' | 'importo' | 'prossimo_contatto' | 'creato_il'`, default `'prossimo_contatto'` per restare compatibile con l'ordine attuale), `appState.ordinamentoDesc` (bool), metodo `impostaOrdinamento(campo)`. `clientiFiltrati()` applica l'ordinamento dopo i filtri esistenti.

- [ ] **Step 1: Aggiungi lo stato di ordinamento**

In `js/app.js`, dentro `appState()` (dopo `filtroStato: '',` a riga 22), aggiungi:

```js
    ordinamento: 'prossimo_contatto',
    ordinamentoDesc: false,
```

- [ ] **Step 2: Aggiungi `impostaOrdinamento()` ed estendi `clientiFiltrati()`**

Sostituisci il metodo `clientiFiltrati()` in `js/app.js:96-104`:

```js
    clientiFiltrati() {
      const testo = this.filtroTesto.trim().toLowerCase();
      const risultato = this.clienti.filter(c => {
        if (this.filtroStato && c.stato !== this.filtroStato) return false;
        if (!testo) return true;
        return (c.nome || '').toLowerCase().includes(testo)
          || (c.referente || '').toLowerCase().includes(testo);
      });
      return this.ordinaClienti(risultato);
    },

    ordinaClienti(elenco) {
      const campo = this.ordinamento;
      const segno = this.ordinamentoDesc ? -1 : 1;
      const valore = c => {
        if (campo === 'nome') return (c.nome || '').toLowerCase();
        if (campo === 'importo') return Number(c.importo_abbonamento) || null;
        if (campo === 'prossimo_contatto') return c.prossimo_contatto || null;
        return c.creato_il || null;
      };
      return [...elenco].sort((a, b) => {
        const va = valore(a), vb = valore(b);
        if (va === null && vb === null) return 0;
        if (va === null) return 1;
        if (vb === null) return -1;
        if (va < vb) return -1 * segno;
        if (va > vb) return 1 * segno;
        return 0;
      });
    },

    impostaOrdinamento(campo) {
      if (this.ordinamento === campo) {
        this.ordinamentoDesc = !this.ordinamentoDesc;
      } else {
        this.ordinamento = campo;
        this.ordinamentoDesc = campo === 'importo' || campo === 'creato_il';
      }
    },
```

Nota: `valore(a)`/`valore(b)` possono restituire tipi diversi (stringa per nome, numero per importo, stringa data ISO per le altre) ma il confronto `<`/`>` funziona correttamente in ognuno di questi casi presi singolarmente (mai confrontati campi diversi tra loro).

- [ ] **Step 3: Aggiungi la riga di chip ordinamento in HTML**

In `index.html`, subito dopo il blocco `.filtro-stati` esistente (chiude a riga 115 con `</div>`), aggiungi:

```html
        <div class="filtro-stati" x-show="clienti.length > 0">
          <template x-for="opz in [
            { campo: 'nome', etichetta: 'Nome' },
            { campo: 'importo', etichetta: 'Importo' },
            { campo: 'prossimo_contatto', etichetta: 'Prossimo contatto' },
            { campo: 'creato_il', etichetta: 'Più recenti' }
          ]" :key="opz.campo">
            <button type="button" class="chip-stato" :class="{ on: ordinamento === opz.campo }" @click="impostaOrdinamento(opz.campo)">
              <span x-text="opz.etichetta"></span><span x-show="ordinamento === opz.campo" x-text="ordinamentoDesc ? ' ↓' : ' ↑'"></span>
            </button>
          </template>
        </div>
```

- [ ] **Step 4: Verifica manuale**

In locale, apri la lista clienti con almeno 2-3 clienti con nomi/importi/date diverse. Tocca ogni chip di ordinamento e verifica che l'ordine cambi e che un secondo tap sullo stesso chip inverta la direzione (freccia che cambia da ↑ a ↓).

- [ ] **Step 5: Commit**

```bash
git add js/app.js index.html
git commit -m "feat: aggiungi ordinamento clienti in lista (nome, importo, prossimo contatto, data)"
```

---

### Task 4: Dashboard pipeline + restyle incassi

**Files:**
- Modify: `js/app.js:96-113` (area statistiche venditore, dopo `clientiFiltrati`/`ordinaClienti` di Task 3)
- Modify: `index.html:110-115` (chip-stato con conteggio)
- Modify: `index.html:90-105` (card "Totale generato" → blocco dashboard incassi)

**Interfaces:**
- Consumes: `this.clienti` (già caricato da `caricaClienti()`, riga 80-94).
- Produces: `conteggiPerStato()` → oggetto `{ contattato: n, brief_mandato: n, in_lavorazione: n, pubblicato: n }`, calcolato su `this.clienti` (non filtrato da ricerca/stato attivo).

- [ ] **Step 1: Aggiungi `conteggiPerStato()`**

In `js/app.js`, subito dopo `clientiPubblicati()` (righe 107-109), aggiungi:

```js
    conteggiPerStato() {
      const conteggi = { contattato: 0, brief_mandato: 0, in_lavorazione: 0, pubblicato: 0 };
      for (const c of this.clienti) {
        if (conteggi[c.stato] !== undefined) conteggi[c.stato] += 1;
      }
      return conteggi;
    },
```

- [ ] **Step 2: Mostra il conteggio sui chip-stato esistenti**

In `index.html:110-115`, sostituisci il blocco `.filtro-stati` dei filtri per stato:

```html
        <div class="filtro-stati" x-show="clienti.length > 0">
          <button type="button" class="chip-stato" :class="{ on: filtroStato === '' }" @click="filtroStato = ''">Tutti · <span x-text="clienti.length"></span></button>
          <template x-for="s in ['contattato','brief_mandato','in_lavorazione','pubblicato']" :key="s">
            <button type="button" class="chip-stato" :class="{ on: filtroStato === s }" @click="filtroStato = filtroStato === s ? '' : s">
              <span x-text="formattaStato(s)"></span> · <span x-text="conteggiPerStato()[s]"></span>
            </button>
          </template>
        </div>
```

(Questo sostituisce il blocco originale - la riga di ordinamento aggiunta in Task 3 resta subito dopo, invariata.)

- [ ] **Step 3: Restyle del blocco incassi come dashboard**

In `index.html:90-105`, la card esistente ha già tutto il contenuto necessario (totale generato + andamento mensile): cambia solo l'etichetta per renderla più esplicita nel nuovo contesto "dashboard". Sostituisci riga 92:

```html
            <span class="lbl">Totale generato</span>
```

con:

```html
            <span class="lbl">Incassi totali</span>
```

Nessun'altra modifica: la card resta la stessa struttura (`stack-card` con `stato-current` + andamento mensile), solo il contenuto testuale cambia per riflettere che ora sta dentro un blocco dashboard con la pipeline sopra i chip-stato.

- [ ] **Step 4: Verifica manuale**

In locale, apri la lista clienti con clienti in stati diversi: verifica che ogni chip-stato mostri "Etichetta · N" con N corretto, che "Tutti" mostri il totale, e che i conteggi NON cambino quando scrivi nella ricerca (restano calcolati su tutti i clienti, non sui filtrati).

- [ ] **Step 5: Commit**

```bash
git add js/app.js index.html
git commit -m "feat: mostra conteggio pipeline sui chip di stato in lista clienti"
```

---

### Task 5: Scheda cliente ad accordion

**Files:**
- Modify: `css/style.css` (dopo il blocco `.stato-chip.on` a riga 196)
- Modify: `js/app.js:7-41` (stato `appState`)
- Modify: `js/app.js:180-190` (`apriScheda`)
- Modify: `index.html:265-311` (corpo della vista scheda, dal blocco `.stato-current` al termine delle note)

**Interfaces:**
- Consumes: `clienteSelezionato()` (già esistente, riga 176-178).
- Produces: `appState.schedaAperture` (oggetto `{ stato, pacchetto, contatti, note }`, booleani), metodo `toggleAccordion(sezione)`.

- [ ] **Step 1: Aggiungi le classi CSS per l'accordion**

In `css/style.css`, dopo `.stato-chip.on{...}` (riga 196), aggiungi:

```css
/* --- accordion scheda cliente --- */
.accordion-section{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);margin-bottom:12px;overflow:hidden}
.accordion-header{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;
  padding:14px 16px;background:none;border:none;font-family:var(--sans);font-size:12.5px;font-weight:800;
  letter-spacing:.02em;color:var(--ink);cursor:pointer;text-align:left}
.accordion-header svg{width:16px;height:16px;flex:none;color:var(--muted);transition:transform .15s var(--ease)}
.accordion-header.open svg{transform:rotate(180deg)}
.accordion-body{padding:0 16px 16px}
```

- [ ] **Step 2: Aggiungi lo stato dell'accordion in `appState()`**

In `js/app.js`, dopo `erroreScheda: '',` (riga 34), aggiungi:

```js
    schedaAperture: { stato: true, pacchetto: false, contatti: false, note: true },
```

- [ ] **Step 3: Calcola i default dell'accordion in `apriScheda()` e aggiungi `toggleAccordion()`**

Sostituisci `apriScheda()` in `js/app.js:180-190`:

```js
    async apriScheda(clienteId) {
      this.clienteSelezionatoId = clienteId;
      this.view = 'scheda';
      this.erroreScheda = '';
      this.confermaEliminazione = false;
      const cliente = this.clienteSelezionato();
      this.schedaAperture = {
        stato: true,
        pacchetto: !!(cliente.importo_abbonamento || cliente.nome_pacchetto),
        contatti: false,
        note: true
      };
      const { data, error } = await window.supabaseClient
        .from('note').select('*').eq('cliente_id', clienteId)
        .order('creata_il', { ascending: false });
      if (error) { this.erroreScheda = 'Errore nel caricare le note: ' + error.message; return; }
      this.note = data;
    },

    toggleAccordion(sezione) {
      this.schedaAperture[sezione] = !this.schedaAperture[sezione];
    },
```

- [ ] **Step 4: Riorganizza il corpo della scheda in HTML**

In `index.html`, sostituisci l'intero blocco da `<div class="stato-current">` (riga 265) fino alla riga che chiude le note `<p x-show="note.length === 0" ...></p>` (riga 311) con:

```html
        <div class="accordion-section">
          <button type="button" class="accordion-header" :class="{ open: schedaAperture.stato }" @click="toggleAccordion('stato')">
            <span>Stato</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div class="accordion-body" x-show="schedaAperture.stato">
            <div class="stato-current">
              <span class="lbl">Stato attuale</span>
              <span class="pill" :class="'s-' + classeStato(clienteSelezionato().stato)"><i></i><span x-text="formattaStato(clienteSelezionato().stato)"></span></span>
            </div>
            <div class="stato-grid" style="margin-bottom:0">
              <button type="button" class="stato-chip" :class="{ on: clienteSelezionato().stato === 'contattato' }" @click="cambiaStato('contattato')">Contattato</button>
              <button type="button" class="stato-chip" :class="{ on: clienteSelezionato().stato === 'brief_mandato' }" @click="cambiaStato('brief_mandato')">Brief mandato</button>
              <button type="button" class="stato-chip" :class="{ on: clienteSelezionato().stato === 'in_lavorazione' }" @click="cambiaStato('in_lavorazione')">In lavorazione</button>
              <button type="button" class="stato-chip" :class="{ on: clienteSelezionato().stato === 'pubblicato' }" @click="cambiaStato('pubblicato')">Pubblicato</button>
            </div>
          </div>
        </div>

        <div class="accordion-section">
          <button type="button" class="accordion-header" :class="{ open: schedaAperture.pacchetto }" @click="toggleAccordion('pacchetto')">
            <span>Pacchetto e pagamento</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div class="accordion-body" x-show="schedaAperture.pacchetto">
            <dl>
              <dt>Importo</dt><dd x-text="formattaEuro(clienteSelezionato().importo_abbonamento)"></dd>
              <dt>Pacchetto</dt><dd x-text="clienteSelezionato().nome_pacchetto || '-'"></dd>
              <dt>Note prezzo</dt><dd x-text="clienteSelezionato().note_prezzo || '-'"></dd>
              <dt>Rinnovo</dt><dd x-text="clienteSelezionato().data_rinnovo ? formattaData(clienteSelezionato().data_rinnovo) : '-'"></dd>
            </dl>
          </div>
        </div>

        <div class="accordion-section">
          <button type="button" class="accordion-header" :class="{ open: schedaAperture.contatti }" @click="toggleAccordion('contatti')">
            <span>Contatti</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div class="accordion-body" x-show="schedaAperture.contatti">
            <dl>
              <dt>Referente</dt><dd x-text="clienteSelezionato().referente"></dd>
              <dt>Telefono</dt><dd x-text="clienteSelezionato().telefono"></dd>
              <dt>Email</dt><dd x-text="clienteSelezionato().email"></dd>
              <dt>P.IVA</dt><dd x-text="clienteSelezionato().piva"></dd>
              <dt>IBAN</dt><dd x-text="clienteSelezionato().iban"></dd>
            </dl>
            <a x-show="clienteSelezionato().sito_url" :href="clienteSelezionato().sito_url" target="_blank" rel="noopener" class="btn btn-ghost" style="margin-top:12px">
              Apri il sito
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>
            </a>
          </div>
        </div>

        <a href="https://landingevolution.it/brief.html" target="_blank" rel="noopener" class="btn btn-lime" style="margin-bottom:22px">
          Manda a brief
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>
        </a>

        <div class="accordion-section">
          <button type="button" class="accordion-header" :class="{ open: schedaAperture.note }" @click="toggleAccordion('note')">
            <span>Note</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div class="accordion-body" x-show="schedaAperture.note">
            <form @submit.prevent="aggiungiNota()">
              <div class="field" style="margin-top:14px">
                <textarea x-model="nuovaNotaTesto" placeholder="Scrivi una nota..."></textarea>
              </div>
              <button type="submit" class="btn btn-ghost" style="margin-bottom:14px">Aggiungi nota</button>
            </form>
            <template x-for="n in note" :key="n.id">
              <div class="note-item">
                <time x-text="formattaData(n.creata_il)"></time>
                <p x-text="n.testo"></p>
              </div>
            </template>
            <p x-show="note.length === 0" style="color:var(--muted);font-size:13.5px">Nessuna nota ancora.</p>
          </div>
        </div>
```

Nota: il vecchio `<div class="stack-card"><dl>...Importo...</dl></div>` (righe 276-285 originali) è stato eliminato: i suoi contenuti sono ora divisi tra il blocco "Pacchetto e pagamento" (importo + i 3 campi nuovi) e il blocco "Contatti" (referente, telefono, email, piva, iban, link sito). Il vecchio `<h2>Note</h2>` è stato rimosso: il titolo della sezione è ora l'header dell'accordion "Note".

- [ ] **Step 5: Verifica manuale**

In locale, apri la scheda di un cliente:
- senza importo/pacchetto compilati → verifica che "Pacchetto e pagamento" sia chiuso di default, "Stato" e "Note" aperti, "Contatti" chiuso.
- di un cliente con importo compilato (da Task 2/1) → verifica che "Pacchetto e pagamento" sia aperto di default.
- tocca ogni header e verifica che la sezione si apra/chiuda e che la freccia ruoti.
- verifica che cambiare stato, aggiungere una nota, e aprire il link del sito funzionino ancora esattamente come prima.
- esegui `/ui-check` sulla vista scheda per overlap/allineamenti prima di considerarla finita.

- [ ] **Step 6: Esegui l'intera suite di test**

Run: `node --test`
Expected: PASS su tutti i file in `test/` (nessuna regressione dai task precedenti).

- [ ] **Step 7: Commit**

```bash
git add css/style.css js/app.js index.html
git commit -m "feat: riorganizza scheda cliente in sezioni ad accordion"
```

---

## Self-Review

- **Copertura spec:** modello dati → Task 1; dashboard lista (pipeline + incassi) → Task 4; ordinamento → Task 3; form nuovo cliente → Task 2; scheda ad accordion → Task 5. Tutte le sezioni dello spec hanno un task corrispondente.
- **Placeholder:** nessuno - ogni step ha codice completo, nessun "TBD"/"gestisci gli edge case".
- **Coerenza tipi:** `nuovoClienteForm` (Task 2) e `apriModificaCliente` (Task 2) usano le stesse chiavi (`nome_pacchetto`, `note_prezzo`, `data_rinnovo`) lette in scheda da Task 5 (`clienteSelezionato().nome_pacchetto` ecc.) e scritte dalla migration di Task 1. `conteggiPerStato()` (Task 4) e `ordinaClienti()`/`impostaOrdinamento()` (Task 3) sono indipendenti tra loro e da Task 5, nessun conflitto di nomi.
- **Fuori scope confermato:** nessun task tocca la vista `admin`, nessuna nuova tabella pacchetti, nessun contatore "contatti urgenti" in dashboard.
