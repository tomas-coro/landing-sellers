// js/auth-logic.js
function mappaErroreLogin(err) {
  if (err.message === 'Invalid login credentials') return 'Email o password errati';
  if (err.message === 'Failed to fetch') return 'Connessione assente, riprova';
  return `Errore: ${err.message}`;
}

function urlRecuperoPassword(location) {
  return new URLSearchParams(location.hash.replace(/^#/, '')).get('type') === 'recovery';
}

if (typeof module !== 'undefined') {
  module.exports = { mappaErroreLogin, urlRecuperoPassword };
}
