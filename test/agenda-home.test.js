const { test } = require('node:test');
const assert = require('node:assert/strict');

const { appState } = require('../js/app.js');

// Una rata prevista scaduta (non incassata) deve restare visibile nel widget
// agenda della Home finché non viene incassata o la vendita non diventa
// inattiva - esattamente come già succede per i "contatto" scaduti. Prima
// del fix, il filtro su rinnovo/rata richiedeva data >= oggi e la faceva
// sparire da sola il giorno dopo la scadenza, senza nessuna azione dell'utente.
test('eventiOggiHome mantiene visibile una rata scaduta non incassata', () => {
  const stato = appState();
  stato.isAdmin = false;
  stato.clienti = [{ id: 'c1', nome: 'Cliente Test' }];
  stato.adminVenditoriPerId = {};

  const ieri = stato.aggiungiGiorniISO(stato.dataISOOggi(), -1);
  stato.scadenzePagamentoPerCliente = {
    c1: [{ id: 'r1', data: ieri, importo: 100 }]
  };

  const eventi = stato.eventiOggiHome();
  const rata = eventi.find(e => e.tipo === 'rata' && e.clienteId === 'c1');

  assert.ok(rata, 'la rata scaduta deve comparire ancora nel widget Home');
});
