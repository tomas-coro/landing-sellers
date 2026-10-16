const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { appState } = require('../js/app.js');

function stato(profilo = { ruolo: 'venditore', ruolo_economico: null }) {
  const s = appState();
  s.sessione = { user: { id: 'venditore-1' } };
  s.profilo = profilo;
  s.scadenzePagamentoPerCliente = {};
  s.trasferimentiDaConfermare = [];
  s.mesiNonRegistratiCliente = () => [];
  return s;
}

test('Ricontatta è disponibile soltanto al venditore diretto', () => {
  const cliente = { id: 'c1', venditore_id: 'venditore-1' };
  assert.strictEqual(stato().puoRicontattareCliente(cliente), true);
  assert.strictEqual(stato().puoRicontattareCliente({ ...cliente, venditore_id: 'altro' }), false);
  assert.strictEqual(stato({ ruolo: 'developer', ruolo_economico: 'produzione' }).puoRicontattareCliente(cliente), false);
  assert.strictEqual(stato({ ruolo: 'admin', ruolo_economico: null }).puoRicontattareCliente(cliente), false);
});

test('il ricontatto conserva e mostra giorno e ora nell agenda del diretto', () => {
  const s = stato();
  s.clientiDiretti = () => [{
    id: 'c1', nome: 'Cliente', venditore_id: 'venditore-1', stato: 'brief_mandato',
    prossimo_contatto: '2030-01-10T15:30:00'
  }];

  const [evento] = s.eventiAgenda();
  assert.strictEqual(evento.data, '2030-01-10');
  assert.strictEqual(evento.dataOra, '2030-01-10T15:30:00');
  assert.match(evento.ora, /15[.:]30/);
  assert.strictEqual(s.dataOraLocale('2030-01-10'), '2030-01-10T09:00');
});

test('la RPC limita il ricontatto al proprietario e accetta data e ora', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '../supabase/migrations/20261016120000_ricontatta_cliente_diretto.sql'),
    'utf8'
  );
  assert.match(sql, /p_data timestamptz/);
  assert.match(sql, /c\.venditore_id = auth\.uid\(\)/);
  assert.match(sql, /p\.ruolo not in \('admin', 'developer'\)/);
  assert.match(sql, /revoke all[\s\S]*from public, anon/);
  assert.match(sql, /grant execute[\s\S]*to authenticated/);
});

test('anche Fatto usa data e ora ed è riservato al venditore diretto', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '../supabase/migrations/20261016123000_completa_ricontatto_cliente_diretto.sql'),
    'utf8'
  );
  const frontend = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
  assert.match(sql, /p_data timestamptz/);
  assert.match(sql, /c\.venditore_id = auth\.uid\(\)/);
  assert.match(sql, /p\.ruolo not in \('admin', 'developer'\)/);
  assert.match(frontend, /p_data: evento\.dataOra \|\| null/);
});
