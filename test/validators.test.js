const { test } = require('node:test');
const assert = require('node:assert');
const { formattaStato, validaClienteForm } = require('../js/validators.js');

test('formattaStato traduce ogni stato in etichetta italiana', () => {
  assert.strictEqual(formattaStato('contattato'), 'Contattato');
  assert.strictEqual(formattaStato('brief_mandato'), 'Brief mandato');
  assert.strictEqual(formattaStato('in_lavorazione'), 'In lavorazione');
  assert.strictEqual(formattaStato('pubblicato'), 'Pubblicato');
});

test('validaClienteForm rifiuta nome vuoto', () => {
  const r = validaClienteForm({ nome: '' });
  assert.strictEqual(r.valido, false);
  assert.strictEqual(r.errori.nome, 'Il nome cliente è obbligatorio');
});

test('validaClienteForm accetta form minimo valido', () => {
  const r = validaClienteForm({ nome: 'Mr. Smoky' });
  assert.strictEqual(r.valido, true);
  assert.deepStrictEqual(r.errori, {});
});

test('validaClienteForm segnala importo_abbonamento negativo', () => {
  const r = validaClienteForm({ nome: 'X', importo_abbonamento: -5 });
  assert.strictEqual(r.valido, false);
  assert.strictEqual(r.errori.importo_abbonamento, 'L\'importo non può essere negativo');
});
