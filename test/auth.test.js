const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const {
  messaggioErroreAuth,
  urlRecuperoPassword,
  sessioneRecuperoPassword,
  emailDaSessione,
  erroreDaUrl
} = require('../js/auth-logic.js');

test('credenziali errate produce messaggio in italiano', () => {
  const msg = messaggioErroreAuth({ code: 'invalid_credentials', status: 400 });
  assert.strictEqual(msg, 'Email o password errati');
});

test('account non confermato o bloccato non rivela che l\'email esiste', () => {
  for (const code of ['email_not_confirmed', 'user_banned', 'user_not_found']) {
    assert.strictEqual(messaggioErroreAuth({ code, status: 400 }), 'Email o password errati');
  }
});

test('errore di rete produce messaggio in italiano anche su iPhone', () => {
  const atteso = 'Connessione assente, riprova';
  // Chrome, Safari (PWA su iPhone), Firefox, e l'errore di rete di supabase-js
  assert.strictEqual(messaggioErroreAuth(new TypeError('Failed to fetch')), atteso);
  assert.strictEqual(messaggioErroreAuth(new TypeError('Load failed')), atteso);
  assert.strictEqual(messaggioErroreAuth({ name: 'AuthRetryableFetchError', status: 0 }), atteso);
  assert.strictEqual(messaggioErroreAuth({ message: 'Failed to fetch' }), atteso);
});

test('troppe richieste: niente durata inventata', () => {
  const atteso = 'Troppe richieste in poco tempo. Riprova più tardi.';
  assert.strictEqual(messaggioErroreAuth({ code: 'over_email_send_rate_limit', status: 429 }), atteso);
  assert.strictEqual(messaggioErroreAuth({ code: 'over_request_rate_limit', status: 429 }), atteso);
  assert.strictEqual(messaggioErroreAuth({ status: 429 }), atteso);
});

test('nuova password: distingue password uguale, debole e link scaduto', () => {
  assert.strictEqual(
    messaggioErroreAuth({ code: 'same_password', status: 422 }),
    'La nuova password deve essere diversa da quella attuale.'
  );
  assert.strictEqual(
    messaggioErroreAuth({ code: 'weak_password', status: 422 }),
    'Password troppo debole. Usane una più lunga.'
  );
  const scaduto = 'Il link non è valido o è scaduto. Richiedine uno nuovo.';
  assert.strictEqual(messaggioErroreAuth({ name: 'AuthSessionMissingError', status: 400 }), scaduto);
  assert.strictEqual(messaggioErroreAuth({ code: 'session_not_found', status: 403 }), scaduto);
});

test('errore sconosciuto: messaggio generico con il codice, mai il testo grezzo', () => {
  const conCodice = messaggioErroreAuth({ code: 'unexpected_failure', status: 500, message: 'dettaglio interno' });
  assert.strictEqual(conCodice, 'Operazione non riuscita (codice unexpected_failure). Riprova tra poco.');

  const soloStatus = messaggioErroreAuth({ status: 500, message: 'dettaglio interno' });
  assert.strictEqual(soloStatus, 'Operazione non riuscita (codice 500). Riprova tra poco.');

  const niente = messaggioErroreAuth({ message: 'boh' });
  assert.strictEqual(niente, 'Operazione non riuscita (codice sconosciuto). Riprova tra poco.');
  assert.strictEqual(messaggioErroreAuth(null), 'Operazione non riuscita (codice sconosciuto). Riprova tra poco.');
});

test('login, recupero e nuova password usano tutti il traduttore unico', () => {
  const app = fs.readFileSync(require.resolve('../js/app.js'), 'utf8');
  const auth = fs.readFileSync(require.resolve('../js/auth.js'), 'utf8');

  assert.doesNotMatch(app, /Invio non riuscito/);
  assert.match(app, /richiediRecuperoPassword[\s\S]*?messaggioErroreAuth\(err\)/);
  assert.match(app, /salvaNuovaPassword[\s\S]*?messaggioErroreAuth\(err\)/);
  assert.equal((auth.match(/messaggioErroreAuth\(error\)/g) || []).length, 2);
  // Il dettaglio tecnico resta visibile, ma solo in console
  assert.equal((auth.match(/console\.error\(/g) || []).length, 2);
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

test('il form nuova password identifica l’account e permette di tornare al login', () => {
  const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(require.resolve('../js/app.js'), 'utf8');
  const inizio = html.indexOf("<form x-show=\"modalitaAccesso === 'nuova-password'\"");
  const form = html.slice(inizio, html.indexOf('</form>', inizio));
  assert.match(form, /autocomplete="username"[^>]*x-model="emailRecupero"|x-model="emailRecupero"[^>]*autocomplete="username"/);
  assert.match(form, /id="new-password"[^>]*name="new-password"/);
  assert.match(form, /id="confirm-password"[^>]*name="confirm-password"/);
  assert.match(form, /Password già aggiornata\? Torna all’accesso/);
  assert.match(app, /tornaAlLogin\(\)[\s\S]{0,300}?history\.replaceState[\s\S]{0,300}?signOut\(\{ scope: 'local' \}\)/);
});

test('link di recupero già usato o scaduto: l\'errore nell\'indirizzo diventa un messaggio', () => {
  const scaduto = 'Il link non è valido o è scaduto. Richiedine uno nuovo.';
  // Supabase rimanda all'app con l'errore nell'hash (o nella query)
  assert.strictEqual(
    erroreDaUrl({ hash: '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid', search: '' }),
    scaduto
  );
  assert.strictEqual(erroreDaUrl({ hash: '', search: '?error=access_denied&error_code=otp_expired' }), scaduto);
  // Codice mai visto: messaggio generico col codice, mai la descrizione grezza
  assert.strictEqual(
    erroreDaUrl({ hash: '#error=server_error&error_description=dettaglio+interno', search: '' }),
    'Operazione non riuscita (codice server_error). Riprova tra poco.'
  );
  // Indirizzo normale o link di recupero valido: nessun errore
  assert.strictEqual(erroreDaUrl({ hash: '#access_token=x&type=recovery', search: '' }), '');
  assert.strictEqual(erroreDaUrl({ hash: '', search: '' }), '');
});

test('all\'avvio l\'app mostra l\'errore del link e ripulisce l\'indirizzo', () => {
  const app = fs.readFileSync(require.resolve('../js/app.js'), 'utf8');
  const client = fs.readFileSync(require.resolve('../js/supabase-client.js'), 'utf8');
  // Letto prima che Supabase ripulisca l'indirizzo, con riserva in app.js
  assert.match(client, /const erroreLinkInUrl = erroreDaUrl\(window\.location\)/);
  assert.match(app, /const erroreLink = window\.AccountSessions\.erroreLink\?\.\(\) \|\| erroreDaUrl\(window\.location\)/);
  assert.match(app, /if \(erroreLink\)[\s\S]{0,300}?history\.replaceState/);
});

test('la pulizia degli account tecnici non può cancellare un admin', () => {
  const migration = fs.readFileSync(
    require('node:path').join(__dirname, '..', 'supabase', 'migrations', '20261013150000_pulisci_e_ordina_profili.sql'),
    'utf8'
  );
  assert.match(migration, /delete from auth\.users u[\s\S]*and not exists \([\s\S]*p\.ruolo = 'admin'/);
});
