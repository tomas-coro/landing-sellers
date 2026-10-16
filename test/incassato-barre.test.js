const { test } = require('node:test');
const assert = require('node:assert/strict');

const app = require('../js/app.js');
// app-fatturato.js usa questi helper come globali del browser.
globalThis.serieIncassatoAnno = app.serieIncassatoAnno;
globalThis.meseInizialeIncassato = app.meseInizialeIncassato;
const mixin = require('../js/app-fatturato.js');

function stato(righe, anno) {
  return Object.assign(Object.create(mixin), {
    fatturatoGuadagniRighe: righe,
    fatturatoAnno: anno,
    fatturatoMeseSelezionato: null
  });
}

test('I tuoi incassi 2026: 5 barre da agosto, totale = somma dei mesi mostrati', () => {
  const s = stato([
    { data: '2026-08-02', valore: 420 },
    { data: '2026-09-15', valore: 910 },
    { data: '2026-10-07', valore: 640 }
  ], 2026);

  assert.deepEqual(s.incassatoSerie().map(m => m.label), ['Ago', 'Set', 'Ott', 'Nov', 'Dic']);
  assert.equal(s.incassatoTotaleAnno(), 1970);
  assert.equal(s.incassatoBarreStrette(), false);
});

test('I tuoi incassi 2027: 12 barre strette, solo iniziali', () => {
  const s = stato([{ data: '2027-03-01', valore: 100 }], 2027);
  assert.equal(s.incassatoSerie().length, 12);
  assert.equal(s.incassatoBarreStrette(), true);
});

test('altezza barra: proporzionale al massimo, minimo visibile, filo se vuota', () => {
  const s = stato([{ data: '2026-09-15', valore: 1000 }, { data: '2026-10-07', valore: 10 }], 2026);
  assert.equal(s.incassatoAltezzaBarra(1000), 112);
  assert.equal(s.incassatoAltezzaBarra(10), 8);
  assert.equal(s.incassatoAltezzaBarra(0), 4);
});

test('mese futuro non selezionabile, mese passato si', () => {
  const s = stato([], 2026);
  const adesso = new Date();
  const chiavePassata = '2000-01';
  const chiaveFutura = (adesso.getFullYear() + 1) + '-01';
  assert.equal(s.incassatoMeseFuturo(chiavePassata), false);
  assert.equal(s.incassatoMeseFuturo(chiaveFutura), true);
});

test('cambiare anno riseleziona un mese valido di quell\'anno', () => {
  const s = stato([{ data: '2027-05-10', valore: 50 }], 2026);
  s.selezionaAnnoIncassato(2027);
  assert.equal(s.fatturatoAnno, 2027);
  assert.ok(s.fatturatoMeseSelezionato.startsWith('2027-'));
});
