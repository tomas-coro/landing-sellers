const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(
  path.resolve(__dirname, '../supabase/migrations/20261017120000_quote_rete.sql'),
  'utf8'
);

test('esiste la tabella delle quote di rete con conferma', () => {
  assert.match(sql, /create table if not exists public\.pagamento_quote_rete/);
  assert.match(sql, /da_profilo_id uuid not null/);
  assert.match(sql, /a_profilo_id uuid not null/);
  assert.match(sql, /ricevuta_il timestamptz/);
});

test('RLS: il venditore che paga il 10% non puo leggere la riga', () => {
  assert.match(sql, /alter table public\.pagamento_quote_rete enable row level security/);
  assert.match(sql, /a_profilo_id = auth\.uid\(\)/);
  assert.doesNotMatch(sql, /da_profilo_id = auth\.uid\(\)/);
});

test('la funzione applica il 10% solo se il gestore non e la radice e non e partecipante', () => {
  assert.match(sql, /create or replace function public\._applica_quote_rete/);
  assert.match(sql, /responsabile_id is not null/);
  assert.match(sql, /not exists[\s\S]*pagamento_partecipanti/);
  assert.match(sql, /\* 0\.10/);
  assert.match(sql, /revoke all on function public\._applica_quote_rete/);
});

test('guard: errore se le quote di rete sono gia applicate', () => {
  assert.match(sql, /raise exception 'Quote di rete gia applicate/);
  assert.doesNotMatch(sql, /delete from public\.pagamento_quote_rete/);
  assert.doesNotMatch(sql, /pp_id/);
});

test('funzione blindata e filtri sui candidati', () => {
  assert.match(sql, /security definer/);
  assert.match(sql, /set search_path = ''/);
  assert.match(sql, /revoke all on function public\._applica_quote_rete\(uuid\)\s+from public, anon, authenticated/);
  assert.match(sql, /where importo > 0/);
  assert.match(sql, /pp\.quota_effettiva > 0/);
  assert.match(sql, /not exists \(\s*select 1 from public\.pagamento_partecipanti x[\s\S]*?x\.profilo_id = v\.responsabile_id\s*\)/);
});

test('tabella: scritture revocate ai client', () => {
  assert.match(sql, /revoke insert, update, delete on public\.pagamento_quote_rete\s+from public, anon, authenticated/);
});

// ---- Task A2: percorsi del pagamento ----
const percorsi = fs.readFileSync(
  path.resolve(__dirname, '../supabase/migrations/20261017121000_quote_rete_percorsi.sql'),
  'utf8'
);

// Estrae il corpo di una funzione: dal suo "create or replace" al "$$;" di chiusura.
function corpoFunzione(nome) {
  const inizio = percorsi.indexOf(`create or replace function public.${nome}(`);
  assert.notEqual(inizio, -1, `manca create or replace di ${nome}`);
  const fine = percorsi.indexOf('\n$$;', inizio);
  assert.notEqual(fine, -1, `manca la chiusura di ${nome}`);
  return percorsi.slice(inizio, fine);
}

test('percorsi: le quattro funzioni sono ridefinite con firma e blindatura originali', () => {
  for (const nome of [
    '_registra_snapshot_pagamento',
    'modifica_pagamento_economico_admin_impl',
    'annulla_incasso_economico_admin_impl',
    '_imposta_incassato_pagamento',
  ]) {
    const c = corpoFunzione(nome);
    assert.match(c, /security definer\s+set search_path = ''/);
  }
  // I wrapper admin NON vanno ridefiniti (perderebbero il controllo is_admin).
  assert.doesNotMatch(percorsi, /create (or replace )?function public\.modifica_pagamento_economico\(/);
  assert.doesNotMatch(percorsi, /create (or replace )?function public\.annulla_incasso_economico\(/);
});

test('percorsi: lo snapshot applica le quote rete dopo l insert dei partecipanti', () => {
  const c = corpoFunzione('_registra_snapshot_pagamento');
  assert.match(
    c,
    /insert into public\.pagamento_partecipanti[\s\S]*from jsonb_array_elements\(p_partecipanti\) elemento;\s*(--[^\n]*\n\s*)*perform public\._applica_quote_rete\(p_pagamento_id\);\s*end;/
  );
});

test('percorsi: la modifica cancella prima le quote rete e le riapplica dopo il reinserimento', () => {
  const c = corpoFunzione('modifica_pagamento_economico_admin_impl');
  assert.match(
    c,
    /delete from public\.pagamento_quote_rete\s+where pagamento_id = p_pagamento_id;\s*delete from public\.pagamento_partecipanti/
  );
  assert.match(
    c,
    /insert into public\.pagamento_partecipanti[\s\S]*from jsonb_array_elements\(p_partecipanti\) elemento;\s*perform public\._applica_quote_rete\(p_pagamento_id\);\s*end if;/
  );
});

test('percorsi: l annullamento cancella le quote rete prima dei partecipanti', () => {
  const c = corpoFunzione('annulla_incasso_economico_admin_impl');
  assert.match(
    c,
    /delete from public\.pagamento_quote_rete\s+where pagamento_id = v_pagamento_id;\s*delete from public\.pagamento_partecipanti/
  );
  assert.doesNotMatch(c, /_applica_quote_rete/);
});

test('percorsi: l incassato azzera/imposta ricevuta_il anche sulle quote rete', () => {
  const c = corpoFunzione('_imposta_incassato_pagamento');
  assert.match(
    c,
    /update public\.pagamento_quote_rete\s+set ricevuta_il = case\s+when a_profilo_id = p_incassato_da then v_data\s+else null\s+end\s+where pagamento_id = p_pagamento_id;\s*end;/
  );
});

test('percorsi: revoke/grant coerenti con le versioni originali', () => {
  assert.match(percorsi, /revoke all on function public\._registra_snapshot_pagamento\(\s*uuid, uuid, numeric, jsonb, jsonb\s*\) from public, anon, authenticated;/);
  assert.match(percorsi, /revoke all on function public\.modifica_pagamento_economico_admin_impl\(\s*uuid, numeric, date, text, text, jsonb, jsonb\s*\) from public, anon, authenticated;/);
  assert.match(percorsi, /revoke all on function public\.annulla_incasso_economico_admin_impl\(uuid\)\s+from public, anon, authenticated;/);
  assert.match(percorsi, /revoke all on function public\._imposta_incassato_pagamento\(uuid, uuid\)\s+from public, anon, authenticated;/);
  assert.doesNotMatch(percorsi, /grant execute/);
});

test('il 10% vale solo dal 2026-10-16, nessun ricalcolo dello storico', () => {
  const fn = sql.slice(sql.indexOf('create or replace function public._applica_quote_rete'));
  assert.match(fn, /join public\.pagamenti pg on pg\.id = pp\.pagamento_id/);
  assert.match(fn, /coalesce\(pg\.data_pagamento, pg\.creato_il::date\) >= date '2026-10-16'/);
});

const confermaSql = fs.readFileSync(
  path.resolve(__dirname, '../supabase/migrations/20261017122000_conferma_quota_rete.sql'),
  'utf8'
);

function corpoFunzioneConferma(nome) {
  const m = confermaSql.match(
    new RegExp('create or replace function public\\.' + nome + '\\([\\s\\S]*?\\n\\$\\$;')
  );
  assert.ok(m, 'funzione ' + nome + ' mancante');
  return m[0];
}

test('conferma_quota_rete imposta ricevuta_il solo per il destinatario, pagamento incassato da un altro', () => {
  const f = corpoFunzioneConferma('conferma_quota_rete');
  assert.match(f, /returns uuid/);
  assert.match(f, /security definer/);
  assert.match(f, /set search_path = ''/);
  assert.match(f, /update public\.pagamento_quote_rete/);
  assert.match(f, /set ricevuta_il = now\(\)/);
  assert.match(f, /a_profilo_id = auth\.uid\(\)/);
  assert.match(f, /ricevuta_il is null/);
  assert.match(f, /stato = 'incassato'/);
  assert.match(f, /incassato_da is distinct from auth\.uid\(\)/);
  assert.match(f, /auth\.uid\(\) is null/);
});

test('annulla_conferma_quota_rete azzera ricevuta_il solo se gia confermata', () => {
  const f = corpoFunzioneConferma('annulla_conferma_quota_rete');
  assert.match(f, /returns uuid/);
  assert.match(f, /security definer/);
  assert.match(f, /set search_path = ''/);
  assert.match(f, /set ricevuta_il = null/);
  assert.match(f, /a_profilo_id = auth\.uid\(\)/);
  assert.match(f, /ricevuta_il is not null/);
  assert.match(f, /stato = 'incassato'/);
  assert.match(f, /incassato_da is distinct from auth\.uid\(\)/);
});

test('le due RPC sono revocate a public/anon e concesse ad authenticated', () => {
  for (const nome of ['conferma_quota_rete', 'annulla_conferma_quota_rete']) {
    assert.match(confermaSql, new RegExp('revoke all on function public\\.' + nome + '\\(uuid\\)\\s+from public, anon'));
    assert.match(confermaSql, new RegExp('grant execute on function public\\.' + nome + '\\(uuid\\)\\s+to authenticated'));
  }
});
