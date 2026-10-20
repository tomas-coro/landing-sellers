const test = require('node:test');
const assert = require('node:assert/strict');

const { appState } = require('../js/app.js');

test('il trend Home mostra il valore sopra tutte le 12 colonne', () => {
  const stato = appState();
  const punti = Array.from({ length: 12 }, (_, indice) => ({
    valore: 1000 + indice * 100,
    numero: 1,
    label: 'Gen',
    chiave: String(indice)
  }));

  const markup = stato.disegnaMarkupBarreMensili(
    punti,
    'trendHoverVenditore',
    { dark: true }
  );

  assert.equal(
    (markup.match(/<text class="metrics-bar-value/g) || []).length,
    12
  );
  assert.match(markup, /metrics-bar-value-dense/);
});
