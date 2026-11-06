const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { appState } = require('../js/app.js');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function statoConVendita(pagamenti) {
  const s = appState();
  s.venditaClienteAttiva = { id: 'v1' };
  s.pagamentiCliente = pagamenti;
  s.chiamate = [];
  s.modificaVenditaCliente = async () => { s.chiamate.push('vendita'); };
  s.apriEditorServiziCliente = () => { s.chiamate.push('servizi'); };
  return s;
}

test('senza incassi "Modifica servizi" apre l\'editor di vendita completo', async () => {
  const s = statoConVendita([{ stato: 'previsto' }]);
  assert.equal(s.ciSonoIncassiCliente(), false);
  assert.equal(s.venditaModificabileCliente(), true);
  await s.modificaServiziCliente();
  assert.deepEqual(s.chiamate, ['vendita']);
});

test('con incassi "Modifica servizi" apre solo l\'editor descrittivo', async () => {
  const s = statoConVendita([{ stato: 'incassato' }, { stato: 'previsto' }]);
  assert.equal(s.ciSonoIncassiCliente(), true);
  assert.equal(s.venditaModificabileCliente(), false);
  await s.modificaServiziCliente();
  assert.deepEqual(s.chiamate, ['servizi']);
});

test('senza vendita attiva "Modifica servizi" apre l\'editor descrittivo', async () => {
  const s = statoConVendita([]);
  s.venditaClienteAttiva = null;
  assert.equal(s.venditaModificabileCliente(), false);
  await s.modificaServiziCliente();
  assert.deepEqual(s.chiamate, ['servizi']);
});

test('"Modifica servizi" passa dall\'instradamento unico, non dall\'editor descrittivo', () => {
  assert.match(html, /@click="modificaServiziCliente\(\)"/);
  assert.doesNotMatch(html, /@click="apriEditorServiziCliente\(\)"/);
});

test('"Modifica vendita" si vede solo se la vendita e\' modificabile', () => {
  assert.match(
    html,
    /x-show="venditaModificabileCliente\(\)"[\s\S]{0,120}@click="modificaVenditaCliente\(\)"/
  );
});

test('con incassi il messaggio e\' corretto e vale per tutti, admin compreso', () => {
  assert.doesNotMatch(html, /chiedi all'admin/);
  assert.match(
    html,
    /x-show="ciSonoIncassiCliente\(\)"[\s\S]{0,200}non si puo' piu' modificare/
  );
});

test('il form della matita non duplica servizi e prezzo e non modifica la vendita (solo il cliente)', () => {
  assert.match(
    html,
    /x-show="clienteInModificaId && selezionePrezzo\.modalita === 'legacy' && !venditaClienteAttiva\?\.id"/
  );
  assert.match(
    html,
    /x-show="clienteInModificaId && selezionePrezzo\.modalita !== 'legacy' && !venditaClienteAttiva\?\.id"/
  );
  // La vendita si modifica dai blocchi Contratto della scheda, non da Modifica cliente.
  assert.doesNotMatch(html, /x-show="clienteInModificaId && venditaClienteAttiva\?\.id"/);
  assert.match(html, /x-for="v in venditeClienteElenco"[\s\S]{0,1200}modificaVenditaCliente\(v\)/);
});
