const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const migration = fs.readFileSync(
  path.join(
    root,
    'supabase/migrations/20260914132000_registra_pagamento_economico.sql'
  ),
  'utf8'
);

const app =
  fs.readFileSync(path.join(root, 'js/app.js'), 'utf8') +
  fs.readFileSync(path.join(root, 'js/app-economia.js'), 'utf8');

test('esiste la RPC atomica per il pagamento economico', () => {
  assert.match(
    migration,
    /create or replace function public\.registra_pagamento_economico\s*\(/
  );

  assert.match(
    migration,
    /security definer/
  );
});

test('la RPC economica riusa la validazione del pagamento esistente', () => {
  assert.match(
    migration,
    /public\.registra_pagamento_vendita\s*\(/
  );
});

test('la RPC salva calcolo e partecipanti dello stesso pagamento', () => {
  assert.match(
    migration,
    /insert into public\.pagamento_calcoli/
  );

  assert.match(
    migration,
    /insert into public\.pagamento_partecipanti/
  );

  assert.match(
    migration,
    /v_pagamento_id/
  );
});

test('la RPC controlla importo snapshot e quadratura delle quote', () => {
  assert.match(
    migration,
    /Importo snapshot diverso dal pagamento/
  );

  assert.match(
    migration,
    /Le quote del pagamento non quadrano/
  );

  assert.match(
    migration,
    /abs\(v_totale_quote - v_netto\)/
  );
});

test('la RPC impedisce partecipanti estranei alla vendita', () => {
  assert.match(
    migration,
    /public\.vendita_partecipanti/
  );

  assert.match(
    migration,
    /Partecipante non appartenente alla vendita/
  );
});

test('solo gli utenti autenticati possono eseguire la RPC economica', () => {
  assert.match(
    migration,
    /revoke all on function public\.registra_pagamento_economico/
  );

  assert.match(
    migration,
    /grant execute on function public\.registra_pagamento_economico[\s\S]*to authenticated/
  );
});

test('il frontend usa la nuova RPC solo per gli incassi', () => {
  assert.match(
    app,
    /rpcNome = 'registra_pagamento_economico'/
  );

  assert.match(
    app,
    /rpcNome = 'registra_pagamento_vendita'/
  );

  assert.match(
    app,
    /if \(previsto\)/
  );
});
