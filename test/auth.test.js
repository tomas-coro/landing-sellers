const { test } = require('node:test');
const assert = require('node:assert');
const { mappaErroreLogin } = require('../js/auth-logic.js');

test('credenziali errate produce messaggio in italiano', () => {
  const msg = mappaErroreLogin({ message: 'Invalid login credentials' });
  assert.strictEqual(msg, 'Email o password errati');
});

test('errore di rete produce messaggio in italiano', () => {
  const msg = mappaErroreLogin({ message: 'Failed to fetch' });
  assert.strictEqual(msg, 'Connessione assente, riprova');
});

test('errore sconosciuto ritorna messaggio generico con dettaglio', () => {
  const msg = mappaErroreLogin({ message: 'boh' });
  assert.strictEqual(msg, 'Errore: boh');
});
