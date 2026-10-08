const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { appState, formVenditaEconomicaVuoto } = require('../js/app.js');

const migration = fs.readFileSync(
  'supabase/migrations/20261009120000_conferme_trasferimenti_quote.sql',
  'utf8'
);
const html = fs.readFileSync('index.html', 'utf8');

test('ogni destinatario conferma soltanto la propria quota', () => {
  assert.match(migration, /add column if not exists ricevuta_il timestamptz/);
  assert.match(migration, /create or replace function public\.conferma_quota_pagamento/);
  assert.match(migration, /pp\.profilo_id = auth\.uid\(\)/);
  assert.match(migration, /p\.incassato_da is distinct from auth\.uid\(\)/);
});

test('il pagamento salva chi ha incassato tra i partecipanti', () => {
  assert.match(migration, /create or replace function public\.registra_pagamento_con_trasferimenti/);
  assert.match(migration, /Partecipante che ha incassato non valido/);
  assert.equal(formVenditaEconomicaVuoto().incassatoDa, null);
  assert.match(html, />HA INCASSATO</);
});

test('un trasferimento e completo solo dopo tutte le conferme necessarie', () => {
  const stato = appState();
  const pagamento = {
    incassato_da: 'nicola',
    quote_trasferimento: [
      { profilo_id: 'nicola', quota_effettiva: 30, ricevuta_il: null },
      { profilo_id: 'tomas', quota_effettiva: 30, ricevuta_il: '2026-10-09' },
      { profilo_id: 'alessandro', quota_effettiva: 40, ricevuta_il: null }
    ]
  };

  assert.equal(stato.trasferimentoPagamentoCompleto(pagamento), false);
  pagamento.quote_trasferimento[2].ricevuta_il = '2026-10-09';
  assert.equal(stato.trasferimentoPagamentoCompleto(pagamento), true);
});
