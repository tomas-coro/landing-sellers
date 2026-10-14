// js/auth-logic.js
// Traduce gli errori di Supabase Auth (login, recupero, nuova password) in
// frasi brevi per l'utente. Regole decise con Tomas il 14/10/2026:
// - solo gli errori noti hanno una frase, scelta sul `code` del server e mai
//   sul testo, e nessuna frase rivela se un'email è registrata;
// - per gli altri un messaggio generico con il codice, così uno screenshot
//   basta per la diagnosi; il dettaglio tecnico lo logga il chiamante in console.
const CREDENZIALI_ERRATE = 'Email o password errati';
const TROPPE_RICHIESTE = 'Troppe richieste in poco tempo. Riprova più tardi.';
const LINK_SCADUTO = 'Il link non è valido o è scaduto. Richiedine uno nuovo.';

const MESSAGGI_ERRORE_AUTH = {
  invalid_credentials: CREDENZIALI_ERRATE,
  // Questi tre direbbero che l'account esiste: stessa frase delle credenziali
  email_not_confirmed: CREDENZIALI_ERRATE,
  user_banned: CREDENZIALI_ERRATE,
  user_not_found: CREDENZIALI_ERRATE,
  over_email_send_rate_limit: TROPPE_RICHIESTE,
  over_request_rate_limit: TROPPE_RICHIESTE,
  same_password: 'La nuova password deve essere diversa da quella attuale.',
  weak_password: 'Password troppo debole. Usane una più lunga.',
  session_not_found: LINK_SCADUTO,
  session_expired: LINK_SCADUTO,
  // Link email già usato (anche solo dall'anteprima di WhatsApp) o scaduto
  otp_expired: LINK_SCADUTO,
  flow_state_expired: LINK_SCADUTO,
  flow_state_not_found: LINK_SCADUTO
};

// Testi del browser quando la rete manca: Chrome, Safari (anche la PWA su
// iPhone) e Firefox li scrivono in modo diverso.
const ERRORI_RETE = ['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.'];

function messaggioErroreAuth(err) {
  const generico = codice => `Operazione non riuscita (codice ${codice}). Riprova tra poco.`;
  if (!err) return generico('sconosciuto');

  const senzaRisposta = !err.status;
  if (
    ERRORI_RETE.includes(err.message) ||
    (err.name === 'AuthRetryableFetchError' && senzaRisposta)
  ) {
    return 'Connessione assente, riprova';
  }
  if (MESSAGGI_ERRORE_AUTH[err.code]) return MESSAGGI_ERRORE_AUTH[err.code];
  if (err.status === 429) return TROPPE_RICHIESTE;
  // Errore del client: il link di recupero non ha creato nessuna sessione
  if (err.name === 'AuthSessionMissingError') return LINK_SCADUTO;

  return generico(err.code || err.status || 'sconosciuto');
}

// Quando un link email non è più valido, Supabase rimanda all'app con
// l'errore nell'indirizzo (#error=...&error_code=..., o nella query).
// Restituisce il messaggio da mostrare, oppure '' se l'indirizzo è pulito.
function erroreDaUrl(location) {
  for (const parte of [location.hash, location.search]) {
    const params = new URLSearchParams((parte || '').replace(/^[#?]/, ''));
    const codice = params.get('error_code') || params.get('error');
    if (codice) return messaggioErroreAuth({ code: codice });
  }
  return '';
}

function urlRecuperoPassword(location) {
  return new URLSearchParams(location.hash.replace(/^#/, '')).get('type') === 'recovery';
}

function sessioneRecuperoPassword(sessione) {
  try {
    const encoded = sessione.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')));
    return payload.amr?.some(metodo => metodo.method === 'otp') === true;
  } catch {
    return false;
  }
}

// Email dell'account a cui appartiene la sessione di recupero: serve al
// portachiavi del telefono per capire quale password salvata aggiornare.
function emailDaSessione(sessione) {
  return sessione?.user?.email || '';
}

if (typeof module !== 'undefined') {
  module.exports = { messaggioErroreAuth, erroreDaUrl, urlRecuperoPassword, sessioneRecuperoPassword, emailDaSessione };
}
