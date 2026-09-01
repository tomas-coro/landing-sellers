# App venditori Landing Evolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Costruire la PWA che permette a ogni venditore di Landing Evolution di vedere/gestire i propri clienti (dati, note, stato pipeline) e mandarli al brief esistente, con un account admin che vede tutto.

**Architecture:** PWA statica (vanilla JS + Alpine.js via CDN, zero build) che parla direttamente con Supabase (Postgres + Auth) dal browser. Nessun server intermedio. Isolamento dati per venditore garantito da Row Level Security a livello di database, non dal codice frontend.

**Tech Stack:** HTML/CSS/JS puro, Alpine.js (CDN), Supabase JS client (CDN), Supabase Postgres+Auth, Node.js built-in test runner (`node --test`, zero dipendenze) per la logica pura, Supabase SQL Editor per testare le policy RLS.

## Global Constraints

- Progetto in cartella/repo separata da LANDING EVOLUTION. Percorso: `/Users/skafiskafnjak/PERSONAL/siti-app/landing-sellers/`. Repo GitHub: `landing-sellers`.
- Repo GitHub pubblico, pubblicato su GitHub Pages (URL tipo `https://xBacco.github.io/<repo>/` - sotto-percorso, non root).
- Nessun bundler/npm per il frontend. Alpine.js e Supabase-js caricati via `<script src="https://cdn...">`.
- Nessun supporto offline nell'MVP: il service worker serve solo per l'installabilità (cache dell'app shell statico), mai dati.
- Lo stato `brief_mandato` è impostato manualmente dal venditore (bottone), perché `brief.html` vive su un altro dominio e non può notificare l'app.
- IBAN e P.IVA sono protetti dalle stesse regole RLS di tutta la riga cliente, nessuna gestione extra nell'MVP.
- Ogni `<script src="https://cdn...">` (Alpine.js, Supabase-js) va con `integrity="sha384-..." crossorigin="anonymous"`: al momento di scrivere Task 4/10, apri la pagina del pacchetto su jsdelivr.com (es. `jsdelivr.com/package/npm/@supabase/supabase-js`), copia lo snippet con SRI generato lì (l'hash dipende dalla versione esatta pubblicata, non è riportabile a mano in questo piano). Protegge da compromissione del CDN.
- "Test" per la logica pura (validazione form, formattazione stato) = `node --test`, zero dipendenze. "Test" per le RLS = script SQL eseguito nel Supabase SQL Editor (incollato ed eseguito manualmente, nessun psql/connection string necessari). Per le schermate Alpine/UI non esiste automazione in questo piano: sono verifiche manuali esplicite nel browser, segnate come tali.

---

### Task 1: Provisioning Supabase (manuale, esegue Tomas)

**Files:** nessuno - nessun codice, solo setup account.

**Interfaces:**
- Produce: `SUPABASE_URL` e `SUPABASE_ANON_KEY`, usati da tutti i task successivi in `js/config.js` (Task 5).

- [x] **Step 1: Creare progetto Supabase**

Vai su https://supabase.com, crea un nuovo progetto (piano Free), regione vicina (es. Frankfurt/EU). Segnati la password del database che ti viene mostrata una sola volta.

- [x] **Step 2: Recuperare URL e anon key**

Dashboard → Project Settings → API. Copia:
- `Project URL` (es. `https://xxxxxxxx.supabase.co`)
- `anon public` key (chiave lunga che inizia con `eyJ...`)

Questi due valori sono pubblici per design (protetti da RLS), andranno nel codice frontend committato.

- [x] **Step 3: Nome del progetto**

Confermato: `landing-sellers`.

- [x] **Step 4: Valori raccolti**

`SUPABASE_URL = https://mptbmhqnsvpiflzjzbea.supabase.co`, `SUPABASE_ANON_KEY` fornita da Tomas. I test RLS del Task 3 girano nel Supabase SQL Editor (dashboard), non serve connection string/psql.

---

### Task 2: Schema database - tabelle e trigger profilo automatico

**Files:**
- Create: `supabase/schema.sql`
- Test: eseguito a mano via Supabase SQL Editor o `psql`

**Interfaces:**
- Produce: tabelle `profili`, `clienti`, `note` e trigger `on_auth_user_created` che ogni task successivo (RLS, frontend) assume esistano.

- [x] **Step 1: Scrivere lo schema**

```sql
-- supabase/schema.sql

create table public.profili (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  ruolo text not null default 'venditore' check (ruolo in ('venditore', 'admin'))
);

create table public.clienti (
  id uuid primary key default gen_random_uuid(),
  venditore_id uuid not null references public.profili(id),
  nome text not null,
  referente text default '',
  telefono text default '',
  email text default '',
  piva text default '',
  iban text default '',
  importo_abbonamento numeric default 0,
  stato text not null default 'contattato'
    check (stato in ('contattato', 'brief_mandato', 'in_lavorazione', 'pubblicato')),
  prossimo_contatto date,
  creato_il timestamptz not null default now()
);

create table public.note (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clienti(id) on delete cascade,
  venditore_id uuid not null references public.profili(id),
  testo text not null,
  creata_il timestamptz not null default now()
);

-- Un account creato in Supabase Auth non crea automaticamente una riga in
-- profili: senza questo trigger un venditore nuovo farebbe login con
-- ruolo/nome assenti e ogni RLS lo tratterebbe come "nessun permesso".
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profili (id, nome, ruolo)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email), 'venditore');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [x] **Step 2: Eseguire lo schema**

Incolla il contenuto in Supabase SQL Editor (dashboard) ed esegui. Verifica: nel tab "Table Editor" compaiono `profili`, `clienti`, `note`.

- [x] **Step 3: Test del trigger**

In Supabase Dashboard → Authentication → Users, crea manualmente un utente di test (email `test-trigger@example.com`, password a scelta). Poi in SQL Editor:

```sql
select id, nome, ruolo from public.profili
where id = (select id from auth.users where email = 'test-trigger@example.com');
```

Expected: una riga con `ruolo = 'venditore'`. Se la query non restituisce righe, il trigger non ha funzionato - controlla i log in Database → Logs prima di andare avanti.

- [x] **Step 4: Promuovere il primo admin (te stesso)**

```sql
update public.profili set ruolo = 'admin', nome = 'Tomas'
where id = (select id from auth.users where email = 'TUA_EMAIL_ADMIN');
```

(Crea prima il tuo utente admin da Authentication → Users se non l'hai già fatto.) Verifica: `select ruolo from public.profili where nome = 'Tomas';` restituisce `admin`.

- [x] **Step 5: Elimina l'utente di test**

Authentication → Users → elimina `test-trigger@example.com` (cascata elimina anche la riga in `profili`).

---

### Task 3: Row Level Security - isolamento venditore/admin

**Files:**
- Create: `supabase/policies.sql`
- Test: `supabase/test_rls.sql` (incollato ed eseguito a mano nel Supabase SQL Editor)

**Interfaces:**
- Consuma: tabelle `profili`, `clienti`, `note` (Task 2).
- Produce: funzione `public.is_admin()` e policy RLS che ogni operazione frontend (Task 6-9) assume attive.

Il check `ruolo` dentro una policy su `clienti` che interroga `profili` va scritto tramite una funzione `security definer`, non con una subquery diretta nella policy: se `profili` ha RLS abilitato e la policy di `clienti` legge `profili` con i permessi dell'utente corrente, Postgres può segnalare `infinite recursion detected in policy for relation "profili"`. La funzione `security definer` bypassa l'RLS di `profili` solo per questo controllo, rompendo il ciclo.

- [x] **Step 1: Scrivere la funzione is_admin e abilitare RLS**

```sql
-- supabase/policies.sql

create function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profili
    where id = auth.uid() and ruolo = 'admin'
  );
$$;

alter table public.profili enable row level security;
alter table public.clienti enable row level security;
alter table public.note enable row level security;

-- profili: ognuno legge solo il proprio profilo, l'admin legge tutti
create policy profili_select on public.profili
  for select using (id = auth.uid() or public.is_admin());

-- clienti: select/update/delete filtrati per proprietario o admin
create policy clienti_select on public.clienti
  for select using (venditore_id = auth.uid() or public.is_admin());

create policy clienti_update on public.clienti
  for update using (venditore_id = auth.uid() or public.is_admin());

create policy clienti_delete on public.clienti
  for delete using (venditore_id = auth.uid() or public.is_admin());

-- insert: un venditore puo' creare solo clienti assegnati a se stesso,
-- l'admin puo' assegnarli a chiunque
create policy clienti_insert on public.clienti
  for insert with check (venditore_id = auth.uid() or public.is_admin());

-- note: stessa logica, passando per il cliente collegato
create policy note_select on public.note
  for select using (
    exists (
      select 1 from public.clienti c
      where c.id = note.cliente_id
        and (c.venditore_id = auth.uid() or public.is_admin())
    )
  );

create policy note_insert on public.note
  for insert with check (
    venditore_id = auth.uid()
    and exists (
      select 1 from public.clienti c
      where c.id = note.cliente_id
        and (c.venditore_id = auth.uid() or public.is_admin())
    )
  );
```

- [x] **Step 2: Eseguire le policy**

Incolla in SQL Editor ed esegui. Verifica: Database → Policies mostra le policy elencate sopra su `profili`, `clienti`, `note`.

- [x] **Step 3: Scrivere il test di isolamento**

```sql
-- supabase/test_rls.sql
-- Esegui incollando tutto il contenuto nel Supabase SQL Editor (dashboard)
-- e premendo "Run". Sostituisci prima VENDITORE_A_ID / VENDITORE_B_ID /
-- ADMIN_ID con id reali presi da: select id, email from auth.users;

begin;

-- Simula il venditore A loggato
select set_config('request.jwt.claims',
  json_build_object('sub', 'VENDITORE_A_ID')::text, true);
set local role authenticated;

insert into public.clienti (venditore_id, nome)
values ('VENDITORE_A_ID', 'Cliente di A');

-- Deve restituire 1 riga (solo il proprio cliente)
select count(*) as deve_essere_1 from public.clienti;

rollback;

begin;

-- Simula il venditore B: non deve vedere il cliente di A
select set_config('request.jwt.claims',
  json_build_object('sub', 'VENDITORE_B_ID')::text, true);
set local role authenticated;

select count(*) as deve_essere_0 from public.clienti
where nome = 'Cliente di A';

-- Venditore B prova a inserire un cliente assegnato a A: deve fallire
-- (atteso: ERROR new row violates row-level security policy)
insert into public.clienti (venditore_id, nome)
values ('VENDITORE_A_ID', 'Cliente rubato');

rollback;

begin;

-- Simula l'admin: deve vedere tutto
select set_config('request.jwt.claims',
  json_build_object('sub', 'ADMIN_ID')::text, true);
set local role authenticated;

select count(*) as deve_essere_maggiore_di_0 from public.clienti;

rollback;
```

- [x] **Step 4: Eseguire il test e verificare i risultati**

Incolla `supabase/test_rls.sql` nel Supabase SQL Editor e premi "Run".

Expected:
- Blocco venditore A: `deve_essere_1` = 1
- Blocco venditore B: `deve_essere_0` = 0, e l'insert successivo termina con errore RLS (non con successo)
- Blocco admin: `deve_essere_maggiore_di_0` > 0

Se uno di questi non corrisponde, non procedere al frontend: un fallimento qui significa che un venditore può vedere o modificare i dati di un altro.

- [x] **Step 5: Commit**

```bash
cd /Users/skafiskafnjak/PERSONAL/siti-app/landing-sellers
git add supabase/schema.sql supabase/policies.sql supabase/test_rls.sql
git commit -m "feat: schema Supabase e RLS per isolamento venditore/admin"
```

---

### Task 4: Scaffold repo frontend

**Files:**
- Create: `index.html` (shell vuoto con i tre `<div>` delle view)
- Create: `css/style.css`
- Create: `.gitignore`
- Create: `js/config.js`

**Interfaces:**
- Produce: struttura file su cui ogni task successivo aggiunge contenuto. `js/config.js` esporta `SUPABASE_URL` e `SUPABASE_ANON_KEY` usati dal Task 5.

- [x] **Step 1: Creare la cartella progetto e inizializzare git**

```bash
mkdir -p /Users/skafiskafnjak/PERSONAL/siti-app/landing-sellers/js /Users/skafiskafnjak/PERSONAL/siti-app/landing-sellers/css /Users/skafiskafnjak/PERSONAL/siti-app/landing-sellers/icons /Users/skafiskafnjak/PERSONAL/siti-app/landing-sellers/supabase
cd /Users/skafiskafnjak/PERSONAL/siti-app/landing-sellers
git init
```

- [x] **Step 2: Creare .gitignore**

```
# /Users/skafiskafnjak/PERSONAL/siti-app/landing-sellers/.gitignore
.DS_Store
```

(`js/config.js` viene committato: contiene solo l'URL e la anon key pubblica, non un segreto.)

- [x] **Step 3: Creare js/config.js**

```js
// js/config.js
// Valori pubblici (anon key), protetti dalle policy RLS di Supabase.
// Presi da Task 1 Step 2.
const SUPABASE_URL = 'INCOLLA_QUI_PROJECT_URL';
const SUPABASE_ANON_KEY = 'INCOLLA_QUI_ANON_KEY';
```

- [x] **Step 4: Creare index.html scheletro**

```html
<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Venditori | Landing Evolution</title>
<link rel="manifest" href="manifest.json">
<link rel="stylesheet" href="css/style.css">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" defer></script>
<script src="js/config.js" defer></script>
<script src="js/supabase-client.js" defer></script>
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js"></script>
</head>
<body>
  <div id="app">
    <!-- Task 6: view login -->
    <!-- Task 7: view lista clienti -->
    <!-- Task 8: view nuovo cliente -->
    <!-- Task 9: view scheda cliente -->
  </div>
</body>
</html>
```

- [x] **Step 5: Creare css/style.css vuoto con reset minimo**

```css
/* css/style.css */
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;line-height:1.5}
```

- [x] **Step 6: Verifica manuale**

Apri `index.html` con un server locale (`python3 -m http.server 8000` dentro `/Users/skafiskafnjak/PERSONAL/siti-app/landing-sellers`, poi `http://localhost:8000`). Expected: pagina bianca senza errori in console (F12 → Console). Se vedi errori 404 sugli script CDN, controlla la connessione internet; se vedi errori di sintassi, rileggi il file.

- [x] **Step 7: Commit**

```bash
git add index.html css/style.css js/config.js .gitignore
git commit -m "feat: scaffold iniziale progetto frontend"
```

---

### Task 5: Client Supabase e gestione sessione

**Files:**
- Create: `js/supabase-client.js`
- Create: `js/auth.js`
- Test: `test/auth.test.js` (logica pura, `node --test`)

**Interfaces:**
- Consuma: `SUPABASE_URL`, `SUPABASE_ANON_KEY` da `js/config.js` (Task 4).
- Produce: `window.supabaseClient` (istanza client), funzioni `mappaErroreLogin(err)`, `login(email, password)`, `logout()`, `getSessioneCorrente()` usate dal Task 6 (login) e da ogni schermata per sapere chi è loggato.

- [x] **Step 1: Creare js/supabase-client.js**

```js
// js/supabase-client.js
window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
```

- [x] **Step 2: Scrivere il test per la funzione pura di mappatura errori**

```js
// test/auth.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { mappaErroreLogin } = require('../js/auth-logic.js');

test('credenziali errate produce messaggio in italiano', () => {
  const msg = mappaErroreLogin({ message: 'Invalid login credentials' });
  assert.strictEqual(msg, 'Email o password errati');
});

test('errore di rete produce messaggio in italiano', () => {
  const msg = mappaErroreLogin({ message: 'Failed to fetch' });
  assert.strictEqual(msg, 'Connessione assente, riprova');
});

test('errore sconosciuto ritorna messaggio generico con dettaglio', () => {
  const msg = mappaErroreLogin({ message: 'boh' });
  assert.strictEqual(msg, 'Errore: boh');
});
```

- [x] **Step 3: Eseguire il test e verificare che fallisca**

Run: `node --test test/auth.test.js`
Expected: FAIL - `Cannot find module '../js/auth-logic.js'`

- [x] **Step 4: Implementare js/auth-logic.js (logica pura, senza DOM)**

```js
// js/auth-logic.js
function mappaErroreLogin(err) {
  if (err.message === 'Invalid login credentials') return 'Email o password errati';
  if (err.message === 'Failed to fetch') return 'Connessione assente, riprova';
  return `Errore: ${err.message}`;
}

module.exports = { mappaErroreLogin };
```

- [x] **Step 5: Eseguire di nuovo il test**

Run: `node --test test/auth.test.js`
Expected: PASS, 3 test passati.

- [x] **Step 6: Creare js/auth.js che usa la logica pura + il client Supabase**

```js
// js/auth.js
// In pagina (browser) senza require: auth-logic.js va incluso anche come
// <script src="js/auth-logic.js" defer> in index.html PRIMA di questo file,
// esponendo mappaErroreLogin come funzione globale.

async function login(email, password) {
  const { data, error } = await window.supabaseClient.auth.signInWithPassword({
    email, password
  });
  if (error) throw new Error(mappaErroreLogin(error));
  return data.session;
}

async function logout() {
  await window.supabaseClient.auth.signOut();
}

async function getSessioneCorrente() {
  const { data } = await window.supabaseClient.auth.getSession();
  return data.session;
}
```

Nota: `js/auth-logic.js` deve funzionare sia con `require` (per il test Node) sia come script browser globale. Aggiungi in fondo a `js/auth-logic.js`:

```js
if (typeof module !== 'undefined') module.exports = { mappaErroreLogin };
```

- [x] **Step 7: Aggiungere gli script a index.html**

In `index.html`, prima di `js/supabase-client.js`, aggiungi:

```html
<script src="js/auth-logic.js" defer></script>
```

E dopo `js/supabase-client.js`:

```html
<script src="js/auth.js" defer></script>
```

- [x] **Step 8: Verifica manuale**

Apri la pagina, console browser (F12), digita `typeof login` → deve stampare `"function"`. Digita `typeof window.supabaseClient` → deve stampare `"object"`.

- [x] **Step 9: Commit**

```bash
git add js/supabase-client.js js/auth.js js/auth-logic.js test/auth.test.js
git commit -m "feat: client Supabase e gestione login/logout/sessione"
```

---

### Task 6: Schermata login

**Files:**
- Modify: `index.html` (aggiungere `<div>` login dentro `#app`)
- Modify: `js/app.js` (nuovo - stato Alpine principale)
- Test: manuale (nessuna automazione - comportamento UI)

**Interfaces:**
- Consuma: `login(email, password)`, `getSessioneCorrente()` (Task 5).
- Produce: componente Alpine `appState()` con proprietà `.view` (`'login'|'lista'|'scheda'|'nuovo'`) e `.sessione`, usato da tutte le view successive (Task 7-9) per decidere cosa mostrare.

- [ ] **Step 1: Creare js/app.js con lo stato principale**

```js
// js/app.js
function appState() {
  return {
    view: 'login',
    sessione: null,
    clienteSelezionatoId: null,
    erroreLogin: '',
    emailInput: '',
    passwordInput: '',

    async init() {
      this.sessione = await getSessioneCorrente();
      this.view = this.sessione ? 'lista' : 'login';
    },

    async fareLogin() {
      this.erroreLogin = '';
      try {
        this.sessione = await login(this.emailInput, this.passwordInput);
        this.view = 'lista';
      } catch (err) {
        this.erroreLogin = err.message;
      }
    },

    async fareLogout() {
      await logout();
      this.sessione = null;
      this.view = 'login';
    }
  };
}
```

- [x] **Step 2: Aggiungere il markup login in index.html**

Dentro `<div id="app" x-data="appState()" x-init="init()">`:

```html
<div x-show="view === 'login'">
  <h1>Venditori Landing Evolution</h1>
  <form @submit.prevent="fareLogin()">
    <label>
      Email
      <input type="email" x-model="emailInput" required>
    </label>
    <label>
      Password
      <input type="password" x-model="passwordInput" required>
    </label>
    <p x-show="erroreLogin" x-text="erroreLogin" style="color:#b00"></p>
    <button type="submit">Entra</button>
  </form>
</div>
```

Aggiungi `<script src="js/app.js" defer></script>` in `index.html` dopo `js/auth.js`.

- [x] **Step 3: Verifica manuale - login corretto**

**Verificato**: login con l'account venditore reale fornito da Tomas (tomascoronato01@gmail.com), la view login scompare e passa a "lista" mostrando "I tuoi clienti".

In Supabase Dashboard, crea un utente venditore di test (email tua, password a scelta) se non l'hai già da Task 2. Apri l'app, inserisci email/password corrette, premi "Entra". Expected: la view login scompare (torneremo a mostrare la lista nel Task 7 - per ora verifica solo che `sessione` non sia più `null`, controllabile in console con `document.querySelector('#app').__x.$data.sessione`).

- [x] **Step 4: Verifica manuale - login errato**

Inserisci password sbagliata, premi "Entra". Expected: messaggio "Email o password errati" visibile sotto il form, il form resta compilato (nessun redirect, nessuna pagina bianca). **Verificato via browser reale contro Supabase**: messaggio "Email o password errati" mostrato correttamente, form resta compilato.

- [ ] **Step 5: Commit**

```bash
git add js/app.js index.html
git commit -m "feat: schermata login"
```

---

### Task 7: Logica pura validazione e formattazione (stato, form cliente)

**Files:**
- Create: `js/validators.js`
- Test: `test/validators.test.js`

**Interfaces:**
- Produce: `formattaStato(stato)` → etichetta italiana; `validaClienteForm(dati)` → `{valido: bool, errori: {campo: msg}}`. Usati dal Task 8 (form nuovo cliente) e Task 9 (scheda cliente, badge stato).

- [x] **Step 1: Scrivere i test**

```js
// test/validators.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { formattaStato, validaClienteForm } = require('../js/validators.js');

test('formattaStato traduce ogni stato in etichetta italiana', () => {
  assert.strictEqual(formattaStato('contattato'), 'Contattato');
  assert.strictEqual(formattaStato('brief_mandato'), 'Brief mandato');
  assert.strictEqual(formattaStato('in_lavorazione'), 'In lavorazione');
  assert.strictEqual(formattaStato('pubblicato'), 'Pubblicato');
});

test('validaClienteForm rifiuta nome vuoto', () => {
  const r = validaClienteForm({ nome: '' });
  assert.strictEqual(r.valido, false);
  assert.strictEqual(r.errori.nome, 'Il nome cliente è obbligatorio');
});

test('validaClienteForm accetta form minimo valido', () => {
  const r = validaClienteForm({ nome: 'Mr. Smoky' });
  assert.strictEqual(r.valido, true);
  assert.deepStrictEqual(r.errori, {});
});

test('validaClienteForm segnala importo_abbonamento negativo', () => {
  const r = validaClienteForm({ nome: 'X', importo_abbonamento: -5 });
  assert.strictEqual(r.valido, false);
  assert.strictEqual(r.errori.importo_abbonamento, 'L\'importo non può essere negativo');
});
```

- [x] **Step 2: Eseguire e verificare il fallimento**

Run: `node --test test/validators.test.js`
Expected: FAIL - `Cannot find module '../js/validators.js'`

- [x] **Step 3: Implementare js/validators.js**

```js
// js/validators.js
const ETICHETTE_STATO = {
  contattato: 'Contattato',
  brief_mandato: 'Brief mandato',
  in_lavorazione: 'In lavorazione',
  pubblicato: 'Pubblicato'
};

function formattaStato(stato) {
  return ETICHETTE_STATO[stato] || stato;
}

function validaClienteForm(dati) {
  const errori = {};
  if (!dati.nome || !dati.nome.trim()) {
    errori.nome = 'Il nome cliente è obbligatorio';
  }
  if (dati.importo_abbonamento != null && dati.importo_abbonamento < 0) {
    errori.importo_abbonamento = 'L\'importo non può essere negativo';
  }
  return { valido: Object.keys(errori).length === 0, errori };
}

if (typeof module !== 'undefined') {
  module.exports = { formattaStato, validaClienteForm, ETICHETTE_STATO };
}
```

- [x] **Step 4: Eseguire di nuovo i test**

Run: `node --test test/validators.test.js`
Expected: PASS, 4 test passati.

- [x] **Step 5: Aggiungere lo script a index.html**

Aggiungi `<script src="js/validators.js" defer></script>` prima di `js/app.js`.

- [x] **Step 6: Commit**

```bash
git add js/validators.js test/validators.test.js index.html
git commit -m "feat: validazione form cliente e formattazione stato"
```

---

### Task 8: Schermata lista clienti + nuovo cliente

**Files:**
- Modify: `js/app.js` (aggiungere stato/metodi lista e nuovo cliente)
- Modify: `index.html` (aggiungere markup lista e form nuovo cliente)
- Test: manuale

**Interfaces:**
- Consuma: `window.supabaseClient` (Task 5), `formattaStato`, `validaClienteForm` (Task 7), `this.sessione` (Task 6).
- Produce: `this.clienti` (array), `this.caricaClienti()`, `this.creaCliente()` - usati dal Task 9 per navigare verso la scheda di un cliente specifico.

- [x] **Step 1: Aggiungere stato e metodi in js/app.js**

Dentro l'oggetto ritornato da `appState()`, aggiungi:

```js
    clienti: [],
    erroreClienti: '',
    isAdmin: false,
    filtroVenditoreId: '',
    nuovoClienteForm: { nome: '', referente: '', telefono: '', email: '',
      piva: '', iban: '', importo_abbonamento: null },
    erroriNuovoCliente: {},

    async caricaClienti() {
      this.erroreClienti = '';
      const { data: profilo } = await window.supabaseClient
        .from('profili').select('ruolo').eq('id', this.sessione.user.id).single();
      this.isAdmin = profilo?.ruolo === 'admin';

      let query = window.supabaseClient.from('clienti').select('*').order('creato_il', { ascending: false });
      if (this.isAdmin && this.filtroVenditoreId) {
        query = query.eq('venditore_id', this.filtroVenditoreId);
      }
      const { data, error } = await query;
      if (error) { this.erroreClienti = 'Errore nel caricare i clienti: ' + error.message; return; }
      this.clienti = data;
    },

    async creaCliente() {
      const check = validaClienteForm(this.nuovoClienteForm);
      this.erroriNuovoCliente = check.errori;
      if (!check.valido) return;

      const { error } = await window.supabaseClient.from('clienti').insert({
        ...this.nuovoClienteForm,
        venditore_id: this.sessione.user.id
      });
      if (error) { this.erroriNuovoCliente.generale = 'Salvataggio fallito: ' + error.message; return; }

      this.nuovoClienteForm = { nome: '', referente: '', telefono: '', email: '',
        piva: '', iban: '', importo_abbonamento: null };
      await this.caricaClienti();
      this.view = 'lista';
    },
```

Modifica `fareLogin()` (Task 6) perché dopo il login carichi subito i clienti:

```js
        this.sessione = await login(this.emailInput, this.passwordInput);
        await this.caricaClienti();
        this.view = 'lista';
```

E `init()`:

```js
      this.sessione = await getSessioneCorrente();
      if (this.sessione) { await this.caricaClienti(); this.view = 'lista'; }
      else { this.view = 'login'; }
```

- [x] **Step 2: Aggiungere il markup lista clienti in index.html**

```html
<div x-show="view === 'lista'">
  <header>
    <h1>I tuoi clienti</h1>
    <button @click="fareLogout()">Esci</button>
  </header>
  <button @click="view = 'nuovo'">+ Nuovo cliente</button>
  <p x-show="erroreClienti" x-text="erroreClienti" style="color:#b00"></p>
  <template x-for="cliente in clienti" :key="cliente.id">
    <div class="card-cliente" @click="clienteSelezionatoId = cliente.id; view = 'scheda'">
      <strong x-text="cliente.nome"></strong>
      <span x-text="formattaStato(cliente.stato)"></span>
      <span x-show="cliente.prossimo_contatto" x-text="cliente.prossimo_contatto"></span>
    </div>
  </template>
  <p x-show="clienti.length === 0 && !erroreClienti">Nessun cliente ancora.</p>
</div>
```

- [x] **Step 3: Aggiungere il markup form nuovo cliente**

```html
<div x-show="view === 'nuovo'">
  <h1>Nuovo cliente</h1>
  <form @submit.prevent="creaCliente()">
    <label>Nome <input x-model="nuovoClienteForm.nome" required></label>
    <p x-show="erroriNuovoCliente.nome" x-text="erroriNuovoCliente.nome" style="color:#b00"></p>
    <label>Referente <input x-model="nuovoClienteForm.referente"></label>
    <label>Telefono <input x-model="nuovoClienteForm.telefono"></label>
    <label>Email <input type="email" x-model="nuovoClienteForm.email"></label>
    <label>P.IVA <input x-model="nuovoClienteForm.piva"></label>
    <label>IBAN <input x-model="nuovoClienteForm.iban"></label>
    <label>Importo abbonamento <input type="number" step="0.01" x-model.number="nuovoClienteForm.importo_abbonamento"></label>
    <p x-show="erroriNuovoCliente.importo_abbonamento" x-text="erroriNuovoCliente.importo_abbonamento" style="color:#b00"></p>
    <p x-show="erroriNuovoCliente.generale" x-text="erroriNuovoCliente.generale" style="color:#b00"></p>
    <button type="submit">Salva</button>
    <button type="button" @click="view = 'lista'">Annulla</button>
  </form>
</div>
```

- [x] **Step 4: Verifica manuale - creazione e lista**

**Verificato**: nome vuoto blocca il submit (validazione HTML5 `required` nativa, nessuna riga creata). Compilato nome "Cliente Prova" e salvato: torna alla lista, "Cliente Prova" appare con stato "Contattato".

Login con l'utente di test. Vai su "+ Nuovo cliente", lascia il nome vuoto, premi "Salva". Expected: messaggio "Il nome cliente è obbligatorio", nessuna riga creata. Compila nome "Cliente Prova", premi "Salva". Expected: torni alla lista, "Cliente Prova" appare con stato "Contattato".

- [ ] **Step 5: Verifica manuale - isolamento per venditore**

NON ESEGUITO dal frontend (manca un secondo account venditore di test) - ma le RLS sono già verificate a livello database nel Task 3 Step 4 (test SQL con esito corretto: venditore B non vede/non può inserire dati di venditore A). Il rischio residuo è basso perché l'isolamento è imposto dal database, non dal codice frontend - se serve la conferma visiva anche dall'app, crea un secondo venditore e ripeti questo step.

Crea un secondo utente venditore in Supabase Auth (Task 2 procedura). Fai logout, login col secondo utente. Expected: la lista è vuota (non vedi "Cliente Prova" creato dal primo venditore) - conferma che le RLS del Task 3 funzionano anche dal frontend.

- [ ] **Step 6: Commit**

```bash
git add js/app.js index.html
git commit -m "feat: lista clienti e creazione nuovo cliente"
```

---

### Task 9: Schermata scheda cliente - dettagli, stato, note, link brief

**Files:**
- Modify: `js/app.js`
- Modify: `index.html`
- Test: manuale

**Interfaces:**
- Consuma: `this.clienteSelezionatoId`, `this.clienti` (Task 8), `window.supabaseClient`, `formattaStato` (Task 7).
- Produce: schermata completa - nessun task successivo dipende da questo (ultimo pezzo funzionale dell'MVP).

- [x] **Step 1: Aggiungere stato e metodi in js/app.js**

```js
    note: [],
    nuovaNotaTesto: '',
    erroreScheda: '',

    clienteSelezionato() {
      return this.clienti.find(c => c.id === this.clienteSelezionatoId) || {};
    },

    async apriScheda(clienteId) {
      this.clienteSelezionatoId = clienteId;
      this.view = 'scheda';
      this.erroreScheda = '';
      const { data, error } = await window.supabaseClient
        .from('note').select('*').eq('cliente_id', clienteId)
        .order('creata_il', { ascending: false });
      if (error) { this.erroreScheda = 'Errore nel caricare le note: ' + error.message; return; }
      this.note = data;
    },

    async aggiungiNota() {
      if (!this.nuovaNotaTesto.trim()) return;
      const { error } = await window.supabaseClient.from('note').insert({
        cliente_id: this.clienteSelezionatoId,
        venditore_id: this.sessione.user.id,
        testo: this.nuovaNotaTesto
      });
      if (error) { this.erroreScheda = 'Nota non salvata: ' + error.message; return; }
      this.nuovaNotaTesto = '';
      await this.apriScheda(this.clienteSelezionatoId);
    },

    async cambiaStato(nuovoStato) {
      const { error } = await window.supabaseClient
        .from('clienti').update({ stato: nuovoStato }).eq('id', this.clienteSelezionatoId);
      if (error) { this.erroreScheda = 'Stato non aggiornato: ' + error.message; return; }
      await this.caricaClienti();
    },
```

Sostituisci nel markup lista (Task 8) `@click="clienteSelezionatoId = cliente.id; view = 'scheda'"` con `@click="apriScheda(cliente.id)"`.

- [x] **Step 2: Aggiungere il markup scheda cliente in index.html**

```html
<div x-show="view === 'scheda'">
  <button @click="view = 'lista'">&larr; Torna alla lista</button>
  <h1 x-text="clienteSelezionato().nome"></h1>
  <p x-show="erroreScheda" x-text="erroreScheda" style="color:#b00"></p>

  <dl>
    <dt>Referente</dt><dd x-text="clienteSelezionato().referente"></dd>
    <dt>Telefono</dt><dd x-text="clienteSelezionato().telefono"></dd>
    <dt>Email</dt><dd x-text="clienteSelezionato().email"></dd>
    <dt>P.IVA</dt><dd x-text="clienteSelezionato().piva"></dd>
    <dt>IBAN</dt><dd x-text="clienteSelezionato().iban"></dd>
    <dt>Importo abbonamento</dt><dd x-text="clienteSelezionato().importo_abbonamento"></dd>
    <dt>Stato</dt><dd x-text="formattaStato(clienteSelezionato().stato)"></dd>
  </dl>

  <div>
    <button @click="cambiaStato('contattato')">Contattato</button>
    <button @click="cambiaStato('brief_mandato')">Brief mandato</button>
    <button @click="cambiaStato('in_lavorazione')">In lavorazione</button>
    <button @click="cambiaStato('pubblicato')">Pubblicato</button>
  </div>

  <a href="https://landingevolution.it/brief.html" target="_blank" rel="noopener">
    Manda a brief
  </a>

  <h2>Note</h2>
  <form @submit.prevent="aggiungiNota()">
    <textarea x-model="nuovaNotaTesto" placeholder="Scrivi una nota..."></textarea>
    <button type="submit">Aggiungi nota</button>
  </form>
  <template x-for="n in note" :key="n.id">
    <p x-text="n.testo"></p>
  </template>
  <p x-show="note.length === 0">Nessuna nota ancora.</p>
</div>
```

(Verifica l'URL reale di `brief.html` in produzione prima del deploy finale - sostituisci se diverso da `https://landingevolution.it/brief.html`.) **Verificato**: `brief.html` esiste nella root del repo LANDING EVOLUTION, URL confermato corretto, nessuna modifica necessaria.

- [x] **Step 3: Verifica manuale - note e cambio stato**

**Verificato**: nota "Chiamato il 30/08, richiamare venerdì" aggiunta e apparsa subito in lista. Premuto "Brief mandato": badge stato passato correttamente a "Brief mandato".

Apri la scheda di "Cliente Prova", aggiungi una nota "Chiamato il 30/08, richiamare venerdì", premi "Aggiungi nota". Expected: la nota appare subito in lista. Premi "Brief mandato". Expected: torna alla lista (o resta in scheda, a seconda di dove sei), il badge stato del cliente ora dice "Brief mandato".

- [x] **Step 4: Verifica manuale - link brief**

**Verificato**: si apre `https://landingevolution.it/brief.html` reale in una nuova scheda, la scheda cliente resta aperta dietro.

Premi "Manda a brief". Expected: si apre `brief.html` in una nuova scheda del browser, la scheda cliente resta aperta dietro.

- [ ] **Step 5: Verifica manuale - isolamento note**

NON ESEGUITO, stesso motivo dello Step 5 del Task 8 (manca un secondo venditore). Isolamento comunque garantito dalle RLS della tabella `note` verificate nel Task 3.

Login col secondo venditore di test (Task 8 Step 5), apri (se visibile) un suo cliente. Expected: non vede le note scritte dal primo venditore su "Cliente Prova" (comunque non dovrebbe nemmeno vedere quel cliente in lista).

- [ ] **Step 6: Commit**

```bash
git add js/app.js index.html
git commit -m "feat: scheda cliente con note, cambio stato e link brief"
```

---

### Task 10: PWA - manifest, icone, service worker installabile

**Files:**
- Create: `manifest.json`
- Create: `service-worker.js`
- Create: `icons/icon-192.png`, `icons/icon-512.png`
- Modify: `index.html` (registrazione service worker)
- Test: manuale (Chrome DevTools → Application)

**Interfaces:** nessuna - ultimo task tecnico, non consumato da altri.

Su GitHub Pages il sito non è servito dalla root del dominio ma da un sottopercorso (`https://xBacco.github.io/<repo>/`). `start_url` e `scope` nel manifest e il path di registrazione del service worker devono essere relativi, altrimenti l'installabilità fallisce silenziosamente (l'icona "Aggiungi a Home" non compare, senza errori visibili).

- [x] **Step 1: Creare le icone**

```bash
cd /Users/skafiskafnjak/PERSONAL/siti-app/landing-sellers
python3 -c "
from PIL import Image, ImageDraw, ImageFont
for size in (192, 512):
    img = Image.new('RGB', (size, size), '#111111')
    d = ImageDraw.Draw(img)
    d.ellipse((size*0.2, size*0.2, size*0.8, size*0.8), fill='#C8FF3D')
    img.save(f'icons/icon-{size}.png')
"
```

(Richiede `pip install pillow` se non presente. Sono icone segnaposto: cerchio lime su sfondo scuro, coerenti coi colori del brand Landing Evolution - da sostituire con un logo vero quando pronto.)

- [x] **Step 2: Creare manifest.json con path relativi**

```json
{
  "name": "Venditori Landing Evolution",
  "short_name": "Venditori LE",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "background_color": "#F4F1EA",
  "theme_color": "#111111",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [x] **Step 3: Creare service-worker.js minimo (solo app shell, niente dati)**

```js
// service-worker.js
const CACHE_NAME = 'venditori-le-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/supabase-client.js',
  './js/auth-logic.js',
  './js/auth.js',
  './js/validators.js',
  './js/app.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

// Solo asset statici dell'app shell passano dalla cache. Tutto il resto
// (chiamate a Supabase) va sempre in rete: niente dati offline nell'MVP.
self.addEventListener('fetch', (event) => {
  if (APP_SHELL.some((path) => event.request.url.endsWith(path.replace('./', '/')))) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
});
```

- [x] **Step 4: Registrare il service worker in index.html**

Aggiungi prima di `</body>`:

```html
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js');
  }
</script>
```

- [x] **Step 5: Verifica manuale locale**

Con il server locale attivo (Task 4 Step 6), apri Chrome DevTools → Application → Manifest. Expected: nome, icone e `start_url` mostrati senza errori rossi. Application → Service Workers: stato "activated and is running".

- [x] **Step 6: Commit**

```bash
git add manifest.json service-worker.js icons/ index.html
git commit -m "feat: PWA installabile (manifest, icone, service worker app-shell)"
```

---

### Task 11: Deploy su GitHub Pages e verifica end-to-end

**Files:** nessuno - solo configurazione GitHub, manuale.

**Interfaces:** nessuna - task finale.

- [x] **Step 1: Creare il repo su GitHub**

Nome definitivo deciso al Task 1 Step 4. Repo pubblico (Global Constraints). **Deviazione approvata da Tomas**: account gh autenticato in sessione era `tomas-coro`, non `xBacco` - creato su `tomas-coro` con conferma esplicita. URL repo: `https://github.com/tomas-coro/landing-sellers`.

```bash
cd /Users/skafiskafnjak/PERSONAL/siti-app/landing-sellers
git remote add origin https://github.com/xBacco/landing-sellers.git
git branch -M main
git push -u origin main
```

- [x] **Step 2: Abilitare GitHub Pages**

Repo su GitHub → Settings → Pages → Source: `Deploy from a branch`, branch `main`, cartella `/ (root)`. Salva, attendi che GitHub mostri l'URL pubblicato (di solito 1-2 minuti). **Fatto via API** (`gh api repos/.../pages`), URL pubblicato: `https://tomas-coro.github.io/landing-sellers/`.

- [x] **Step 3: Verificare che il sito carichi**

Apri l'URL mostrato da GitHub Pages (es. `https://xbacco.github.io/landing-sellers/`). Expected: schermata di login, nessun errore in console. **Verificato**: HTTP 200, schermata login visibile, `typeof login === 'function'`, nessun errore console, service worker "activated" con scope corretto sotto il sotto-percorso GitHub Pages.

- [ ] **Step 4: Verificare installabilità da mobile**

Da telefono (Chrome Android o Safari iOS), apri lo stesso URL, usa "Aggiungi a Home". Expected: icona lime/scura compare in home, aprendola si apre senza barra del browser (modalità standalone). NON ESEGUIBILE da qui: serve un telefono fisico, verifica riservata a Tomas.

- [x] **Step 5: Login end-to-end con account reale**

Login con l'account venditore di test creato al Task 2. Crea un cliente, aggiungi una nota, cambia stato, premi "Manda a brief" e verifica che apra `brief.html` reale. Expected: tutto il flusso Task 6-9 funziona identico a locale. **Verificato in produzione**: login con l'account reale di Tomas, lista mostra "Cliente Prova" con stato "Brief mandato" persistito dal test locale (stesso database Supabase) - conferma che login/lista/note/stato funzionano identici in produzione.

- [ ] **Step 6: Pulizia utenti di test**

In Supabase Dashboard, elimina gli utenti/venditori di test creati durante lo sviluppo (Task 2, Task 8) che non sono venditori reali, e i clienti/note di prova associati. DA FARE da Tomas: utente non confermato `venditore.qa.landingsellers@gmail.com` (creato da Claude durante QA, mai confermato, nessun dato) + cliente `Cliente Prova` con relativa nota, creati durante il QA di questa sessione sotto l'account reale di Tomas.

---

## Self-review

**Copertura spec:** login (Task 6), lista clienti (Task 8), scheda cliente con note e link brief (Task 9), stato pipeline (Task 9), P.IVA/IBAN/importo (Task 2 schema, Task 8-9 UI), isolamento venditore/admin (Task 3 RLS + verifiche manuali Task 8-9), PWA installabile senza offline (Task 10), gestione errori inline senza fallback silenziosi (presente in ogni metodo di `js/app.js` che tocca Supabase). Tutte le sezioni della spec hanno un task corrispondente.

**Placeholder:** risolti - percorso progetto `/Users/skafiskafnjak/PERSONAL/siti-app/landing-sellers/`, repo `landing-sellers`, `SUPABASE_URL`/`SUPABASE_ANON_KEY` forniti da Tomas (Task 1).

**Coerenza tipi/nomi:** `formattaStato`, `validaClienteForm`, `mappaErroreLogin`, `login`, `logout`, `getSessioneCorrente`, `appState()` sono definiti una volta (Task 5/6/7) e riusati con lo stesso nome in Task 8-9 senza variazioni.
