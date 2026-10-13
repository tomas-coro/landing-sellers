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

if (typeof module !== 'undefined') {
  module.exports = { mappaErroreLogin, urlRecuperoPassword, sessioneRecuperoPassword };
}
