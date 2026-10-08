const test = require('node:test');
const assert = require('node:assert/strict');
const { appState } = require('../js/app.js');

test('la scelta della vendita porta al modulo incasso', async () => {
  const stato = appState();
  const scroll = [];

  stato.venditeClienteIncasso = [{
    id: 'vendita-1',
    cliente_id: 'cliente-1',
    servizio: 'Landing',
    importo_vendita: 500,
    applica_bonus_venditore: true
  }];
  stato.scorriEconomiaA = selettore => scroll.push(selettore);
  stato.caricaPagamentiCliente = async () => {};
  stato.aggiornaSnapshotEconomia = () => {};

  global.requestAnimationFrame = () => {};
  global.window ||= {};
  global.window.supabaseClient = {
    from(tabella) {
      return {
        select() { return this; },
        eq() {
          return Promise.resolve({
            data: tabella === 'vendita_partecipanti' ? [] : [],
            error: null
          });
        }
      };
    }
  };

  await stato.selezionaVenditaIncasso('vendita-1');

  assert.deepEqual(scroll, ['.payment-entry-panel']);
});

test('un incasso senza metodo mostra errore, porta al campo e apre la validazione nativa', async () => {
  const stato = appState();
  const toast = [];
  const scroll = [];

  stato.venditaEconomicaAttiva = { id: 'vendita-1' };
  stato.venditaEconomicaForm.importoIncassato = 100;
  stato.venditaEconomicaForm.statoIncasso = 'incassato';
  stato.venditaEconomicaForm.metodoPagamento = '';
  stato.residuoCliente = () => 500;
  stato.partecipantiPerMotoreRataEconomia = () => [];
  stato.snapshotPagamentoEconomia = () => ({ valido: true });
  stato.mostraToast = (...args) => toast.push(args);
  stato.scorriEconomiaA = (...args) => scroll.push(args);

  await stato.salvaIncassoEconomia();

  assert.deepEqual(toast, [[
    'error',
    'Completa i dati',
    'Seleziona il metodo di pagamento.'
  ]]);
  assert.deepEqual(scroll, [['#metodo-incasso', true]]);
});

test('dopo un incasso riuscito mostra conferma e torna allo storico', async () => {
  const stato = appState();
  const toast = [];
  const scroll = [];

  stato.isAdmin = true;
  stato.venditaEconomicaAttiva = {
    id: 'vendita-1',
    cliente_id: 'cliente-1'
  };
  stato.venditaEconomicaForm.importoIncassato = 100;
  stato.venditaEconomicaForm.statoIncasso = 'incassato';
  stato.venditaEconomicaForm.metodoPagamento = 'Bonifico';
  stato.validaIncassoEconomia = () => '';
  stato.snapshotPagamentoEconomia = () => ({ valido: true });
  stato.payloadSnapshotPagamentoEconomia = () => ({
    calcolo: {},
    partecipanti: []
  });
  stato.caricaPagamentiCliente = async () => {};
  stato.caricaDashboardAdmin = async () => {};
  stato.aggiornaSnapshotEconomia = () => {};
  stato.mostraToast = (...args) => toast.push(args);
  stato.scorriEconomiaA = (...args) => scroll.push(args);

  global.window ||= {};
  global.window.supabaseClient = {
    rpc: async () => ({ error: null })
  };

  await stato.salvaIncassoEconomia();

  assert.deepEqual(toast, [['success', 'Incasso registrato.']]);
  assert.deepEqual(scroll, [['.payment-history-panel']]);
});
