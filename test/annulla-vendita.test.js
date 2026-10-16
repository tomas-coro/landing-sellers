const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const migration = fs.readFileSync(
  'supabase/migrations/20261017170000_modifica_vendita_annulla_admin.sql', 'utf8'
);
const economia = fs.readFileSync('js/app-economia.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

test('annulla_vendita blocca se ci sono incassi e controlla i permessi', () => {
  assert.match(migration, /function public\.annulla_vendita/);
  assert.match(migration, /p\.stato = 'incassato'/);
  assert.match(migration, /public\.is_admin\(\)/);
  assert.match(migration, /set stato = 'annullata'/);
  assert.match(migration, /set stato = 'annullato'/);
});

test('il frontend annulla la vendita via RPC e mostra gli errori come toast', () => {
  assert.match(economia, /rpc\(\s*'annulla_vendita'/);
  assert.match(economia, /mostraErroreEconomia\(/);
  assert.match(economia, /this\.mostraToast\('error', titolo, messaggio\)/);
  assert.match(html, /annullaVenditaCliente\(\)/);
  assert.match(html, /vaiAllaVenditaEsistente\(\)/);
  assert.match(html, /id="errore-economia"/);
});

test('annullare e\' solo admin; il venditore modifica con sostituisci_vendita', () => {
  assert.match(migration, /if not public\.is_admin\(\) then\s+raise exception 'Solo l''admin/);
  assert.match(migration, /function public\.sostituisci_vendita/);
  assert.match(migration, /registra_vendita_con_trasferimenti\(/);
  assert.match(migration, /non si puo'' piu'' modificare/);
  assert.match(economia, /'sostituisci_vendita'/);
  assert.match(html, /modificaVenditaCliente\(\)/);
  assert.match(html, /x-show="isAdmin"[\s\S]{0,120}annullaVenditaCliente\(\)/);
});

test('un non-admin non puo\' eliminare un cliente con vendita attiva', () => {
  assert.match(migration, /not public\.is_admin\(\) and exists/);
  assert.match(migration, /chiedi all''admin di eliminarlo/);
});
