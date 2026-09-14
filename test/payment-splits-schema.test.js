const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20260914121000_ripartizione_economica_pagamenti.sql'
  ),
  'utf8'
);

test('esiste uno snapshot economico per ogni pagamento', () => {
  assert.match(
    migration,
    /create table if not exists public\.pagamento_calcoli/i
  );

  assert.match(
    migration,
    /unique\s*\(pagamento_id\)/i
  );
});

test('ogni pagamento può avere una quota per ogni partecipante', () => {
  assert.match(
    migration,
    /create table if not exists public\.pagamento_partecipanti/i
  );

  assert.match(
    migration,
    /unique\s*\(pagamento_id,\s*profilo_id\)/i
  );
});

test('lo snapshot conserva fatturazione, riduzioni e override', () => {
  assert.match(migration, /modalita_fatturazione/i);
  assert.match(migration, /importo_fatturato/i);
  assert.match(migration, /importo_riduzione/i);
  assert.match(migration, /quota_calcolata/i);
  assert.match(migration, /quota_effettiva/i);
  assert.match(migration, /quota_override/i);
});

test('il calcolo della rata conserva costi tasse e netto', () => {
  assert.match(migration, /importo_costi/i);
  assert.match(migration, /costi_snapshot/i);
  assert.match(migration, /percentuale_tasse/i);
  assert.match(migration, /importo_tasse/i);
  assert.match(migration, /netto_distribuibile/i);
});

test('le nuove tabelle hanno RLS attiva', () => {
  assert.match(
    migration,
    /alter table public\.pagamento_calcoli enable row level security/i
  );

  assert.match(
    migration,
    /alter table public\.pagamento_partecipanti enable row level security/i
  );
});
