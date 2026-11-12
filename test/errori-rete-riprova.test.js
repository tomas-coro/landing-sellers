const { test } = require('node:test');
const assert = require('node:assert/strict');
const { appState } = require('../js/app.js');

function statoConNota(risposta) {
  const s = appState();
  s.clienteAzioniRapideId = 'cliente-1';
  s.clienteNotaRapidaTesto = 'Richiamare lunedi';
  s.sessione = { user: { id: 'venditore-1' } };
  s.clienti = [{ id: 'cliente-1' }];
  s.chiudiAzioniCliente = () => {};
  global.window = {
    setTimeout: () => 0,
    supabaseClient: {
      from: () => ({
        insert: () => ({
          select: () => ({ single: risposta })
        })
      })
    }
  };
  return s;
}

test('nota rapida: errore del database mostra il messaggio e offre Riprova', async () => {
  const s = statoConNota(async () => ({ data: null, error: { message: 'permesso negato' } }));
  const errori = console.error;
  console.error = () => {};
  try {
    await s.salvaNotaRapida();
  } finally {
    console.error = errori;
  }
  assert.match(s.erroreAzioneCliente, /^Nota non salvata: permesso negato/);
  assert.equal(typeof s.retryAzioneCliente?.fn, 'function');
  assert.equal(s.salvandoNotaRapida, false);
  assert.equal(s.clienteNotaRapidaTesto, 'Richiamare lunedi');
});

test('nota rapida: rete assente (eccezione) mostra errore, offre Riprova e non perde il testo', async () => {
  const s = statoConNota(async () => { throw new TypeError('Failed to fetch'); });
  const errori = console.error;
  console.error = () => {};
  try {
    await s.salvaNotaRapida();
  } finally {
    console.error = errori;
  }
  assert.equal(s.erroreAzioneCliente, 'Errore durante il salvataggio della nota.');
  assert.equal(typeof s.retryAzioneCliente?.fn, 'function');
  assert.equal(s.salvandoNotaRapida, false);
  assert.equal(s.clienteNotaRapidaTesto, 'Richiamare lunedi');
});

test('nota rapida: Riprova dopo un errore salva la nota e pulisce lo stato di errore', async () => {
  let tentativo = 0;
  const s = statoConNota(async () => {
    tentativo += 1;
    if (tentativo === 1) throw new TypeError('Failed to fetch');
    return { data: { id: 'nota-1', testo: 'Richiamare lunedi' }, error: null };
  });
  const errori = console.error;
  console.error = () => {};
  try {
    await s.salvaNotaRapida();
    await s.retryAzioneCliente.fn();
  } finally {
    console.error = errori;
  }
  assert.equal(tentativo, 2);
  assert.equal(s.erroreAzioneCliente, '');
  assert.equal(s.retryAzioneCliente, null);
  assert.equal(s.messaggioAzioneCliente, 'Nota salvata');
  assert.equal(s.clienteNotaRapidaTesto, '');
});
