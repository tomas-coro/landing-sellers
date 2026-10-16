const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const migration = fs.readFileSync(
  'supabase/migrations/20261017150000_annulla_vendita.sql', 'utf8'
);
const economia = fs.readFileSync('js/app-economia.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

test('annulla_vendita blocca se ci sono incassi e controlla i permessi', () => {
  assert.match(migration, /function public\.annulla_vendita/);
  assert.match(migration, /p\.stato = 'incassato'/);
  assert.match(migration, /v\.venditore_id = v_user/);
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
