const { test } = require('node:test');
const assert = require('node:assert');
const { formattaStato, validaClienteForm, classeUrgenza, giorniResiduiCestino, etichettaGiorniResidui } = require('../js/validators.js');

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

test('giorniResiduiCestino ritorna 30 il giorno stesso della cancellazione', () => {
  const oggi = new Date('2026-09-01T10:00:00');
  assert.strictEqual(giorniResiduiCestino('2026-09-01T09:00:00', oggi), 30);
});

test('giorniResiduiCestino conta i giorni trascorsi', () => {
  const oggi = new Date('2026-09-30T10:00:00');
  assert.strictEqual(giorniResiduiCestino('2026-09-01T09:00:00', oggi), 1);
});

test('giorniResiduiCestino non va mai sotto zero oltre i 30 giorni', () => {
  const oggi = new Date('2026-10-05T10:00:00');
  assert.strictEqual(giorniResiduiCestino('2026-09-01T09:00:00', oggi), 0);
});

test('giorniResiduiCestino ritorna 0 con input nullo o vuoto', () => {
  assert.strictEqual(giorniResiduiCestino(null), 0);
  assert.strictEqual(giorniResiduiCestino(''), 0);
});

test('etichettaGiorniResidui ritorna "ultimo giorno" per 0', () => {
  assert.strictEqual(etichettaGiorniResidui(0), 'ultimo giorno');
});

test('etichettaGiorniResidui ritorna "1 giorno" al singolare', () => {
  assert.strictEqual(etichettaGiorniResidui(1), '1 giorno');
});

test('etichettaGiorniResidui ritorna "N giorni" al plurale', () => {
  assert.strictEqual(etichettaGiorniResidui(5), '5 giorni');
});
