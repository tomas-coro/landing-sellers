const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { formattaEuro, formattaData } = require('../js/validators.js');
globalThis.formattaEuro = formattaEuro;
globalThis.formattaData = formattaData;
const { appState } = require('../js/app.js');

function stato() {
  const s = appState();
  s.sessione = { user: { id: 'me' } };
  s.venditaClienteAttiva = { importo_vendita: 1200, servizio: 'Sito vetrina' };
  s.pagamentiCliente = [
    { id: 'p1', stato: 'incassato', importo: 400, data_pagamento: '2026-11-02' },
    { id: 'p2', stato: 'previsto', importo: 400, data_scadenza: '2026-12-02' },
    { id: 'p3', stato: 'previsto', importo: 400, data_scadenza: '2027-01-02' }
  ];
  s.nomePartecipanteTrasferimento = q => q.nome;
  return s;
}

test('vibrazione: pattern, preferenza, motion ridotto e API assente', () => {
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalMatchMedia = globalThis.matchMedia;
  const originalStorage = globalThis.localStorage;
  const chiamate = [];
  try {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { vibrate: pattern => chiamate.push(pattern) } });
    globalThis.matchMedia = () => ({ matches: false });
    globalThis.localStorage = {
      getItem: () => 'off', setItem: (key, value) => chiamate.push([key, value])
    };
    const s = stato();
    assert.equal(s.vibrazioneAttiva, false);
    s.vibra('vendita');
    s.toggleVibrazione();
    s.vibra('vendita');
    s.vibra('incasso');
    s.mostraFeedback({ tipo: 'errore', titolo: 'Errore' });
    s.chiudiFeedback();
    assert.deepEqual(chiamate, [['le-vibrazione', 'on'], 15, 12, [20, 40, 20]]);
    globalThis.matchMedia = () => ({ matches: true });
    s.vibra('vendita');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
    globalThis.matchMedia = () => ({ matches: false });
    s.vibra('errore');
    assert.equal(chiamate.length, 4);
    globalThis.localStorage = { getItem: () => { throw Error('denied'); }, setItem: () => { throw Error('denied'); } };
    const senzaStorage = stato();
    assert.equal(senzaStorage.vibrazioneAttiva, true);
    senzaStorage.toggleVibrazione();
    assert.equal(senzaStorage.vibrazioneAttiva, false);
  } finally {
    if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
    else delete globalThis.navigator;
    globalThis.matchMedia = originalMatchMedia;
    globalThis.localStorage = originalStorage;
  }
});

test('spunta e scontrino vibrano al termine delle animazioni', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /class="fb-ck"[^>]*@animationend\.self="feedback\.tipo === 'vendita' && vibra\('vendita'\)"/);
  assert.match(html, /class="fb-pp"[^>]*@animationend\.self="feedback\.stampato = true; vibra\('incasso'\)"/);
});

const incasso = {
  id: 'p1', importo: 400, data_pagamento: '2026-11-02', metodo: 'Bonifico',
  quote_trasferimento: [
    { profilo_id: 'altro', nome: 'Alessandro', quota_effettiva: 160 },
    { profilo_id: 'me', quota_effettiva: 240 }
  ]
};

test('lo scontrino prende i numeri dall\'incasso e dallo storico reali', () => {
  const m = stato().costruisciScontrinoIncasso(incasso, { nomeCliente: 'Rossi' });
  assert.equal(m.importo, 400);
  assert.equal(m.quota, 240);
  assert.equal(m.rata, '1 di 3');
  assert.equal(m.incassatoFinora, 400);
  assert.equal(m.importoVendita, 1200);
  assert.equal(m.percentuale, 33);
  assert.equal(m.previste.length, 2);
  assert.equal(m.saldata, false);
  assert.deepEqual(m.quote.map(q => q.nome), ['Tua quota', 'Quota Alessandro']);
});

test('lo scontrino annullato non mostra il numero di rata', () => {
  const m = stato().costruisciScontrinoIncasso(incasso, { annullato: true });
  assert.equal(m.annullato, true);
  assert.equal(m.rata, '');
});

test('vendita e incasso mostrano il feedback e restano sulla scheda, non in home', () => {
  const economia = fs.readFileSync('js/app-economia.js', 'utf8');
  assert.match(economia, /this\.mostraFeedback\(\{\s*tipo: 'vendita'/);
  assert.match(economia, /await this\.apriScheda\(clienteId\);/);
  assert.doesNotMatch(economia, /if \(this\.successoEconomia\) this\.vaiHome\(\)/);
  assert.match(economia, /nuovoIncasso/);
});

test('il feedback parte dopo la registrazione e si chiude da solo', () => {
  const s = stato();
  s.apriFoglioScheda = () => {};
  s.mostraFeedback({ tipo: 'errore', titolo: 'x', messaggio: 'y' });
  assert.equal(s.feedback.fase, 'overlay');
  s.chiudiFeedback();
  assert.equal(s.feedback, null);
});
