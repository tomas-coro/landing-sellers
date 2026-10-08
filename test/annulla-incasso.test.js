const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const migrationPath = 'supabase/migrations/20260927120000_annulla_incasso_in_rata_prevista.sql';
const migration = fs.existsSync(migrationPath)
  ? fs.readFileSync(migrationPath, 'utf8')
  : '';
const frontend = fs.readFileSync('js/app-economia.js', 'utf8');

test('annullare un incasso lo riporta atomicamente tra le rate da incassare', () => {
  assert.match(migration, /create or replace function public\.annulla_incasso_economico/);
  assert.match(migration, /delete from public\.pagamento_partecipanti/);
  assert.match(migration, /delete from public\.pagamento_calcoli/);
  assert.match(migration, /stato = 'previsto'/);
  assert.match(frontend, /rpc\(\s*'annulla_incasso_economico'/);
});
