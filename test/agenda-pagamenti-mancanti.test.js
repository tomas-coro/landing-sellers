const { test } = require('node:test');
const assert = require('node:assert/strict');

const { appState } = require('../js/app.js');

// Un cliente mensile con sito online ma senza nessuna riga in "pagamenti"
// per i mesi passati non deve sparire dall'agenda: prima di questo fix
// data_rinnovo veniva avanzato da solo (cron sincronizza_rinnovi) e, senza
// nessuna rata mai creata, non c'era nessun evento che segnalasse il buco.
test('mesiNonRegistratiCliente segnala ogni mese mensile senza nessuna riga pagamenti', () => {
  const stato = appState();
  stato.pacchettoVenditaPerCliente = { c1: { venditaId: 'v1' } };
  stato.mesiCopertiPerVenditaVenditore = {};
  stato.coperturaPagamentiAffidabile = true;

  const oggi = stato.dataISOOggi();
  const [anno, mese] = oggi.split('-').map(Number);
  // Attivato 3 mesi fa: deve generare 3 mesi mancanti (quello di attivazione
  // è escluso, è il primo periodo incassato alla vendita).
  const indiceAttivazione = (mese - 1) - 3;
  const annoAttivazione = anno + Math.floor(indiceAttivazione / 12);
  const meseAttivazione = ((indiceAttivazione % 12) + 12) % 12 + 1;
  const dataAttivazione =
    `${annoAttivazione}-${String(meseAttivazione).padStart(2, '0')}-05`;

  const cliente = {
    id: 'c1',
    periodicita_contratto: 'mensile',
    data_attivazione: dataAttivazione,
    importo_abbonamento: 100
  };

  const risultati = stato.mesiNonRegistratiCliente(cliente);

  assert.equal(risultati.length, 3);
  risultati.forEach(mese => {
    assert.equal(mese.importo, 100);
    assert.equal(mese.venditaId, 'v1');
  });
});

test('mesiNonRegistratiCliente non segnala un mese che ha già una rata (previsto o incassata)', () => {
  const stato = appState();
  stato.pacchettoVenditaPerCliente = { c1: { venditaId: 'v1' } };
  stato.coperturaPagamentiAffidabile = true;

  const oggi = stato.dataISOOggi();
  const meseScorso = stato.aggiungiGiorniISO(oggi, -30).slice(0, 7);
  stato.mesiCopertiPerVenditaVenditore = { v1: new Set([meseScorso]) };

  const dueMesiFa = stato.aggiungiGiorniISO(oggi, -60);
  const cliente = {
    id: 'c1',
    periodicita_contratto: 'mensile',
    data_attivazione: dueMesiFa,
    importo_abbonamento: 100
  };

  const risultati = stato.mesiNonRegistratiCliente(cliente);

  assert.ok(
    !risultati.some(r => r.chiaveMese === meseScorso),
    'il mese già coperto da una riga pagamenti non deve comparire come mancante'
  );
});

test('mesiNonRegistratiCliente non genera nulla senza data_attivazione/pubblicato_il', () => {
  const stato = appState();
  stato.pacchettoVenditaPerCliente = { c1: { venditaId: 'v1' } };
  stato.mesiCopertiPerVenditaVenditore = {};

  const cliente = { id: 'c1', periodicita_contratto: 'mensile', importo_abbonamento: 100 };

  assert.deepEqual(stato.mesiNonRegistratiCliente(cliente), []);
});

test('mesiNonRegistratiCliente usa pubblicato_il come ancora se data_attivazione manca', () => {
  const stato = appState();
  stato.pacchettoVenditaPerCliente = { c1: { venditaId: 'v1' } };
  stato.mesiCopertiPerVenditaVenditore = {};
  stato.coperturaPagamentiAffidabile = true;

  const oggi = stato.dataISOOggi();
  const dueMesiFa = stato.aggiungiGiorniISO(oggi, -60);
  const cliente = {
    id: 'c1',
    periodicita_contratto: 'mensile',
    pubblicato_il: dueMesiFa,
    importo_abbonamento: 150
  };

  const risultati = stato.mesiNonRegistratiCliente(cliente);
  assert.ok(risultati.length >= 1);
});

// La tab "Non completate" sostituisce "7 giorni": deve mostrare tutto
// l'arretrato scaduto, senza finestra temporale, compresi i mesi mancanti.
test('eventiAgendaVisibili con agendaVista non_completate ignora la finestra temporale', () => {
  const stato = appState();
  stato.isAdmin = false;
  stato.adminVenditoriPerId = {};
  stato.pacchettoVenditaPerCliente = { c1: { venditaId: 'v1' } };
  stato.mesiCopertiPerVenditaVenditore = {};
  stato.coperturaPagamentiAffidabile = true;

  const oggi = stato.dataISOOggi();
  const seiMesiFa = stato.aggiungiGiorniISO(oggi, -180);

  stato.clienti = [{
    id: 'c1',
    nome: 'Mr Smoky',
    periodicita_contratto: 'mensile',
    data_attivazione: seiMesiFa,
    importo_abbonamento: 100,
    venditore_id: null
  }];
  stato.scadenzePagamentoPerCliente = {};

  stato.agendaVista = 'non_completate';
  const visibili = stato.eventiAgendaVisibili();

  const mancanti = visibili.filter(e => e.tipo === 'mancante' && e.clienteId === 'c1');
  assert.ok(mancanti.length >= 5, 'mesi vecchi di oltre 7 giorni devono restare visibili');
});

// Regressione: aprire "Registra" su una riga mancante dalla dashboard admin
// passa da apriClientiVenditore -> caricaClienti -> caricaScadenzePagamentoClienti,
// che ricostruisce la copertura SOLO per i clienti di un venditore. Se quella
// scrittura toccasse la stessa mappa usata dall'agenda admin-wide, un cliente
// pagato ma di un altro venditore diventerebbe "mancante" per errore.
test('mesiCopertiPerVenditaVenditore (scope singolo venditore) non inquina mesiCopertiPerVenditaAdmin', () => {
  const stato = appState();
  stato.isAdmin = true;
  stato.venditaIdPerClienteAdmin = { c1: 'v1', c2: 'v2' };

  const oggi = stato.dataISOOggi();
  const meseScorso = stato.aggiungiGiorniISO(oggi, -30).slice(0, 7);

  // Admin-wide: entrambe le vendite sono coperte (pagate).
  stato.mesiCopertiPerVenditaAdmin = {
    v1: new Set([meseScorso]),
    v2: new Set([meseScorso])
  };

  // Simula il narrowing: la lista clienti di UN venditore (solo c1) viene
  // ricaricata e scrive sulla mappa venditore, lasciando v2 fuori scope.
  stato.mesiCopertiPerVenditaVenditore = { v1: new Set([meseScorso]) };

  const dueMesiFa = stato.aggiungiGiorniISO(oggi, -60);
  const cliente2 = {
    id: 'c2',
    periodicita_contratto: 'mensile',
    data_attivazione: dueMesiFa,
    importo_abbonamento: 100
  };

  const risultati = stato.mesiNonRegistratiCliente(cliente2);

  assert.deepEqual(
    risultati,
    [],
    'un cliente di un altro venditore, già pagato, non deve diventare mancante dopo il narrowing'
  );
});

// Regressione: se la query su "pagamenti" fallisce (rete flaky, RLS, ecc.),
// pacchettoVenditaPerCliente è già popolato (venditaId si risolve) ma
// mesiCopertiPerVenditaVenditore resta vuota - "non lo so" non deve
// leggersi come "nessun pagamento mai registrato".
test('coperturaPagamentiAffidabile=false azzera i mesi mancanti lato venditore', () => {
  const stato = appState();
  stato.isAdmin = false;
  stato.pacchettoVenditaPerCliente = { c1: { venditaId: 'v1' } };
  stato.mesiCopertiPerVenditaVenditore = {};
  stato.coperturaPagamentiAffidabile = false;

  const oggi = stato.dataISOOggi();
  const dueMesiFa = stato.aggiungiGiorniISO(oggi, -60);
  const cliente = {
    id: 'c1',
    periodicita_contratto: 'mensile',
    data_attivazione: dueMesiFa,
    importo_abbonamento: 100
  };

  assert.deepEqual(stato.mesiNonRegistratiCliente(cliente), []);
});
