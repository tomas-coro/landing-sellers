# Rete multilivello: piano di implementazione

> **Per chi esegue:** usare superpowers:subagent-driven-development oppure superpowers:executing-plans, un task alla volta. I passi usano la sintassi `- [ ]`.

**Goal:** aggiungere la quota di rete 10% (lv3 verso lv2) e la vendita condivisa 50/50, secondo `docs/superpowers/specs/2026-10-16-rete-multilivello-design.md`.

**Architettura:** il motore `js/economic-engine.js` non si tocca. Il 10% si applica **lato server** dentro lo snapshot del pagamento, cosi' il client non puo' saltarlo. La vendita condivisa e' una **post-elaborazione JS** dopo il motore, che spezza la quota del venditore in due. Le quote di rete stanno in una tabella separata, con RLS che le nasconde al venditore.

**Stack:** Supabase (Postgres, RLS, RPC `security definer`), JS vanilla + Alpine, test `node:test`.

## Vincoli globali

- Niente trattini lunghi nei testi e nel codice: solo `-`.
- Test: `node --test test/` (non esiste package.json). I test SQL del repo sono regex sul testo delle migration.
- Ogni deploy bumpa `CACHE_NAME` in `service-worker.js` e `?v=` in `index.html`.
- Interventi su RLS/accessi vanno nel registro sicurezza (AGENTS.md).
- Niente commit senza "ok commit" di Tomas: i passi "Commit" sono proposte, non azioni automatiche.
- Nome migration: `supabase/migrations/2026101XXXXXXX_nome.sql` (timestamp successivo a `20261016130000`).
- Pagamenti gia' incassati: nessun ricalcolo.
- Regola 10%: `profili.responsabile_id` del venditore = gestore; il gestore deve avere a sua volta `responsabile_id` non nullo (non e' la radice). Il 10% non scatta se il gestore e' gia' partecipante del pagamento.

## Mappa file

| File | Ruolo |
|---|---|
| `supabase/migrations/..._quote_rete.sql` (nuovo) | tabella `pagamento_quote_rete`, RLS, `_applica_quote_rete`, conferma/annulla |
| `supabase/migrations/..._vendita_condivisa.sql` (nuovo) | colonna `vendite.condivisa_con`, validazione |
| `js/rete-quote.js` (nuovo) | funzioni pure: `splitVenditaCondivisa`, `anteprimaQuotaRete` |
| `test/rete-quote-sql.test.js`, `test/rete-quote.test.js` (nuovi) | test |
| `js/app-economia.js` | caricamento/conferma quote rete, post-elaborazione condivisa |
| `js/app.js`, `index.html`, `css/style.css` | agenda, modulo vendita, rete vendita |
| `service-worker.js` | bump versione |

---

## PARTE A - Quota di rete 10%

### Task A1: tabella, RLS e funzione server

**Files:**
- Create: `supabase/migrations/20261017120000_quote_rete.sql`
- Test: `test/rete-quote-sql.test.js`

**Interfaces:**
- Produces: tabella `public.pagamento_quote_rete`, funzione interna `public._applica_quote_rete(p_pagamento_id uuid) returns void`.

- [ ] **Step 1: test che fallisce**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(
  path.resolve(__dirname, '../supabase/migrations/20261017120000_quote_rete.sql'),
  'utf8'
);

test('esiste la tabella delle quote di rete con conferma', () => {
  assert.match(sql, /create table if not exists public\.pagamento_quote_rete/);
  assert.match(sql, /da_profilo_id uuid not null/);
  assert.match(sql, /a_profilo_id uuid not null/);
  assert.match(sql, /ricevuta_il timestamptz/);
});

test('RLS: il venditore che paga il 10% non puo leggere la riga', () => {
  assert.match(sql, /alter table public\.pagamento_quote_rete enable row level security/);
  assert.match(sql, /a_profilo_id = auth\.uid\(\)/);
  assert.doesNotMatch(sql, /da_profilo_id = auth\.uid\(\)/);
});

test('la funzione applica il 10% solo se il gestore non e la radice e non e partecipante', () => {
  assert.match(sql, /create or replace function public\._applica_quote_rete/);
  assert.match(sql, /responsabile_id is not null/);
  assert.match(sql, /not exists[\s\S]*pagamento_partecipanti/);
  assert.match(sql, /\* 0\.10/);
  assert.match(sql, /revoke all on function public\._applica_quote_rete/);
});
```

- [ ] **Step 2: eseguire e vedere il fallimento**

Run: `node --test test/rete-quote-sql.test.js`
Expected: FAIL (ENOENT, la migration non esiste).

- [ ] **Step 3: scrivere la migration**

```sql
-- Quota di rete: il responsabile diretto (non radice) riceve il 10% della
-- quota effettiva di chi sta sotto. Il venditore non vede mai queste righe.

create table if not exists public.pagamento_quote_rete (
  id uuid primary key default gen_random_uuid(),
  pagamento_id uuid not null
    references public.pagamenti(id) on delete cascade,
  da_profilo_id uuid not null references public.profili(id),
  a_profilo_id uuid not null references public.profili(id),
  importo numeric(12,2) not null check (importo > 0),
  ricevuta_il timestamptz,
  creato_il timestamptz not null default now(),
  unique (pagamento_id, da_profilo_id)
);

create index if not exists pagamento_quote_rete_a_idx
  on public.pagamento_quote_rete(a_profilo_id);

alter table public.pagamento_quote_rete enable row level security;

-- Legge solo chi riceve. Admin e developer (Alessandro, Tomas) leggono tutto.
-- Verificare in Step 4 il nome esatto della funzione/colonna ruolo usata
-- dalle altre policy in supabase/policies.sql e riusarla qui.
create policy quote_rete_select on public.pagamento_quote_rete
  for select to authenticated
  using (
    a_profilo_id = auth.uid()
    or exists (
      select 1 from public.profili p
      where p.id = auth.uid() and p.ruolo in ('admin', 'developer')
    )
  );

create or replace function public._applica_quote_rete(p_pagamento_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.pagamento_quote_rete where pagamento_id = p_pagamento_id;

  with candidati as (
    select
      pp.id as pp_id,
      pp.profilo_id as da_id,
      v.responsabile_id as a_id,
      round(pp.quota_effettiva * 0.10, 2) as importo
    from public.pagamento_partecipanti pp
    join public.profili v on v.id = pp.profilo_id
    join public.profili g on g.id = v.responsabile_id
    where pp.pagamento_id = p_pagamento_id
      and pp.quota_effettiva > 0
      and g.responsabile_id is not null
      and not exists (
        select 1 from public.pagamento_partecipanti x
        where x.pagamento_id = p_pagamento_id
          and x.profilo_id = v.responsabile_id
      )
  ),
  inseriti as (
    insert into public.pagamento_quote_rete
      (pagamento_id, da_profilo_id, a_profilo_id, importo)
    select p_pagamento_id, da_id, a_id, importo
    from candidati
    where importo > 0
    returning da_profilo_id, importo
  )
  update public.pagamento_partecipanti pp
  set quota_effettiva = pp.quota_effettiva - i.importo
  from inseriti i
  where pp.pagamento_id = p_pagamento_id
    and pp.profilo_id = i.da_profilo_id;
end;
$$;

revoke all on function public._applica_quote_rete(uuid)
  from public, anon, authenticated;
```

- [ ] **Step 4: verificare le assunzioni sulle policy**

Run: `grep -n "ruolo in\|is_admin\|es_admin" supabase/policies.sql | head`
Allineare la `using (...)` della policy al modo in cui le altre tabelle riconoscono admin e developer.

- [ ] **Step 5: test verde**

Run: `node --test test/rete-quote-sql.test.js`
Expected: PASS.

- [ ] **Step 6: commit (solo con ok di Tomas)**

`git add supabase/migrations/20261017120000_quote_rete.sql test/rete-quote-sql.test.js && git commit -m "feat: tabella quote di rete 10% con RLS"`

---

### Task A2: agganciare `_applica_quote_rete` ai percorsi del pagamento

**Files:**
- Modify (nuova migration, `create or replace`): `supabase/migrations/20261017121000_quote_rete_percorsi.sql`
- Test: `test/rete-quote-sql.test.js`

**Interfaces:**
- Consumes: `_applica_quote_rete(uuid)` da A1.
- I quattro punti da toccare, tutti gia' esistenti:
  1. `_registra_snapshot_pagamento` (`20260924190000_pagamento_consolidato_e_iniziale.sql:40`): chiamare `perform public._applica_quote_rete(p_pagamento_id);` dopo l'`insert into pagamento_partecipanti` finale.
  2. `modifica_pagamento_economico` (`20260925183000_allinea_modifica_pagamento_consolidato.sql:11`): stessa chiamata dopo l'insert alla riga 274.
  3. `annulla_incasso_economico` (`20260927120000_annulla_incasso_in_rata_prevista.sql:3`): il `delete` delle quote rete e' coperto dal `on delete cascade` solo se il pagamento viene cancellato; qui il pagamento resta, quindi aggiungere `delete from public.pagamento_quote_rete where pagamento_id = ...` accanto ai delete alle righe 36-39.
  4. `_imposta_incassato_pagamento` (`20261009120000_conferme_trasferimenti_quote.sql:43`): aggiungere, dopo l'update su `pagamento_partecipanti`, l'update di `pagamento_quote_rete.ricevuta_il` (null, tranne quando `a_profilo_id = p_incassato_da`, allora `v_data`).


**Contratto con A1 (aggiunto dopo la revisione):** `_applica_quote_rete` NON e' idempotente: se esistono gia' righe in `pagamento_quote_rete` per il pagamento, lancia un'eccezione. Quindi in `modifica_pagamento_economico`, subito accanto al `delete from public.pagamento_partecipanti` (riga ~245), aggiungere `delete from public.pagamento_quote_rete where pagamento_id = ...` PRIMA di reinserire e richiamare `_applica_quote_rete`. Stesso per `annulla_incasso_economico`.

- [ ] **Step 1: test che fallisce** (regex sulla nuova migration)

```js
const percorsi = fs.readFileSync(
  path.resolve(__dirname, '../supabase/migrations/20261017121000_quote_rete_percorsi.sql'),
  'utf8'
);

test('snapshot, modifica, annulla e incassato gestiscono le quote rete', () => {
  assert.match(percorsi, /function public\._registra_snapshot_pagamento[\s\S]*_applica_quote_rete/);
  assert.match(percorsi, /function public\.modifica_pagamento_economico[\s\S]*_applica_quote_rete/);
  assert.match(percorsi, /function public\.annulla_incasso_economico[\s\S]*delete from public\.pagamento_quote_rete/);
  assert.match(percorsi, /function public\._imposta_incassato_pagamento[\s\S]*update public\.pagamento_quote_rete/);
});
```

- [ ] **Step 2: eseguire, atteso FAIL.**
- [ ] **Step 3: scrivere la migration.** Per ciascuna delle 4 funzioni copiare **per intero** la definizione piu' recente dal file indicato sopra (tutte e quattro con `create or replace`, stessa firma, stessi `revoke`/`grant`), aggiungendo solo la riga prevista. Non riscrivere la logica esistente. Prima di copiare, eseguire `grep -n "function public.<nome>" supabase/migrations/*.sql` per essere certi che sia l'ultima versione.
- [ ] **Step 4: test verde.** `node --test test/`. Expected: tutta la suite PASS.
- [ ] **Step 5: commit (con ok).** `feat: applica quota di rete ai percorsi di pagamento`

---

### Task A3: conferma lato gestore

**Files:**
- Modify: la migration `20261017121000_quote_rete_percorsi.sql` (aggiungere le due RPC in coda) oppure una terza migration `20261017122000_conferma_quota_rete.sql`
- Modify: `js/app-economia.js` (accanto a `caricaTrasferimentiDaConfermare`, riga ~946)
- Test: `test/rete-quote-sql.test.js`, `test/payment-transfers.test.js` (stile esistente)

**Interfaces:**
- Produces SQL: `conferma_quota_rete(p_pagamento_id uuid) returns uuid`, `annulla_conferma_quota_rete(p_pagamento_id uuid) returns uuid`. Stesso schema di `conferma_quota_pagamento` (`20261009120000...sql:215`) e `annulla_conferma_quota_pagamento` (`20261009130000...sql`), ma su `pagamento_quote_rete` con `a_profilo_id = auth.uid()`.
- Produces JS: `caricaQuoteReteDaConfermare()` che riempie `this.quoteReteDaConfermare` con `{ id, pagamento_id, importo, clienteNome, controparteNome, dataPagamento }` da `pagamento_quote_rete` con `ricevuta_il is null`, `a_profilo_id = utente`, `pagamenti.stato = 'incassato'`.

- [ ] **Step 1: test** (regex): esistenza di entrambe le RPC, `grant execute ... to authenticated`, `a_profilo_id = auth.uid()`, presenza di `caricaQuoteReteDaConfermare` in `js/app-economia.js`.
- [ ] **Step 2:** `node --test` atteso FAIL.
- [ ] **Step 3: SQL.**

```sql
create or replace function public.conferma_quota_rete(p_pagamento_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;

  update public.pagamento_quote_rete q
  set ricevuta_il = now()
  from public.pagamenti p
  where q.pagamento_id = p.id
    and q.pagamento_id = p_pagamento_id
    and q.a_profilo_id = auth.uid()
    and q.ricevuta_il is null
    and p.stato = 'incassato'
    and p.incassato_da is distinct from auth.uid()
  returning q.id into v_id;

  if v_id is null then
    raise exception 'Quota di rete da confermare non disponibile';
  end if;

  return p_pagamento_id;
end;
$$;

revoke all on function public.conferma_quota_rete(uuid) from public, anon;
grant execute on function public.conferma_quota_rete(uuid) to authenticated;
```

`annulla_conferma_quota_rete`: identica con `set ricevuta_il = null` e condizione `q.ricevuta_il is not null`.

- [ ] **Step 4: JS** in `app-economia.js`, nello stesso stile di `caricaTrasferimentiDaConfermare`:

```js
async caricaQuoteReteDaConfermare() {
  const profiloId = this.sessione?.user?.id;
  this.quoteReteDaConfermare = [];
  if (!profiloId) return;

  const { data, error } = await window.supabaseClient
    .from('pagamento_quote_rete')
    .select(`
      id, pagamento_id, importo, da_profilo_id,
      pagamenti!inner(id, incassato_da, stato, importo, data_pagamento,
        vendite!inner(cliente_id, clienti(nome)))
    `)
    .eq('a_profilo_id', profiloId)
    .is('ricevuta_il', null)
    .eq('pagamenti.stato', 'incassato');

  if (error) {
    this.mostraToast('error', 'Quote di rete non caricate', error.message);
    return;
  }

  await this.caricaMappaNomiVenditori();
  this.quoteReteDaConfermare = (data || [])
    .filter(q => q.pagamenti?.incassato_da !== profiloId)
    .map(q => ({
      ...q,
      clienteNome: q.pagamenti?.vendite?.clienti?.nome || '',
      controparteNome: this.nomeVenditorePerId(q.pagamenti?.incassato_da),
      dataPagamento: q.pagamenti?.data_pagamento || null
    }));
}
```

Aggiungere `quoteReteDaConfermare: []` allo stato in `js/app.js` (vicino alla riga 900) e chiamare il metodo dove oggi si chiama `caricaTrasferimentiDaConfermare` (`grep -n caricaTrasferimentiDaConfermare js/*.js`).

- [ ] **Step 5:** test verde, `node --test test/`.
- [ ] **Step 6: commit (con ok).**

---

### Task A4: agenda e notifica

**Files:**
- Modify: `js/app.js:3999-4010` (blocco che costruisce le righe agenda da `trasferimentiDaConfermare`), `index.html` (riga agenda e foglio di conferma)
- Test: `test/agenda-pagamenti-mancanti.test.js` (stile) o nuovo `test/agenda-quote-rete.test.js`

- [ ] **Step 1:** leggere `js/app.js:3990-4030` e l'`index.html` della riga "Quote da confermare" (`grep -n "trasferimentiDaConfermare" index.html`).
- [ ] **Step 2: test che fallisce:** nell'agenda compare una voce con `id` che inizia per `quota-rete-` per ogni elemento di `quoteReteDaConfermare`, con testo "Quota di rete su vendita di <nome>".
- [ ] **Step 3:** duplicare il ciclo `forEach` esistente su `quoteReteDaConfermare`, con `id: \`quota-rete-${q.pagamento_id}\``, `importo: q.importo`, titolo "Quota di rete da riscattare".
- [ ] **Step 4:** il tocco sulla riga chiama `conferma_quota_rete` (stesso foglio e stesso toast della conferma esistente), poi `caricaQuoteReteDaConfermare()`.
- [ ] **Step 5:** notifica push: verificare con `grep -n "web-push\|notifiche" js/web-push.js supabase/functions -r` se le quote da confermare hanno gia' una notifica; se si', estenderla alle quote rete, altrimenti l'agenda e il badge bastano (decisione da riportare a Tomas).
- [ ] **Step 6:** test verde e commit (con ok).

---

### Task A5: visibilita' in Rete vendita per Alessandro e Tomas

**Files:**
- Modify: `supabase/migrations/20261015140000_rete_vendita.sql` non si tocca; nuova funzione in una migration `20261017123000_rete_vendita_quote_rete.sql` oppure lettura diretta da `pagamento_quote_rete` (le admin leggono tutto per la RLS di A1)
- Modify: `js/app-rete.js`, `index.html` (sezione Rete vendita)
- Test: `test/rete-vendita.test.js`

- [ ] **Step 1:** leggere `js/app-rete.js` e `test/rete-vendita.test.js` per capire come si costruisce il nodo.
- [ ] **Step 2: test che fallisce:** per un gestore, il nodo espone `quoteReteRicevute` (somma delle `importo` dove `a_profilo_id` = nodo) e, per Alessandro/Tomas, la riga "ha preso X da una vendita di <venditore>".
- [ ] **Step 3:** implementare la query e la riga nella vista. Il venditore sotto non deve ricevere la query (la RLS ritorna vuoto, non serve altro).
- [ ] **Step 4:** decidere con `calcolaStatisticheVenditore` (`js/app.js:392`) se la quota rete ricevuta conta come "generato" del gestore. Raccomandazione: si', e va mostrata come voce separata "di cui da rete". Chiedere conferma a Tomas prima di sommarla.
- [ ] **Step 5:** test verde e commit (con ok).

---

## PARTE B - Vendita condivisa

### Task B1: funzione pura di divisione 50/50

**Files:**
- Create: `js/rete-quote.js`
- Test: `test/rete-quote.test.js`
- Modify: `index.html` (aggiungere `<script src="js/rete-quote.js" defer></script>` accanto alla riga 45)

**Interfaces:**
- Produces: `ReteQuote.splitVenditaCondivisa(partecipanti, venditoreId, collegaId)` che restituisce un nuovo array di partecipanti dove la riga del venditore e' spezzata. Stesso pattern UMD di `js/economic-engine.js` (root.ReteQuote + module.exports).

- [ ] **Step 1: test che fallisce**

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { splitVenditaCondivisa } = require('../js/rete-quote.js');

const base = [
  { id: 'ale', ruolo: 'referente', quotaFinale: 200 },
  { id: 'nic', ruolo: 'venditore', haVenduto: true, quotaFinale: 100 }
];

test('divide al 50% la quota del venditore con il collega', () => {
  const r = splitVenditaCondivisa(base, 'nic', 'sel');
  const nic = r.find(p => p.id === 'nic');
  const sel = r.find(p => p.id === 'sel');
  assert.equal(nic.quotaFinale, 50);
  assert.equal(sel.quotaFinale, 50);
  assert.equal(r.find(p => p.id === 'ale').quotaFinale, 200);
});

test('il totale delle quote non cambia, anche con importo dispari', () => {
  const dispari = [{ id: 'nic', ruolo: 'venditore', quotaFinale: 33.33 }];
  const r = splitVenditaCondivisa(dispari, 'nic', 'sel');
  const totale = r.reduce((t, p) => t + p.quotaFinale, 0);
  assert.equal(Math.round(totale * 100), 3333);
});

test('senza collega restituisce i partecipanti invariati', () => {
  assert.deepEqual(splitVenditaCondivisa(base, 'nic', null), base);
});

test('errore chiaro se il venditore non e tra i partecipanti', () => {
  assert.throws(() => splitVenditaCondivisa(base, 'xxx', 'sel'), /venditore/);
});
```

- [ ] **Step 2:** `node --test test/rete-quote.test.js`, atteso FAIL (modulo mancante).
- [ ] **Step 3: implementare**

```js
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ReteQuote = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const centesimi = n => Math.round(n * 100);

  // Spezza la quota del venditore in due meta'. Il resto di un centesimo
  // resta a chi ha registrato la vendita, cosi' il totale non cambia.
  function splitVenditaCondivisa(partecipanti, venditoreId, collegaId) {
    if (!collegaId) return partecipanti;

    const venditore = partecipanti.find(p => p.id === venditoreId);
    if (!venditore) {
      throw new Error('Vendita condivisa: venditore non tra i partecipanti');
    }

    const totale = centesimi(Number(venditore.quotaFinale) || 0);
    const metaCollega = Math.floor(totale / 2);
    const metaVenditore = totale - metaCollega;

    const collega = {
      ...venditore,
      id: collegaId,
      haVenduto: false,
      quotaFinale: metaCollega / 100,
      quotaCalcolata: metaCollega / 100,
      quotaEffettiva: metaCollega / 100,
      quotaOverride: false
    };

    return [
      ...partecipanti.map(p =>
        p.id === venditoreId
          ? {
              ...p,
              quotaFinale: metaVenditore / 100,
              quotaCalcolata: metaVenditore / 100,
              quotaEffettiva: metaVenditore / 100
            }
          : p
      ),
      collega
    ];
  }

  return { splitVenditaCondivisa };
});
```

- [ ] **Step 4:** test verde.
- [ ] **Step 5: commit (con ok).** `feat: divisione 50/50 per vendita condivisa`

---

### Task B2: colonna e validazione lato server

**Files:**
- Create: `supabase/migrations/20261017130000_vendita_condivisa.sql`
- Test: `test/rete-quote-sql.test.js`

- [ ] **Step 1: test che fallisce:** la migration aggiunge `vendite.condivisa_con uuid references public.profili(id)`, un trigger o check che richiede `responsabile_id` del collega = chi ha registrato (`vendite.creato_da`; verificare il nome reale con `grep -n "create table public.vendite" -A25 supabase/schema.sql`), e blocca la modifica dopo il primo pagamento incassato.
- [ ] **Step 2:** FAIL atteso.
- [ ] **Step 3: SQL**

```sql
alter table public.vendite
  add column if not exists condivisa_con uuid references public.profili(id);

create or replace function public._valida_vendita_condivisa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.condivisa_con is null then
    return new;
  end if;

  -- Solo con un diretto sottostante di chi registra la vendita.
  if not exists (
    select 1 from public.profili c
    where c.id = new.condivisa_con
      and c.responsabile_id = new.creato_da   -- verificare nome colonna
  ) then
    raise exception 'La vendita si puo condividere solo con un tuo diretto sottostante';
  end if;

  -- Non modificabile dopo il primo incasso.
  if tg_op = 'UPDATE'
     and new.condivisa_con is distinct from old.condivisa_con
     and exists (
       select 1 from public.pagamenti p
       where p.vendita_id = new.id and p.stato = 'incassato'
     ) then
    raise exception 'Vendita gia incassata: la condivisione non si modifica';
  end if;

  return new;
end;
$$;

create trigger vendite_valida_condivisa
  before insert or update of condivisa_con on public.vendite
  for each row execute function public._valida_vendita_condivisa();
```

- [ ] **Step 4:** verificare il constraint `ruolo` di `vendita_partecipanti`: `grep -n "vendita_partecipanti" -A20 supabase/migrations/*.sql | grep -i "check"`. Il collega entra in `vendita_partecipanti` con `ruolo = 'venditore'` (la validazione dello snapshot confronta i ruoli con quelli della vendita). Se il constraint lo vieta, allargarlo qui.
- [ ] **Step 5:** test verde e commit (con ok).

---

### Task B3: modulo vendita e salvataggio

**Files:**
- Modify: `js/app-economia.js` (form vendita economica, riga ~200 `aggiungiVenditoreTerzo...`), `js/app-vendita.js`, `index.html`
- Test: `test/payment-economic-rpc.test.js` (stile) o nuovo `test/vendita-condivisa-ui.test.js`

- [ ] **Step 1:** leggere `js/app-vendita.js` e il punto di `index.html` dove si sceglie il venditore. Riusare `caricaMappaNomiVenditori` e l'albero di `js/app-rete.js` per elencare i diretti sottostanti.
- [ ] **Step 2: test che fallisce:** esiste `collegaCondivisioneDisponibili()` che per un profilo restituisce solo i `responsabile_id === profilo.id`; vuoto se non ha nessuno sotto (l'interruttore resta nascosto).
- [ ] **Step 3:** implementare lista, interruttore "Vendita condivisa" e select del collega con `x-show="collegaDisponibili.length"`. Salvare `condivisa_con` nella vendita e aggiungere il collega a `vendita_partecipanti`.
- [ ] **Step 4:** nel punto in cui il form calcola i partecipanti del pagamento (dopo `EconomicEngine.calcolaSnapshotPagamento`) chiamare `ReteQuote.splitVenditaCondivisa(...)` con `venditoreId` e `condivisa_con` della vendita.
- [ ] **Step 5:** verificare a mano che `sum(quota_effettiva) = netto` (il controllo server dello snapshot) passi con la divisione.
- [ ] **Step 6:** test verde e commit (con ok).

---

### Task B4: resoconto

**Files:**
- Modify: `js/app-cliente.js` (~riga 1349, lettura `pagamento_partecipanti`), `index.html` scheda cliente

- [ ] **Step 1:** nella scheda cliente e nel resoconto del venditore mostrare, quando `vendite.condivisa_con` e' valorizzato, la propria meta' e quella del collega con etichetta "Vendita condivisa 50/50".
- [ ] **Step 2:** test: la scheda con `condivisa_con` mostra due righe venditore; senza, una.
- [ ] **Step 3:** commit (con ok).

---

## PARTE C - Chiusura

### Task C1: sicurezza, versione, QA

- [ ] **Step 1: RLS test.** Aggiungere in `supabase/test_rls.sql` due controlli: il venditore `da_profilo_id` ottiene 0 righe da `pagamento_quote_rete`; il gestore `a_profilo_id` ne ottiene 1.
- [ ] **Step 2: registro sicurezza.** Aggiornare `~/.config/landing-evolution/registro-sicurezza-landing-sellers.html` (nuova fase "Quote di rete: RLS", tabelle audit, sezione 9, storico, versione +1) e rigenerare il PDF come da AGENTS.md. Senza password, ID o email.
- [ ] **Step 3: bump.** Incrementare `CACHE_NAME` in `service-worker.js` e `?v=` in `index.html`, aggiungere `js/rete-quote.js` alla lista di cache se il service worker ne ha una.
- [ ] **Step 4: suite completa.** `node --test test/`. Expected: tutto PASS.
- [ ] **Step 5: prova su ambiente di test** (mai produzione): 1) vendita di Selim con incasso: Selim vede la quota al netto, Nicholas la quota da riscattare; 2) vendita condivisa Nicholas+Selim: due metà, nessun 10%; 3) vendita condivisa Alessandro+Nicholas: nessun 10% (radice); 4) rata parziale: il 10% segue l'importo; 5) annulla incasso: la quota rete sparisce.
- [ ] **Step 6:** `/ui-check` sulle schermate toccate, poi controllo A/B a due passaggi.
- [ ] **Step 7:** proporre a Tomas il commit finale e l'applicazione delle migration in produzione (azione esterna: chiedere prima).

## Stime

- Parte A: circa un pomeriggio (la parte lunga e' copiare con cura le 4 funzioni SQL esistenti in A2).
- Parte B: circa un pomeriggio.
- Parte C: circa un'ora piu' le prove manuali.

## Rischi da tenere d'occhio

1. **A2 riscrive 4 funzioni critiche del flusso incassi.** Copiare l'ultima versione, non una vecchia: un errore qui blocca la registrazione dei pagamenti.
2. **Quote rete su `modifica_pagamento_economico`:** se un pagamento viene modificato dopo la conferma del gestore, la conferma si azzera (stesso comportamento di `ricevuta_il` oggi).
3. **Statistiche** (`calcolaStatisticheVenditore`, `rete_vendita_incassi`): leggono `quota_effettiva`, quindi ora al netto per chi paga il 10%. E' voluto, ma va controllato che i totali di rete non scendano di colpo.
