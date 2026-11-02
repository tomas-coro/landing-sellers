const { test } = require('node:test');
const assert = require('node:assert/strict');
const { appState } = require('../js/app.js');

test('dopo la creazione si può aprire subito la scheda e tornare all’elenco', async () => {
  const s = appState();
  s.view = 'lista';
  s.clienteCreatoId = 'cliente-1';
  s.clienteCreatoPromptAperto = true;
  let aperto = null;
  s.apriScheda = async id => {
    aperto = id;
    s.viewPrecedenteScheda = s.view;
    s.view = 'scheda';
  };
  await s.apriSchedaClienteCreato();
  assert.equal(aperto, 'cliente-1');
  assert.equal(s.viewPrecedenteScheda, 'lista');
  assert.equal(s.clienteCreatoPromptAperto, false);
  assert.equal(s.clienteCreatoId, null);
});
