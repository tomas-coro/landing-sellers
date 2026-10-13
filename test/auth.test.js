const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const {
  mappaErroreLogin,
  urlRecuperoPassword,
  sessioneRecuperoPassword,
  emailDaSessione
} = require('../js/auth-logic.js');

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

test('riconosce una sessione creata dal link di recupero anche dopo il redirect', () => {
  const token = payload => `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.firma`;

  assert.strictEqual(sessioneRecuperoPassword({ access_token: token({ amr: [{ method: 'otp' }] }) }), true);
  assert.strictEqual(sessioneRecuperoPassword({ access_token: token({ amr: [{ method: 'password' }] }) }), false);
  assert.strictEqual(sessioneRecuperoPassword(null), false);
});

test('logout e cambio password chiudono solo la sessione locale', () => {
  const auth = fs.readFileSync(require.resolve('../js/auth.js'), 'utf8');
  const client = fs.readFileSync(require.resolve('../js/supabase-client.js'), 'utf8');

  assert.match(auth, /client\.auth\.signOut\(\{ scope: 'local' \}\)/);
  assert.match(client, /getClient\(slot\)\.auth\.signOut\(\{ scope: 'local' \}\)/);
});

test('emailDaSessione legge l\'email dell\'account dalla sessione di recupero', () => {
  assert.strictEqual(emailDaSessione({ user: { email: 'venditore@esempio.it' } }), 'venditore@esempio.it');
  assert.strictEqual(emailDaSessione(null), '');
  assert.strictEqual(emailDaSessione({ user: {} }), '');
});

test('il form nuova password dice al portachiavi a quale account appartiene', () => {
  const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
  const inizio = html.indexOf("<form x-show=\"modalitaAccesso === 'nuova-password'\"");
  const form = html.slice(inizio, html.indexOf('</form>', inizio));
  assert.match(form, /autocomplete="username"[^>]*x-model="emailRecupero"|x-model="emailRecupero"[^>]*autocomplete="username"/);
  assert.match(form, /id="new-password"[^>]*name="new-password"/);
  assert.match(form, /id="confirm-password"[^>]*name="confirm-password"/);
});
