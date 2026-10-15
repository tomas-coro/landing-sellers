const { test } = require('node:test');
const assert = require('node:assert');
const { appState } = require('../js/app.js');

const chiave = (view, extra = {}) => JSON.stringify({ le: true, view, ...extra });

function nuovoStato(pila, { admin = false } = {}) {
  const s = appState();
  s.isAdmin = admin;
  s.pilaNavigazione = pila;
  s.chiamate = [];
  s.vaiHome = async () => s.chiamate.push('home');
  s.tornaAllaDashboard = () => s.chiamate.push('dashboard');
  s.confermaUscitaFormCliente = async () => true;
  s.applicaStatoNavigazione = async stato => s.chiamate.push(stato.view + ':' + (stato.reteFocusId || ''));
  return s;
}

test('senza schermata precedente indietro porta alla Home (o alla dashboard per admin)', async () => {
  const s = nuovoStato([chiave('agenda')]);
  assert.strictEqual(s.etichettaIndietro(), 'Torna alla home');
  await s.tornaIndietro();
  const a = nuovoStato([chiave('agenda')], { admin: true });
  assert.strictEqual(a.etichettaIndietro(), 'Torna alla dashboard');
  await a.tornaIndietro();
  assert.deepStrictEqual(s.chiamate, ['home']);
  assert.deepStrictEqual(a.chiamate, ['dashboard']);
});

test('da un venditore della Rete indietro porta alla Rete, poi alla Home', async () => {
  const s = nuovoStato([chiave('lista'), chiave('rete'), chiave('rete', { reteFocusId: 'x' })]);
  assert.strictEqual(s.etichettaIndietro(), 'Torna a Rete vendita');
  await s.tornaIndietro();
  s.pilaNavigazione = [chiave('lista'), chiave('rete')];
  assert.strictEqual(s.etichettaIndietro(), 'Torna alla home');
  await s.tornaIndietro();
  assert.deepStrictEqual(s.chiamate, ['rete:', 'home']);
});

test('l etichetta segue la sezione di provenienza', () => {
  const s = nuovoStato([chiave('agenda'), chiave('scheda', { clienteId: 'c1' })]);
  assert.strictEqual(s.etichettaIndietro(), 'Torna all’agenda');
  s.pilaNavigazione = [chiave('clienti'), chiave('scheda', { clienteId: 'c1' })];
  assert.strictEqual(s.etichettaIndietro(), 'Torna ai clienti');
  s.pilaNavigazione = [chiave('profilo'), chiave('fatturato')];
  assert.strictEqual(s.etichettaIndietro(), 'Torna al profilo');
});

test('uno stato Rete con un nome mostra Torna a <nome>', () => {
  const s = nuovoStato([chiave('rete', { reteFocusId: 'n1' }), chiave('rete', { reteFocusId: 'n2' })]);
  s.reteNodi = [{ id: 'n1', nome: 'Nicholas', livello: 2, responsabile_id: null }, { id: 'n2', nome: 'Selim', livello: 3, responsabile_id: 'n1' }];
  assert.strictEqual(s.etichettaIndietro(), 'Torna a Nicholas');
});
