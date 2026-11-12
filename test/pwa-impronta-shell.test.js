const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { versioneCache, calcolaImpronta } = require('./impronta-shell.js');

const COMANDO = 'node test/impronta-shell.js';

test('se cambia un file della shell in cache, la versione del service worker va bumpata', () => {
  const salvata = JSON.parse(fs.readFileSync('test/impronta-shell.json', 'utf8'));
  const versione = versioneCache();
  const impronta = calcolaImpronta();

  if (impronta !== salvata.impronta) {
    assert.notEqual(
      versione,
      salvata.cache,
      'I file della shell sono cambiati ma CACHE_NAME e ?v= sono ancora v' + versione +
        '. Bumpa la versione in service-worker.js e index.html, poi esegui: ' + COMANDO
    );
    assert.fail('Versione bumpata ma impronta non aggiornata. Esegui: ' + COMANDO);
  }

  assert.equal(
    versione,
    salvata.cache,
    'La versione e\' cambiata senza che cambi la shell. Esegui: ' + COMANDO
  );
});
