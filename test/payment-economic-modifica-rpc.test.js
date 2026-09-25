const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const migration = fs.readFileSync(
  path.join(
    root,
    'supabase/migrations/20260925140000_modifica_pagamento_economico.sql'
  ),
  'utf8'
);

const app =
  fs.readFileSync(path.join(root, 'js/app.js'), 'utf8') +
  fs.readFileSync(path.join(root, 'js/app-economia.js'), 'utf8') +
  fs.readFileSync(path.join(root, 'js/app-cliente.js'), 'utf8');

test('esiste la RPC per correggere un pagamento già registrato', () => {
  assert.match(
    migration,
    /create or replace function public\.modifica_pagamento_economico\s*\(/
  );

  assert.match(
    migration,
    /security definer/
  );
});

test('la RPC nega la modifica a chi non è venditore, creatore o admin della vendita', () => {
  assert.match(
    migration,
    /v\.venditore_id = v_user\s*\n\s*or v\.creato_da = v_user\s*\n\s*or public\.is_admin\(\)/
  );
});

test('la RPC blocca la modifica di un pagamento annullato', () => {
  assert.match(
    migration,
    /Non è possibile modificare un pagamento annullato/
  );
});

test('la RPC esclude il pagamento stesso dal calcolo del residuo', () => {
  assert.match(
    migration,
    /p\.id <> p_pagamento_id/
  );

  assert.match(
    migration,
    /Importo superiore al residuo/
  );
});

test('la RPC ricalcola lo snapshot economico solo per i pagamenti incassati', () => {
  assert.match(
    migration,
    /if v_stato_attuale = 'incassato' then/
  );

  assert.match(
    migration,
    /delete from public\.pagamento_partecipanti/
  );

  assert.match(
    migration,
    /delete from public\.pagamento_calcoli/
  );

  assert.match(
    migration,
    /insert into public\.pagamento_calcoli/
  );

  assert.match(
    migration,
    /insert into public\.pagamento_partecipanti/
  );
});

test('la RPC di modifica riusa la stessa validazione quote della registrazione', () => {
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
    /Partecipante non appartenente alla vendita/
  );
});

test('solo gli utenti autenticati possono eseguire la RPC di modifica', () => {
  assert.match(
    migration,
    /revoke all on function public\.modifica_pagamento_economico/
  );

  assert.match(
    migration,
    /grant execute on function public\.modifica_pagamento_economico[\s\S]*to authenticated/
  );
});

test('il frontend instrada la modifica di un pagamento incassato sulla nuova RPC', () => {
  assert.match(
    app,
    /rpcNome = 'modifica_pagamento_economico'/
  );

  assert.match(
    app,
    /p_pagamento_id: modificaId/
  );
});

test('eliminare un pagamento tratta il filtro silenzioso della RLS come errore visibile', () => {
  assert.match(
    app,
    /eliminaPagamentoCliente\(/
  );

  assert.match(
    app,
    /\.delete\(\)\s*\n\s*\.eq\('id', pagamento\.id\)\s*\n\s*\.select\('id'\)/
  );

  assert.match(
    app,
    /if \(!data \|\| data\.length === 0\)/
  );
});

test('la conversione di una rata prevista in incassato non usa la RPC di modifica', () => {
  // Una rata ancora 'previsto' che passa a incassato deve scrivere lo
  // snapshot per la prima volta (percorso registra_pagamento_economico +
  // p_pagamento_previsto_id): la RPC di modifica per un pagamento ancora
  // 'previsto' salterebbe lo snapshot e lascerebbe lo stato invariato.
  assert.match(
    app,
    /if \(modificaId && !this\.pagamentoPrevistoId\)/
  );
});

test('il residuo cliente esclude il pagamento in modifica per non contarlo due volte', () => {
  assert.match(
    app,
    /p\.stato === 'incassato' && p\.id !== this\.pagamentoInModificaId/
  );
});
