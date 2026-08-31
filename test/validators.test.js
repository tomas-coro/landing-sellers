const { test } = require('node:test');
const assert = require('node:assert');
const { formattaStato, validaClienteForm, classeUrgenza } = require('../js/validators.js');

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

test('validaClienteForm rifiuta sito_url senza http/https (blocca javascript: e simili)', () => {
  const r = validaClienteForm({ nome: 'X', sito_url: 'javascript:alert(1)' });
  assert.strictEqual(r.valido, false);
  assert.strictEqual(r.errori.sito_url, 'L\'URL deve iniziare con http:// o https://');
});

test('validaClienteForm accetta sito_url https valido', () => {
  const r = validaClienteForm({ nome: 'X', sito_url: 'https://cliente.it' });
  assert.strictEqual(r.valido, true);
});

test('validaClienteForm accetta sito_url vuoto (campo opzionale)', () => {
  const r = validaClienteForm({ nome: 'X', sito_url: '' });
  assert.strictEqual(r.valido, true);
});

test('classeUrgenza ritorna vuoto quando non c\'e\' data', () => {
  assert.strictEqual(classeUrgenza(null), '');
  assert.strictEqual(classeUrgenza(''), '');
});

test('classeUrgenza segnala ritardo per date passate', () => {
  const oggi = new Date('2026-08-31T10:00:00');
  assert.strictEqual(classeUrgenza('2026-08-30', oggi), 'ritardo');
});

test('classeUrgenza segnala vicino per oggi e fino a 3 giorni', () => {
  const oggi = new Date('2026-08-31T10:00:00');
  assert.strictEqual(classeUrgenza('2026-08-31', oggi), 'vicino');
  assert.strictEqual(classeUrgenza('2026-09-03', oggi), 'vicino');
});

test('classeUrgenza ritorna vuoto oltre i 3 giorni', () => {
  const oggi = new Date('2026-08-31T10:00:00');
  assert.strictEqual(classeUrgenza('2026-09-04', oggi), '');
});
