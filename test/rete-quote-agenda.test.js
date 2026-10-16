const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { appState } = require('../js/app.js');
const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const economia = fs.readFileSync(path.resolve(__dirname, '../js/app-economia.js'), 'utf8');

function statoConQuoteRete() {
  const stato = appState();
  stato.isAdmin = false;
  stato.clienti = [];
  stato.adminVenditoriPerId = {};
  stato.mappaNomiVenditori = { sotto1: 'Marco' };
  // due quote rete sullo stesso pagamento: la chiave deve essere q.id
  stato.quoteReteDaConfermare = [
    { id: 'qr1', pagamento_id: 'p1', importo: 5, da_profilo_id: 'sotto1', clienteNome: 'Rossi', controparteNome: 'Luca', dataPagamento: '2026-10-10' },
    { id: 'qr2', pagamento_id: 'p1', importo: 2, da_profilo_id: 'sotto2', clienteNome: 'Rossi', controparteNome: 'Luca', dataPagamento: '2026-10-10' }
  ];
  return stato;
}

test('eventiAgenda include una voce quota-rete- per ogni quota rete, con chiave q.id', () => {
  const eventi = statoConQuoteRete().eventiAgenda().filter(e => e.id.startsWith('quota-rete-'));
  assert.deepEqual(eventi.map(e => e.id).sort(), ['quota-rete-qr1', 'quota-rete-qr2']);
  const e = eventi.find(x => x.id === 'quota-rete-qr1');
  assert.equal(e.importo, 5);
  assert.equal(e.clienteNome, 'Rossi');
  assert.equal(e.pagamentoId, 'p1');
  assert.equal(e.tipo, 'quota');
  assert.match(e.titolo, /Quota di rete da riscattare/);
  assert.match(e.sottotitolo, /Dalla vendita di Marco/);
});

test('se il nome del venditore sotto non e disponibile resta solo il cliente', () => {
  const eventi = statoConQuoteRete().eventiAgenda();
  const e = eventi.find(x => x.id === 'quota-rete-qr2');
  assert.equal(e.sottotitolo, '');
});

test('index.html mostra le quote rete e chiama la conferma rete', () => {
  assert.match(html, /quoteReteDaConfermare/);
  assert.match(html, /confermaQuotaReteConDettaglio\(/);
  assert.match(html, /:key="'da-ricevere-rete-' \+ q\.id"/);
  assert.match(html, /evento\.sottotitolo/);
});

test('confermaQuotaReteConDettaglio chiede conferma e poi chiama confermaQuotaRete', () => {
  const m = economia.match(/async confermaQuotaReteConDettaglio\([^)]*\) \{[\s\S]*?\n    \},/);
  assert.ok(m, 'metodo mancante');
  assert.match(m[0], /chiediConferma\(/);
  assert.match(m[0], /this\.confermaQuotaRete\(q\.pagamento_id\)/);
});

test('il ricaricamento dopo conferma/annulla rete sta fuori dal try dell RPC', () => {
  for (const nome of ['confermaQuotaRete', 'annullaConfermaQuotaRete']) {
    const f = economia.match(new RegExp('async ' + nome + '\\([^)]*\\) \\{[\\s\\S]*?\\n    \\},'))[0];
    const iFinally = f.indexOf('finally');
    const iReload = f.indexOf('await this.caricaQuoteReteDaConfermare()');
    assert.ok(iReload > iFinally, nome + ': il reload deve stare dopo il try/catch/finally');
  }
});
