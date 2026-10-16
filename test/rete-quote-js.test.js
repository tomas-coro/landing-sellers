const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const economia = fs.readFileSync(path.resolve(__dirname, '../js/app-economia.js'), 'utf8');
const app = fs.readFileSync(path.resolve(__dirname, '../js/app.js'), 'utf8');

// Estrae il corpo di un metodo (fino al metodo successivo allo stesso livello).
function metodo(nome) {
  const m = economia.match(new RegExp('\\n    async ' + nome + '\\([^)]*\\) \\{[\\s\\S]*?\\n    \\},'));
  assert.ok(m, 'metodo ' + nome + ' mancante');
  return m[0];
}

test('lo stato iniziale ha quoteReteDaConfermare vuoto', () => {
  assert.match(app, /quoteReteDaConfermare:\s*\[\]/);
});

test('caricaQuoteReteDaConfermare legge solo le quote ricevibili dell utente', () => {
  const f = metodo('caricaQuoteReteDaConfermare');
  assert.match(f, /\.from\('pagamento_quote_rete'\)/);
  assert.match(f, /\.eq\('a_profilo_id', profiloId\)/);
  assert.match(f, /\.is\('ricevuta_il', null\)/);
  assert.match(f, /\.eq\('pagamenti\.stato', 'incassato'\)/);
  assert.match(f, /incassato_da !== profiloId/);
  assert.match(f, /this\.quoteReteDaConfermare = /);
  assert.match(f, /clienteNome/);
  assert.match(f, /controparteNome/);
  assert.match(f, /dataPagamento/);
  assert.match(f, /mostraToast\('error'/);
});

test('confermaQuotaRete chiama la RPC giusta con try/catch e toast', () => {
  const f = metodo('confermaQuotaRete');
  assert.match(f, /rpc\(\s*'conferma_quota_rete',\s*\{ p_pagamento_id: pagamentoId \}/);
  assert.doesNotMatch(f, /annulla_conferma_quota_rete/);
  assert.match(f, /try \{/);
  assert.match(f, /catch \(/);
  assert.match(f, /mostraToast\('error'/);
  assert.match(f, /mostraToast\('success'/);
  assert.match(f, /await this\.caricaQuoteReteDaConfermare\(\)/);
});

test('annullaConfermaQuotaRete chiama la RPC di annullo con try/catch e toast', () => {
  const f = metodo('annullaConfermaQuotaRete');
  assert.match(f, /rpc\(\s*'annulla_conferma_quota_rete',\s*\{ p_pagamento_id: pagamentoId \}/);
  assert.match(f, /try \{/);
  assert.match(f, /catch \(/);
  assert.match(f, /mostraToast\('error'/);
  assert.match(f, /await this\.caricaQuoteReteDaConfermare\(\)/);
});

test('il caricamento quote rete e chiamato in ognuno dei punti di chiamata', () => {
  const chiamata = /await this\.caricaQuoteReteDaConfermare\(\)/;
  const aperte = economia.match(/async caricaQuoteAperte\(\) \{[\s\S]*?\n    \},/)[0];
  assert.match(aperte, chiamata, 'caricaQuoteAperte');
  assert.match(economia, /await this\.caricaTrasferimentiDaConfermare\(\);\s*await this\.caricaQuoteReteDaConfermare\(\);\s*this\.mostraToast\('success', this\.successoEconomia\)/, 'salvataggio vendita');
  assert.match(app, /this\.view = 'agenda';\s*await this\.caricaTrasferimentiDaConfermare\(\);\s*await this\.caricaQuoteReteDaConfermare\(\)/, 'agenda');
  assert.match(app, /this\.view = 'profilo';\s*await this\.caricaTrasferimentiDaConfermare\(\);\s*await this\.caricaQuoteReteDaConfermare\(\)/, 'profilo');
});
