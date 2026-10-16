const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  serieMensileAnno,
  serieIncassatoAnno,
  meseInizialeIncassato,
  totaliPerAnno,
  anniDisponibiliFatturato
} = require('../js/app.js');

test('serieMensileAnno somma i valori nel mese giusto e ignora gli altri anni', () => {
  const righe = [
    { data: '2025-01-10', valore: 100 },
    { data: '2025-01-20', valore: 50 },
    { data: '2025-02-01', valore: 30 },
    { data: '2024-01-15', valore: 999 } // anno diverso, va ignorato
  ];

  const serie = serieMensileAnno(righe, 2025);

  assert.equal(serie.length, 12);
  assert.equal(serie[0].valore, 150); // gennaio
  assert.equal(serie[1].valore, 30);  // febbraio
  assert.equal(serie[2].valore, 0);   // marzo: nessun dato
});

test('serieMensileAnno ignora righe senza data o con valore non numerico', () => {
  const righe = [
    { data: null, valore: 100 },
    { data: '2025-03-01', valore: 'x' }
  ];

  const serie = serieMensileAnno(righe, 2025);
  assert.ok(serie.every(m => m.valore === 0));
});

test('totaliPerAnno raggruppa correttamente per anno', () => {
  const righe = [
    { data: '2025-01-10', valore: 100 },
    { data: '2025-06-01', valore: 200 },
    { data: '2026-01-01', valore: 50 }
  ];

  const totali = totaliPerAnno(righe);

  assert.equal(totali[2025], 300);
  assert.equal(totali[2026], 50);
});

test('anniDisponibiliFatturato include sempre l\'anno corrente e ordina decrescente', () => {
  const annoCorrente = new Date().getFullYear();
  const anni = anniDisponibiliFatturato([
    [{ data: '2023-01-01', valore: 1 }],
    [{ data: '2025-06-01', valore: 1 }]
  ]);

  assert.ok(anni.includes(annoCorrente));
  assert.ok(anni.includes(2023));
  assert.ok(anni.includes(2025));
  assert.deepEqual(anni, [...anni].sort((a, b) => b - a));
});

test('serieIncassatoAnno: il 2026 parte da agosto, gli altri anni da gennaio', () => {
  const righe = [{ data: '2026-10-07', valore: 640 }, { data: '2027-01-05', valore: 10 }];

  const s2026 = serieIncassatoAnno(righe, 2026);
  assert.equal(s2026.length, 5);
  assert.equal(s2026[0].chiave, '2026-08');
  assert.equal(s2026[2].valore, 640); // ottobre

  const s2027 = serieIncassatoAnno(righe, 2027);
  assert.equal(s2027.length, 12);
  assert.equal(s2027[0].valore, 10);
});

test('meseInizialeIncassato: mese corrente, altrimenti ultimo con incassi, altrimenti il primo', () => {
  const oggi = new Date(2026, 9, 16); // 16 ottobre 2026
  const s2026 = serieIncassatoAnno([{ data: '2026-09-15', valore: 100 }], 2026);
  assert.equal(meseInizialeIncassato(s2026, oggi), '2026-10');

  const s2025 = serieIncassatoAnno([{ data: '2025-03-02', valore: 50 }, { data: '2025-06-02', valore: 70 }], 2025);
  assert.equal(meseInizialeIncassato(s2025, oggi), '2025-06');

  assert.equal(meseInizialeIncassato(serieIncassatoAnno([], 2028), oggi), '2028-01');
  assert.equal(meseInizialeIncassato([], oggi), null);
});
