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

const CLASSE_STATO = {
  contattato: 'contattato',
  brief_mandato: 'brief',
  in_lavorazione: 'lavorazione',
  pubblicato: 'pubblicato'
};

function classeStato(stato) {
  return CLASSE_STATO[stato] || 'contattato';
}

function formattaData(data) {
  if (!data) return '';
  return new Date(data).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
}

function formattaMese(data) {
  if (!data) return '';
  const testo = new Date(data).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}

function formattaEuro(numero) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
    .format(Number(numero) || 0);
}

function classeUrgenza(prossimoContatto, oggi = new Date()) {
  if (!prossimoContatto) return '';
  const soloData = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffGiorni = Math.round((soloData(new Date(prossimoContatto)) - soloData(oggi)) / 86400000);
  if (diffGiorni < 0) return 'ritardo';
  if (diffGiorni <= 3) return 'vicino';
  return '';
}

function validaClienteForm(dati) {
  const errori = {};
  if (!dati.nome || !dati.nome.trim()) {
    errori.nome = 'Il nome cliente è obbligatorio';
  }
  if (dati.importo_abbonamento != null && dati.importo_abbonamento < 0) {
    errori.importo_abbonamento = 'L\'importo non può essere negativo';
  }
  if (dati.sito_url && dati.sito_url.trim() && !/^https?:\/\//i.test(dati.sito_url.trim())) {
    errori.sito_url = 'L\'URL deve iniziare con http:// o https://';
  }
  return { valido: Object.keys(errori).length === 0, errori };
}

if (typeof module !== 'undefined') {
  module.exports = { formattaStato, validaClienteForm, ETICHETTE_STATO, classeStato, formattaData, formattaMese, formattaEuro, classeUrgenza };
}
