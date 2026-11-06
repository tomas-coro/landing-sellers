const { test } = require('node:test');
const assert = require('node:assert/strict');
const { appState } = require('../js/app.js');

test('aggiungere una nota aggiorna la scheda senza chiudere il foglio o perdere la posizione', async () => {
  const s = appState();
  s.sessione = { user: { id: 'venditore-1' } };
  s.clienteSelezionatoId = 'cliente-1';
  s.schedaFoglio = 'storia';
  s.nuovaNotaTesto = 'Chiamare venerdì';
  s.note = [];
  s.apriScheda = () => { throw new Error('non deve ricaricare la scheda'); };
  s.mostraToast = () => {};
  const precedente = global.window;
  global.window = {
    supabaseClient: { from: () => ({ insert: () => ({ select: () => ({ single: async () => ({
      data: { id: 'n1', testo: 'Chiamare venerdì', creata_il: '2026-11-02T12:00:00Z' }, error: null
    }) }) }) }) }
  };
  try {
    await s.aggiungiNota();
    assert.equal(s.schedaFoglio, 'storia');
    assert.equal(s.note[0].testo, 'Chiamare venerdì');
    assert.equal(s.nuovaNotaTesto, '');
    assert.equal(s.aggiungendoNota, false);
  } finally { global.window = precedente; }
});

test('un salvataggio fallito conserva il testo e mostra il motivo', async () => {
  const s = appState();
  s.sessione = { user: { id: 'venditore-1' } };
  s.clienteSelezionatoId = 'cliente-1';
  s.nuovaNotaTesto = 'Non perdere questa nota';
  const precedente = global.window;
  global.window = {
    supabaseClient: { from: () => ({ insert: () => ({ select: () => ({ single: async () => ({
      data: null, error: { message: 'Rete non disponibile' }
    }) }) }) }) }
  };
  try {
    await s.aggiungiNota();
    assert.equal(s.nuovaNotaTesto, 'Non perdere questa nota');
    assert.match(s.erroreScheda, /Rete non disponibile/);
    assert.equal(s.aggiungendoNota, false);
  } finally { global.window = precedente; }
});
