# Modifica vendita unificata - piano di implementazione

> **Per chi esegue:** usa superpowers:subagent-driven-development oppure superpowers:executing-plans. I passi usano checkbox (`- [ ]`).

**Goal:** i tre punti di modifica nella scheda cliente (matita, "Modifica servizi", "Modifica vendita") portano allo stesso editor di vendita, con una sola regola sugli incassi.

**Architecture:** `modificaVenditaCliente()` (js/app-economia.js:2632, gia' esistente) resta l'unico editor completo. In `js/app-cliente.js` si aggiungono tre piccoli helper (`ciSonoIncassiCliente`, `venditaModificabileCliente`, `modificaServiziCliente`). In `index.html` pulsanti e messaggi leggono gli helper, cosi' la regola vive in un solo posto. Nessuna migrazione.

**Tech Stack:** Alpine.js (mixin in `js/app-*.js`), HTML statico, test con `node --test`.

## Global Constraints

- Nessuna modifica al database ne' ai permessi (scelta A del 06/11/2026): dopo il primo incasso la vendita non e' modificabile da nessuno, admin compreso.
- Italiano ovunque, trattino `-` semplice, mai em/en dash.
- Niente commit senza conferma di Tomas: l'ultimo step e' "mostra cosa verrebbe committato", non il commit.
- Bump del service worker prima del push: `CACHE_NAME` in `service-worker.js` (oggi `v206`) e `?v=` nella `register()` di `index.html:7867` devono coincidere (lo verifica `test/pwa-shell.test.js`).
- Baseline test: oggi `node --test test/*.test.js` fa 273 test e 32 falliscono gia' (non dipendono da questo lavoro). L'elenco e' in `scratchpad/baseline-fail.txt`. Dopo il lavoro non devono comparire fallimenti nuovi. Nota: `node --test test/` (cartella) non funziona, usa il glob.

## File toccati

| File | Cosa cambia |
|---|---|
| `js/app-cliente.js` | 3 helper nuovi prima di `apriEditorServiziCliente` (~riga 1071) |
| `index.html` | pulsante e testo "Modifica servizi" (~5446-5452), blocco "Modifica vendita"/incassi (~6019-6027), form matita (~4596 e ~4668) |
| `test/modifica-vendita-unificata.test.js` | nuovo |
| `service-worker.js`, `index.html:7867` | bump versione (Task 4) |

---

### Task 1: helper di instradamento

**Files:**
- Modify: `js/app-cliente.js` (prima di `apriEditorServiziCliente() {`)
- Test: `test/modifica-vendita-unificata.test.js` (nuovo)

**Interfaces:**
- Produces:
  - `ciSonoIncassiCliente(): boolean` - true se in `pagamentiCliente` c'e' una rata con `stato === 'incassato'`.
  - `venditaModificabileCliente(): boolean` - true se c'e' una vendita attiva (`venditaClienteAttiva?.id`) e nessun incasso.
  - `modificaServiziCliente()` - se `venditaModificabileCliente()` chiama `this.modificaVenditaCliente()`, altrimenti `this.apriEditorServiziCliente()`.

- [ ] **Step 1: scrivere il test che fallisce**

Creare `test/modifica-vendita-unificata.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { appState } = require('../js/app.js');

function statoConVendita(pagamenti) {
  const s = appState();
  s.venditaClienteAttiva = { id: 'v1' };
  s.pagamentiCliente = pagamenti;
  s.chiamate = [];
  s.modificaVenditaCliente = async () => { s.chiamate.push('vendita'); };
  s.apriEditorServiziCliente = () => { s.chiamate.push('servizi'); };
  return s;
}

test('senza incassi "Modifica servizi" apre l\'editor di vendita completo', async () => {
  const s = statoConVendita([{ stato: 'previsto' }]);
  assert.equal(s.ciSonoIncassiCliente(), false);
  assert.equal(s.venditaModificabileCliente(), true);
  await s.modificaServiziCliente();
  assert.deepEqual(s.chiamate, ['vendita']);
});

test('con incassi "Modifica servizi" apre solo l\'editor descrittivo', async () => {
  const s = statoConVendita([{ stato: 'incassato' }, { stato: 'previsto' }]);
  assert.equal(s.ciSonoIncassiCliente(), true);
  assert.equal(s.venditaModificabileCliente(), false);
  await s.modificaServiziCliente();
  assert.deepEqual(s.chiamate, ['servizi']);
});

test('senza vendita attiva "Modifica servizi" apre l\'editor descrittivo', async () => {
  const s = statoConVendita([]);
  s.venditaClienteAttiva = null;
  assert.equal(s.venditaModificabileCliente(), false);
  await s.modificaServiziCliente();
  assert.deepEqual(s.chiamate, ['servizi']);
});
```

- [ ] **Step 2: verificare che fallisca**

Run: `node --test test/modifica-vendita-unificata.test.js`
Atteso: FAIL con `s.ciSonoIncassiCliente is not a function`.

- [ ] **Step 3: implementare gli helper**

In `js/app-cliente.js`, subito prima di `apriEditorServiziCliente() {`:

```js
    // Regola unica sugli incassi: dopo il primo incasso la vendita non si
    // riscrive piu' (lo impone anche sostituisci_vendita nel database).
    ciSonoIncassiCliente() {
      return (this.pagamentiCliente || []).some(p => p.stato === 'incassato');
    },

    venditaModificabileCliente() {
      return !!this.venditaClienteAttiva?.id && !this.ciSonoIncassiCliente();
    },

    // "Modifica servizi" e "Modifica vendita" portano allo stesso editor.
    // Con incassi resta solo l'editor descrittivo (non tocca importo e rate).
    modificaServiziCliente() {
      if (this.venditaModificabileCliente()) {
        return this.modificaVenditaCliente();
      }
      return this.apriEditorServiziCliente();
    },

```

- [ ] **Step 4: verificare che passi**

Run: `node --test test/modifica-vendita-unificata.test.js`
Atteso: 3 test PASS.

---

### Task 2: pulsanti e messaggi della scheda

**Files:**
- Modify: `index.html` (accordion "Servizi e pacchetto" ~5438-5456; blocco "Modifica vendita" ~6019-6027)
- Test: `test/modifica-vendita-unificata.test.js` (aggiungere)

**Interfaces:**
- Consumes: `modificaServiziCliente()`, `venditaModificabileCliente()`, `ciSonoIncassiCliente()` dal Task 1.

- [ ] **Step 1: aggiungere i test HTML che falliscono**

In fondo a `test/modifica-vendita-unificata.test.js`:

```js
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('"Modifica servizi" passa dall\'instradamento unico, non dall\'editor descrittivo', () => {
  assert.match(html, /@click="modificaServiziCliente\(\)"/);
  assert.doesNotMatch(html, /@click="apriEditorServiziCliente\(\)"/);
});

test('"Modifica vendita" si vede solo se la vendita e\' modificabile', () => {
  assert.match(
    html,
    /x-show="venditaModificabileCliente\(\)"[\s\S]{0,120}@click="modificaVenditaCliente\(\)"/
  );
});

test('con incassi il messaggio e\' corretto e vale per tutti, admin compreso', () => {
  assert.doesNotMatch(html, /chiedi all'admin/);
  assert.match(
    html,
    /x-show="ciSonoIncassiCliente\(\)"[\s\S]{0,200}non si puo' piu' modificare/
  );
});
```

- [ ] **Step 2: verificare che falliscano**

Run: `node --test test/modifica-vendita-unificata.test.js`
Atteso: i 3 nuovi test FAIL, i 3 del Task 1 PASS.

- [ ] **Step 3: pulsante "Modifica servizi"**

In `index.html` (~riga 5446) sostituire

```html
                  @click="apriEditorServiziCliente()">
                  Modifica servizi
```

con

```html
                  @click="modificaServiziCliente()">
                  Modifica servizi
```

- [ ] **Step 4: testo sotto il pulsante**

Subito sotto (~riga 5451) sostituire

```html
              <small>
                La modifica dei servizi aggiorna la descrizione
                del pacchetto ma non ricalcola il prezzo storico.
              </small>
```

con

```html
              <small x-show="venditaModificabileCliente()">
                Apre l'editor della vendita: servizi, pagamento e importo
                si correggono insieme.
              </small>
              <small x-show="!venditaModificabileCliente()">
                La modifica dei servizi aggiorna la descrizione
                del pacchetto ma non ricalcola il prezzo storico.
              </small>
```

- [ ] **Step 5: pulsante "Modifica vendita" e messaggio incassi**

In `index.html` (~riga 6019-6027) sostituire

```html
              x-show="!pagamentiCliente.some(p => p.stato === 'incassato')"
              @click="modificaVenditaCliente()">
```

con

```html
              x-show="venditaModificabileCliente()"
              @click="modificaVenditaCliente()">
```

e sostituire

```html
              x-show="!isAdmin && pagamentiCliente.some(p => p.stato === 'incassato')">
              Ci sono incassi registrati: per cambiare questa vendita chiedi all'admin.
```

con

```html
              x-show="ciSonoIncassiCliente()">
              Ci sono incassi registrati: la vendita non si puo' piu' modificare.
              Dai servizi puoi ancora correggere solo la descrizione.
```

- [ ] **Step 6: verificare**

Run: `node --test test/modifica-vendita-unificata.test.js test/annulla-vendita.test.js`
Atteso: tutti PASS (annulla-vendita controlla ancora `modificaVenditaCliente()` e il pulsante admin "Annulla vendita").

---

### Task 3: form della matita senza servizi/prezzo quando c'e' una vendita

**Files:**
- Modify: `index.html` (~4596 legacy, ~4668 builder)
- Test: `test/modifica-vendita-unificata.test.js` (aggiungere)

- [ ] **Step 1: aggiungere il test che fallisce**

```js
test('il form della matita non duplica servizi e prezzo se c\'e\' una vendita attiva', () => {
  assert.match(
    html,
    /x-show="clienteInModificaId && selezionePrezzo\.modalita === 'legacy' && !venditaClienteAttiva\?\.id"/
  );
  assert.match(
    html,
    /x-show="clienteInModificaId && selezionePrezzo\.modalita !== 'legacy' && !venditaClienteAttiva\?\.id"/
  );
  assert.match(
    html,
    /x-show="clienteInModificaId && venditaClienteAttiva\?\.id"[\s\S]{0,900}modificaVenditaCliente\(\)/
  );
});
```

- [ ] **Step 2: verificare che fallisca**

Run: `node --test test/modifica-vendita-unificata.test.js`
Atteso: il nuovo test FAIL.

- [ ] **Step 3: nascondere le due sezioni prezzo**

In `index.html` sostituire (riga ~4598)

```html
            x-show="clienteInModificaId && selezionePrezzo.modalita === 'legacy'"
```

con

```html
            x-show="clienteInModificaId && selezionePrezzo.modalita === 'legacy' && !venditaClienteAttiva?.id"
```

e (riga ~4669)

```html
            x-show="clienteInModificaId && selezionePrezzo.modalita !== 'legacy'">
```

con

```html
            x-show="clienteInModificaId && selezionePrezzo.modalita !== 'legacy' && !venditaClienteAttiva?.id">
```

- [ ] **Step 4: aggiungere il blocco "Vendita" prima del blocco legacy**

Subito prima di `<div x-show="clienteInModificaId && selezionePrezzo.modalita === 'legacy' && !venditaClienteAttiva?.id" ...>` (riga ~4596) inserire:

```html
          <section
            class="client-form-section"
            x-show="clienteInModificaId && venditaClienteAttiva?.id">
            <div class="client-form-section-head">
              <span>02</span>
              <div>
                <strong>Vendita e servizi</strong>
                <small>Servizi, pagamento e importo si correggono insieme</small>
              </div>
            </div>
            <button
              type="button"
              class="btn btn-primary"
              x-show="venditaModificabileCliente()"
              @click="modificaVenditaCliente()">
              Modifica vendita
            </button>
            <p
              style="color:var(--muted);font-size:15px"
              x-show="ciSonoIncassiCliente()">
              Ci sono incassi registrati: la vendita non si puo' piu' modificare.
            </p>
          </section>

```

Se ci sono modifiche non salvate, `apriEconomia` chiede gia' conferma (`confermaUscitaFormCliente`, js/app-economia.js:227): nessun codice extra.

- [ ] **Step 5: verificare**

Run: `node --test test/modifica-vendita-unificata.test.js`
Atteso: tutti PASS.

---

### Task 4: bump, suite completa, prova a mano

**Files:**
- Modify: `service-worker.js:2`, `index.html:7867`

- [ ] **Step 1: bump versione**

`service-worker.js` riga 2: `'venditori-le-shell-v206'` -> `'venditori-le-shell-v207'`.
`index.html` riga 7867: `service-worker.js?v=206` -> `service-worker.js?v=207`.

- [ ] **Step 2: suite completa contro la baseline**

Run:

```bash
node --test test/*.test.js 2>&1 | grep -E "^✖" | sort -u > /tmp/dopo.txt
diff <(sed 's/ ([0-9.]*ms)//' scratchpad/baseline-fail.txt) <(sed 's/ ([0-9.]*ms)//' /tmp/dopo.txt)
```

Atteso: nessuna riga `>` (nessun fallimento nuovo). `test/pwa-shell.test.js` deve passare.

- [ ] **Step 3: prova a mano (la fa Tomas, ~5 minuti)**

1. Cliente con vendita senza incassi: "Modifica servizi" e "Modifica vendita" aprono lo stesso editor. Cambia un servizio, controlla che l'importo si ricalcoli, salva.
2. Stesso cliente, matita: niente sezione prezzo, c'e' il pulsante "Modifica vendita".
3. Cliente con un incasso: "Modifica vendita" assente, messaggio nuovo ovunque, "Modifica servizi" apre l'editor descrittivo.
4. Cliente senza vendita: la matita mostra ancora "Offerta e servizi".

- [ ] **Step 4: mostrare cosa verrebbe committato (senza committare)**

Run: `git status --short` e `git diff --stat`.
Proporre a Tomas il messaggio `feat: unifica la modifica della vendita nella scheda cliente`. Commit e push solo dopo il suo ok.
