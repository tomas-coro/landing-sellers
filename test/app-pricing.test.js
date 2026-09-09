const { test } = require('node:test');
const assert = require('node:assert');
const {
  normalizzaClientePerSalvataggio,
  prezzoRicorrenteDaForm,
  etichettaDurataScontoForm
} = require('../js/app.js');

test('il salvataggio converte lo sconto vuoto in null', () => {
  const form = { nome: 'ZDE', sconto_tipo: '' };
  assert.deepStrictEqual(normalizzaClientePerSalvataggio(form), {
    nome: 'ZDE',
    sconto_tipo: null
  });
  assert.strictEqual(form.sconto_tipo, '');
});

test('il prezzo finale manuale sostituisce il prezzo di catalogo', () => {
  assert.strictEqual(prezzoRicorrenteDaForm(576, {
    sconto_tipo: 'prezzo_fisso',
    sconto_valore: 300
  }), 300);
});

test('gli sconti percentuale e fisso continuano a ridurre il catalogo', () => {
  assert.strictEqual(prezzoRicorrenteDaForm(100, {
    sconto_tipo: 'percentuale',
    sconto_valore: 10
  }), 90);
  assert.strictEqual(prezzoRicorrenteDaForm(100, {
    sconto_tipo: 'fisso',
    sconto_valore: 15
  }), 85);
});

test('la durata nulla indica un prezzo o sconto permanente', () => {
  assert.strictEqual(etichettaDurataScontoForm({ sconto_durata_anni: null }), 'Per sempre');
  assert.strictEqual(etichettaDurataScontoForm({ sconto_durata_anni: 2 }), 'Per i primi 2 anni');
});
