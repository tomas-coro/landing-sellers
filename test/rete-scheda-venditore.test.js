const test = require('node:test');
const assert = require('node:assert/strict');
const mixin = require('../js/app-rete.js');
const { indicizzaAlbero, markupAlberoRete, idsScheda, clientiScheda, righeIncassiScheda } = mixin.__puri;

const nodi = [
  { id: 'a', nome: 'Alessandro', livello: 1, responsabile_id: null },
  { id: 'n', nome: 'Nicholas', livello: 2, responsabile_id: 'a' },
  { id: 's', nome: 'Selim', livello: 3, responsabile_id: 'n' }
];

test('idsScheda: solo lui, oppure lui e il team', () => {
  const albero = indicizzaAlbero(nodi);
  assert.deepEqual(idsScheda(albero, 'n', false), ['n']);
  assert.deepEqual(idsScheda(albero, 'n', true).sort(), ['n', 's']);
});

test('clientiScheda: solo i clienti dei venditori coperti, ordinati per nome', () => {
  const clienti = [
    { id: 1, nome: 'Zeta', venditore_id: 'n' },
    { id: 2, nome: 'Alfa', venditore_id: 'n' },
    { id: 3, nome: 'Beta', venditore_id: 's' },
    { id: 4, nome: 'Altro', venditore_id: 'x' }
  ];
  assert.deepEqual(clientiScheda({ clienti, ids: ['n'] }).map(c => c.nome), ['Alfa', 'Zeta']);
  assert.deepEqual(clientiScheda({ clienti, ids: ['n', 's'] }).map(c => c.nome), ['Alfa', 'Beta', 'Zeta']);
});

test('righeIncassiScheda: filtra per venditore e scarta vendite annullate', () => {
  const vendite = [
    { id: 'v1', cliente_id: 'c1', stato: 'attiva' },
    { id: 'v2', cliente_id: 'c2', stato: 'annullata' }
  ];
  const incassi = [
    { profilo_id: 'n', vendita_id: 'v1', data_pagamento: '2026-10-05', quota_effettiva: '100.5' },
    { profilo_id: 'n', vendita_id: 'v2', data_pagamento: '2026-10-06', quota_effettiva: 50 },
    { profilo_id: 'x', vendita_id: 'v1', data_pagamento: '2026-10-07', quota_effettiva: 70 }
  ];
  const righe = righeIncassiScheda({ incassi, ids: ['n'], vendite, clientiPerId: { c1: { nome: 'Rossi' } } });
  assert.deepEqual(righe, [{ data: '2026-10-05', valore: 100.5, profiloId: 'n', clienteNome: 'Rossi' }]);
});

test('albero: ogni riga ha il tasto Scheda con l id escapato', () => {
  const albero = indicizzaAlbero(nodi);
  const html = markupAlberoRete({
    albero, statistiche: {}, visibili: albero.ordine, centro: null, viewerId: 'a'
  });
  assert.equal((html.match(/data-scheda="/g) || []).length, 3);
  assert.match(html, /data-scheda="n"/);
});
