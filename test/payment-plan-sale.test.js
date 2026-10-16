const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { appState } = require('../js/app.js');

const migrationPath =
  'supabase/migrations/20261016130000_rate_previste_registrazione_vendita.sql';

function venditaValida() {
  const stato = appState();
  stato.venditaEconomicaForm.clienteId = 'cliente-1';
  stato.venditaEconomicaForm.importoVendita = 100;
  stato.venditaEconomicaForm.partecipanti = [
    { id: 'referente-1', ruolo: 'referente', haVenduto: true }
  ];
  return stato;
}

test('il piano rateizzato parte con due rate uguali modificabili', () => {
  const stato = venditaValida();

  stato.selezionaPagamentoVendita('rateizzato');

  assert.equal(stato.venditaEconomicaForm.modalitaPagamentoVendita, 'rateizzato');
  assert.deepEqual(
    stato.venditaEconomicaForm.ratePreviste.map(rata => rata.importo),
    [50, 50]
  );

  stato.venditaEconomicaForm.ratePreviste[0].importo = 40;
  assert.equal(stato.venditaEconomicaForm.ratePreviste[0].importo, 40);
});

test('toccare di nuovo Rateizzato non cancella le modifiche manuali', () => {
  const stato = venditaValida();
  stato.selezionaPagamentoVendita('rateizzato');
  stato.venditaEconomicaForm.ratePreviste[0].importo = 40;

  stato.selezionaPagamentoVendita('rateizzato');

  assert.equal(stato.venditaEconomicaForm.ratePreviste[0].importo, 40);
});

test('aggiungere una rata ridivide automaticamente il totale anche con i centesimi', () => {
  const stato = venditaValida();
  stato.venditaEconomicaForm.importoVendita = 100.01;
  stato.selezionaPagamentoVendita('rateizzato');

  stato.aggiungiRataVendita();

  assert.deepEqual(
    stato.venditaEconomicaForm.ratePreviste.map(rata => rata.importo),
    [33.34, 33.34, 33.33]
  );
});

test('il piano consente al massimo tre rate', () => {
  const stato = venditaValida();
  stato.selezionaPagamentoVendita('rateizzato');
  stato.aggiungiRataVendita();
  stato.aggiungiRataVendita();

  assert.equal(stato.venditaEconomicaForm.ratePreviste.length, 3);
});

test('il piano rifiuta importi che non coprono la vendita', () => {
  const stato = venditaValida();
  stato.selezionaPagamentoVendita('rateizzato');
  stato.venditaEconomicaForm.ratePreviste[0].importo = 40;

  assert.match(stato.validaVenditaEconomica(), /somma delle rate/i);
});

test('il piano rifiuta anche un solo centesimo di differenza', () => {
  const stato = venditaValida();
  stato.selezionaPagamentoVendita('rateizzato');
  stato.venditaEconomicaForm.ratePreviste[1].importo = 49.99;

  assert.match(stato.validaVenditaEconomica(), /somma delle rate/i);
});

test('l’ultima rata non può superare sei mesi dalla vendita', () => {
  const stato = venditaValida();
  stato.dataISOOggi = () => '2026-10-16';
  stato.selezionaPagamentoVendita('rateizzato');
  stato.venditaEconomicaForm.ratePreviste[1].data_scadenza = '2027-04-17';

  assert.match(stato.validaVenditaEconomica(), /sei mesi/i);
  assert.equal(stato.dataMassimaRateVendita(), '2027-04-16');
});

test('la registrazione invia le rate previste alla RPC atomica', () => {
  const js = fs.readFileSync('js/app-economia.js', 'utf8');
  assert.match(js, /p_rate_previste:\s*ratePreviste/);
});

test('la RPC valida e crea tutte le rate nella transazione della vendita', () => {
  assert.equal(fs.existsSync(migrationPath), true);
  const sql = fs.readFileSync(migrationPath, 'utf8');

  assert.match(sql, /jsonb_array_length\(p_rate_previste\) > 3/);
  assert.match(sql, /jsonb_array_length\(p_rate_previste\)/);
  assert.match(sql, /v_data_vendita \+ interval '6 months'/);
  assert.match(sql, /v_totale_rate <> v_importo_vendita/);
  assert.match(sql, /public\.registra_pagamento_vendita\(/);
  assert.match(sql, /p_stato[\s\S]*'previsto'/);
});
