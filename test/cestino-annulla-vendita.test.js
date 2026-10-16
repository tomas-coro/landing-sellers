const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const migration = fs.readFileSync(
  'supabase/migrations/20261017160000_cestino_annulla_vendita.sql', 'utf8'
);

test('eliminare un cliente annulla la vendita senza incassi e blocca se ci sono incassi', () => {
  assert.match(migration, /function public\.sposta_cliente_nel_cestino/);
  assert.match(migration, /pg\.stato = 'incassato'/);
  assert.match(migration, /annulla prima gli incassi/);
  assert.match(migration, /set stato = 'annullata'/);
  assert.match(migration, /set stato = 'annullato'/);
});

test('la migrazione pulisce le vendite orfane dei clienti gia\' nel cestino', () => {
  assert.match(migration, /c\.cancellato_il is not null/);
  assert.match(migration, /not exists/);
});
