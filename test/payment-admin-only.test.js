const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const migrationPath = 'supabase/migrations/20261008160000_pagamenti_registrati_solo_admin.sql';
const migration = fs.existsSync(migrationPath)
  ? fs.readFileSync(migrationPath, 'utf8')
  : '';
const frontend = fs.readFileSync('js/app-economia.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

test('solo admin può modificare o annullare un incasso registrato', () => {
  assert.match(migration, /if not public\.is_admin\(\) then[\s\S]*Solo l’amministratore può modificare un incasso registrato/);
  assert.match(migration, /if not public\.is_admin\(\) then[\s\S]*Solo l’amministratore può annullare un incasso registrato/);
  assert.match(frontend, /pagamento\.stato === 'incassato' && !this\.isAdmin/);
});

test('i venditori non vedono modifica o annulla sugli incassi', () => {
  const adminOnlyActions = html.match(/x-show="p\.stato === 'previsto' \|\| isAdmin"/g) || [];
  assert.equal(adminOnlyActions.length, 2);
});
