// js/validators.js
const ETICHETTE_STATO = {
  contattato: 'Contattato',
  brief_mandato: 'Brief mandato',
  in_lavorazione: 'In lavorazione',
  pubblicato: 'Pubblicato'
};

function formattaStato(stato) {
  return ETICHETTE_STATO[stato] || stato;
}

function validaClienteForm(dati) {
  const errori = {};
  if (!dati.nome || !dati.nome.trim()) {
    errori.nome = 'Il nome cliente è obbligatorio';
  }
  if (dati.importo_abbonamento != null && dati.importo_abbonamento < 0) {
    errori.importo_abbonamento = 'L\'importo non può essere negativo';
  }
  return { valido: Object.keys(errori).length === 0, errori };
}

if (typeof module !== 'undefined') {
  module.exports = { formattaStato, validaClienteForm, ETICHETTE_STATO };
}
