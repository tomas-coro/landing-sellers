const test = require('node:test');
const assert = require('node:assert/strict');

const { appState } = require('../js/app.js');

function punti(valori) {
  return valori.map((valore, i) => ({ valore, numero: valore ? 1 : 0, label: 'M' + i, chiave: 'k' + i }));
}

function statoConSerie() {
  const s = appState();
  s.trendRangeAdmin = 3;
  s.trendDatiAdmin = [
    { id: 'totale', nome: 'Totale', punti: punti([0, 0, 0, 0, 0, 0, 0, 0, 0, 380, 1650, 2533]) },
    { id: 'v1', nome: 'Alessandro', punti: punti([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1850]) }
  ];
  return s;
}

test('il trend admin disegna barre (non linee) con il valore sopra ogni colonna', () => {
  const markup = statoConSerie().trendMarkupAdmin();
  assert.equal((markup.match(/<rect class="metrics-bar/g) || []).length, 3);
  assert.equal((markup.match(/<text class="metrics-bar-value/g) || []).length, 3);
  assert.doesNotMatch(markup, /metrics-trend-line/);
});

test('scegliere un venditore cambia la serie e azzera la selezione', () => {
  const s = statoConSerie();
  s.trendHoverAdmin = 2;
  s.impostaSerieTrendAdmin('v1');
  assert.equal(s.trendSerieAdminScelta().id, 'v1');
  assert.equal(s.trendHoverAdmin, null);
  // un solo mese con vendite: una sola etichetta valore
  assert.equal((s.trendMarkupAdmin().match(/<text class="metrics-bar-value/g) || []).length, 1);
});

test('serie scomparsa dai dati: si torna al totale', () => {
  const s = statoConSerie();
  s.trendSerieAdminId = 'sparito';
  assert.equal(s.trendSerieAdminScelta().id, 'totale');
});
