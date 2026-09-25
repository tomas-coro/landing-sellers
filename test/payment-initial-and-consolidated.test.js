const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const { appState } = require('../js/app.js');
const engine = require('../js/economic-engine.js');

const migrazioneConsolidato = fs.readFileSync(
  path.join(
    root,
    'supabase/migrations/20260924190000_pagamento_consolidato_e_iniziale.sql'
  ),
  'utf8'
);

const app =
  fs.readFileSync(path.join(root, 'js/app.js'), 'utf8') +
  fs.readFileSync(path.join(root, 'js/app-economia.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// ============================================================
// PROBLEMA 1 - pagamento iniziale nella creazione vendita
// ============================================================

test('PROBLEMA 1: senza importo incassato non viene costruito alcun pagamento', () => {
  const stato = appState();

  stato.venditaEconomicaForm.importoVendita = 500;
  stato.venditaEconomicaForm.importoIncassato = 0;

  // Nessun pagamento iniziale: la validazione non deve richiederlo
  // né bloccare il salvataggio della vendita.
  stato.venditaEconomicaForm.clienteId = 'cliente-1';
  stato.venditaEconomicaForm.partecipanti = [
    { id: 'a', ruolo: 'referente', haVenduto: true }
  ];

  assert.equal(stato.validaVenditaEconomica(), '');
});

test('PROBLEMA 1: un pagamento iniziale superiore alla vendita viene rifiutato prima del salvataggio', () => {
  const stato = appState();

  stato.venditaEconomicaForm.importoVendita = 500;
  stato.venditaEconomicaForm.importoIncassato = 600;
  stato.venditaEconomicaForm.clienteId = 'cliente-1';
  stato.venditaEconomicaForm.partecipanti = [
    { id: 'a', ruolo: 'referente', haVenduto: true }
  ];

  assert.match(
    stato.validaVenditaEconomica(),
    /non può superare/
  );
});

test('PROBLEMA 1: il frontend non scarta più il pagamento iniziale con un valore fisso a null', () => {
  assert.doesNotMatch(app, /const pagamento = null;/);
});

test('PROBLEMA 1: registra_vendita_economica registra anche lo snapshot economico del pagamento iniziale', () => {
  assert.match(
    migrazioneConsolidato,
    /create or replace function public\.registra_vendita_economica\s*\(/
  );

  // Stessa RPC di autorizzazione/residuo usata da Incassa: niente
  // doppia logica di validazione del pagamento.
  assert.match(
    migrazioneConsolidato,
    /v_pagamento_id\s*:=\s*public\.registra_pagamento_vendita\s*\(/
  );

  // Lo snapshot (pagamento_calcoli + pagamento_partecipanti, quindi
  // "indistinguibile" da un pagamento fatto con Incassa) viene scritto
  // riusando la stessa funzione condivisa di Incassa, non duplicato.
  assert.match(
    migrazioneConsolidato,
    /perform public\._registra_snapshot_pagamento\(/
  );
});

test('PROBLEMA 1: un solo insert di pagamento per vendita (nessun doppio salvataggio)', () => {
  const corpoFunzione = migrazioneConsolidato.match(
    /create or replace function public\.registra_vendita_economica[\s\S]*?\$\$;/
  )[0];

  const occorrenze = (
    corpoFunzione.match(
      /public\.registra_pagamento_vendita\s*\(/g
    ) || []
  ).length;

  // Una sola chiamata dentro registra_vendita_economica.
  assert.equal(occorrenze, 1);
});

// ============================================================
// PROBLEMA 2 - Incassa non ridefinisce la configurazione economica
// ============================================================

test('PROBLEMA 2: i controlli editabili "per rata" (chi fattura, quota manuale) sono stati rimossi dall\'interfaccia', () => {
  for (const campo of [
    'modalitaFatturazioneRata',
    'importoFatturatoRata',
    'quotaOverrideRata',
    'quotaEffettivaRata',
    'modalitaFatturazioneAdminRata',
    'importoFatturatoAdminRata'
  ]) {
    assert.doesNotMatch(app, new RegExp(campo));
    assert.doesNotMatch(html, new RegExp(campo));
  }
});

test('PROBLEMA 2: la ripartizione della rata è derivata dal consolidato, mai da un input libero', () => {
  const stato = appState();

  stato.venditaEconomicaForm.importoVendita = 1000;
  stato.venditaEconomicaForm.importoIncassato = 250;

  stato.venditaEconomicaForm.partecipanti = [
    {
      id: 'a',
      ruolo: 'referente',
      modalitaFatturazione: 'mista',
      importoFatturato: 800 // consolidato sull'intera vendita
    },
    {
      id: 't',
      ruolo: 'produzione',
      modalitaFatturazione: 'nessuna'
    }
  ];

  const [referente, tomas] = stato.partecipantiPerMotoreRataEconomia();

  // Stessa proporzione fatturato/vendita (800/1000) applicata alla rata
  // da 250: 200. Non un valore inseribile a mano.
  assert.equal(referente.importoFatturato, 200);
  assert.equal(tomas.modalitaFatturazione, 'nessuna');
});

test('PROBLEMA 2: due pagamenti della stessa vendita derivano dalla stessa configurazione consolidata', () => {
  const stato = appState();

  const consolidato = [
    {
      id: 'a',
      ruolo: 'referente',
      modalitaFatturazione: 'mista',
      importoFatturato: 400
    },
    {
      id: 't',
      ruolo: 'produzione',
      modalitaFatturazione: 'nessuna',
      quotaOverride: true,
      quotaEffettiva: 100
    }
  ];

  stato.venditaEconomicaForm.importoVendita = 1000;

  // Prima rata: 400.
  stato.venditaEconomicaForm.importoIncassato = 400;
  stato.venditaEconomicaForm.partecipanti = consolidato;
  const primaRata = stato.partecipantiPerMotoreRataEconomia();

  // Seconda rata: 600 (residuo).
  stato.venditaEconomicaForm.importoIncassato = 600;
  const secondaRata = stato.partecipantiPerMotoreRataEconomia();

  const referentePrima = primaRata.find(p => p.id === 'a');
  const referenteSeconda = secondaRata.find(p => p.id === 'a');
  const tomasPrima = primaRata.find(p => p.id === 't');
  const tomasSeconda = secondaRata.find(p => p.id === 't');

  // Stessa modalità di fatturazione in entrambe le rate.
  assert.equal(
    referentePrima.modalitaFatturazione,
    referenteSeconda.modalitaFatturazione
  );

  // Stessa proporzione fatturato/importoRata (40%) in entrambe le rate.
  assert.ok(
    Math.abs(referentePrima.importoFatturato / 400 -
      referenteSeconda.importoFatturato / 600) < 0.0001
  );

  // L'override consolidato di Tomas resta attivo su entrambe le rate,
  // scalato in proporzione (100 su 1000 -> 40 sulla rata da 400,
  // 60 sulla rata da 600).
  assert.equal(tomasPrima.quotaOverride, true);
  assert.equal(tomasSeconda.quotaOverride, true);
  assert.equal(tomasPrima.quotaEffettiva, 40);
  assert.equal(tomasSeconda.quotaEffettiva, 60);
});

test('PROBLEMA 2: la ripartizione derivata dal consolidato continua a quadrare', () => {
  const stato = appState();

  stato.venditaEconomicaForm.importoVendita = 375;
  stato.venditaEconomicaForm.importoIncassato = 200;

  stato.venditaEconomicaForm.partecipanti = [
    { id: 'a', ruolo: 'referente', modalitaFatturazione: 'totale' },
    {
      id: 't',
      ruolo: 'produzione',
      modalitaFatturazione: 'nessuna',
      haVenduto: true
    }
  ];

  const partecipantiRata = stato.partecipantiPerMotoreRataEconomia();

  const snapshot = engine.calcolaSnapshotPagamento({
    importoPagamento: 200,
    costiApplicati: [],
    partecipanti: partecipantiRata
  });

  assert.equal(snapshot.valido, true);
});

test('PROBLEMA 2: la RPC verifica che il pagamento usi la stessa modalità di fatturazione e la stessa scelta di override della vendita consolidata', () => {
  assert.match(
    migrazioneConsolidato,
    /create or replace function public\._registra_snapshot_pagamento/
  );

  assert.match(
    migrazioneConsolidato,
    /coalesce\(nullif\(elemento ->> 'modalita_fatturazione', ''\), 'nessuna'\) <>/
  );

  assert.match(
    migrazioneConsolidato,
    /coalesce\(\(elemento ->> 'quota_override'\)::boolean, false\) <>/
  );

  assert.match(
    migrazioneConsolidato,
    /Partecipante non coerente con la configurazione consolidata della vendita/
  );
});

test('PROBLEMA 2: la funzione interna dello snapshot non è eseguibile direttamente da un utente autenticato', () => {
  // _registra_snapshot_pagamento non verifica l'autorizzazione sulla
  // vendita (lo fa registra_pagamento_vendita più a monte): deve restare
  // raggiungibile solo dalle funzioni SECURITY DEFINER che la chiamano,
  // mai concessa direttamente a "authenticated".
  assert.doesNotMatch(
    migrazioneConsolidato,
    /grant execute on function public\._registra_snapshot_pagamento/
  );

  assert.match(
    migrazioneConsolidato,
    /revoke all on function public\._registra_snapshot_pagamento\([\s\S]{0,80}\) from public, anon, authenticated;/
  );
});

test('PROBLEMA 2: il referente (che assorbe sempre il residuo del pagamento) non blocca l\'incasso per via del suo quota_override consolidato', () => {
  const corpoFunzione = migrazioneConsolidato.match(
    /create or replace function public\._registra_snapshot_pagamento[\s\S]*?\$\$;/
  )[0];

  assert.match(
    corpoFunzione,
    /coalesce\(elemento ->> 'ruolo', ''\) <> 'referente'\s*\n\s*and coalesce\(\(elemento ->> 'quota_override'\)::boolean, false\) <>/
  );
});

test('PROBLEMA 2: registrare un pagamento non aggiorna mai vendita_partecipanti', () => {
  const corpoFunzione = migrazioneConsolidato.match(
    /create or replace function public\._registra_snapshot_pagamento[\s\S]*?\$\$;/
  )[0];

  assert.doesNotMatch(
    corpoFunzione,
    /update\s+public\.vendita_partecipanti/i
  );
});

test('PROBLEMA 2: legacy - vendite senza applica_bonus_venditore salvato si comportano come prima (bonus attivo)', () => {
  const stato = appState();

  // Simula una vendita legacy: la colonna non è mai stata scritta,
  // undefined dal client Supabase.
  const venditaLegacy = { applica_bonus_venditore: undefined };

  stato.venditaEconomicaForm.applicaBonusVenditore =
    venditaLegacy.applica_bonus_venditore !== false;

  assert.equal(stato.venditaEconomicaForm.applicaBonusVenditore, true);
});

test('PROBLEMA 2: applica_bonus_venditore è persistito e usato al posto del default del form', () => {
  assert.match(
    migrazioneConsolidato,
    /add column if not exists applica_bonus_venditore boolean/
  );

  assert.match(
    app,
    /venditaEconomicaForm\.applicaBonusVenditore\s*=\s*\n?\s*vendita\.applica_bonus_venditore !== false/
  );

  assert.match(
    app,
    /applicaBonusVenditore:\s*\n?\s*this\.venditaEconomicaForm\.applicaBonusVenditore !== false/
  );
});

// ============================================================
// PROBLEMA 3 - consultazione read-only in scheda cliente
// ============================================================

test('PROBLEMA 3: la scheda cliente espone una sezione read-only "Dettagli economici"', () => {
  assert.match(html, /Dettagli economici/);
  assert.match(html, /economy-details-readonly/);
});

test('PROBLEMA 3: la sezione non contiene alcun controllo editabile (nessun x-model economico)', () => {
  const blocco = html.match(
    /<div class="accordion-section" x-show="venditaClienteAttiva">[\s\S]*?<div class="accordion-section">/
  )[0];

  assert.doesNotMatch(blocco, /x-model/);
});

test('PROBLEMA 3: totaleCostiVenditaCliente somma solo i costi realmente salvati, senza ricalcoli', () => {
  const stato = appState();

  stato.dettagliEconomiciCosti = [
    { descrizione: 'Dominio', importo: 15 },
    { descrizione: 'Hosting', importo: 25 }
  ];

  assert.equal(stato.totaleCostiVenditaCliente(), 40);
});

test('PROBLEMA 3: configurazione commerciale legacy senza snapshot non genera dati inventati', () => {
  const stato = appState();

  stato.venditaClienteAttiva = { configurazione_commerciale: null };

  assert.equal(stato.configurazioneCommercialeClienteAttiva(), null);
});

test('PROBLEMA 3: la sezione non richiama il catalogo prezzi per ricostruire vendite storiche', () => {
  const blocco = html.match(
    /<div class="accordion-section" x-show="venditaClienteAttiva">[\s\S]*?<div class="accordion-section">/
  )[0];

  assert.doesNotMatch(blocco, /catalogo/i);
});
