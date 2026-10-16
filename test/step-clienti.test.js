const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const migrationPath = 'supabase/migrations/20261017180000_step_cliente.sql';
const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const app = fs.readFileSync('js/app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

test('database e frontend accettano i cinque step cliente', () => {
  for (const stato of ['contattato', 'acquisito', 'brief_mandato', 'vinto', 'completato', 'perso']) {
    assert.match(migration, new RegExp(`'${stato}'`));
  }
  assert.match(app, /'contattato', 'acquisito', 'brief_mandato', 'vinto', 'completato', 'perso'/);
  assert.match(html, /\['contattato','acquisito','brief_mandato','vinto','completato','perso'\]/);
});

test('completato e pubblicato restano sincronizzati', () => {
  assert.match(migration, /when p_stato = 'completato' then 'pubblicato'/);
  assert.match(migration, /stato = case\s+when p_stato = 'pubblicato' then 'completato'/);
});
