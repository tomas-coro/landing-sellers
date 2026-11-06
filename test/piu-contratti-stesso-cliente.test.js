const { test } = require('node:test');
const assert = require('node:assert/strict');
const { appState } = require('../js/app.js');

test('la modifica vendita precarica la fatturazione salvata, non "nessuna"', async () => {
  const s = appState();
  s.venditaEconomicaForm.partecipanti = [
    { id: 'p-venditore', ruolo: 'venditore', modalitaFatturazione: 'nessuna', importoFatturato: 0, faFattura: false },
    { id: 'p-prod', ruolo: 'produzione', modalitaFatturazione: 'nessuna', importoFatturato: 0, faFattura: false }
  ];
  global.window = {
    supabaseClient: {
      from: () => ({
        select: () => ({
          eq: async () => ({
            data: [
              { profilo_id: 'p-venditore', ruolo: 'venditore', modalita_fatturazione: 'mista', importo_fatturato: 120 },
              { profilo_id: 'p-prod', ruolo: 'produzione', modalita_fatturazione: 'totale', importo_fatturato: 300 },
              { profilo_id: 'p-admin', ruolo: 'referente', modalita_fatturazione: 'totale', importo_fatturato: 300 }
            ],
            error: null
          })
        })
      })
    }
  };
  await s.precaricaFatturazioneVendita('v1');
  const [venditore, produzione] = s.venditaEconomicaForm.partecipanti;
  assert.equal(venditore.modalitaFatturazione, 'mista');
  assert.equal(venditore.importoFatturato, 120);
  assert.equal(venditore.faFattura, false);
  assert.equal(produzione.modalitaFatturazione, 'totale');
  assert.equal(produzione.faFattura, true);
  assert.equal(s.venditaEconomicaForm.modalitaFatturazioneAdmin, 'totale');
  delete global.window;
});

test('il titolo di un contratto usa il nome scelto, poi il servizio', () => {
  const s = appState();
  assert.equal(s.titoloVenditaCliente({ servizio: 'Start annuale', configurazione_commerciale: { nome_vendita: ' Sito shop ' } }), 'Sito shop');
  assert.equal(s.titoloVenditaCliente({ servizio: 'Start annuale', configurazione_commerciale: {} }), 'Start annuale');
});

test('con 2 vendite attive l\'agenda ha un rinnovo per contratto', () => {
  const s = appState();
  s.isAdmin = false;
  const cliente = { id: 'c1', nome: 'Rossi', venditore_id: 'u1', data_rinnovo: '2030-01-01' };
  s.clientiDiretti = () => [cliente];
  s.venditeAttivePerCliente = {
    c1: [
      { id: 'a', servizio: 'Sito A', configurazione_commerciale: { formula: 'annuale', data_attivazione: '2026-03-10', nome_vendita: 'Sito A' } },
      { id: 'b', servizio: 'Sito B', configurazione_commerciale: { formula: 'annuale', data_attivazione: '2026-09-20' } }
    ]
  };
  const rinnovi = s.eventiAgenda().filter(e => e.tipo === 'rinnovo');
  assert.equal(rinnovi.length, 2);
  assert.ok(rinnovi.every(e => e.venditaId));
  assert.ok(!rinnovi.some(e => e.data === '2030-01-01'));
});
