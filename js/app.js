// js/app.js
function formModuloVuoto() {
  return { nome: '', referente: '', telefono: '', email: '',
    piva: '', iban: '', sito_url: '', importo_abbonamento: null,
    nome_pacchetto: '', note_prezzo: '', data_rinnovo: null,
    brief_cliente: '', prossima_azione: '', prossimo_contatto: '',
    esito_motivazione: '',
    data_attivazione: '', periodicita_contratto: 'mensile',
    durata_contratto_anni: 1,
    giorni_preavviso_notifica: 7,
    sconto_tipo: '', sconto_valore: 0, sconto_durata_anni: null,
    pagine_extra: 0, lingue_extra: 0,
    cliente_ha_dominio: true,
    dominio_it: 0, dominio_com: 0, email_5_caselle: 0,
    pacchetto_sicurezza: false };
}

function filtroVenditoreClienti(isAdmin, venditoreId) {
  return isAdmin ? venditoreId : '';
}

function ultimiClienti(clienti = [], limite = 5) {
  return [...clienti]
    .sort((a, b) => String(b.creato_il || '').localeCompare(String(a.creato_il || '')))
    .slice(0, limite);
}

function normalizzaClientePerSalvataggio(form) {
  return {
    ...form,
    sconto_tipo: form.sconto_tipo || null,
    data_attivazione: form.data_attivazione || null,
    data_rinnovo: form.data_rinnovo || null,
    prossimo_contatto: form.prossimo_contatto || null,
    brief_cliente: (form.brief_cliente || '').trim() || null,
    prossima_azione: (form.prossima_azione || '').trim() || null,
    esito_motivazione: (form.esito_motivazione || '').trim() || null
  };
}

function normalizzaAnagraficaClientePerSalvataggio(form) {
  return {
    nome: (form.nome || '').trim(),
    referente: (form.referente || '').trim() || null,
    telefono: (form.telefono || '').trim() || null,
    email: (form.email || '').trim() || null,
    piva: (form.piva || '').trim() || null,
    iban: (form.iban || '').trim() || null,
    sito_url: (form.sito_url || '').trim() || null,
    brief_cliente: (form.brief_cliente || '').trim() || null,
    prossima_azione: (form.prossima_azione || '').trim() || null,
    prossimo_contatto: form.prossimo_contatto || null,
    esito_motivazione: (form.esito_motivazione || '').trim() || null
  };
}

function prezzoRicorrenteDaForm(prezzoCatalogo, form) {
  const lordo = Math.max(0, Number(prezzoCatalogo) || 0);
  const valore = Math.max(0, Number(form.sconto_valore) || 0);

  if (form.sconto_tipo === 'prezzo_fisso') {
    return valore;
  }

  if (form.sconto_tipo === 'percentuale') {
    // Un valore oltre 100% è invalido:
    // non deve azzerare il prezzo configurato.
    if (valore > 100) return lordo;

    return lordo * (1 - valore / 100);
  }

  if (form.sconto_tipo === 'fisso') {
    return Math.max(0, lordo - valore);
  }

  return lordo;
}

function totaleContrattoDaForm(canone, extra, form) {
  return Number(canone) + (
    form.sconto_tipo === 'prezzo_fisso' ? 0 : Number(extra)
  );
}

function costiGestioneCliente(cliente, rinnovo = false) {
  const costi = [{ descrizione: 'Gestione sito', importo: 30 }];
  if (cliente.cliente_ha_dominio === false) {
    const qtaIt = Number(cliente.dominio_it) || 0;
    if (qtaIt > 0) {
      costi.push({
        descrizione:
          (rinnovo ? 'Dominio .it - rinnovo' : 'Dominio .it - primo anno') +
          (qtaIt > 1 ? ` x${qtaIt}` : ''),
        importo: (rinnovo ? 15 : 10) * qtaIt
      });
    }
    const qtaCom = Number(cliente.dominio_com) || 0;
    if (qtaCom > 0) {
      costi.push({
        descrizione:
          (rinnovo ? 'Dominio .com - rinnovo' : 'Dominio .com - primo anno') +
          (qtaCom > 1 ? ` x${qtaCom}` : ''),
        importo: (rinnovo ? 20 : 15) * qtaCom
      });
    }
    const qtaEmail = Number(cliente.email_5_caselle) || 0;
    if (qtaEmail > 0) {
      costi.push({
        descrizione:
          (rinnovo ? 'Email 5 caselle - rinnovo' : 'Email 5 caselle - primo anno') +
          (qtaEmail > 1 ? ` x${qtaEmail}` : ''),
        importo: (rinnovo ? 10 : 5) * qtaEmail
      });
    }
  }
  return costi;
}

function economicEngineApi() {
  if (
    typeof globalThis !== 'undefined' &&
    globalThis.EconomicEngine
  ) {
    return globalThis.EconomicEngine;
  }

  if (
    typeof module === 'object' &&
    module.exports &&
    typeof require === 'function'
  ) {
    return require('./economic-engine.js');
  }

  return null;
}

function validatorsApi() {
  if (
    typeof globalThis !== 'undefined' &&
    typeof globalThis.formattaStato === 'function' &&
    typeof globalThis.classeStato === 'function'
  ) {
    return {
      formattaStato: globalThis.formattaStato,
      classeStato: globalThis.classeStato
    };
  }

  if (
    typeof module === 'object' &&
    module.exports &&
    typeof require === 'function'
  ) {
    return require('./validators.js');
  }

  return {
    formattaStato: stato => stato,
    classeStato: () => 'contattato'
  };
}

function appEconomiaMixinApi() {
  if (
    typeof globalThis !== 'undefined' &&
    globalThis.appEconomiaMixin
  ) {
    return globalThis.appEconomiaMixin;
  }

  if (
    typeof module === 'object' &&
    module.exports &&
    typeof require === 'function'
  ) {
    return require('./app-economia.js');
  }

  return null;
}

function percentualeTasseEconomia(partecipanti) {
  const engine = economicEngineApi();

  if (engine) {
    return engine.percentualeTasse(partecipanti);
  }

  // Fallback difensivo: normalmente browser e test caricano EconomicEngine.
  const collaboratori = partecipanti.filter(
    p => p.ruolo !== 'referente'
  );

  return collaboratori.length &&
    collaboratori.every(
      p => (p.modalitaFatturazione || 'nessuna') === 'nessuna'
    )
      ? 60
      : 40;
}

function etichettaDurataScontoForm(form) {
  if (form.sconto_durata_anni == null) return 'Per sempre';
  const anni = Number(form.sconto_durata_anni) || 1;
  return anni === 1 ? 'Per il primo anno' : `Per i primi ${anni} anni`;
}

function posizioneAvatarDaUrl(url = '') {
  const match = String(url).match(
  /#(?:pos|crop)=(\d{1,3}(?:\.\d+)?),(\d{1,3}(?:\.\d+)?)(?:,([\d.]+))?$/
);
  return match ? {
    x: Math.min(100, Number(match[1])),
    y: Math.min(100, Number(match[2])),
    zoom: Math.max(1, Math.min(2, Number(match[3]) || 1))
  } : { x: 50, y: 50, zoom: 1 };
}

function avatarUrlConPosizione(url = '', x = 50, y = 50, zoom = 1) {
  const base = String(url).split('#')[0];
  const limita = valore => Math.max(0, Math.min(100, Number(valore) || 0));
  const scala = Math.max(1, Math.min(2, Number(zoom) || 1));
  return base ? `${base}#crop=${limita(x)},${limita(y)},${scala}` : '';
}

function clientiAttribuitiAlProfilo(profiloId, clienti = [], vendite = [], partecipanti = []) {
  const venditeDelProfilo = new Set(
    partecipanti.filter(p => p.profilo_id === profiloId).map(p => p.vendita_id)
  );
  const venditeConPartecipanti = new Set(partecipanti.map(p => p.vendita_id));
  const clientiDelProfilo = new Set(
    vendite.filter(v => venditeDelProfilo.has(v.id)).map(v => v.cliente_id)
  );
  const clientiConPartecipanti = new Set(
    vendite.filter(v => venditeConPartecipanti.has(v.id)).map(v => v.cliente_id)
  );

  return clienti.filter(cliente =>
    clientiDelProfilo.has(cliente.id) ||
    (!clientiConPartecipanti.has(cliente.id) && cliente.venditore_id === profiloId)
  );
}

function ordinaTeamEconomico(venditori = []) {
  const ordine = ['alessandro', 'tomas', 'nicola'];
  return [...venditori].sort((a, b) => {
    const nomeA = String(a.nome || '').trim().toLowerCase();
    const nomeB = String(b.nome || '').trim().toLowerCase();
    const prioritaA = ordine.includes(nomeA) ? ordine.indexOf(nomeA) : ordine.length;
    const prioritaB = ordine.includes(nomeB) ? ordine.indexOf(nomeB) : ordine.length;
    return prioritaA - prioritaB || nomeA.localeCompare(nomeB, 'it');
  });
}

function ordinaClassificaVenditori(venditori = []) {
  return venditori
    .filter(v => v.ruolo !== 'Developer')
    .sort((a, b) =>
      (Number(b.totaleVenduto) || 0) - (Number(a.totaleVenduto) || 0) ||
      (Number(b.totaleGenerato) || 0) - (Number(a.totaleGenerato) || 0) ||
      String(a.nome || '').localeCompare(String(b.nome || ''), 'it')
    );
}

function clientiDelVenditoreRiferimento(profiloId, clienti = [], vendite = []) {
  const clientiConVendita = new Set(vendite.map(v => v.cliente_id));
  const clientiDelVenditore = new Set(
    vendite.filter(v => v.venditore_id === profiloId).map(v => v.cliente_id)
  );

  return clienti.filter(cliente =>
    clientiDelVenditore.has(cliente.id) ||
    (!clientiConVendita.has(cliente.id) && cliente.venditore_id === profiloId)
  );
}

function valoreAnnualeCliente(cliente) {
  const importo = Number(cliente?.importo_abbonamento) || 0;
  return cliente?.periodicita_contratto === 'mensile' ? importo * 12 : importo;
}

function valoreContrattoVendita(vendita, clientiPerId = {}) {
  const cliente = clientiPerId[vendita?.cliente_id];
  return valoreAnnualeCliente(cliente) || (Number(vendita?.importo_vendita) || 0);
}

const MESI_LABEL_TREND = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

function ultimiMesiTrend(n = 12) {
  const oggi = new Date();
  const risultato = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(oggi.getFullYear(), oggi.getMonth() - i, 1);
    risultato.push({
      chiave: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'),
      label: MESI_LABEL_TREND[d.getMonth()]
    });
  }
  return risultato;
}

// Aggregazione mensile del valore contratto (stessa funzione dei tile
// "Venduto"). Il dedupe e' per mese, non globale come nel tile: un cliente
// con piu' vendite attive in mesi diversi (es. rinnovo) compare nel mese
// giusto in ogni punto - e' la lettura corretta per un trend temporale,
// anche se puo' differire dal totale cumulativo del tile sopra.
function serieMensileValore(vendite = [], clientiPerId = {}, filtroVenditoreId = null) {
  const mesi = ultimiMesiTrend(12);
  const somme = Object.fromEntries(mesi.map(m => [m.chiave, 0]));
  const conteggi = Object.fromEntries(mesi.map(m => [m.chiave, 0]));
  const clientiContatiPerMese = {};

  vendite
    .filter(v => v.stato === 'attiva' && v.data_vendita)
    .filter(v => !filtroVenditoreId || v.venditore_id === filtroVenditoreId)
    .forEach(v => {
      const chiaveMese = String(v.data_vendita).slice(0, 7);
      if (!(chiaveMese in somme)) return;
      const chiaveCliente = v.cliente_id || v.id;
      const contati = (clientiContatiPerMese[chiaveMese] ||= new Set());
      if (contati.has(chiaveCliente)) return;
      contati.add(chiaveCliente);
      somme[chiaveMese] += valoreContrattoVendita(v, clientiPerId);
      conteggi[chiaveMese] += 1;
    });

  return mesi.map(m => ({ ...m, valore: somme[m.chiave], numero: conteggi[m.chiave] }));
}

function calcolaStatisticheVenditore(
  vendite = [],
  pagamenti = [],
  quotePerVendita = {},
  profiloId = '',
  clientiPerId = {}
) {
  const venditeAttive = vendite.filter(v => v.stato === 'attiva');

  const incassatoTotalePerVendita = {};
  pagamenti
    .filter(p => p.stato === 'incassato')
    .forEach(p => {
      incassatoTotalePerVendita[p.vendita_id] =
        (incassatoTotalePerVendita[p.vendita_id] || 0) + (Number(p.importo) || 0);
    });

  const clientiVenduti = new Set();
  const totali = venditeAttive.reduce((totali, v) => {
    // Vendita condivisa nel team: ognuno vede solo la propria quota (quota_finale),
    // mai l'importo pieno della vendita degli altri partecipanti.
    const quota = Number(quotePerVendita[v.id]) || 0;
    const importoVendita = valoreContrattoVendita(v, clientiPerId);
    const importoIncassabile = Number(v.importo_vendita) || 0;
    const incassatoVendita = incassatoTotalePerVendita[v.id] || 0;

    // L'incasso reale è per l'intera vendita, non per partecipante: la quota
    // personale scala in proporzione a quanto è stato effettivamente versato.
    const proporzione = importoIncassabile > 0
      ? Math.min(1, incassatoVendita / importoIncassabile)
      : 0;

    totali.generato += quota;
    totali.incassato += quota * proporzione;

    // Valore commerciale: conta l'importo pieno solo quando questo profilo
    // risulta essere il venditore effettivo della vendita.
    const chiaveCliente = v.cliente_id || v.id;
    if (v.venditore_id === profiloId && !clientiVenduti.has(chiaveCliente)) {
      clientiVenduti.add(chiaveCliente);
      totali.venduto += importoVendita;
      totali.numeroVendite += 1;
    }

    return totali;
  }, {
    generato: 0,
    incassato: 0,
    venduto: 0,
    mediaVendita: 0,
    numeroVendite: 0
  });

  totali.mediaVendita = totali.numeroVendite > 0
    ? totali.venduto / totali.numeroVendite
    : 0;

  return totali;
}

// ===== Sezione Fatturato: aggregazione per anno/mese =====
// Righe di input nella forma { data: 'YYYY-MM-DD', valore: number }.
// A differenza di serieMensileValore (finestra fissa ultimi 12 mesi) questi
// helper lavorano su un anno solare specifico e su tutto lo storico, per la
// vista "Fatturato" (mensile + confronto tra anni).
function mesiAnnoFatturato(anno) {
  return MESI_LABEL_TREND.map((label, i) => ({
    chiave: anno + '-' + String(i + 1).padStart(2, '0'),
    label
  }));
}

function serieMensileAnno(righe = [], anno) {
  const mesi = mesiAnnoFatturato(anno);
  const somme = Object.fromEntries(mesi.map(m => [m.chiave, 0]));

  righe.forEach(riga => {
    if (!riga?.data) return;
    const chiave = String(riga.data).slice(0, 7);
    if (!(chiave in somme)) return;
    somme[chiave] += Number(riga.valore) || 0;
  });

  return mesi.map(m => ({ ...m, valore: somme[m.chiave] }));
}

function totaliPerAnno(righe = []) {
  const totali = {};
  righe.forEach(riga => {
    if (!riga?.data) return;
    const anno = Number(String(riga.data).slice(0, 4));
    if (!Number.isFinite(anno)) return;
    totali[anno] = (totali[anno] || 0) + (Number(riga.valore) || 0);
  });
  return totali;
}

function anniDisponibiliFatturato(gruppiRighe = []) {
  const anni = new Set([new Date().getFullYear()]);
  gruppiRighe.forEach(righe => {
    (righe || []).forEach(riga => {
      if (!riga?.data) return;
      const anno = Number(String(riga.data).slice(0, 4));
      if (Number.isFinite(anno)) anni.add(anno);
    });
  });
  return [...anni].sort((a, b) => b - a);
}

function formVenditaEconomicaVuoto() {
  return {
    clienteRicerca: '',
    clienteId: null,
    servizio: '',
    importoVendita: null,

    configurazioneCommerciale: {
      formula: 'mensile',
      upgrade: [],
      periodicita_contratto: 'mensile',
      pagine_extra: 0,
      lingue_extra: 0,

      durata_contratto_anni: 1,
      sconto_tipo: '',
      sconto_valore: 0,
      sconto_durata_anni: null,

      // Inserita una sola volta durante la vendita e sincronizzata
      // automaticamente con la scheda cliente.
      data_attivazione: '',

      cliente_ha_dominio: true,
      dominio_it: 0,
      dominio_com: 0,
      email_5_caselle: 0,

      pacchetto_sicurezza: false
    },

    costi: [],
    costoDescrizione: '',
    costoImporto: null,

    // Regole economiche attualmente definite.
    percentualeRiduzioneNoFattura: 20,
    applicaBonusVenditore: true,

    modalitaFatturazioneAdmin: 'nessuna',
    importoFatturatoAdmin: 0,

    statoIncasso: 'incassato',
    importoIncassato: null,
    dataPagamento: '',
    dataScadenza: '',
    metodoPagamento: '',
    notePagamento: '',

    // Costi propri della singola rata (es. commissioni di incasso):
    // concetto distinto dai costi della vendita, non vengono applicati
    // automaticamente da una rata all'altra.
    costiRata: [],
    costoRataDescrizione: '',
    costoRataImporto: null,

    partecipanti: [],
    venditoriDisponibili: [],
    nuovoPartecipanteNome: ''
  };
}

// js/app-economia.js e js/app-vendita.js vengono richiesti come moduli Node
// separati (scope proprio): le funzioni top-level di questo file che i loro
// metodi richiamano per nome nudo vanno esposte sull'oggetto globale,
// altrimenti in Node (non nel browser, dove gli script condividono lo stesso
// scope globale) risultano "not defined". Nessun cambio di comportamento:
// nel browser sono gia' globali di per se' (dichiarazioni function a
// livello di script).
if (typeof globalThis !== 'undefined') {
  globalThis.costiGestioneCliente = costiGestioneCliente;
  globalThis.economicEngineApi = economicEngineApi;
  globalThis.percentualeTasseEconomia = percentualeTasseEconomia;
  globalThis.valoreAnnualeCliente = valoreAnnualeCliente;
  globalThis.formVenditaEconomicaVuoto = formVenditaEconomicaVuoto;
  globalThis.prezzoRicorrenteDaForm = prezzoRicorrenteDaForm;
  globalThis.totaleContrattoDaForm = totaleContrattoDaForm;
}

function appVenditaMixinApi() {
  if (
    typeof globalThis !== 'undefined' &&
    globalThis.appVenditaMixin
  ) {
    return globalThis.appVenditaMixin;
  }

  if (
    typeof module === 'object' &&
    module.exports &&
    typeof require === 'function'
  ) {
    return require('./app-vendita.js');
  }

  return null;
}

function appClienteMixinApi() {
  if (
    typeof globalThis !== 'undefined' &&
    globalThis.appClienteMixin
  ) {
    return globalThis.appClienteMixin;
  }

  if (
    typeof module === 'object' &&
    module.exports &&
    typeof require === 'function'
  ) {
    return require('./app-cliente.js');
  }

  return null;
}

function appAdminMixinApi() {
  if (
    typeof globalThis !== 'undefined' &&
    globalThis.appAdminMixin
  ) {
    return globalThis.appAdminMixin;
  }

  if (
    typeof module === 'object' &&
    module.exports &&
    typeof require === 'function'
  ) {
    return require('./app-admin.js');
  }

  return null;
}

function appFatturatoMixinApi() {
  if (
    typeof globalThis !== 'undefined' &&
    globalThis.appFatturatoMixin
  ) {
    return globalThis.appFatturatoMixin;
  }

  if (
    typeof module === 'object' &&
    module.exports &&
    typeof require === 'function'
  ) {
    return require('./app-fatturato.js');
  }

  return null;
}

function appState() {
  return Object.assign({
    view: '',
    avvioVisibile: true,
    sessione: null,
    clienteSelezionatoId: null,
    erroreLogin: '',
    emailInput: '',
    passwordInput: '',

    // toast: feedback non bloccante per azioni che oggi salvano senza alcun riscontro visivo
    toasts: [],
    _toastId: 0,

    // modal di conferma generico: sostituisce window.confirm() nativo per
    // azioni distruttive o con perdita di dati, restando coerente con lo
    // stile dell'app. risolve la Promise quando l'utente sceglie.
    confermaGenerica: {
      aperto: false,
      messaggio: '',
      testoConferma: 'Conferma',
      _risolvi: null
    },

    accountSlot: globalThis.window?.AccountSessions?.getActiveSlot() || 'personale',
    accountSwitcherAperto: false,
    accountSwitchInCorso: false,
    personaleSessioneDisponibile: false,
    adminSessioneDisponibile: false,
    adminEmail: 'info@landingevolution.it',
    adminPasswordInput: '',
    adminLoginInCorso: false,
    adminLoginErrore: '',
    mostraLoginAdmin: false,

    clienti: [],
    erroreClienti: '',
    // Bottone "Riprova": { fn } quando l'errore e' di rete/server, null sui
    // validazione. Avvolto in un oggetto perche' Alpine auto-invoca i
    // riferimenti a funzione bare in x-show/x-text (userebbe il return della
    // funzione come condizione, non la sua esistenza) - un oggetto invece no.
    retryClienti: null,
    caricandoClienti: true,
    isAdmin: false,
    filtroVenditoreId: '',
    filtroVenditoreNome: '',
    filtroTesto: '',
    filtroStato: '',
    cmdkAperta: false,
    cmdkTesto: '',
    cmdkIndiceAttivo: 0,
    filtroSoloRitardo: false,
    ordinamento: 'prossimo_contatto',
    ordinamentoDesc: false,
    paginaClienti: 1,
    clientiPerPagina: 20,
    viewPrecedenteScheda: 'lista',
    viewPrecedenteRicerca: 'lista',

    // mini CRM
    agendaVista: 'oggi',
    agendaMese: new Date().toISOString().slice(0, 7),
    agendaDataSelezionata: new Date().toISOString().slice(0, 10),

    pipelineIndice: 0,
    caricandoStatistiche: true,
    statisticheVenditore: {
      generato: 0,
      incassato: 0,
      venduto: 0,
      mediaVendita: 0,
      numeroVendite: 0
    },

    // grafici: trend vendite mensile (sempre 12 mesi in memoria, la vista
    // mostra uno slice di 6 o 12 - vedi trendRangeVenditore/trendRangeAdmin)
    trendDatiVenditore: [],
    trendRangeVenditore: 12,
    trendHoverVenditore: null,

    trendDatiAdmin: [], // [{ id, nome, color, punti: [{chiave,label,valore}] }]
    trendRangeAdmin: 12,
    trendHoverAdmin: null,

    // Vista Fatturato: caricata a richiesta (apriFatturato), mai in cache -
    // così resta sempre coerente con l'ultimo incasso/vendita registrati.
    caricandoFatturato: false,
    erroreFatturato: '',
    fatturatoAnno: new Date().getFullYear(),
    fatturatoAnniDisponibili: [new Date().getFullYear()],
    fatturatoVenditeRighe: [],   // admin: [{ data, valore }] - venduto azienda
    fatturatoIncassiRighe: [],   // admin: [{ data, valore }] - incassato azienda
    fatturatoBreakdownRighe: [], // admin: [{ profiloId, nome, data, valore }] - guadagni per persona
    fatturatoGuadagniRighe: [],  // utente corrente: [{ data, valore }]
    fatturatoHover: null,
    incassatoHoverMensile: null, // indice barra evidenziata nel grafico "Il tuo incassato"

    ricercaGlobale: '',
    indiceNoteRicerca: [],
    erroreRicerca: '',

    assistenteDomanda: '',
    assistenteMessaggi: [{
      ruolo: 'bot',
      testo: 'Ciao! Chiedimi come usare l’app. Ti risponderò solo con indicazioni già verificate.'
    }],

    nuovoClienteForm: formModuloVuoto(),
    ritornoDopoNuovoCliente: null,
    clienteCreatoId: null,
    clienteCreatoPromptAperto: false,
    clienteFormSnapshot: null,

    // CRM economico / vendite
    venditaEconomicaForm: formVenditaEconomicaVuoto(),
    modalitaEconomia: 'vendita',
    venditaEconomicaAttiva: null,
    economiaFormSnapshot: null,

    // Incasso: un cliente può avere più vendite attive.
    venditeClienteIncasso: [],
    venditaIncassoSelezionataId: null,
    caricandoVenditeIncasso: false,

    costiVenditaRiferimento: [],
    pagamentoPrevistoId: null,
    pagamentoInModificaId: null,
    eliminandoPagamentoId: null,
    clienteEconomiaSelezionato: null,
    anagraficaEconomiaAperta: false,
    menuAzioneAperto: false,

    // Azioni rapide cliente
    clienteAzioniRapideId: null,
    clienteAzioniPosizione: { top: 0, left: 0 },
    eliminazioneDaAzioniRapide: false,
    clienteAzioniStatoAperto: false,
    clienteAzioniContattoAperto: false,
    clienteAzioniNotaAperta: false,
    clienteProssimoContattoData: '',
    clienteNotaRapidaTesto: '',
    completandoEventoAgendaId: null,
    salvandoProssimoContattoRapido: false,
    salvandoNotaRapida: false,
    messaggioAzioneCliente: '',
    erroreAzioneCliente: '',
    retryAzioneCliente: null,
    salvandoVenditaEconomica: false,
    erroreEconomia: '',
    successoEconomia: '',

    selezionePrezzo: { modalita: 'catalogo', formula: 'mensile', upgrade: [] },
    erroriNuovoCliente: {},
    retryNuovoCliente: null,
    clienteInModificaId: null,
    salvandoCliente: false,

    confermaEliminazione: false,
    eliminandoCliente: false,

    cestino: [],
    erroreCestino: '',
    filtroTestoCestino: '',
    ripristinandoClienteId: null,

    note: [],
    nuovaNotaTesto: '',
    aggiungendoNota: false,
    erroreScheda: '',
    cambiandoStato: false,
    cambiandoStatoProduzione: false,

    attivitaCliente: [],
    caricandoAttivitaCliente: false,

    // pagamenti cliente
    venditaClienteAttiva: null,
    pagamentiCliente: [],
    caricandoPagamentiCliente: false,
    errorePagamentiCliente: '',
    scadenzePagamentoPerCliente: {},
    riepilogoPagamentiPerCliente: {},
    pacchettoVenditaPerCliente: {},

    // PROBLEMA 3: consultazione read-only della configurazione economica
    // consolidata della vendita, dalla scheda cliente.
    dettagliEconomiciPartecipanti: [],
    dettagliEconomiciCosti: [],
    caricandoDettagliEconomici: false,
    erroreDettagliEconomici: '',

    schedaAperture: { stato: true, crm: true, pacchetto: false, contatti: false, attivita: true, note: false, economia: false },

    aggiornamentoDisponibile: false,
    aggiornamentoStato: 'controllo', // controllo | aggiornato | disponibile | errore

    temaPreferenza: globalThis.localStorage?.getItem?.('le-theme') || 'system',

    accedendo: false,

    // notifiche push (Web Push standard)
    pushStato: 'inattivo', // 'non-supportato' | 'bloccato' | 'attivo' | 'inattivo'
    pushInCorso: false,
    pushErrore: '',

    // dashboard admin
    venditori: [],
    adminClienti: [],
    adminVenditoriPerId: {},
    adminClientiPerVenditore: {},
    adminStats: {
      volumeVendite: 0,
      incassatoEffettivo: 0,
      residuoIncasso: 0,
      venditeAttive: 0,
      clienti: 0,
      pubblicati: 0,
      pubblicatiMese: 0,
      inLavorazione: 0
    },
    erroreAdmin: '',
    filtroTestoAdmin: '',

    profilo: { nome: '', username: '', avatar_url: '', ruolo: '' },
    profiloPersonale: { nome: '', username: '', avatar_url: '', ruolo: '', email: '' },
    profiloForm: { username: '' },
    avatarPosizione: { x: 50, y: 50, zoom: 1 },
    avatarTrascinamento: null,
    modificaInquadraturaAperta: false,
    modificaProfiloAperta: false,
    profiloErrore: '',
    profiloSalvando: false,
    avatarCaricando: false,
    avatarErrore: false,
    avatarPersonaleErrore: false,
    pressioneProfiloTimer: null,
    pressioneProfiloLunga: false,

    // navigazione mobile
    swipeStartX: null,
    swipeStartY: null,
    swipeLastX: null,
    swipeStartedAt: 0,
    swipeTracking: false,
    swipeDirection: null,
    swipeElement: null,

    historyPronta: false,
    historyRipristino: false,
    historyUltimaChiave: '',
    posizioniScroll: {},

    statoHistoryCorrente() {
      return {
        le: true,
        view: this.view,
        clienteId: this.clienteSelezionatoId || null,
        modalitaEconomia: this.modalitaEconomia || null,
        agendaVista: this.agendaVista || null,
        agendaData: this.agendaDataSelezionata || null,
        agendaMese: this.agendaMese || null,
        pipelineIndice: Number(this.pipelineIndice) || 0
      };
    },

    chiaveHistory(stato = this.statoHistoryCorrente()) {
      return JSON.stringify(stato);
    },

    sincronizzaHistoryNavigazione() {
      if (
        !this.historyPronta ||
        this.historyRipristino ||
        this.view === 'login'
      ) return;

      const stato = this.statoHistoryCorrente();
      const chiave = this.chiaveHistory(stato);

      if (chiave === this.historyUltimaChiave) return;

      history.pushState(stato, '', location.href);
      this.historyUltimaChiave = chiave;
    },

    inizializzaHistoryNavigazione() {
      if (this.historyPronta || this.view === 'login') return;

      const iniziale = this.statoHistoryCorrente();

      history.replaceState(iniziale, '', location.href);
      this.historyUltimaChiave = this.chiaveHistory(iniziale);
      this.historyPronta = true;

      const appEl = document.getElementById('app');
      if (appEl) {
        let scrollTick = false;
        appEl.addEventListener('scroll', () => {
          if (scrollTick) return;
          scrollTick = true;
          requestAnimationFrame(() => {
            this.posizioniScroll[this.historyUltimaChiave] = appEl.scrollTop;
            scrollTick = false;
          });
        }, { passive: true });
      }

      window.addEventListener('popstate', async event => {
        const stato = event.state;
        if (!stato?.le) return;

        if (!(await this.confermaUscitaFormCliente())) {
          const corrente = this.statoHistoryCorrente();

          history.pushState(
            corrente,
            '',
            location.href
          );

          this.historyUltimaChiave =
            this.chiaveHistory(corrente);

          return;
        }

        this.historyRipristino = true;

        try {
          if (stato.view === 'scheda' && stato.clienteId) {
            await this.apriScheda(stato.clienteId);

          } else if (stato.view === 'economia') {
            await this.apriEconomia(
              stato.modalitaEconomia || 'vendita'
            );

          } else {
            this.view = stato.view || (this.isAdmin ? 'admin' : 'lista');

            if (stato.view === 'agenda') {
              this.agendaVista = stato.agendaVista || 'oggi';
              this.agendaDataSelezionata =
                stato.agendaData || this.dataISOOggi();
              this.agendaMese =
                stato.agendaMese || this.dataISOOggi().slice(0, 7);
            }

            if (stato.view === 'pipeline') {
              this.pipelineIndice =
                Number(stato.pipelineIndice) || 0;
            }
          }

          this.historyUltimaChiave = this.chiaveHistory(stato);

          requestAnimationFrame(() => {
            const scrollSalvato = this.posizioniScroll[this.historyUltimaChiave] || 0;
            document.getElementById('app')?.scrollTo({
              top: scrollSalvato,
              behavior: 'auto'
            });
          });

        } finally {
          requestAnimationFrame(() => {
            this.historyRipristino = false;
          });
        }
      });
    },

    mostraToast(tipo, titolo, testo = '') {
      const id = ++this._toastId;
      this.toasts.push({ id, tipo, titolo, testo, uscita: false });
      window.setTimeout(() => this.chiudiToast(id), 3200);
    },

    chiudiToast(id) {
      const toast = this.toasts.find(t => t.id === id);
      if (!toast || toast.uscita) return;
      toast.uscita = true;
      window.setTimeout(() => {
        this.toasts = this.toasts.filter(t => t.id !== id);
      }, 200);
    },

    chiediConferma(messaggio, testoConferma = 'Conferma') {
      return new Promise(risolvi => {
        this.confermaGenerica = {
          aperto: true,
          messaggio,
          testoConferma,
          _risolvi: risolvi
        };
      });
    },

    rispondiConferma(esito) {
      const risolvi = this.confermaGenerica._risolvi;
      this.confermaGenerica = {
        aperto: false,
        messaggio: '',
        testoConferma: 'Conferma',
        _risolvi: null
      };
      if (risolvi) risolvi(esito);
    },

    async init() {
      if (window.__leAppInitDone) return;
      window.__leAppInitDone = true;

      this.applicaTema(this.temaPreferenza);

      this._temaMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this._temaMediaHandler = () => {
        if (this.temaPreferenza === 'system') {
          this.applicaTema('system');
        }
      };
      this._temaMediaQuery.addEventListener?.('change', this._temaMediaHandler);

      window.setTimeout(() => { this.avvioVisibile = false; }, 700);

      window.addEventListener('le:aggiornamento-pronto', () => {
        this.aggiornamentoDisponibile = true;
        this.aggiornamentoStato = 'disponibile';
      });

      window.addEventListener('le:aggiornamento-nessuno', () => {
        if (!this.aggiornamentoDisponibile) {
          this.aggiornamentoStato = 'aggiornato';
        }
      });

      window.addEventListener('le:aggiornamento-errore', () => {
        if (!this.aggiornamentoDisponibile) {
          this.aggiornamentoStato = 'errore';
        }
      });

      window.addEventListener('beforeunload', event => {
        if (
          !this.clienteFormModificato() &&
          !this.economiaFormModificato()
        ) return;

        event.preventDefault();
        event.returnValue = '';
      });

      window.addEventListener('keydown', event => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
          if (!this.cmdkDesktop()) return;
          event.preventDefault();
          this.cmdkAperta ? this.chiudiCmdk() : this.apriCmdk();
          return;
        }

        if (!this.cmdkAperta) return;

        if (event.key === 'Escape') {
          this.chiudiCmdk();
        } else if (event.key === 'ArrowDown') {
          event.preventDefault();
          this.muoviCmdk(1);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          this.muoviCmdk(-1);
        } else if (event.key === 'Enter') {
          event.preventDefault();
          this.confermaCmdk();
        }
      });

      this.sessione = await getSessioneCorrente();
      this.accountSlot = window.AccountSessions.getActiveSlot();
      await this.aggiornaStatoAccountSwitcher();

      if (this.sessione) {
        await this.dopoLogin();
        this.inizializzaHistoryNavigazione();
      } else {
        this.view = 'login';
      }
    },

    aggiornaApp() {
      this.aggiornamentoDisponibile = false;
      this.aggiornamentoStato = 'controllo';

      try {
        window.leAggiornaApp();
      } catch (err) {
        this.aggiornamentoStato = 'errore';
        console.error('Aggiornamento app non riuscito:', err);
      }
    },

    temaRisolto(preferenza = this.temaPreferenza) {
      if (preferenza === 'dark') return 'dark';
      if (preferenza === 'light') return 'light';

      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    },

    applicaTema(preferenza = this.temaPreferenza) {
      const valore = ['system', 'light', 'dark'].includes(preferenza)
        ? preferenza
        : 'system';

      this.temaPreferenza = valore;
      globalThis.localStorage?.setItem?.('le-theme', valore);

      const tema = this.temaRisolto(valore);

      document.documentElement.dataset.theme = tema;
      document.documentElement.dataset.themePreference = valore;
      document.documentElement.style.colorScheme = tema;

      const meta = document.getElementById('app-theme-color');
      if (meta) {
        meta.setAttribute(
          'content',
          tema === 'dark' ? '#111310' : '#F4F1EA'
        );
      }
    },

    impostaTema(preferenza) {
      this.applicaTema(preferenza);
    },

    async controllaAggiornamenti() {
      if (this.aggiornamentoDisponibile) {
        this.aggiornaApp();
        return;
      }

      this.aggiornamentoStato = 'controllo';

      try {
        await window.leControllaAggiornamenti();
      } catch {
        this.aggiornamentoStato = 'errore';
      }
    },

    etichettaAggiornamento() {
      if (this.aggiornamentoDisponibile || this.aggiornamentoStato === 'disponibile') {
        return 'Aggiornamento disponibile';
      }

      if (this.aggiornamentoStato === 'controllo') return 'Controllo...';
      if (this.aggiornamentoStato === 'errore') return 'Riprova';

      return 'App aggiornata';
    },

    async fareLogin() {
      if (this.accedendo) return;
      this.accedendo = true;
      this.erroreLogin = '';
      try {
        this.sessione = await login(this.emailInput, this.passwordInput);
        await this.dopoLogin();
      } catch (err) {
        this.erroreLogin = err.message;
      } finally {
        this.accedendo = false;
      }
    },

    async dopoLogin() {
      this.accountSlot = window.AccountSessions.getActiveSlot();

      const { data: profilo } = await window.supabaseClient
        .from('profili').select('nome,ruolo,username,avatar_url').eq('id', this.sessione.user.id).single();
      this.profilo = {
        nome: profilo?.nome || '',
        ruolo: profilo?.ruolo || 'venditore',
        username: profilo?.username || '',
        avatar_url: profilo?.avatar_url || ''
      };
      if (this.accountSlot === 'personale') {
        this.profiloPersonale = { ...this.profilo, email: this.sessione.user.email || '' };
      }
      this.profiloForm.username = this.profilo.username;
      this.avatarPosizione = posizioneAvatarDaUrl(this.profilo.avatar_url);
      this.avatarErrore = false;
      this.isAdmin = profilo?.ruolo === 'admin';
      this.filtroTesto = '';
      this.filtroStato = '';
      this.filtroSoloRitardo = false;

      if (this.isAdmin) { await this.caricaDashboardAdmin(); this.view = 'admin'; }
      else {
        await this.caricaClienti();
        await this.caricaStatisticheVenditore();
        this.view = 'lista';
      }

      // se il browser ha gia' una subscription da un login precedente sullo
      // stesso device, aggiornaStatoPush() la ritrova subito (getSubscription)
      // senza richiedere di nuovo il permesso.
      await this.aggiornaStatoAccountSwitcher();
      await this.aggiornaStatoPush();
    },

    async aggiornaStatoPush() {
      this.pushStato = await window.WebPush.statoAttuale();
    },

    async attivaPush() {
      if (this.pushInCorso || this.pushStato === 'attivo') return;
      this.pushInCorso = true;
      this.pushErrore = '';
      try {
        const esito = await window.WebPush.attiva();
        if (esito === 'denied') this.pushStato = 'bloccato';
        else if (esito === 'granted') this.pushStato = 'attivo';
        else await this.aggiornaStatoPush();
      } catch (err) {
        this.pushErrore = err.message;
        await this.aggiornaStatoPush();
      } finally {
        this.pushInCorso = false;
      }
    },

    async togglePush() {
      if (this.pushInCorso) return;

      if (this.pushStato !== 'attivo') {
        await this.attivaPush();
        return;
      }

      this.pushInCorso = true;
      this.pushErrore = '';

      try {
        await window.WebPush.disattivaSottoscrizioneCorrente();
        this.pushStato = 'inattivo';
      } catch (err) {
        this.pushErrore = err.message;
        await this.aggiornaStatoPush();
      } finally {
        this.pushInCorso = false;
      }
    },

    etichettaPush() {
      if (this.pushStato === 'non-supportato') return 'Notifiche non supportate';
      if (this.pushStato === 'bloccato') return 'Notifiche bloccate';
      if (this.pushStato === 'attivo') return 'Notifiche attive';
      return 'Attiva notifiche';
    },

    async vaiHome() {
      if (!(await this.confermaUscitaFormCliente())) return;

      /*
       * La Home deve riflettere sempre l'ultimo stato salvato nel DB.
       * Evita card obsolete dopo modifiche a servizi, contratto o cliente.
       */
      if (this.isAdmin) {
        await this.caricaDashboardAdmin();
        await this.caricaClienti();
      } else {
        await this.caricaClienti();
        await this.caricaStatisticheVenditore();
      }

      this.view = this.isAdmin ? 'admin' : 'lista';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    async vaiNuovoCliente() {
      if (this.isAdmin || !(await this.confermaUscitaFormCliente())) return;
      this.apriNuovoCliente();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    async apriAgenda() {
      if (!(await this.confermaUscitaFormCliente())) return;
      this.agendaVista = 'oggi';
      this.agendaDataSelezionata = this.dataISOOggi();
      this.agendaMese = this.dataISOOggi().slice(0, 7);
      this.view = 'agenda';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    async apriPipeline(stato) {
      if (!(await this.confermaUscitaFormCliente())) return;
      const indice = stato ? this.statiPipeline().findIndex(s => s.valore === stato) : 0;
      this.pipelineIndice = indice >= 0 ? indice : 0;
      this.view = 'pipeline';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    apriClienti() {
      this.filtroTesto = '';
      this.filtroStato = '';
      this.filtroSoloRitardo = false;
      this.ordinamento = 'creato_il';
      this.ordinamentoDesc = true;
      this.paginaClienti = 1;
      this.view = 'clienti';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    apriRicerca() {
      if (this.view !== 'ricerca') this.viewPrecedenteRicerca = this.view;
      this.ricercaGlobale = '';
      this.erroreRicerca = '';
      this.view = 'ricerca';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    tornaDaRicerca() {
      this.view = this.viewPrecedenteRicerca === 'clienti' ? 'clienti' : 'lista';
    },

    apriAssistente() {
      this.assistenteDomanda = '';
      this.view = 'assistente';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    domandeAssistente() {
      return globalThis.AssistenteLanding?.faq || [];
    },

    categorieAssistente() {
      return this.domandeAssistente().reduce((categorie, voce) => {
        let categoria = categorie.find(gruppo => gruppo.nome === voce.categoria);
        if (!categoria) {
          categoria = { nome: voce.categoria, voci: [] };
          categorie.push(categoria);
        }
        categoria.voci.push(voce);
        return categorie;
      }, []);
    },

    inviaDomandaAssistente(domanda = this.assistenteDomanda) {
      const testo = domanda.trim();
      if (!testo) return;

      this.assistenteMessaggi.push(
        { ruolo: 'utente', testo },
        { ruolo: 'bot', testo: globalThis.AssistenteLanding.rispondi(testo) }
      );
      this.assistenteDomanda = '';
      this.$nextTick(() => {
        const container = document.getElementById('app');
        container.scrollTop = container.scrollHeight;
      });
    },

    selezionaOperazioneIncasso(tipo) {
      if (tipo === 'previsto') {
        this.venditaEconomicaForm.statoIncasso = 'previsto';
        this.venditaEconomicaForm.importoIncassato = 0;
        this.venditaEconomicaForm.dataScadenza = '';
        this.pagamentoPrevistoId = null;
        return;
      }

      this.venditaEconomicaForm.statoIncasso = 'incassato';
      this.venditaEconomicaForm.dataPagamento =
        this.dataISOOggi();

      if (
        !(Number(this.venditaEconomicaForm.importoIncassato) > 0)
      ) {
        this.venditaEconomicaForm.importoIncassato =
          this.residuoCliente();
      }
    },

    usaResiduoIncasso() {
      this.venditaEconomicaForm.statoIncasso = 'incassato';
      this.venditaEconomicaForm.importoIncassato =
        this.residuoCliente();
    },

    async incassaRataPrevista(pagamento) {
      if (!pagamento?.id || !this.clienteEconomiaSelezionato) {
        return;
      }

      await this.apriPagamentoCliente(
        this.clienteEconomiaSelezionato,
        pagamento
      );
    },

    async apriPagamentoCliente(
      cliente = this.clienteSelezionato(),
      pagamentoPrevisto = null
    ) {
      if (!cliente?.id) return;

      await this.apriEconomia('incasso');

      this.clienteEconomiaSelezionato = cliente;
      this.pagamentoPrevistoId = pagamentoPrevisto?.id || null;

      this.venditeClienteIncasso = [];
      this.venditaIncassoSelezionataId = null;
      this.venditaEconomicaAttiva = null;
      this.venditaClienteAttiva = null;
      this.pagamentiCliente = [];
      this.costiVenditaRiferimento = [];
      this.caricandoVenditeIncasso = true;
      this.erroreEconomia = '';

      try {
        const { data, error } = await window.supabaseClient
          .from('vendite')
          .select(
            'id,cliente_id,servizio,importo_vendita,data_vendita,creato_il,applica_bonus_venditore'
          )
          .eq('cliente_id', cliente.id)
          .eq('stato', 'attiva')
          .order('data_vendita', { ascending: false })
          .order('creato_il', { ascending: false });

        if (error) {
          this.erroreEconomia =
            'Vendite non disponibili: ' + error.message;
          return;
        }

        this.venditeClienteIncasso = data || [];

        if (!this.venditeClienteIncasso.length) {
          this.erroreEconomia =
            'Nessuna vendita attiva per questo cliente.';
          return;
        }

        let venditaDaAprireId =
          pagamentoPrevisto?.vendita_id || null;

        // Alcuni ingressi legacy passano solo l'id della rata.
        if (!venditaDaAprireId && pagamentoPrevisto?.id) {
          const {
            data: pagamentoSalvato,
            error: errorePagamento
          } = await window.supabaseClient
            .from('pagamenti')
            .select('vendita_id')
            .eq('id', pagamentoPrevisto.id)
            .maybeSingle();

          if (errorePagamento) {
            this.erroreEconomia =
              'Rata prevista non disponibile: ' +
              errorePagamento.message;
            return;
          }

          venditaDaAprireId =
            pagamentoSalvato?.vendita_id || null;
        }

        // Una sola vendita: selezione automatica.
        if (
          !venditaDaAprireId &&
          this.venditeClienteIncasso.length === 1
        ) {
          venditaDaAprireId =
            this.venditeClienteIncasso[0].id;
        }

        // Più vendite: nessuna scelta arbitraria.
        if (venditaDaAprireId) {
          const esiste =
            this.venditeClienteIncasso.some(
              vendita => vendita.id === venditaDaAprireId
            );

          if (!esiste) {
            this.erroreEconomia =
              'La vendita collegata al pagamento non è più disponibile.';
            return;
          }

          await this.selezionaVenditaIncasso(
            venditaDaAprireId,
            pagamentoPrevisto
          );
        }
      } finally {
        this.caricandoVenditeIncasso = false;
      }

      this.view = 'economia';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    async selezionaVenditaIncasso(
      venditaId,
      pagamentoPrevisto = null
    ) {
      if (!venditaId) return;

      const vendita =
        this.venditeClienteIncasso.find(
          voce => voce.id === venditaId
        );

      if (!vendita) {
        this.erroreEconomia =
          'Vendita selezionata non disponibile.';
        return;
      }

      this.erroreEconomia = '';
      this.successoEconomia = '';

      this.venditaIncassoSelezionataId = vendita.id;
      this.venditaEconomicaAttiva = vendita;
      this.venditaClienteAttiva = vendita;

      /*
       * Stato operativo della singola rata:
       * non deve mai passare da una vendita all'altra.
       */
      this.venditaEconomicaForm.statoIncasso = 'incassato';
      this.venditaEconomicaForm.costiRata = [];
      this.venditaEconomicaForm.costoRataDescrizione = '';
      this.venditaEconomicaForm.costoRataImporto = null;
      this.venditaEconomicaForm.metodoPagamento = '';
      this.venditaEconomicaForm.notePagamento =
        pagamentoPrevisto?.note || '';
      this.venditaEconomicaForm.dataScadenza =
        pagamentoPrevisto?.data_scadenza || '';

      // Condizione economica consolidata alla registrazione della vendita:
      // non è un default del form, deve restare identica per ogni pagamento
      // di questa vendita.
      this.venditaEconomicaForm.applicaBonusVenditore =
        vendita.applica_bonus_venditore !== false;

      this.pagamentoPrevistoId =
        pagamentoPrevisto?.id || null;

      const [
        partecipantiResult,
        costiResult
      ] = await Promise.all([
        window.supabaseClient
          .from('vendita_partecipanti')
          .select(
            'profilo_id,ruolo,fa_fattura,modalita_fatturazione,importo_fatturato,quota_calcolata,quota_effettiva,quota_finale,quota_override,note_quota,saldato,data_saldo'
          )
          .eq('vendita_id', vendita.id),

        window.supabaseClient
          .from('costi_vendita')
          .select('descrizione,importo')
          .eq('vendita_id', vendita.id)
      ]);

      if (partecipantiResult.error) {
        this.erroreEconomia =
          'Partecipanti economici non disponibili: ' +
          partecipantiResult.error.message;
        return;
      }

      if (costiResult.error) {
        this.erroreEconomia =
          'Costi della vendita non disponibili: ' +
          costiResult.error.message;
        return;
      }

      const snapshotPartecipanti =
        partecipantiResult.data || [];

      this.costiVenditaRiferimento =
        (costiResult.data || []).map(costo => ({
          descrizione: costo.descrizione || 'Costo',
          importo: Number(costo.importo) || 0
        }));

      // I costi storici restano solo riferimento.
      this.venditaEconomicaForm.costi = [];

      this.venditaEconomicaForm.partecipanti =
        snapshotPartecipanti.map(partecipante => ({
          id: partecipante.profilo_id,

          nome:
            partecipante.ruolo === 'referente'
              ? 'Alessandro'
              : partecipante.ruolo === 'produzione'
                ? 'Tomas'
                : 'Venditore',

          ruolo: partecipante.ruolo,

          modalitaFatturazione:
            partecipante.modalita_fatturazione ||
            (partecipante.fa_fattura ? 'totale' : 'nessuna'),

          importoFatturato:
            Number(partecipante.importo_fatturato) || 0,

          faFattura:
            partecipante.modalita_fatturazione === 'totale' ||
            !!partecipante.fa_fattura,

          haVenduto: false,

          quotaOverride: !!partecipante.quota_override,

          quotaEffettiva:
            partecipante.quota_effettiva != null
              ? Number(partecipante.quota_effettiva)
              : Number(partecipante.quota_finale) || 0,

          quotaCalcolata:
            partecipante.quota_calcolata != null
              ? Number(partecipante.quota_calcolata)
              : Number(partecipante.quota_finale) || 0,

          noteQuota: partecipante.note_quota || '',
          saldato: !!partecipante.saldato,
          dataSaldo: partecipante.data_saldo || null,
          bloccato: true
        }));

      const referenteSnapshot =
        snapshotPartecipanti.find(
          partecipante =>
            partecipante.ruolo === 'referente'
        );

      if (referenteSnapshot) {
        this.venditaEconomicaForm.modalitaFatturazioneAdmin =
          referenteSnapshot.modalita_fatturazione ||
          (referenteSnapshot.fa_fattura ? 'totale' : 'nessuna');

        this.venditaEconomicaForm.importoFatturatoAdmin =
          Number(referenteSnapshot.importo_fatturato) || 0;
      }

      this.venditaEconomicaForm.clienteId =
        vendita.cliente_id;

      this.azzeraRicercaClienteEconomia();

      this.venditaEconomicaForm.servizio =
        vendita.servizio || '';

      this.venditaEconomicaForm.importoVendita =
        Number(vendita.importo_vendita) || 0;

      await this.caricaPagamentiCliente(
        vendita.cliente_id,
        vendita.id
      );

      this.venditaEconomicaForm.importoIncassato =
        pagamentoPrevisto
          ? Number(pagamentoPrevisto.importo) || 0
          : this.residuoCliente();

      this.venditaEconomicaForm.dataPagamento =
        this.dataISOOggi();

      this.venditaEconomicaForm.dataScadenza =
        pagamentoPrevisto?.data_scadenza || '';

      this.venditaEconomicaForm.notePagamento =
        pagamentoPrevisto?.note || '';

      this.aggiornaSnapshotEconomia();
    },

    apriIncasso() {
      return this.apriEconomia('incasso');
    },

    utenteCorrenteETomas() {
      const valori = [
        this.profilo.nome,
        this.profilo.username,
        this.sessione?.user?.email
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return valori.includes('tomas');
    },

    profiloEconomicoETomas(profilo) {
      return [profilo?.nome, profilo?.username]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes('tomas');
    },

    // Deriva la configurazione economica di una rata dalla configurazione
    // CONSOLIDATA della vendita (modalità di fatturazione, importo fatturato,
    // quota override), scalando gli importi assoluti nella stessa proporzione
    // importoRata/importoVendita. Non permette di ridefinire chi fattura o
    // le quote per il singolo pagamento: quelle restano decise alla
    // registrazione della vendita (vedi PROBLEMA 2 - Incassa non deve
    // modificare la configurazione economica della vendita).
    derivaPartecipantiRataDaConsolidato(
      partecipantiConsolidati,
      importoRata,
      importoVenditaTotale
    ) {
      const engine = economicEngineApi();
      const arrotonda = engine?.arrotonda ||
        (n => Math.round((Number(n) || 0) * 100) / 100);

      const fattore = importoVenditaTotale > 0
        ? importoRata / importoVenditaTotale
        : 0;

      return (partecipantiConsolidati || []).map(partecipante => {
        const referente = partecipante.ruolo === 'referente';

        const modalita =
          ['totale', 'mista', 'nessuna'].includes(
            partecipante.modalitaFatturazione
          )
            ? partecipante.modalitaFatturazione
            : 'nessuna';

        // Per i collaboratori l'importo fatturato al referente in modalità
        // "mista" è calcolato in automatico dal motore economico: qui serve
        // solo per il referente, che fattura davvero il cliente e la cui
        // parte fatturata va scalata sulla singola rata.
        let importoFatturato = 0;

        if (modalita === 'totale') {
          importoFatturato = importoRata;
        } else if (modalita === 'mista' && referente) {
          importoFatturato = arrotonda(
            (Number(partecipante.importoFatturato) || 0) * fattore
          );
        }

        return {
          ...partecipante,
          modalitaFatturazione: modalita,
          importoFatturato,

          quotaOverride:
            referente ? false : !!partecipante.quotaOverride,

          quotaEffettiva:
            referente || !partecipante.quotaOverride
              ? null
              : arrotonda(
                  (Number(partecipante.quotaEffettiva) || 0) * fattore
                )
        };
      });
    },

costiPerMotoreRataEconomia(
  costiVendita = this.costiVenditaRiferimento
) {
  const importoVendita =
    Number(this.venditaEconomicaForm.importoVendita) || 0;
  const importoRata =
    Number(this.venditaEconomicaForm.importoIncassato) || 0;
  const fattore = importoVendita > 0
    ? Math.min(1, importoRata / importoVendita)
    : 0;

  const proporzionali = (costiVendita || [])
    .map(costo => ({
      descrizione:
        (costo.descrizione || '').trim() || 'Costo vendita',
      importo:
        Math.round(
          Math.max(0, Number(costo.importo) || 0) * fattore * 100
        ) / 100
    }));

  return [
    ...proporzionali,
    ...(this.venditaEconomicaForm.costiRata || [])
  ]
    .map(costo => ({
      descrizione:
        (costo.descrizione || '').trim() || 'Costo',
      importo: Math.max(0, Number(costo.importo) || 0)
    }))
    .filter(costo => costo.importo > 0);
},

    navVisibile() {
      return !!this.sessione && [
        'lista',
        'clienti',
        'admin',
        'nuovo',
        'profilo',
        'agenda',
        'pipeline',
        'ricerca',
        'assistente',
        'economia'
      ].includes(this.view);
    },

    swipeStart(event) {
      if (event.touches?.length !== 1) return;

      // Con un popup aperto (anagrafica cliente, azioni rapide +, conferma eliminazione)
      // lo swipe-back non deve intercettare il tocco: bloccava scroll, tap e chiusura del popup.
      if (
        this.anagraficaEconomiaAperta ||
        this.menuAzioneAperto ||
        this.clienteAzioniRapideId ||
        this.confermaEliminazione
      ) return;

      const target = event.target;
      if (target.closest(
        '.economy-modal-overlay, .quick-action-overlay, .modal-overlay, .mobile-tabbar, input, textarea, select, [contenteditable="true"]'
      )) return;

      const touch = event.touches[0];
      const isBackView = this.vistaSupportaSwipeIndietro();
      const isForwardView = this.vistaSupportaSwipeAvanti();

      // Lo swipe-back parte dal bordo sinistro, come nelle app native.
      if (isBackView && touch.clientX > 42) return;

      // Home -> Profilo può partire dalla parte destra dello schermo.
      if (isForwardView && touch.clientX < window.innerWidth * 0.55) return;

      this.swipeStartX = touch.clientX;
      this.swipeStartY = touch.clientY;
      this.swipeLastX = touch.clientX;
      this.swipeStartedAt = performance.now();
      this.swipeTracking = true;
      this.swipeDirection = null;
      this.swipeElement = target.closest('.app-main-view');

      if (this.swipeElement) {
        this.swipeElement.classList.add('gesture-dragging');
      }
    },

    swipeMove(event) {
      if (!this.swipeTracking || this.swipeStartX == null || this.swipeStartY == null) return;
      const touch = event.touches?.[0];
      if (!touch) return;

      const dx = touch.clientX - this.swipeStartX;
      const dy = touch.clientY - this.swipeStartY;

      if (!this.swipeDirection) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;

        if (Math.abs(dy) > Math.abs(dx)) {
          this.resetSwipeGesture();
          return;
        }

        this.swipeDirection = dx >= 0 ? 'right' : 'left';

        const allowedRight = this.vistaSupportaSwipeIndietro();
        const allowedLeft = this.vistaSupportaSwipeAvanti();

        if (
          (this.swipeDirection === 'right' && !allowedRight) ||
          (this.swipeDirection === 'left' && !allowedLeft)
        ) {
          this.resetSwipeGesture();
          return;
        }
      }

      event.preventDefault();
      this.swipeLastX = touch.clientX;

      if (!this.swipeElement) return;

      let movement = dx;

      if (this.swipeDirection === 'right') {
        movement = Math.max(0, dx);
      } else {
        movement = Math.min(0, dx);
      }

      const max = window.innerWidth;
      const translated = Math.max(-max, Math.min(max, movement));
      const progress = Math.min(1, Math.abs(translated) / max);

      this.swipeElement.style.transition = 'none';
      this.swipeElement.style.transform = `translate3d(${translated}px,0,0)`;
      this.swipeElement.style.boxShadow =
        this.swipeDirection === 'right'
          ? `-12px 0 28px rgba(0,0,0,${0.05 + progress * 0.13})`
          : `12px 0 28px rgba(0,0,0,${0.05 + progress * 0.13})`;
    },

    swipeEnd(event) {
      if (!this.swipeTracking || this.swipeStartX == null) {
        this.resetSwipeGesture();
        return;
      }

      const touch = event.changedTouches?.[0];
      const endX = touch?.clientX ?? this.swipeLastX ?? this.swipeStartX;
      const dx = endX - this.swipeStartX;
      const elapsed = Math.max(1, performance.now() - this.swipeStartedAt);
      const velocity = Math.abs(dx) / elapsed;

      const complete =
        Math.abs(dx) >= Math.min(120, window.innerWidth * 0.28) ||
        (Math.abs(dx) > 55 && velocity > 0.55);

      if (!complete || !this.swipeDirection) {
        this.animateSwipeBack();
        return;
      }

      this.completeSwipeGesture(this.swipeDirection);
    },

    swipeCancel() {
      this.animateSwipeBack();
    },

    animateSwipeBack() {
      const el = this.swipeElement;

      if (!el) {
        this.resetSwipeGesture();
        return;
      }

      el.style.transition = 'transform 220ms cubic-bezier(.22,.61,.36,1), box-shadow 220ms ease';
      el.style.transform = 'translate3d(0,0,0)';
      el.style.boxShadow = 'none';

      window.setTimeout(() => this.resetSwipeGesture(), 230);
    },

    completeSwipeGesture(direction) {
      const el = this.swipeElement;
      const targetX = direction === 'right' ? window.innerWidth : -window.innerWidth;

      if (!el) {
        this.eseguiNavigazioneGesture(direction);
        this.resetSwipeGesture();
        return;
      }

      el.style.transition = 'transform 180ms cubic-bezier(.22,.61,.36,1), box-shadow 180ms ease';
      el.style.transform = `translate3d(${targetX}px,0,0)`;
      el.style.boxShadow = 'none';

      window.setTimeout(() => {
        this.eseguiNavigazioneGesture(direction);
        this.resetSwipeGesture();
        window.scrollTo({ top: 0, behavior: 'auto' });
      }, 170);
    },

    vistaSupportaSwipeIndietro() {
      return [
        'profilo', 'cestino', 'scheda', 'nuovo', 'agenda',
        'pipeline', 'ricerca', 'assistente', 'clienti', 'economia'
      ].includes(this.view) || (
        this.view === 'lista' && this.isAdmin && this.filtroVenditoreId
      );
    },

    vistaSupportaSwipeAvanti() {
      return this.view === 'admin' || (
        this.view === 'lista' && !(this.isAdmin && this.filtroVenditoreId)
      );
    },

    eseguiNavigazioneGesture(direction) {
      if (direction === 'left') {
        this.apriProfilo();
        return;
      }

      if (this.view === 'lista' && this.isAdmin && this.filtroVenditoreId) {
        this.tornaAllaDashboard();
      } else if (this.view === 'profilo' || this.view === 'economia') {
        this.vaiHome();
      } else if (this.view === 'cestino') {
        this.apriProfilo();
      } else if (['agenda', 'pipeline', 'clienti'].includes(this.view)) {
        this.vaiHome();
      } else if (this.view === 'ricerca') {
        this.tornaDaRicerca();
      } else if (this.view === 'assistente') {
        this.vaiHome();
      } else if (this.view === 'scheda') {
        this.tornaDaScheda();
      } else if (this.view === 'nuovo') {
        this.annullaFormCliente();
      }
    },

    resetSwipeGesture() {
      if (this.swipeElement) {
        this.swipeElement.classList.remove('gesture-dragging');
        this.swipeElement.style.transition = '';
        this.swipeElement.style.transform = '';
        this.swipeElement.style.boxShadow = '';
      }

      this.swipeStartX = null;
      this.swipeStartY = null;
      this.swipeLastX = null;
      this.swipeStartedAt = 0;
      this.swipeTracking = false;
      this.swipeDirection = null;
      this.swipeElement = null;
    },

    async apriProfilo() {
      if (!(await this.confermaUscitaFormCliente())) return;
      this.profiloErrore = '';
      this.profiloForm.username = this.profilo.username || '';
      this.view = 'profilo';
    },

    iniziaPressioneProfilo() {
      this.pressioneProfiloLunga = false;
      clearTimeout(this.pressioneProfiloTimer);
      this.pressioneProfiloTimer = setTimeout(async () => {
        this.pressioneProfiloLunga = true;
        await this.apriAccountSwitcher();
      }, 500);
    },

    terminaPressioneProfilo() {
      clearTimeout(this.pressioneProfiloTimer);
      this.pressioneProfiloTimer = null;
    },

    apriProfiloDaNav() {
      if (this.pressioneProfiloLunga) {
        this.pressioneProfiloLunga = false;
        return;
      }
      this.apriProfilo();
    },

    tornaDaProfilo() {
      this.view = this.isAdmin ? 'admin' : 'lista';
    },

    inizialeProfilo() {
      const s = this.profilo.username || this.profilo.nome || this.sessione?.user?.email || '?';
      return s.trim().charAt(0).toUpperCase();
    },

    avatarStile(posizione = this.avatarPosizione) {
      const x = Number.isFinite(Number(posizione.x)) ? Number(posizione.x) : 50;
      const y = Number.isFinite(Number(posizione.y)) ? Number(posizione.y) : 50;
      const zoom = Number(posizione.zoom) || 1;

      return [
        'width:100%',
        'height:100%',
        'object-fit:cover',
        `object-position:${x}% ${y}%`,
        `transform:scale(${zoom})`,
        `transform-origin:${x}% ${y}%`
      ].join(';');
    },

    avatarPersonaleStile() {
      return this.avatarStile(posizioneAvatarDaUrl(this.profiloPersonale.avatar_url));
    },

    avatarCustomProps(posizione = this.avatarPosizione) {
      const x = Number.isFinite(Number(posizione.x)) ? Number(posizione.x) : 50;
      const y = Number.isFinite(Number(posizione.y)) ? Number(posizione.y) : 50;
      const zoom = Number(posizione.zoom) || 1;
      return `--avatar-x:${x}%;--avatar-y:${y}%;--avatar-zoom:${zoom}`;
    },

    avatarPersonaleCustomProps() {
      return this.avatarCustomProps(posizioneAvatarDaUrl(this.profiloPersonale.avatar_url));
    },

    inizialeProfiloPersonale() {
      const s = this.profiloPersonale.username || this.profiloPersonale.nome || 'Personale';
      return s.trim().charAt(0).toUpperCase();
    },

    iniziaRitaglioAvatar(event) {
      event.currentTarget.setPointerCapture(event.pointerId);
      this.avatarTrascinamento = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        x: this.avatarPosizione.x,
        y: this.avatarPosizione.y
      };
    },

    spostaRitaglioAvatar(event) {
      const start = this.avatarTrascinamento;
      if (!start || start.pointerId !== event.pointerId) return;
      const rect = event.currentTarget.getBoundingClientRect();
      this.avatarPosizione.x = Math.max(0, Math.min(100, start.x - ((event.clientX - start.clientX) / rect.width * 100)));
      this.avatarPosizione.y = Math.max(0, Math.min(100, start.y - ((event.clientY - start.clientY) / rect.height * 100)));
    },

    terminaRitaglioAvatar() {
      this.avatarTrascinamento = null;
    },

    async salvaProfilo() {
      if (this.profiloSalvando) return;
      this.profiloSalvando = true;
      this.profiloErrore = '';
      try {
        const username = (this.profiloForm.username || '').trim();
        if (username && username.length < 3) {
          this.profiloErrore = "L'username deve avere almeno 3 caratteri.";
          return;
        }
        const avatarUrl = avatarUrlConPosizione(
          this.profilo.avatar_url,
          this.avatarPosizione.x,
          this.avatarPosizione.y,
          this.avatarPosizione.zoom
        );
        const { error } = await window.supabaseClient.rpc('update_my_profile', {
          p_username: username || null,
          p_avatar_url: avatarUrl || null
        });
        if (error) {
          this.profiloErrore = error.message.includes('duplicate') ? 'Username gia utilizzato.' : 'Profilo non salvato: ' + error.message;
          return;
        }
        this.profilo.username = username;
        this.profilo.avatar_url = avatarUrl;
        this.profiloPersonale = { ...this.profilo, email: this.sessione.user.email || '' };
        this.modificaInquadraturaAperta = false;
        this.modificaProfiloAperta = false;
        this.mostraToast('success', 'Profilo aggiornato');
      } finally {
        this.profiloSalvando = false;
      }
    },

    async caricaAvatar(event) {
      const file = event.target.files?.[0];
      if (!file || this.avatarCaricando) return;
      if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
        this.profiloErrore = 'Formato immagine non supportato.';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        this.profiloErrore = 'Immagine troppo grande: massimo 5 MB.';
        return;
      }

      this.avatarCaricando = true;
      this.profiloErrore = '';
      try {
        const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `${this.sessione.user.id}/avatar.${ext}`;
        const { error: uploadError } = await window.supabaseClient.storage
          .from('profile-avatars')
          .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });
        if (uploadError) {
          this.profiloErrore = 'Foto non caricata: ' + uploadError.message;
          return;
        }
        const { data } = window.supabaseClient.storage.from('profile-avatars').getPublicUrl(path);
        this.avatarPosizione = { x: 50, y: 50, zoom: 1 };
        const avatarUrl = avatarUrlConPosizione(`${data.publicUrl}?v=${Date.now()}`);
        const { error: saveError } = await window.supabaseClient.rpc('update_my_profile', {
          p_username: (this.profiloForm.username || '').trim() || null,
          p_avatar_url: avatarUrl
        });
        if (saveError) {
          this.profiloErrore = 'Profilo non aggiornato: ' + saveError.message;
          return;
        }
        this.profilo.avatar_url = avatarUrl;
        this.profilo.username = (this.profiloForm.username || '').trim();
        this.profiloPersonale = { ...this.profilo, email: this.sessione.user.email || '' };
        this.avatarErrore = false;
        this.modificaInquadraturaAperta = true;
      } finally {
        this.avatarCaricando = false;
        event.target.value = '';
      }
    },

    async rimuoviAvatar() {
      if (!this.profilo.avatar_url || this.profiloSalvando) return;
      this.profiloSalvando = true;
      this.profiloErrore = '';
      try {
        const { error } = await window.supabaseClient.rpc('update_my_profile', {
          p_username: (this.profiloForm.username || '').trim() || null,
          p_avatar_url: null
        });
        if (error) {
          this.profiloErrore = 'Foto non rimossa: ' + error.message;
          return;
        }
        this.profilo.avatar_url = '';
        this.profiloPersonale = { ...this.profilo, email: this.sessione.user.email || '' };
        this.avatarPosizione = { x: 50, y: 50, zoom: 1 };
        this.modificaInquadraturaAperta = false;
        this.avatarErrore = false;
      } finally {
        this.profiloSalvando = false;
      }
    },

    async aggiornaStatoAccountSwitcher() {
      const [personale, admin] = await Promise.all([
        sessioneAccount('personale'),
        sessioneAccount('admin')
      ]);

      this.personaleSessioneDisponibile = Boolean(personale);
      this.adminSessioneDisponibile = Boolean(admin);

      if (personale) {
        const { data } = await window.AccountSessions.getClient('personale')
          .from('profili')
          .select('nome,ruolo,username,avatar_url')
          .eq('id', personale.user.id)
          .single();
        if (data) this.profiloPersonale = { ...data, email: personale.user.email || '' };
      }
    },

    async apriAccountSwitcher() {
      this.adminLoginErrore = '';
      this.adminPasswordInput = '';
      this.mostraLoginAdmin = false;
      await this.aggiornaStatoAccountSwitcher();
      this.accountSwitcherAperto = true;
    },

    chiudiAccountSwitcher() {
      if (this.accountSwitchInCorso || this.adminLoginInCorso) return;
      this.accountSwitcherAperto = false;
      this.adminPasswordInput = '';
      this.adminLoginErrore = '';
      this.mostraLoginAdmin = false;
    },

    resetStatoCambioAccount() {
      this.clienti = [];
      this.cestino = [];
      this.note = [];
      this.venditaClienteAttiva = null;
      this.pagamentiCliente = [];
      this.scadenzePagamentoPerCliente = {};
      this.venditori = [];
      this.indiceNoteRicerca = [];
      this.clienteSelezionatoId = null;
      this.filtroVenditoreId = '';
      this.filtroVenditoreNome = '';
      this.filtroTesto = '';
      this.filtroStato = '';
      this.filtroSoloRitardo = false;
      this.erroreClienti = '';
      this.erroreAdmin = '';
      this.erroreScheda = '';
      this.pushErrore = '';
    },

    async validaAccountAdmin(sessione) {
      if (!sessione?.user) {
        throw new Error('Sessione admin non valida.');
      }

      if (
        String(sessione.user.email || '').toLowerCase()
        !== this.adminEmail.toLowerCase()
      ) {
        throw new Error(
          'Questo accesso non corrisponde all’account admin Landing Evolution.'
        );
      }

      const clientAdmin = window.AccountSessions.getClient('admin');
      const { data: profilo, error } = await clientAdmin
        .from('profili')
        .select('ruolo')
        .eq('id', sessione.user.id)
        .single();

      if (error) throw error;

      if (profilo?.ruolo !== 'admin') {
        throw new Error(
          'L’account info@landingevolution.it non risulta configurato come admin.'
        );
      }
    },

    async collegaAccountAdmin() {
      if (this.adminLoginInCorso) return;

      this.adminLoginErrore = '';

      if (!this.adminPasswordInput) {
        this.adminLoginErrore = 'Inserisci la password dell’account admin.';
        return;
      }

      this.adminLoginInCorso = true;

      try {
        const sessione = await loginAccount(
          'admin',
          this.adminEmail,
          this.adminPasswordInput
        );

        try {
          await this.validaAccountAdmin(sessione);
        } catch (error) {
          await logoutAccount('admin');
          throw error;
        }

        this.adminSessioneDisponibile = true;
        this.adminPasswordInput = '';

        await this.cambiaAccountRapido('admin');
      } catch (error) {
        this.adminLoginErrore = error.message;
      } finally {
        this.adminLoginInCorso = false;
      }
    },

    async cambiaAccountRapido(slot) {
      if (this.accountSwitchInCorso) return;
      if (!(await this.confermaUscitaFormCliente())) return;

      if (slot === this.accountSlot) {
        this.accountSwitcherAperto = false;
        return;
      }

      this.accountSwitchInCorso = true;
      this.adminLoginErrore = '';

      try {
        const sessione = await cambiaAccount(slot);

        if (!sessione) {
          this.adminLoginErrore =
            slot === 'admin'
              ? 'Accedi una volta all’account admin per abilitarne lo switch rapido.'
              : 'La sessione personale non è più disponibile.';
          return;
        }

        if (slot === 'admin') {
          await this.validaAccountAdmin(sessione);
        }

        this.resetStatoCambioAccount();
        this.sessione = sessione;
        this.accountSlot = slot;
        this.accountSwitcherAperto = false;

        await this.dopoLogin();
        window.scrollTo({ top: 0, behavior: 'auto' });
      } catch (error) {
        this.adminLoginErrore = error.message;
      } finally {
        this.accountSwitchInCorso = false;
        await this.aggiornaStatoAccountSwitcher();
      }
    },

    async fareLogout() {
      if (!(await this.confermaUscitaFormCliente())) return;
      const slotUscente = this.accountSlot;

      if (slotUscente === 'personale') {
        try {
          await window.WebPush.disattivaSottoscrizioneCorrente();
        } catch (err) {
          console.warn(
            'Disattivazione notifiche push fallita al logout:',
            err
          );
        }
      }

      await logoutAccount(slotUscente);
      await this.aggiornaStatoAccountSwitcher();

      const altroSlot = slotUscente === 'admin' ? 'personale' : 'admin';
      const altraSessione = await cambiaAccount(altroSlot);

      if (altraSessione) {
        this.resetStatoCambioAccount();
        this.sessione = altraSessione;
        this.accountSlot = altroSlot;
        await this.dopoLogin();
        return;
      }

      this.sessione = null;
      this.accountSlot = 'personale';
      window.AccountSessions.setActiveSlot('personale');
      this.view = 'login';
    },

    async caricaClienti() {
      this.erroreClienti = '';
      this.caricandoClienti = true;
      let query = window.supabaseClient.from('clienti').select('*')
        .is('cancellato_il', null)
        .order('prossimo_contatto', { ascending: true, nullsFirst: false })
        .order('creato_il', { ascending: false });
      const venditoreId = filtroVenditoreClienti(
        this.isAdmin,
        this.filtroVenditoreId
      );
      const usaAttribuzioneCondivisa = venditoreId &&
        Object.prototype.hasOwnProperty.call(this.adminClientiPerVenditore, venditoreId);
      if (venditoreId && !usaAttribuzioneCondivisa) {
        query = query.eq('venditore_id', venditoreId);
      }
      const { data, error } = await query;
      if (error) {
        this.erroreClienti = 'Errore nel caricare i clienti: ' + error.message;
        this.caricandoClienti = false;
        return;
      }
      const idsAttribuiti = new Set(this.adminClientiPerVenditore[venditoreId] || []);
      this.clienti = usaAttribuzioneCondivisa
        ? data.filter(cliente => idsAttribuiti.has(cliente.id))
        : data;
      this.caricandoClienti = false;
      await Promise.all([
        this.caricaIndiceNoteRicerca(),
        this.caricaScadenzePagamentoClienti()
      ]);
    },

    async caricaIndiceNoteRicerca() {
      this.indiceNoteRicerca = [];
      if (!this.clienti.length) return;

      const ids = this.clienti.map(c => c.id);
      const { data, error } = await window.supabaseClient
        .from('note')
        .select('cliente_id,testo')
        .in('cliente_id', ids);

      if (error) {
        console.warn('Indice ricerca note non disponibile:', error.message);
        return;
      }

      this.indiceNoteRicerca = data || [];
    },

    async caricaScadenzePagamentoClienti() {
      this.scadenzePagamentoPerCliente = {};
      this.riepilogoPagamentiPerCliente = {};
      this.pacchettoVenditaPerCliente = {};

      const clienteIds = this.clienti.map(cliente => cliente.id).filter(Boolean);
      if (!clienteIds.length) return;

      const { data: vendite, error: venditeError } = await window.supabaseClient
        .from('vendite')
        .select('id,cliente_id,importo_vendita,servizio,configurazione_commerciale,data_vendita,creato_il')
        .in('cliente_id', clienteIds)
        .eq('stato', 'attiva');

      if (venditeError) {
        console.warn('Scadenze pagamento non disponibili:', venditeError.message);
        return;
      }

      const venditePerId = Object.fromEntries(
        (vendite || []).map(vendita => [vendita.id, vendita])
      );

      const clientiConVenditaAttiva = new Set(
        (vendite || []).map(vendita => vendita.cliente_id)
      );

      // La vendita attiva e' la fonte di verita' commerciale piu' recente:
      // un cliente creato "al volo" prima di registrare la vendita non ha
      // mai nome_pacchetto/periodicita_contratto valorizzati sulla sua riga.
      this.pacchettoVenditaPerCliente = Object.fromEntries(
        (vendite || []).map(vendita => [
          vendita.cliente_id,
          {
            venditaId: vendita.id,
            nomePacchetto:
              (vendita.servizio || '').trim() || null,
            configurazioneCommerciale:
              vendita.configurazione_commerciale &&
              typeof vendita.configurazione_commerciale === 'object'
                ? vendita.configurazione_commerciale
                : null,
            importoVendita: Number(vendita.importo_vendita) || 0,
            periodicitaContratto:
              vendita.configurazione_commerciale?.periodicita_contratto ||
              vendita.configurazione_commerciale?.formula ||
              null,
            durataContrattoAnni:
              Number(
                vendita.configurazione_commerciale
                  ?.durata_contratto_anni
              ) || null,
            dataVendita:
              this.normalizzaDataAgenda(
                vendita.data_vendita || vendita.creato_il
              )
          }
        ])
      );

      this.clienti = this.clienti.map(cliente => ({
        ...cliente,
        haVenditaAttiva: clientiConVenditaAttiva.has(cliente.id)
      }));

      const riepiloghi = {};

      (vendite || []).forEach(vendita => {
        const clienteId = vendita.cliente_id;
        if (!clienteId) return;

        const riepilogo = riepiloghi[clienteId] ||= {
          numeroVendite: 0,
          totaleVendite: 0,
          incassato: 0,
          rateIncassate: 0,
          ratePreviste: 0,
          percentualeIncassata: 0
        };

        riepilogo.numeroVendite += 1;
        riepilogo.totaleVendite +=
          Number(vendita.importo_vendita) || 0;
      });

      const venditaIds = Object.keys(venditePerId);

      if (!venditaIds.length) {
        this.riepilogoPagamentiPerCliente = riepiloghi;
        return;
      }

      const { data: pagamenti, error: pagamentiError } =
        await window.supabaseClient
          .from('pagamenti')
          .select(
            'id,vendita_id,importo,stato,data_scadenza,data_pagamento'
          )
          .in('vendita_id', venditaIds);

      if (pagamentiError) {
        console.warn(
          'Pagamenti clienti non disponibili:',
          pagamentiError.message
        );
        this.riepilogoPagamentiPerCliente = riepiloghi;
        return;
      }

      const prossime = {};

      (pagamenti || []).forEach(pagamento => {
        const vendita = venditePerId[pagamento.vendita_id];
        const clienteId = vendita?.cliente_id;
        if (!clienteId) return;

        const riepilogo = riepiloghi[clienteId];
        if (!riepilogo) return;

        if (pagamento.stato === 'incassato') {
          riepilogo.incassato += Number(pagamento.importo) || 0;
          riepilogo.rateIncassate += 1;
          return;
        }

        if (pagamento.stato !== 'previsto') return;

        riepilogo.ratePreviste += 1;

        const data =
          this.normalizzaDataAgenda(pagamento.data_scadenza);

        if (!data) return;

        (prossime[clienteId] ||= []).push({
          id: pagamento.id,
          tipo: 'rata',
          label: 'Rata',
          data,
          importo: Number(pagamento.importo) || 0
        });
      });

      Object.values(riepiloghi).forEach(riepilogo => {
        riepilogo.percentualeIncassata =
          riepilogo.totaleVendite > 0
            ? Math.max(
                0,
                Math.min(
                  100,
                  riepilogo.incassato /
                    riepilogo.totaleVendite *
                    100
                )
              )
            : 0;
      });

      Object.values(prossime).forEach(rate => {
        rate.sort((a, b) => a.data.localeCompare(b.data));
      });

      this.scadenzePagamentoPerCliente = prossime;
      this.riepilogoPagamentiPerCliente = riepiloghi;
    },

    riepilogoContrattoCliente(cliente) {
      const vendita =
        this.pacchettoVenditaPerCliente[cliente?.id] || null;

      const durataVendita =
        Number(vendita?.durataContrattoAnni) || 0;

      const durataCliente =
        Number(cliente?.durata_contratto_anni) || 0;

      const durataContrattoAnni =
        durataVendita > 0
          ? durataVendita
          : durataCliente > 0
            ? durataCliente
            : null;

      const periodicitaContratto =
        vendita?.periodicitaContratto ||
        cliente?.periodicita_contratto ||
        null;

      const importoVendita =
        Number(vendita?.importoVendita) || 0;

      /*
       * Le vendite nuove salvano l'importo complessivo del contratto.
       * Per la Home mostriamo il valore annuale medio del contratto,
       * senza ricostruirlo dal catalogo prezzi corrente.
       */
      const valoreAnnuale =
        importoVendita > 0
          ? importoVendita /
            Math.max(1, durataContrattoAnni || 1)
          : valoreAnnualeCliente(cliente);

      return {
        venditaId: vendita?.venditaId || null,
        valoreAnnuale,
        periodicitaContratto,
        durataContrattoAnni,
        dataVendita:
          vendita?.dataVendita ||
          this.normalizzaDataAgenda(cliente?.data_attivazione) ||
          this.normalizzaDataAgenda(cliente?.creato_il)
      };
    },

    rinnovoCalcolatoCliente(
      cliente,
      oggiIso = this.dataISOOggi()
    ) {
      const esplicito =
        this.normalizzaDataAgenda(cliente?.data_rinnovo);

      /*
       * Una scadenza salvata esplicitamente resta prioritaria:
       * preserva storico e compatibilità legacy.
       */
      if (esplicito) return esplicito;

      const contratto =
        this.riepilogoContrattoCliente(cliente);

      const periodicita =
        contratto.periodicitaContratto;

      if (
        !['mensile', 'annuale'].includes(periodicita)
      ) {
        return null;
      }

      const dataBase =
        this.normalizzaDataAgenda(cliente?.data_attivazione) ||
        contratto.dataVendita ||
        this.normalizzaDataAgenda(cliente?.creato_il);

      if (!dataBase) return null;

      return this.calcolaProssimoRinnovo(
        dataBase,
        periodicita,
        oggiIso
      );
    },

    riepilogoPagamentoListaCliente(cliente) {
      const riepilogo = this.riepilogoPagamentiPerCliente[cliente?.id] || {
        numeroVendite: 0,
        totaleVendite: 0,
        incassato: 0,
        rateIncassate: 0,
        ratePreviste: 0,
        percentualeIncassata: 0
      };
      /*
       * Il valore annuale serve solo alla label VALORE ANNUALE.
       * L'avanzamento incassi deve invece usare il valore complessivo
       * della vendita attiva, altrimenti un contratto pluriennale
       * risulterebbe saldato troppo presto.
       */
      const vendita =
        this.pacchettoVenditaPerCliente[
          cliente?.id
        ] || null;

      const totaleVenditaAttiva =
        Number(vendita?.importoVendita) || 0;

      const totaleAnnualeLegacy =
        Number(
          this.riepilogoContrattoCliente(cliente)
            .valoreAnnuale
        ) || 0;

      const totaleVendite =
        totaleVenditaAttiva ||
        totaleAnnualeLegacy ||
        Number(riepilogo.totaleVendite) ||
        0;

      return {
        ...riepilogo,
        totaleVendite,
        percentualeIncassata: totaleVendite > 0
          ? Math.max(0, Math.min(100, riepilogo.incassato / totaleVendite * 100))
          : 0
      };
    },

    etichettaDurataContrattoCliente(cliente) {
      const durata =
        Number(
          this.riepilogoContrattoCliente(cliente)
            .durataContrattoAnni
        );

      if (!(durata > 0)) return '-';

      return durata === 1
        ? '1 anno'
        : `${durata} anni`;
    },

    etichettaPeriodicitaContrattoCliente(cliente) {
      const periodicita =
        this.riepilogoContrattoCliente(cliente)
          .periodicitaContratto;

      if (periodicita === 'mensile') {
        return 'Mensile';
      }

      if (periodicita === 'annuale') {
        return 'Annuale';
      }

      return 'Non indicata';
    },

    // La vendita attiva e' la fonte piu' recente: un cliente creato "al
    // volo" prima di registrare la vendita non ha mai nome_pacchetto
    // valorizzato sulla sua riga, solo sulla vendita collegata.
    etichettaPacchettoCliente(cliente) {
      const vendita =
        this.pacchettoVenditaPerCliente[
          cliente?.id
        ] || null;

      const fallbackVendita =
        String(vendita?.nomePacchetto || '').trim();

      const fallbackCliente =
        String(cliente?.nome_pacchetto || '').trim();

      const fallback =
        fallbackVendita ||
        fallbackCliente ||
        'Pacchetto non specificato';

      if (
        vendita?.configurazioneCommerciale &&
        typeof this.descrizioneConfigurazioneCommerciale ===
          'function'
      ) {
        return (
          this.descrizioneConfigurazioneCommerciale(
            vendita.configurazioneCommerciale,
            fallback,
            true
          ) ||
          fallback
        );
      }

      return fallback;
    },

    etichettaProssimaScadenzaCard(cliente) {
      const scadenza = this.prossimaScadenzaCliente(cliente);

      if (!scadenza) return 'Nessuna';

      if (
        scadenza.tipo === 'rata' &&
        Number(scadenza.importo) > 0
      ) {
        return `Rata ${this.formattaNumeroEuro(scadenza.importo)}`;
      }

      return scadenza.label || 'Scadenza';
    },

    prossimaScadenzaCliente(
      cliente,
      oggiIso = this.dataISOOggi()
    ) {
      if (!cliente?.id) return null;

      const scadenze = [];

      const rinnovo =
        this.rinnovoCalcolatoCliente(cliente, oggiIso);

      if (rinnovo) {
        scadenze.push({
          tipo: 'rinnovo',
          label: 'Rinnovo',
          data: rinnovo,
          importo: null
        });
      }

      const rata =
        this.scadenzePagamentoPerCliente[cliente.id]?.[0];

      if (rata?.data) {
        scadenze.push(rata);
      }

      const contatto =
        this.normalizzaDataAgenda(cliente.prossimo_contatto);

      if (contatto) {
        scadenze.push({
          tipo: 'contatto',
          label: 'Contatto',
          data: contatto,
          importo: null
        });
      }

      if (!scadenze.length) return null;

      return scadenze
        .sort((a, b) => a.data.localeCompare(b.data))[0];
    },

    formattaDataCompleta(value) {
      const iso = this.normalizzaDataAgenda(value);
      if (!iso) return '-';

      const [anno, mese, giorno] = iso.split('-').map(Number);
      return new Intl.DateTimeFormat('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(new Date(Date.UTC(anno, mese - 1, giorno)));
    },

    schedaClienteCompleta(cliente) {
      const c = cliente || {};

      const contratto =
        this.riepilogoContrattoCliente(c);

      const pagamento =
        this.riepilogoPagamentoListaCliente(c);

      const prossima =
        this.prossimaScadenzaCliente(c);

      const valoreAnnuale =
        Number(contratto?.valoreAnnuale) || 0;

      const durata =
        Number(contratto?.durataContrattoAnni) || 0;

      const periodicita =
        contratto?.periodicitaContratto || null;

      const totalePagamento =
        Number(pagamento?.totaleVendite) || 0;

      const incassato =
        Number(pagamento?.incassato) || 0;

      const percentualeIncassata =
        totalePagamento > 0
          ? Math.max(
              0,
              Math.min(
                100,
                Number(
                  pagamento?.percentualeIncassata
                ) || 0
              )
            )
          : 0;

      const validators = validatorsApi();

      return {
        id: c.id || null,

        nome:
          String(c.nome || '').trim() ||
          'Cliente senza nome',

        stato:
          c.stato || null,

        statoLabel:
          validators.formattaStato(c.stato),

        statoClasse:
          validators.classeStato(c.stato),

        pacchetto:
          this.etichettaPacchettoCliente(c),

        valoreAnnuale,

        valoreAnnualeLabel:
          valoreAnnuale > 0
            ? `${this.formattaNumeroEuro(
                valoreAnnuale
              )}/anno`
            : '-',

        durataContrattoAnni:
          durata || null,

        durataContrattoLabel:
          durata > 0
            ? (
                durata === 1
                  ? '1 anno'
                  : `${durata} anni`
              )
            : '-',

        periodicitaContratto:
          periodicita,

        periodicitaContrattoLabel:
          periodicita === 'mensile'
            ? 'Mensile'
            : periodicita === 'annuale'
              ? 'Annuale'
              : 'Non indicata',

        prossimaScadenza:
          prossima || null,

        prossimaScadenzaLabel:
          prossima
            ? (
                prossima.tipo === 'rata' &&
                Number(prossima.importo) > 0
                  ? `Rata ${this.formattaNumeroEuro(
                      prossima.importo
                    )}`
                  : prossima.label || 'Scadenza'
              )
            : 'Nessuna',

        prossimaScadenzaDataLabel:
          prossima?.data
            ? this.formattaDataCompleta(
                prossima.data
              )
            : 'Nessuna scadenza',

        incassato,

        totalePagamento,

        incassatoLabel:
          totalePagamento > 0
            ? this.formattaNumeroEuro(incassato)
            : '-',

        totalePagamentoLabel:
          totalePagamento > 0
            ? this.formattaNumeroEuro(
                totalePagamento
              )
            : '-',

        percentualeIncassata,

        percentualeIncassataLabel:
          totalePagamento > 0
            ? `${Math.round(
                percentualeIncassata
              )}% pagato`
            : 'Importo non indicato',

        prossimoContatto:
          c.prossimo_contatto || null,

        contattoInRitardo:
          Boolean(
            c.prossimo_contatto &&
            classeUrgenza(
              c.prossimo_contatto
            ) === 'ritardo'
          ),

        prossimoContattoLabel:
          c.prossimo_contatto
            ? this.formattaDataCompleta(
                c.prossimo_contatto
              )
            : '-'
      };
    },

    clientiRecenti() {
      return ultimiClienti(this.clienti);
    },

    clientiFiltrati() {
      const testo = this.filtroTesto.trim().toLowerCase();
      const risultato = this.clienti.filter(c => {
        if (this.filtroStato && c.stato !== this.filtroStato) return false;
        if (this.filtroSoloRitardo && classeUrgenza(c.prossimo_contatto) !== 'ritardo') return false;
        if (!testo) return true;
        return (c.nome || '').toLowerCase().includes(testo)
          || (c.referente || '').toLowerCase().includes(testo);
      });
      return this.ordinaClienti(risultato);
    },

    cmdkDesktop() {
      return window.matchMedia('(min-width:721px)').matches;
    },

    apriCmdk() {
      if (!this.cmdkDesktop()) return;
      this.cmdkAperta = true;
      this.cmdkTesto = '';
      this.cmdkIndiceAttivo = 0;
      this.$nextTick(() => {
        document.getElementById('cmdkInput')?.focus();
      });
    },

    chiudiCmdk() {
      this.cmdkAperta = false;
    },

    risultatiCmdk() {
      const testo = this.cmdkTesto.trim().toLowerCase();
      const lista = this.clienti.filter(c => {
        if (!testo) return true;
        return (c.nome || '').toLowerCase().includes(testo)
          || (c.referente || '').toLowerCase().includes(testo);
      });
      return lista.slice(0, 8);
    },

    etichettaStatoCmdk(cliente) {
      const stato = this.statiPipeline().find(s => s.valore === cliente.stato);
      return stato ? stato.label : '-';
    },

    muoviCmdk(delta) {
      const risultati = this.risultatiCmdk();
      if (!risultati.length) return;
      this.cmdkIndiceAttivo = Math.max(
        0,
        Math.min(risultati.length - 1, this.cmdkIndiceAttivo + delta)
      );
      this.$nextTick(() => {
        document.querySelectorAll('.cmdk-row')[this.cmdkIndiceAttivo]
          ?.scrollIntoView({ block: 'nearest' });
      });
    },

    selezionaCmdk(cliente) {
      if (!cliente) return;
      this.chiudiCmdk();
      this.apriScheda(cliente.id);
    },

    confermaCmdk() {
      const risultati = this.risultatiCmdk();
      this.selezionaCmdk(risultati[this.cmdkIndiceAttivo]);
    },

    clientiPagina() {
      const inizio = (this.paginaClienti - 1) * this.clientiPerPagina;
      return this.clientiFiltrati().slice(inizio, inizio + this.clientiPerPagina);
    },

    totalePagineClienti() {
      return Math.max(1, Math.ceil(this.clientiFiltrati().length / this.clientiPerPagina));
    },

    cambiaPaginaClienti(delta) {
      this.paginaClienti = Math.max(1, Math.min(this.totalePagineClienti(), this.paginaClienti + delta));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    clientiInRitardo() {
      return this.clienti.filter(c => classeUrgenza(c.prossimo_contatto) === 'ritardo');
    },

    async caricaStatisticheVenditore() {
      this.caricandoStatistiche = true;
      this.statisticheVenditore = {
        generato: 0,
        incassato: 0,
        venduto: 0,
        mediaVendita: 0,
        numeroVendite: 0
      };
      this.trendDatiVenditore = [];

      // Il developer non ha una quota su ogni vendita: il grafico gli serve
      // per vedere il totale venduto dall'azienda, non la propria parte.
      const isDeveloper = this.profilo.ruolo === 'developer';

      try {
        const partecipazioni = await window.supabaseClient
          .from('vendita_partecipanti')
          .select('vendita_id,quota_finale')
          .eq('profilo_id', this.sessione.user.id);

        if (partecipazioni.error) {
          console.warn('Statistiche economiche non disponibili:', partecipazioni.error.message);
          return;
        }

        const quotePerVendita = {};
        (partecipazioni.data || []).forEach(p => {
          quotePerVendita[p.vendita_id] = (quotePerVendita[p.vendita_id] || 0) + (Number(p.quota_finale) || 0);
        });

        const ids = Object.keys(quotePerVendita);
        if (!ids.length && !isDeveloper) return;

        const clientiPerId = Object.fromEntries(this.clienti.map(cliente => [cliente.id, cliente]));

        if (ids.length) {
          const [vendite, pagamenti] = await Promise.all([
            window.supabaseClient
              .from('vendite')
              .select('id,cliente_id,importo_vendita,stato,venditore_id,data_vendita')
              .in('id', ids),
            window.supabaseClient
              .from('pagamenti')
              .select('vendita_id,importo,stato')
              .in('vendita_id', ids)
          ]);

          if (vendite.error || pagamenti.error) {
            console.warn('Statistiche economiche non disponibili:', (vendite.error || pagamenti.error).message);
            return;
          }

          this.statisticheVenditore = calcolaStatisticheVenditore(
            vendite.data || [],
            pagamenti.data || [],
            quotePerVendita,
            this.sessione.user.id,
            clientiPerId
          );

          if (!isDeveloper) {
            this.trendDatiVenditore = serieMensileValore(
              vendite.data || [],
              clientiPerId,
              this.sessione.user.id
            );
          }
        }

        if (isDeveloper) {
          const venditeGenerali = await window.supabaseClient
            .from('vendite')
            .select('id,cliente_id,importo_vendita,stato,venditore_id,data_vendita');

          if (venditeGenerali.error) {
            console.warn('Statistiche economiche non disponibili:', venditeGenerali.error.message);
            return;
          }

          this.trendDatiVenditore = serieMensileValore(
            venditeGenerali.data || [],
            clientiPerId,
            null
          );
        }
      } finally {
        this.caricandoStatistiche = false;
      }
    },

    eventiOggiHome() {
      const oggi = this.dataISOOggi();
      const limite = this.aggiungiGiorniISO(oggi, 7);

      return this.eventiAgenda()
        .filter(evento => {
          if (evento.tipo === 'contatto') {
            return evento.data <= oggi;
          }

          if (evento.tipo === 'rinnovo' || evento.tipo === 'rata') {
            return evento.data >= oggi && evento.data <= limite;
          }

          return false;
        })
        .map(evento => {
          let priorita = 4;

          if (evento.tipo === 'contatto' && evento.data < oggi) priorita = 1;
          else if (evento.data === oggi) priorita = 2;
          else if (evento.tipo === 'rinnovo') priorita = 3;
          else if (evento.tipo === 'rata') priorita = 3;

          return { ...evento, priorita };
        })
        .sort((a, b) =>
          a.priorita - b.priorita ||
          a.data.localeCompare(b.data) ||
          a.clienteNome.localeCompare(b.clienteNome)
        );
    },

    descrizioneEventoHome(evento) {
      const oggi = this.dataISOOggi();

      if (evento.tipo === 'contatto') {
        if (evento.data < oggi) return 'Contatto in ritardo';
        return 'Da contattare oggi';
      }

      const giorni = Math.max(
        0,
        Math.round(
          (
            Date.parse(evento.data + 'T00:00:00Z') -
            Date.parse(oggi + 'T00:00:00Z')
          ) / 86400000
        )
      );

      if (evento.tipo === 'rinnovo') {
        if (giorni === 0) return 'Rinnovo oggi';
        if (giorni === 1) return 'Rinnovo domani';
        return `Rinnovo tra ${giorni} giorni`;
      }

      if (evento.tipo === 'rata') {
        const importo = evento.titolo.includes('·')
          ? evento.titolo.split('·').slice(1).join('·').trim()
          : '';

        let testo = 'Rata prevista';

        if (giorni === 0) testo = 'Rata oggi';
        else if (giorni === 1) testo = 'Rata domani';
        else testo = `Rata tra ${giorni} giorni`;

        return importo ? `${testo} · ${importo}` : testo;
      }

      return evento.titolo;
    },

    dataISOOggi() {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const g = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${g}`;
    },

    normalizzaDataAgenda(value) {
      if (!value) return null;
      const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
      return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
    },

    aggiungiGiorniISO(iso, giorni) {
      const [y, m, d] = iso.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d + giorni));
      return date.toISOString().slice(0, 10);
    },

    eventiAgenda() {
      const oggi = this.dataISOOggi();
      const eventi = [];
      const clientiAgenda = this.isAdmin ? this.adminClienti : this.clienti;

      clientiAgenda.forEach(cliente => {
        const contatto = this.normalizzaDataAgenda(cliente.prossimo_contatto);
        if (contatto) {
          eventi.push({
            id: `contatto-${cliente.id}-${contatto}`,
            clienteId: cliente.id,
            clienteNome: cliente.nome,
            venditoreId: cliente.venditore_id,
            venditoreNome: this.adminVenditoriPerId[cliente.venditore_id] || '',
            data: contatto,
            tipo: 'contatto',
            titolo: contatto < oggi ? 'Contatto in ritardo' : 'Contatto cliente',
            scaduto: contatto < oggi
          });
        }

        const rinnovo = this.normalizzaDataAgenda(cliente.data_rinnovo);
        if (rinnovo) {
          eventi.push({
            id: `rinnovo-${cliente.id}-${rinnovo}`,
            clienteId: cliente.id,
            clienteNome: cliente.nome,
            venditoreId: cliente.venditore_id,
            venditoreNome: this.adminVenditoriPerId[cliente.venditore_id] || '',
            data: rinnovo,
            tipo: 'rinnovo',
            titolo: cliente.periodicita_contratto === 'annuale'
              ? 'Rinnovo annuale'
              : 'Rinnovo contratto',
            scaduto: rinnovo < oggi
          });
        }

        (this.scadenzePagamentoPerCliente[cliente.id] || []).forEach(rata => {
          if (!rata?.data) return;
          eventi.push({
            id: `rata-${rata.id || cliente.id + '-' + rata.data}`,
            pagamentoId: rata.id || null,
            importo: rata.importo,
            clienteId: cliente.id,
            clienteNome: cliente.nome,
            venditoreId: cliente.venditore_id,
            venditoreNome: this.adminVenditoriPerId[cliente.venditore_id] || '',
            data: rata.data,
            tipo: 'rata',
            titolo: rata.importo > 0
              ? `Rata prevista · ${this.formattaNumeroEuro(rata.importo)}`
              : 'Rata prevista',
            scaduto: rata.data < oggi
          });
        });
      });

      return eventi.sort((a, b) =>
        a.data.localeCompare(b.data) ||
        a.clienteNome.localeCompare(b.clienteNome)
      );
    },

    eventiAgendaVisibili() {
      const oggi = this.dataISOOggi();
      const eventi = this.eventiAgenda();

      if (this.agendaVista === 'oggi') {
        return eventi.filter(e =>
          e.data === oggi ||
          ((e.tipo === 'contatto' || e.tipo === 'rata') && e.data < oggi)
        );
      }

      if (this.agendaVista === '7giorni') {
        const fine = this.aggiungiGiorniISO(oggi, 7);
        return eventi.filter(e =>
          (e.data >= oggi && e.data <= fine) ||
          ((e.tipo === 'contatto' || e.tipo === 'rata') && e.data < oggi)
        );
      }

      return eventi.filter(e => e.data === this.agendaDataSelezionata);
    },

    giorniCalendarioAgenda() {
      const [anno, mese] = this.agendaMese.split('-').map(Number);
      const primo = new Date(Date.UTC(anno, mese - 1, 1));
      const offset = (primo.getUTCDay() + 6) % 7;
      const start = new Date(Date.UTC(anno, mese - 1, 1 - offset));
      const oggi = this.dataISOOggi();

      return Array.from({ length: 42 }, (_, i) => {
        const d = new Date(start.getTime() + i * 86400000);
        const iso = d.toISOString().slice(0, 10);
        return {
          iso,
          giorno: d.getUTCDate(),
          nelMese: d.getUTCMonth() === mese - 1,
          oggi: iso === oggi,
          eventi: this.eventiAgenda().filter(e => e.data === iso).length
        };
      });
    },

    titoloMeseAgenda() {
      const [anno, mese] = this.agendaMese.split('-').map(Number);
      return new Intl.DateTimeFormat('it-IT', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
      }).format(new Date(Date.UTC(anno, mese - 1, 1)));
    },

    cambiaMeseAgenda(delta) {
      const [anno, mese] = this.agendaMese.split('-').map(Number);
      const d = new Date(Date.UTC(anno, mese - 1 + delta, 1));
      this.agendaMese = d.toISOString().slice(0, 7);
      this.agendaDataSelezionata = d.toISOString().slice(0, 10);
      this.agendaVista = 'mese';
    },

    selezionaGiornoAgenda(iso) {
      this.agendaVista = 'mese';
      this.agendaDataSelezionata = iso;
      this.agendaMese = iso.slice(0, 7);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document
            .getElementById('agenda-attivita-giorno')
            ?.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
        });
      });
    },

    clientiPipeline(stato) {
      return this.clienti
        .filter(c => c.stato === stato)
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    },

    clientiProduzione(stato) {
      return this.clienti.filter(c => c.stato_produzione === stato);
    },

    statiPipeline() {
      return [
        { valore: 'contattato', label: 'Contattato' },
        { valore: 'brief_mandato', label: 'Brief mandato' },
        { valore: 'vinto', label: 'Convertito' },
        { valore: 'perso', label: 'Mancato' }
      ];
    },

    statiProduzione() {
      return [
        { valore: 'da_avviare', label: 'Da avviare' },
        { valore: 'in_lavorazione', label: 'In lavorazione' },
        { valore: 'pubblicato', label: 'Pubblicato' }
      ];
    },

    formattaStatoProduzione(stato) {
      return this.statiProduzione().find(s => s.valore === stato)?.label || '-';
    },

    // Le barre confrontano i volumi correnti, non fingono conversioni tra
    // gruppi che non sono coorti storiche dello stesso periodo.
    funnelPipeline() {
      const stadi = this.statiPipeline().map(stato => ({
        ...stato,
        count: this.clientiPipeline(stato.valore).length
      }));
      const max = Math.max(1, ...stadi.map(s => s.count));
      return stadi.map(stadio => ({
        ...stadio,
        larghezza: Math.round((stadio.count / max) * 100)
      }));
    },

    // ===== Grafici a linea (trend vendite) - geometria condivisa =====
    // viewBox fisso 640x200, preserveAspectRatio uniforme (mai "none":
    // deforma le etichette quando la card e' piu' stretta di 640px).
    trendVisibile(datiCompleti, range) {
      return range < 12 ? datiCompleti.slice(-range) : datiCompleti;
    },

    // Formato compatto per le etichette sempre visibili sopra i punti
    // (a differenza di formattaEuro, qui serve corto: "12k" non "12.000 €").
    formattaEuroCompatto(valore) {
      const v = Number(valore) || 0;
      if (!v) return '0€';
      if (v >= 1000) {
        const k = v / 1000;
        return (Number.isInteger(k) ? k : k.toFixed(1)) + 'k€';
      }
      return Math.round(v) + '€';
    },

    trendPuntiSerie(punti) {
      const w = 640, h = 200, pad = 28;
      if (punti.length < 2) return [];
      const maxVal = Math.max(1, ...punti.map(p => p.valore)) * 1.15;
      const stepX = (w - pad * 2) / (punti.length - 1);
      return punti.map((p, i) => ({
        x: pad + i * stepX,
        y: h - pad - (p.valore / maxVal) * (h - pad * 2 - 20),
        valore: p.valore,
        numero: p.numero || 0,
        label: p.label,
        chiave: p.chiave
      }));
    },

    trendPathLinea(punti) {
      const pts = this.trendPuntiSerie(punti);
      if (!pts.length) return '';
      return pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
    },

    trendPathArea(punti) {
      const pts = this.trendPuntiSerie(punti);
      if (!pts.length) return '';
      const h = 200, pad = 28;
      const linea = this.trendPathLinea(punti);
      const ultimo = pts[pts.length - 1];
      const primo = pts[0];
      return `${linea} L${ultimo.x},${h - pad} L${primo.x},${h - pad} Z`;
    },

    // Etichette dirette a fine linea con anti-sovrapposizione verticale:
    // se due serie finiscono a meno di 14 unita' viewBox, la piu' in alto
    // viene spinta ancora piu' su.
    trendEtichetteFinali(serie) {
      const MIN_GAP = 38;
      const etichette = serie
        .map(s => {
          const pts = this.trendPuntiSerie(s.punti);
          if (!pts.length) return null;
          const ultimo = pts[pts.length - 1];
          return {
            x: ultimo.x + 9,
            y: ultimo.y + 3,
            color: s.color,
            text: (ultimo.valore / 1000).toFixed(1) + 'k'
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.y - b.y);

      for (let i = 1; i < etichette.length; i++) {
        const gap = etichette[i].y - etichette[i - 1].y;
        if (gap < MIN_GAP) etichette[i - 1].y -= (MIN_GAP - gap);
      }
      return etichette;
    },

    trendGridLineY() {
      const h = 200, pad = 28;
      const step = (h - pad * 2 - 20) / 3;
      return [0, 1, 2, 3].map(i => pad + i * step);
    },

    trendEtichetteAsse(punti) {
      const pts = this.trendPuntiSerie(punti);
      if (!pts.length) return [];
      const passo = pts.length > 8 ? 2 : 1;
      return pts
        .filter((_, i) => i % passo === 0 || i === pts.length - 1)
        .map(p => ({ x: p.x, text: p.label, numero: p.numero }));
    },

    // ===== Grafico a barre mensile: condiviso tra il trend Home venditore
    // e la vista "Il tuo incassato". A differenza di linea+pallini ogni
    // mese occupa uno slot di larghezza fissa, quindi etichette e valori
    // non si accavallano mai anche con i font ingranditi in questa app
    // (era proprio quello il problema della linea con 12 punti ravvicinati).
    barrePuntiMensili(punti) {
      const w = 640, h = 248, padTop = 46, padBottom = 46, padSide = 16;
      const area = h - padTop - padBottom;
      const baseline = h - padBottom;
      const n = Math.max(1, punti.length);
      const slotW = (w - padSide * 2) / n;
      const barW = Math.min(slotW * 0.56, 36);
      const maxVal = Math.max(1, ...punti.map(p => p.valore));

      return punti.map((p, i) => {
        const altezza = p.valore > 0 ? Math.max(3, (p.valore / maxVal) * area) : 0;
        const x = padSide + i * slotW + (slotW - barW) / 2;
        return {
          x, w: barW, y: baseline - altezza, h: altezza, cx: x + barW / 2, baseline,
          valore: p.valore, label: p.label, chiave: p.chiave, numero: p.numero || 0
        };
      });
    },

    barreEtichetteVisibili(punti) {
      const passo = punti.length > 8 ? 2 : 1;
      return new Set(
        punti.filter((_, i) => i % passo === 0 || i === punti.length - 1).map(p => p.chiave)
      );
    },

    disegnaMarkupBarreMensili(punti, statoHoverProp, opzioni = {}) {
      if (!punti.some(p => p.valore > 0)) return '';

      const barre = this.barrePuntiMensili(punti);
      const etichetteVisibili = this.barreEtichetteVisibili(punti);
      const dark = opzioni.dark ? ' metrics-bar-dark' : '';
      const gridClass = opzioni.dark ? ' metrics-grid-line-dark' : '';
      const colore = opzioni.colore || 'var(--lime-deep)';
      let svg = `<line class="metrics-grid-line${gridClass}" x1="16" y1="${barre[0].baseline}" x2="624" y2="${barre[0].baseline}"></line>`;

      barre.forEach((b, i) => {
        svg += `<rect class="metrics-bar${dark}" x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" width="${b.w.toFixed(1)}" height="${Math.max(b.h, 1).toFixed(1)}" rx="5" style="fill:${colore}"
          onmouseenter="Alpine.$data(document.getElementById('app')).${statoHoverProp}=${i}"
          onmouseleave="Alpine.$data(document.getElementById('app')).${statoHoverProp}=null"
          onclick="const __d=Alpine.$data(document.getElementById('app'));__d.${statoHoverProp}=(__d.${statoHoverProp}===${i}?null:${i})"></rect>`;

        if (b.valore > 0) {
          svg += `<text class="metrics-bar-value${dark}" x="${b.cx.toFixed(1)}" y="${Math.max(20, b.y - 10).toFixed(1)}" text-anchor="middle">${this.formattaEuroCompatto(b.valore)}</text>`;
        }
        if (etichetteVisibili.has(b.chiave)) {
          svg += `<text class="metrics-bar-label${dark}" x="${b.cx.toFixed(1)}" y="${(b.baseline + 26).toFixed(1)}" text-anchor="middle">${b.label}</text>`;
        }
      });

      const hoverIndex = this[statoHoverProp];
      if (Number.isInteger(hoverIndex) && barre[hoverIndex]) {
        const b = barre[hoverIndex];
        const x = Math.max(60, Math.min(580, b.cx));
        const y = Math.max(20, b.y - 26);
        const dettaglio = b.numero ? (' · ' + b.numero + ' sit' + (b.numero === 1 ? 'o' : 'i')) : '';
        svg += `<text class="metrics-tooltip${dark}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle">${b.label} · ${formattaEuro(b.valore)}${dettaglio}</text>`;
      }

      return svg;
    },

    // ===== Rendering SVG dei due grafici trend =====
    // Alpine x-for/x-if con <template> DENTRO <svg> non funziona (verificato:
    // il parser HTML non popola .content sul <template> in contesto SVG
    // foreign-content, Alpine lancia "Cannot read properties of undefined
    // (reading 'children')"). Si genera quindi la marcatura SVG come stringa
    // e si lega con x-html sull'elemento <svg>; l'hover/click sui punti usa
    // handler inline (non window.addEventListener, per non ripetere il bug
    // di doppia registrazione gia' documentato altrove in questo file) che
    // scrivono direttamente sullo stato Alpine via Alpine.$data(...).
    trendSerieAdminVisibili() {
      return this.trendDatiAdmin.map(serie => ({
        ...serie,
        puntiVisibili: this.trendVisibile(serie.punti, this.trendRangeAdmin)
      }));
    },

    trendMarkupVenditore() {
      const punti = this.trendVisibile(this.trendDatiVenditore, this.trendRangeVenditore);
      return this.disegnaMarkupBarreMensili(punti, 'trendHoverVenditore', {
        dark: true,
        colore: 'var(--lime)'
      });
    },

    trendMarkupAdmin() {
      const serie = this.trendSerieAdminVisibili();
      if (!serie.some(s => s.puntiVisibili.some(p => p.valore > 0))) return '';

      let svg = '';

      this.trendGridLineY().forEach(y => {
        svg += `<line class="metrics-grid-line" x1="28" y1="${y}" x2="632" y2="${y}"></line>`;
      });
      // Il conteggio siti sotto il mese usa sempre la serie "totale" (prima
      // serie): sotto ogni venditore avrebbe contato solo le sue vendite,
      // qui interessa quante vendite ci sono state in azienda quel mese.
      const serieTotale = serie.find(s => s.id === 'totale') || serie[0];
      this.trendEtichetteAsse(serieTotale ? serieTotale.puntiVisibili : []).forEach(a => {
        svg += `<text class="metrics-axis-label" x="${a.x}" y="196" text-anchor="middle">${a.text}</text>`;
        svg += `<text class="metrics-count-label" x="${a.x}" y="234" text-anchor="middle">${a.numero} sit${a.numero === 1 ? 'o' : 'i'}</text>`;
      });

      serie.forEach(s => {
        svg += `<path class="metrics-trend-line" style="stroke:${s.color}" d="${this.trendPathLinea(s.puntiVisibili)}"></path>`;
      });

      serie.forEach((s, si) => {
        this.trendPuntiSerie(s.puntiVisibili).forEach((p, pi) => {
          svg += `<circle class="metrics-trend-dot" cx="${p.x}" cy="${p.y}" r="3.5" style="fill:${s.color}"
            onmouseenter="Alpine.$data(document.getElementById('app')).trendHoverAdmin={si:${si},pi:${pi}}"
            onmouseleave="Alpine.$data(document.getElementById('app')).trendHoverAdmin=null"
            onclick="const __d=Alpine.$data(document.getElementById('app'));const __h=__d.trendHoverAdmin;__d.trendHoverAdmin=(__h&&__h.si===${si}&&__h.pi===${pi})?null:{si:${si},pi:${pi}}"></circle>`;
        });
      });

      this.trendEtichetteFinali(serie.map(s => ({ color: s.color, punti: s.puntiVisibili }))).forEach(e => {
        svg += `<text class="metrics-direct-label" x="${e.x}" y="${e.y}" style="fill:${e.color}">${e.text}</text>`;
      });

      if (this.trendHoverAdmin) {
        const s = serie[this.trendHoverAdmin.si];
        const p = s && this.trendPuntiSerie(s.puntiVisibili)[this.trendHoverAdmin.pi];
        if (p) {
          const x = Math.max(50, Math.min(590, p.x));
          const y = Math.max(28, p.y - 24);
          const nomeSerie = s.id !== 'totale' ? ' · ' + s.nome : '';
          svg += `<text class="metrics-tooltip" x="${x}" y="${y}" text-anchor="middle">${p.label}${nomeSerie} · ${formattaEuro(p.valore)} · ${p.numero} sit${p.numero === 1 ? 'o' : 'i'}</text>`;
        }
      }

      return svg;
    },

    aggiornaPipelineIndice(event) {
      const el = event.currentTarget;
      if (!el) return;

      const larghezza = el.clientWidth || 1;
      const indice = Math.round(el.scrollLeft / larghezza);

      this.pipelineIndice = Math.max(
        0,
        Math.min(this.statiPipeline().length - 1, indice)
      );
    },

    vaiAStatoPipeline(indice) {
      const container = document.querySelector('.pipeline-scroll-v2');
      if (!container) return;

      const target = Math.max(
        0,
        Math.min(this.statiPipeline().length - 1, Number(indice) || 0)
      );

      this.pipelineIndice = target;

      container.scrollTo({
        left: container.clientWidth * target,
        behavior: 'smooth'
      });
    },

    async impostaStatoCliente(clienteId, stato) {
      const consentiti = ['contattato', 'brief_mandato', 'vinto', 'perso'];
      if (!clienteId || !consentiti.includes(stato)) {
        return 'Stato non valido';
      }

      try {
        const { error } = await window.supabaseClient
          .rpc('imposta_stato_cliente', {
            p_cliente_id: clienteId,
            p_stato: stato
          });

        return error ? error.message : '';
      } catch (err) {
        console.error('Errore impostaStatoCliente:', err);
        return 'Errore di connessione.';
      }
    },

    async impostaStatoProduzione(clienteId, stato) {
      if (!clienteId || !this.statiProduzione().some(s => s.valore === stato)) {
        return 'Stato produzione non valido';
      }
      try {
        const { error } = await window.supabaseClient.rpc(
          'imposta_stato_produzione',
          { p_cliente_id: clienteId, p_stato: stato }
        );
        return error ? error.message : '';
      } catch (err) {
        console.error('Errore impostaStatoProduzione:', err);
        return 'Errore di connessione.';
      }
    },

    async cambiaStatoProduzione(stato) {
      if (this.cambiandoStatoProduzione) return;
      this.cambiandoStatoProduzione = true;
      this.erroreScheda = '';

      try {
        const errore = await this.impostaStatoProduzione(this.clienteSelezionatoId, stato);
        if (errore) {
          this.erroreScheda = 'Produzione non aggiornata: ' + errore;
          return;
        }
        await Promise.all([
          this.caricaClienti(),
          this.caricaAttivitaCliente(this.clienteSelezionatoId)
        ]);
        this.mostraToast('success', 'Produzione aggiornata');
      } finally {
        this.cambiandoStatoProduzione = false;
      }
    },

    async cambiaStatoDaPipeline(clienteId, stato) {
      this.erroreClienti = '';
      this.retryClienti = null;

      const errore = await this.impostaStatoCliente(clienteId, stato);

      if (errore) {
        this.erroreClienti = 'Stato non aggiornato: ' + errore;
        // "Stato non valido" e' un errore di validazione lato client (stato
        // non tra quelli consentiti): riprovare non cambierebbe l'esito,
        // quindi niente bottone Riprova su questo caso specifico.
        if (errore !== 'Stato non valido') {
          this.retryClienti = { fn: () => this.cambiaStatoDaPipeline(clienteId, stato) };
        }
        return;
      }

      await this.caricaClienti();
      this.mostraToast('success', 'Stato aggiornato');
    },

    async completaContattoAgenda(evento) {
      if (
        !evento ||
        evento.tipo !== 'contatto' ||
        !evento.clienteId ||
        this.completandoEventoAgendaId === evento.id
      ) return;

      this.completandoEventoAgendaId = evento.id;
      this.erroreClienti = '';

      try {
        const { error } = await window.supabaseClient
          .rpc('completa_contatto_cliente', {
            p_cliente_id: evento.clienteId,
            p_data: evento.data || null
          });

        if (error) {
          console.error('Errore completamento contatto:', error);
          this.erroreClienti =
            'Contatto non completato: ' + error.message;
          return;
        }

        if (this.isAdmin) {
          await this.caricaDashboardAdmin();
        } else {
          await this.caricaClienti();
        }

        if (this.clienteSelezionatoId === evento.clienteId) {
          await this.caricaAttivitaCliente(evento.clienteId);
        }

      } finally {
        this.completandoEventoAgendaId = null;
      }
    },

    risultatiRicercaGlobale() {
      const q = this.ricercaGlobale.trim().toLowerCase();
      if (q.length < 2) return [];

      const campi = [
        ['nome', 'Nome'],
        ['referente', 'Referente'],
        ['telefono', 'Telefono'],
        ['email', 'Email'],
        ['piva', 'P.IVA'],
        ['sito_url', 'Sito'],
        ['nome_pacchetto', 'Pacchetto']
      ];

      const risultati = [];

      this.clienti.forEach(cliente => {
        let motivo = null;
        let estratto = '';

        for (const [campo, label] of campi) {
          const valore = String(cliente[campo] || '');
          if (valore.toLowerCase().includes(q)) {
            motivo = label;
            estratto = valore;
            break;
          }
        }

        if (!motivo) {
          const nota = this.indiceNoteRicerca.find(n =>
            n.cliente_id === cliente.id &&
            String(n.testo || '').toLowerCase().includes(q)
          );

          if (nota) {
            motivo = 'Nota';
            estratto = nota.testo;
          }
        }

        if (motivo) {
          risultati.push({
            cliente,
            motivo,
            estratto: estratto.length > 90
              ? estratto.slice(0, 87) + '...'
              : estratto
          });
        }
      });

      return risultati.slice(0, 30);
    },

    prezzoRicorrenteScontato() {
      return prezzoRicorrenteDaForm(
        this.prezzoLordoRicorrente(),
        this.nuovoClienteForm
      );
    },

    valoreTotaleContrattoStimato() {
      const durata = Math.max(
        1,
        Math.min(4, Number(this.nuovoClienteForm.durata_contratto_anni) || 1)
      );

      return totaleContrattoDaForm(
        this.valoreCanoneContratto(),
        this.totaleUnaTantum() + (this.totaleAnnualiSeparati() * durata),
        this.nuovoClienteForm
      );
    },

    toggleFiltroSoloRitardo() {
      this.filtroSoloRitardo = !this.filtroSoloRitardo;
      this.paginaClienti = 1;
    },

    ordinaClienti(elenco) {
      const campo = this.ordinamento;
      const segno = this.ordinamentoDesc ? -1 : 1;
      const valore = c => {
        if (campo === 'nome') return (c.nome || '').toLowerCase();
        if (campo === 'importo') return c.importo_abbonamento == null ? null : Number(c.importo_abbonamento);
        if (campo === 'prossimo_contatto') return c.prossimo_contatto || null;
        return c.creato_il || null;
      };
      return [...elenco].sort((a, b) => {
        const va = valore(a), vb = valore(b);
        if (va === null && vb === null) return 0;
        if (va === null) return 1;
        if (vb === null) return -1;
        if (va < vb) return -1 * segno;
        if (va > vb) return 1 * segno;
        return 0;
      });
    },

    impostaOrdinamento(campo) {
      this.paginaClienti = 1;
      if (this.ordinamento === campo) {
        this.ordinamentoDesc = !this.ordinamentoDesc;
      } else {
        this.ordinamento = campo;
        this.ordinamentoDesc = campo === 'importo' || campo === 'creato_il';
      }
    },

    // --- statistiche venditore (home) ---
    clientiPubblicati() {
      return this.clienti.filter(c => c.stato_produzione === 'pubblicato');
    },

    conteggiPerStato() {
      const conteggi = { contattato: 0, brief_mandato: 0, vinto: 0, perso: 0 };
      for (const c of this.clienti) {
        if (conteggi[c.stato] !== undefined) conteggi[c.stato] += 1;
      }
      return conteggi;
    },

    totaleGenerato() {
      return this.clientiPubblicati().reduce((s, c) => s + (Number(c.importo_abbonamento) || 0), 0);
    },

    andamentoMensile() {
      const mesi = {};
      for (const c of this.clientiPubblicati()) {
        if (!c.pubblicato_il) continue;
        const d = new Date(c.pubblicato_il);
        const chiave = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        if (!mesi[chiave]) {
          mesi[chiave] = { chiave, etichetta: formattaMese(d), conteggio: 0, totale: 0 };
        }
        mesi[chiave].conteggio += 1;
        mesi[chiave].totale += Number(c.importo_abbonamento) || 0;
      }
      return Object.values(mesi).sort((a, b) => b.chiave.localeCompare(a.chiave));
    },

    catalogoPrezzi() { return window.CATALOGO_PREZZI_LE; },
    selezionaFormulaPrezzo(formula) {
      this.selezionePrezzo.modalita = 'catalogo';
      this.selezionePrezzo.formula = formula;
      this.nuovoClienteForm.periodicita_contratto = formula === 'annuale' ? 'annuale' : 'mensile';
      if (formula === 'annuale') this.nuovoClienteForm.pacchetto_sicurezza = false;
      this.aggiornaPrezzoCliente();
      this.aggiornaPreviewRinnovo();
    },
    toggleUpgradePrezzo(id) {
      this.selezionePrezzo.modalita = 'catalogo';
      const a = this.selezionePrezzo.upgrade;
      this.selezionePrezzo.upgrade = a.includes(id) ? a.filter(x => x !== id) : [...a, id];
      this.aggiornaPrezzoCliente();
    },
    setQuantitaExtra(campo, delta, max) {
      const corrente = Number(this.nuovoClienteForm[campo]) || 0;
      this.nuovoClienteForm[campo] = Math.max(0, Math.min(max, corrente + delta));
      this.aggiornaPrezzoCliente();
    },

    normalizzaQuantitaExtra(campo, max) {
      this.nuovoClienteForm[campo] = Math.max(0, Math.min(max, Number(this.nuovoClienteForm[campo]) || 0));
      this.aggiornaPrezzoCliente();
    },

    prezzoUpgradeMensile() {
      const c = this.catalogoPrezzi();
      const toggle = c.upgrade.filter(u => this.selezionePrezzo.upgrade.includes(u.id)).reduce((s,u) => s + u.prezzoMensile, 0);
      return toggle
        + ((Number(this.nuovoClienteForm.pagine_extra) || 0) * c.paginaExtra.prezzoMensile)
        + ((Number(this.nuovoClienteForm.lingue_extra) || 0) * c.multilingua.prezzoMensilePerLingua);
    },

    scontoRicorrente(importo) {
      return Math.max(
        0,
        Number(importo) - prezzoRicorrenteDaForm(importo, this.nuovoClienteForm)
      );
    },

    setDurataContratto(anni) {
      const durata = Math.max(1, Math.min(4, Number(anni) || 1));
      this.nuovoClienteForm.durata_contratto_anni = durata;

      const durataSconto = this.nuovoClienteForm.sconto_durata_anni;
      if (durataSconto != null && Number(durataSconto) > durata) {
        this.nuovoClienteForm.sconto_durata_anni = durata;
      }

      this.aggiornaPrezzoCliente();
    },

    setDurataSconto(anni) {
      if (anni == null || anni === '') {
        this.nuovoClienteForm.sconto_durata_anni = null;
      } else {
        const durataContratto = Math.max(
          1,
          Math.min(4, Number(this.nuovoClienteForm.durata_contratto_anni) || 1)
        );
        this.nuovoClienteForm.sconto_durata_anni = Math.max(
          1,
          Math.min(durataContratto, Number(anni) || 1)
        );
      }
      this.aggiornaPrezzoCliente();
    },

    anniScontoEffettivi() {
      if (!this.nuovoClienteForm.sconto_tipo || Number(this.nuovoClienteForm.sconto_valore) <= 0) {
        return 0;
      }
      const durata = Math.max(
        1,
        Math.min(4, Number(this.nuovoClienteForm.durata_contratto_anni) || 1)
      );
      if (this.nuovoClienteForm.sconto_durata_anni == null) return durata;
      return Math.max(
        1,
        Math.min(durata, Number(this.nuovoClienteForm.sconto_durata_anni) || 1)
      );
    },

    etichettaDurataSconto() {
      return etichettaDurataScontoForm(this.nuovoClienteForm);
    },

    valoreCanoneContratto() {
      const durata = Math.max(
        1,
        Math.min(4, Number(this.nuovoClienteForm.durata_contratto_anni) || 1)
      );
      const lordoPeriodo = this.prezzoLordoRicorrente();
      const nettoPeriodo = prezzoRicorrenteDaForm(
        lordoPeriodo,
        this.nuovoClienteForm
      );
      const anniScontati = this.anniScontoEffettivi();
      const periodiPerAnno = this.nuovoClienteForm.periodicita_contratto === 'annuale' ? 1 : 12;

      return (
        nettoPeriodo * periodiPerAnno * anniScontati
        + lordoPeriodo * periodiPerAnno * (durata - anniScontati)
      );
    },

    prezzoLordoRicorrente() {
      const c = this.catalogoPrezzi();
      const f = c.formule[this.selezionePrezzo.formula] || c.formule.mensile;
      const up = this.prezzoUpgradeMensile();
      return f.id === 'annuale' ? f.prezzoBase + (up * 12) : f.prezzoBase + up;
    },

    totaleAnnualiSeparati() {
      if (this.nuovoClienteForm.cliente_ha_dominio !== false) return 0;
      const a = this.catalogoPrezzi().annuali;
      return (Number(this.nuovoClienteForm.dominio_it) || 0) * a.dominioIt.prezzo
        + (Number(this.nuovoClienteForm.dominio_com) || 0) * a.dominioCom.prezzo
        + (Number(this.nuovoClienteForm.email_5_caselle) || 0) * a.email5.prezzo;
    },

    totaleUnaTantum() {
      const c = this.catalogoPrezzi();
      const f = c.formule[this.selezionePrezzo.formula] || c.formule.mensile;
      return f.setup + (f.id === 'mensile' && this.nuovoClienteForm.pacchetto_sicurezza ? c.sicurezza.prezzo : 0);
    },

    aggiornaPrezzoCliente() {
      const c = this.catalogoPrezzi();
      const f = c.formule[this.selezionePrezzo.formula] || c.formule.mensile;
      this.nuovoClienteForm.periodicita_contratto = f.id === 'annuale' ? 'annuale' : 'mensile';
      if (f.id === 'annuale') this.nuovoClienteForm.pacchetto_sicurezza = false;

      const lordo = this.prezzoLordoRicorrente();
      this.nuovoClienteForm.importo_abbonamento =
        prezzoRicorrenteDaForm(lordo, this.nuovoClienteForm);
      this.nuovoClienteForm.nome_pacchetto = f.nome;

      const d = c.upgrade.filter(u => this.selezionePrezzo.upgrade.includes(u.id)).map(u => `${u.nome} (+${u.prezzoMensile} €/mese)`);
      const pagine = Number(this.nuovoClienteForm.pagine_extra) || 0;
      const lingue = Number(this.nuovoClienteForm.lingue_extra) || 0;
      if (pagine > 0) d.push(`${pagine} ${pagine === 1 ? 'pagina extra' : 'pagine extra'} (+${pagine * c.paginaExtra.prezzoMensile} €/mese)`);
      if (lingue > 0) d.push(`${lingue} lingue extra (+${lingue * c.multilingua.prezzoMensilePerLingua} €/mese)`);
      if (this.nuovoClienteForm.sconto_tipo && Number(this.nuovoClienteForm.sconto_valore) > 0) {
        const descrizioneSconto =
          this.nuovoClienteForm.sconto_tipo === 'prezzo_fisso'
            ? `Prezzo fisso ${this.formattaNumeroEuro(this.nuovoClienteForm.sconto_valore)}`
            : this.nuovoClienteForm.sconto_tipo === 'percentuale'
              ? `Sconto ${Number(this.nuovoClienteForm.sconto_valore)}%`
              : `Sconto ${this.formattaNumeroEuro(this.nuovoClienteForm.sconto_valore)}`;
        d.push(`${descrizioneSconto} ${this.etichettaDurataSconto()}`);
      }

      const durataContratto = Math.max(
        1,
        Math.min(4, Number(this.nuovoClienteForm.durata_contratto_anni) || 1)
      );
      d.push(`Durata contratto: ${durataContratto} ${durataContratto === 1 ? 'anno' : 'anni'}`);
      if (this.nuovoClienteForm.cliente_ha_dominio === false) {
        const annuali = [];
        const qtaIt = Number(this.nuovoClienteForm.dominio_it) || 0;
        const qtaCom = Number(this.nuovoClienteForm.dominio_com) || 0;
        const qtaEmail = Number(this.nuovoClienteForm.email_5_caselle) || 0;
        if (qtaIt > 0) annuali.push(`Dominio .it${qtaIt > 1 ? ` x${qtaIt}` : ''}`);
        if (qtaCom > 0) annuali.push(`Dominio .com${qtaCom > 1 ? ` x${qtaCom}` : ''}`);
        if (qtaEmail > 0) annuali.push(`Email 5 caselle${qtaEmail > 1 ? ` x${qtaEmail}` : ''}`);
        if (annuali.length) d.push(`Annuali: ${annuali.join(', ')}`);
      }
      if (f.id === 'mensile' && this.nuovoClienteForm.pacchetto_sicurezza) d.push('Pacchetto sicurezza 100 € una tantum');
      d.unshift(f.id === 'annuale' ? 'Setup incluso' : 'Setup: 150 € una tantum');
      this.nuovoClienteForm.note_prezzo = d.join(' · ');
    },

    riepilogoSetupPrezzo() { return this.selezionePrezzo.formula==='annuale'?'Setup incluso':'Setup: 150 € una tantum'; },
    riepilogoUpgradePrezzo() { const m=this.prezzoUpgradeMensile(); if(!m)return ''; return this.selezionePrezzo.formula==='annuale'?`Upgrade: +${this.formattaNumeroEuro(m*12)}/anno`:`Upgrade: +${this.formattaNumeroEuro(m)}/mese`; },
    formattaNumeroEuro(v) { return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v)||0); },
    calcolaProssimoRinnovo(
      dataAttivazione,
      periodicita,
      oggiIso = this.dataISOOggi()
    ) {
      if (
        !dataAttivazione ||
        !['mensile','annuale'].includes(periodicita)
      ) return null;

      const parti = dataAttivazione.split('-').map(Number);
      if (
        parti.length !== 3 ||
        parti.some(Number.isNaN)
      ) return null;

      const [annoBase, meseBase, giornoBase] = parti;

      const oggiParti =
        String(oggiIso || '')
          .split('-')
          .map(Number);

      if (
        oggiParti.length !== 3 ||
        oggiParti.some(Number.isNaN)
      ) return null;

      const oggiUTC = Date.UTC(
        oggiParti[0],
        oggiParti[1] - 1,
        oggiParti[2]
      );

      for (let n = 1; n <= 2400; n += 1) {
        let anno = annoBase;
        let mese = meseBase;

        if (periodicita === 'mensile') {
          const indice = (meseBase - 1) + n;
          anno = annoBase + Math.floor(indice / 12);
          mese = (indice % 12) + 1;
        } else {
          anno = annoBase + n;
        }

        const ultimoGiorno = new Date(Date.UTC(anno, mese, 0)).getUTCDate();
        const giorno = Math.min(giornoBase, ultimoGiorno);
        const candidato = Date.UTC(anno, mese - 1, giorno);

        if (candidato >= oggiUTC) {
          return `${anno}-${String(mese).padStart(2,'0')}-${String(giorno).padStart(2,'0')}`;
        }
      }

      return null;
    },

    aggiornaPreviewRinnovo() {
      if (this.selezionePrezzo.modalita !== 'catalogo') return;
      this.nuovoClienteForm.data_rinnovo = this.calcolaProssimoRinnovo(
        this.nuovoClienteForm.data_attivazione,
        this.nuovoClienteForm.periodicita_contratto
      );
    },

    etichettaPreavviso(giorni) {
      const n = Number(giorni);
      if (n === 30) return '1 mese prima';
      if (n === 7) return '1 settimana prima';
      if (n === 2) return '2 giorni prima';
      return '1 giorno prima';
    },

    setModalitaNotificaRinnovo(modalita) {
      const annuale = this.nuovoClienteForm.periodicita_contratto === 'annuale';

      const consentite = annuale
        ? ['nessuna', 'annuale']
        : ['nessuna', 'mensile', 'annuale', 'entrambe'];

      this.nuovoClienteForm.modalita_notifica_rinnovo =
        consentite.includes(modalita) ? modalita : 'nessuna';
    },

    notificheRinnovoAttive() {
      return (
        this.nuovoClienteForm.modalita_notifica_rinnovo &&
        this.nuovoClienteForm.modalita_notifica_rinnovo !== 'nessuna'
      );
    },

    prossimoAnniversarioContratto() {
      return this.calcolaProssimoRinnovo(
        this.nuovoClienteForm.data_attivazione,
        'annuale'
      );
    },

    ripristinaSelezionePrezzo(c) {
      const vendita =
        this.pacchettoVenditaPerCliente?.[c.id] || null;

      const cfg =
        vendita?.configurazioneCommerciale &&
        typeof vendita.configurazioneCommerciale === 'object'
          ? vendita.configurazioneCommerciale
          : {};

      const periodicita =
        cfg.formula ||
        cfg.periodicita_contratto ||
        c.periodicita_contratto ||
        '';

      const pacchetto =
        String(
          vendita?.nomePacchetto ||
          c.nome_pacchetto ||
          ''
        ).trim();

      const formula =
        periodicita === 'annuale'
          ? 'annuale'
          : periodicita === 'mensile'
            ? 'mensile'
            : pacchetto.toLowerCase().includes('annuale')
              ? 'annuale'
              : pacchetto.toLowerCase().includes('mensile')
                ? 'mensile'
                : '';

      if (!formula) {
        this.selezionePrezzo = {
          modalita: 'legacy',
          formula: 'mensile',
          upgrade: []
        };
        return;
      }

      let upgrade =
        Array.isArray(cfg.upgrade)
          ? [...cfg.upgrade]
          : [];

      /*
       * Fallback solo per legacy che non hanno ancora uno snapshot:
       * appena salvati, la vendita attiva diventa la fonte canonica.
       */
      if (!upgrade.length && !Object.prototype.hasOwnProperty.call(cfg, 'upgrade')) {
        const testoStorico = [
          vendita?.nomePacchetto,
          c.nome_pacchetto,
          c.note_prezzo
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        upgrade = this.catalogoPrezzi().upgrade
          .filter(item =>
            testoStorico.includes(
              String(item.nome || '').toLowerCase()
            )
          )
          .map(item => item.id);
      }

      this.selezionePrezzo = {
        modalita: 'catalogo',
        formula,
        upgrade
      };

      this.nuovoClienteForm.pagine_extra =
        cfg.pagine_extra != null
          ? Number(cfg.pagine_extra) || 0
          : Number(c.pagine_extra) || 0;

      this.nuovoClienteForm.lingue_extra =
        cfg.lingue_extra != null
          ? Number(cfg.lingue_extra) || 0
          : Number(c.lingue_extra) || 0;
    },

    passaAlCatalogoPrezzi() {
      this.selezionePrezzo = {
        modalita: 'catalogo',
        formula: 'mensile',
        upgrade: []
      };
      this.nuovoClienteForm.pagine_extra = 0;
      this.nuovoClienteForm.lingue_extra = 0;
      this.nuovoClienteForm.periodicita_contratto = 'mensile';
      this.aggiornaPrezzoCliente();
      this.aggiornaPreviewRinnovo();
    },

    tornaAllaDashboard() {
      this.filtroVenditoreId = '';
      this.filtroVenditoreNome = '';
      this.filtroTestoAdmin = '';
      this.view = 'admin';
    }
  }, appEconomiaMixinApi(), appVenditaMixinApi(), appClienteMixinApi(), appAdminMixinApi(), appFatturatoMixinApi());
}

if (typeof module !== 'undefined') {
  module.exports = {
    filtroVenditoreClienti,
    ultimiClienti,
    normalizzaClientePerSalvataggio,
    prezzoRicorrenteDaForm,
    etichettaDurataScontoForm,
    totaleContrattoDaForm,
    costiGestioneCliente,
    percentualeTasseEconomia,
    appState,
    calcolaStatisticheVenditore,
    valoreContrattoVendita,
    valoreAnnualeCliente,
    clientiAttribuitiAlProfilo,
    clientiDelVenditoreRiferimento,
    ordinaClassificaVenditori,
    ordinaTeamEconomico,
    posizioneAvatarDaUrl,
    avatarUrlConPosizione,
    serieMensileAnno,
    totaliPerAnno,
    anniDisponibiliFatturato
  };
}
