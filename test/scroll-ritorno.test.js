const { test } = require('node:test');
const assert = require('node:assert');
const { appState } = require('../js/app.js');

// Stato reale di appState con scrollApp sostituito: registra dove si scorre.
function nuovoStato() {
  const s = appState();
  s.scrolli = [];
  s.scrollApp = top => s.scrolli.push(top);
  s.pilaNavigazione = ['home'];
  s.posizioniScroll = { home: 640 };
  return s;
}

test('aprire una schermata nuova parte dall alto', () => {
  const s = nuovoStato();
  s.gestisciScrollCambioVista('rete');
  assert.deepStrictEqual(s.scrolli, [0]);
  assert.deepStrictEqual(s.pilaNavigazione, ['home', 'rete']);
});

test('tornare a una schermata gia attraversata riprende la posizione', () => {
  const s = nuovoStato();
  s.gestisciScrollCambioVista('rete');
  s.gestisciScrollCambioVista('home');
  assert.deepStrictEqual(s.scrolli, [0, 640]);
  assert.deepStrictEqual(s.pilaNavigazione, ['home']);
});

test('indietro di due livelli ritrova la posizione di ognuno', () => {
  const s = nuovoStato();
  s.gestisciScrollCambioVista('clienti');
  s.posizioniScroll.clienti = 200;
  s.gestisciScrollCambioVista('scheda');
  s.gestisciScrollCambioVista('clienti');
  s.gestisciScrollCambioVista('home');
  assert.deepStrictEqual(s.scrolli, [0, 0, 200, 640]);
});

test('il tocco sulla barra in basso parte sempre dall alto e riazzera la pila', () => {
  const s = nuovoStato();
  s.gestisciScrollCambioVista('rete');
  s.navTabScadenza = Date.now() + 2000;
  s.gestisciScrollCambioVista('home');
  assert.deepStrictEqual(s.scrolli, [0, 0]);
  assert.deepStrictEqual(s.pilaNavigazione, ['home']);
  assert.strictEqual(s.navTabScadenza, 0);
});

test('un tocco sulla barra scaduto non conta', () => {
  const s = nuovoStato();
  s.gestisciScrollCambioVista('rete');
  s.navTabScadenza = Date.now() - 1;
  s.gestisciScrollCambioVista('home');
  assert.deepStrictEqual(s.scrolli, [0, 640]);
});
