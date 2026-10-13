// js/auth-logic.js
function mappaErroreLogin(err) {
  if (err.message === 'Invalid login credentials') return 'Email o password errati';
  if (err.message === 'Failed to fetch') return 'Connessione assente, riprova';
  return `Errore: ${err.message}`;
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
  module.exports = { mappaErroreLogin, urlRecuperoPassword, sessioneRecuperoPassword, emailDaSessione };
}
