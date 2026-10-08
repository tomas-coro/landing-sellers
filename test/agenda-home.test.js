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

test('eventiOggiHome mostra i pagamenti arretrati non registrati', () => {
  const stato = appState();
  stato.isAdmin = false;
  stato.clienti = [{
    id: 'c1',
    nome: 'Cliente Test',
    periodicita_contratto: 'mensile',
    data_attivazione: stato.aggiungiGiorniISO(stato.dataISOOggi(), -60),
    importo_abbonamento: 100
  }];
  stato.adminVenditoriPerId = {};
  stato.pacchettoVenditaPerCliente = { c1: { venditaId: 'v1' } };
  stato.mesiCopertiPerVenditaVenditore = {};
  stato.coperturaPagamentiAffidabile = true;
  stato.scadenzePagamentoPerCliente = {};

  const evento = stato.eventiOggiHome().find(e => e.tipo === 'mancante');

  assert.ok(evento, 'il pagamento arretrato deve comparire nella Home');
  assert.equal(evento.venditaId, 'v1');
});

test('annullare un incasso richiama la conversione atomica in rata prevista', async () => {
  const stato = appState();
  let chiamata = null;

  stato.chiediConferma = async () => true;
  stato.caricaPagamentiCliente = async () => {};
  stato.caricaDashboardAdmin = async () => {};
  stato.isAdmin = true;

  global.formattaEuro = valore => `${valore} €`;
  global.window ||= {};
  global.window.supabaseClient = {
    rpc: async (nome, payload) => {
      chiamata = [nome, payload];
      return { data: 'p1', error: null };
    }
  };

  await stato.eliminaPagamentoCliente(
    { id: 'c1' },
    { id: 'p1', vendita_id: 'v1', stato: 'incassato', importo: 100 }
  );

  assert.deepEqual(chiamata, [
    'annulla_incasso_economico',
    { p_pagamento_id: 'p1' }
  ]);
});
