const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { mappaErroreLogin, urlRecuperoPassword } = require('../js/auth-logic.js');

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

test('riconosce soltanto i link Supabase di recupero password', () => {
  assert.strictEqual(urlRecuperoPassword({ hash: '#access_token=x&type=recovery' }), true);
  assert.strictEqual(urlRecuperoPassword({ hash: '#access_token=x&type=signup' }), false);
  assert.strictEqual(urlRecuperoPassword({ hash: '' }), false);
});

test('logout e cambio password chiudono solo la sessione locale', () => {
  const auth = fs.readFileSync(require.resolve('../js/auth.js'), 'utf8');
  const client = fs.readFileSync(require.resolve('../js/supabase-client.js'), 'utf8');

  assert.match(auth, /client\.auth\.signOut\(\{ scope: 'local' \}\)/);
  assert.match(client, /getClient\(slot\)\.auth\.signOut\(\{ scope: 'local' \}\)/);
});
