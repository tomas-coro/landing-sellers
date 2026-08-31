// js/auth-logic.js
function mappaErroreLogin(err) {
  if (err.message === 'Invalid login credentials') return 'Email o password errati';
  if (err.message === 'Failed to fetch') return 'Connessione assente, riprova';
  return `Errore: ${err.message}`;
}

if (typeof module !== 'undefined') module.exports = { mappaErroreLogin };
