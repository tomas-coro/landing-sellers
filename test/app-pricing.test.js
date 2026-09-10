const { test } = require('node:test');
const assert = require('node:assert');
const {
  normalizzaClientePerSalvataggio,
  prezzoRicorrenteDaForm,
  etichettaDurataScontoForm,
  totaleContrattoDaForm,
  calcolaStatisticheVenditore,
  posizioneAvatarDaUrl,
  avatarUrlConPosizione
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

test('il prezzo finale concordato include setup, dominio e altri extra', () => {
  assert.strictEqual(totaleContrattoDaForm(300, 180, {
    sconto_tipo: 'prezzo_fisso'
  }), 300);
  assert.strictEqual(totaleContrattoDaForm(300, 180, {
    sconto_tipo: 'percentuale'
  }), 480);
});

test('la posizione avatar viene salvata nell’URL e riletta', () => {
  const url = avatarUrlConPosizione('https://example.com/avatar.png?v=1#vecchio', 25, 80);
  assert.strictEqual(url, 'https://example.com/avatar.png?v=1#pos=25,80');
  assert.deepStrictEqual(posizioneAvatarDaUrl(url), { x: 25, y: 80 });
});

test('le statistiche sommano vendite attive e pagamenti incassati', () => {
  assert.deepStrictEqual(calcolaStatisticheVenditore([
    { id: 'a', stato: 'attiva', importo_vendita: '1000' },
    { id: 'b', stato: 'annullata', importo_vendita: '500' }
  ], [
    { vendita_id: 'a', stato: 'incassato', importo: '240' },
    { vendita_id: 'a', stato: 'previsto', importo: '300' },
    { vendita_id: 'b', stato: 'incassato', importo: '100' }
  ]), { generato: 1000, incassato: 240 });
});
