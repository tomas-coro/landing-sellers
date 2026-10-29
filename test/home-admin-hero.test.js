const test = require('node:test');
const assert = require('node:assert/strict');
const admin = require('../js/app-admin.js');

// Stato minimo: i metodi leggono solo adminStats e trendDatiAdmin
function stato(adminStats, trendDatiAdmin = []) {
  return Object.assign({}, admin, { adminStats, trendDatiAdmin, classificaVenditori() { return [1, 2, 3, 4]; } });
}

test('percentuale incassato: arrotondata, 0 senza venduto, mai oltre 100', () => {
  assert.equal(stato({ volumeVendite: 4563, incassatoEffettivo: 2490 }).percentualeIncassatoAdmin(), 55);
  assert.equal(stato({ volumeVendite: 0, incassatoEffettivo: 100 }).percentualeIncassatoAdmin(), 0);
  assert.equal(stato({ volumeVendite: 100, incassatoEffettivo: 150 }).percentualeIncassatoAdmin(), 100);
});

test('venduto del mese in corso: ultimo punto della serie Totale, null se manca', () => {
  const serie = [{ id: 'totale', punti: [{ label: 'Set', valore: 1650 }, { label: 'Ott', valore: 2533 }] }];
  assert.deepEqual(stato({}, serie).venditoMeseCorrenteAdmin(), { label: 'Ott', valore: 2533 });
  assert.equal(stato({}, []).venditoMeseCorrenteAdmin(), null);
});

test('sottotitolo admin: singolare e plurale', () => {
  assert.equal(stato({ venditeAttive: 12 }).sottotitoloAdmin(), '4 venditori, 12 vendite attive.');
  assert.equal(stato({ venditeAttive: 1 }).sottotitoloAdmin(), '4 venditori, 1 vendita attiva.');
});
