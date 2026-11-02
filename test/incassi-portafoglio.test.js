const { test } = require('node:test');
const assert = require('node:assert/strict');
const mixin = require('../js/app-fatturato.js');

function stato() {
  return Object.assign(Object.create(mixin), {
    portafoglioModo: 'incassi', portafoglioPeriodo: '1M',
    fatturatoGuadagniRighe: [
      { data: '2026-08-08', valore: 50, clienteNome: 'A', importoPagato: 300 },
      { data: '2026-10-29', valore: 45, clienteNome: 'B', importoPagato: 75 },
      { data: '2026-11-02', valore: 30, clienteNome: 'C', importoPagato: 50 }
    ],
    portafoglioVendite: [{ data: '2026-11-01', valore: 120, clienteNome: 'D' }]
  });
}

test('quota nel periodo e confronto precedente: incassi e vendite non si mescolano', () => {
  const s = stato();
  const oggi = new Date(2026, 10, 2);
  assert.equal(s.portafoglioDati(oggi).totale, 75);
  assert.equal(s.portafoglioDati(oggi).precedente, 0);
  s.portafoglioModo = 'vendite';
  assert.equal(s.portafoglioDati(oggi).totale, 120);
  s.portafoglioPeriodo = '1G';
  assert.equal(s.portafoglioDati(oggi).totale, 0);
  s.portafoglioModo = 'incassi';
  assert.equal(s.portafoglioDati(oggi).totale, 30);
  assert.equal(s.portafoglioDati(oggi).precedente, 0);
});

test('Tutto inizia nel mese del primo incasso, mai prima di agosto 2026', () => {
  const s = stato(); s.portafoglioPeriodo = 'Tutto';
  const dati = s.portafoglioDati(new Date(2026, 10, 2));
  assert.equal(dati.inizio, '2026-08-01');
  assert.equal(dati.totale, 125);
  assert.equal(dati.righe[0].clienteNome, 'C');
  s.fatturatoGuadagniRighe = [{ data: '2026-07-01', valore: 999 }, { data: '2026-08-14', valore: 20 }];
  assert.equal(s.portafoglioDati(new Date(2026, 10, 2)).totale, 20);
  assert.equal(s.portafoglioDati(new Date(2026, 10, 2)).inizio, '2026-08-01');
});

test('lettura vendite per quota personale e importo contratto dal database', async () => {
  const s = stato();
  s.sessione = { user: { id: 'me' } };
  s.view = 'incassato';
  s.isAdmin = false;
  s.fatturatoAnno = 2026;
  s.righeIncassatePerPartecipazioni = async () => [{ data: '2026-11-02', valore: 30 }];
  const { serieIncassatoAnno, anniDisponibiliFatturato } = require('../js/app.js');
  globalThis.serieIncassatoAnno = serieIncassatoAnno;
  globalThis.anniDisponibiliFatturato = anniDisponibiliFatturato;
  const old = globalThis.window;
  globalThis.window = { supabaseClient: { from(tabella) {
    return { select() { return {
      eq() { return Promise.resolve({ data: [{ pagamento_id: 'p1', vendita_id: 'v1', quota_finale: 120 }], error: null }); },
      in() { return Promise.resolve({ data: [{ id: 'v1', stato: 'attiva', data_vendita: '2026-11-02', importo_vendita: 250, clienti: { nome: 'Cliente A' } }], error: null }); }
    }; } };
  } } };
  try {
    await s.caricaFatturato();
    assert.equal(s.portafoglioVendite[0].valore, 120);
    assert.equal(s.portafoglioVendite[0].clienteNome, 'Cliente A');
    assert.equal(s.fatturatoGuadagniRighe[0].valore, 30);
    assert.equal(s.portafoglioVendite[0].importoPagato, 250);
    assert.equal(s.erroreFatturato, '');
  } finally { globalThis.window = old; }
});

test('grafico reale: linea cumulativa, barre solo sui giorni con quota, scala per mesi', () => {
  const s = stato(); s.portafoglioPeriodo = 'Tutto';
  const svg = s.portafoglioGrafico(new Date(2026, 10, 2));
  assert.match(svg, /port-area/);
  assert.equal((svg.match(/<rect /g) || []).length, 3);
  assert.doesNotMatch(svg, /clienteNome|pagamentoId/);
});
