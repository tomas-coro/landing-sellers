// js/app.js
function formModuloVuoto() {
  return { nome: '', referente: '', telefono: '', email: '',
    piva: '', iban: '', sito_url: '', importo_abbonamento: null,
    nome_pacchetto: '', note_prezzo: '', data_rinnovo: null,
    data_attivazione: '', periodicita_contratto: 'mensile',
    durata_contratto_anni: 1,
    giorni_preavviso_notifica: 7,
    sconto_tipo: '', sconto_valore: 0, sconto_durata_anni: null,
    pagine_extra: 0, lingue_extra: 0,
    cliente_ha_dominio: true,
    dominio_it: false, dominio_com: false, email_5_caselle: false,
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
  return { ...form, sconto_tipo: form.sconto_tipo || null };
}

function prezzoRicorrenteDaForm(prezzoCatalogo, form) {
  const lordo = Math.max(0, Number(prezzoCatalogo) || 0);
  const valore = Math.max(0, Number(form.sconto_valore) || 0);

  if (form.sconto_tipo === 'prezzo_fisso') return valore;
  if (form.sconto_tipo === 'percentuale') {
    return lordo * (1 - Math.min(valore, 100) / 100);
  }
  if (form.sconto_tipo === 'fisso') return Math.max(0, lordo - valore);
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
    if (cliente.dominio_it) {
      costi.push({
        descrizione: rinnovo ? 'Dominio .it - rinnovo' : 'Dominio .it - primo anno',
        importo: rinnovo ? 15 : 10
      });
    }
    if (cliente.dominio_com) {
      costi.push({
        descrizione: rinnovo ? 'Dominio .com - rinnovo' : 'Dominio .com - primo anno',
        importo: rinnovo ? 20 : 15
      });
    }
    if (cliente.email_5_caselle) {
      costi.push({
        descrizione: rinnovo ? 'Email 5 caselle - rinnovo' : 'Email 5 caselle - primo anno',
        importo: rinnovo ? 10 : 5
      });
    }
  }
  return costi;
}

function percentualeTasseEconomia(partecipanti) {
  const collaboratori = partecipanti.filter(p => p.ruolo !== 'referente');
  return collaboratori.length && collaboratori.every(
    p => (p.modalitaFatturazione || 'nessuna') === 'nessuna'
  ) ? 60 : 40;
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

function valoreContrattoVendita(vendita, clientiPerId = {}) {
  const cliente = clientiPerId[vendita?.cliente_id];
  const importo = Number(cliente?.importo_abbonamento ?? vendita?.importo_vendita) || 0;
  return cliente?.periodicita_contratto === 'mensile' ? importo * 12 : importo;
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

function formVenditaEconomicaVuoto() {
  return {
    clienteRicerca: '',
    clienteId: null,
    servizio: '',
    importoVendita: null,
    costi: [],
    costoDescrizione: '',
    costoImporto: null,

    // Regole economiche attualmente definite.
    percentualeRiduzioneNoFattura: 20,

    modalitaFatturazioneAdmin: 'nessuna',
    importoFatturatoAdmin: 0,

    statoIncasso: 'incassato',
    importoIncassato: null,
    dataPagamento: '',
    dataScadenza: '',
    metodoPagamento: '',
    notePagamento: '',

    partecipanti: [],
    nuovoPartecipanteNome: ''
  };
}

function appState() {
  return {
    view: '',
    avvioVisibile: true,
    sessione: null,
    clienteSelezionatoId: null,
    erroreLogin: '',
    emailInput: '',
    passwordInput: '',

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
    isAdmin: false,
    filtroVenditoreId: '',
    filtroVenditoreNome: '',
    filtroTesto: '',
    filtroStato: '',
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
    statisticheVenditore: {
      generato: 0,
      incassato: 0,
      venduto: 0,
      mediaVendita: 0,
      numeroVendite: 0
    },

    ricercaGlobale: '',
    indiceNoteRicerca: [],
    erroreRicerca: '',

    assistenteDomanda: '',
    assistenteMessaggi: [{
      ruolo: 'bot',
      testo: 'Ciao! Chiedimi come usare l’app. Ti risponderò solo con indicazioni già verificate.'
    }],

    nuovoClienteForm: formModuloVuoto(),

    // CRM economico / vendite
    venditaEconomicaForm: formVenditaEconomicaVuoto(),
    modalitaEconomia: 'vendita',
    venditaEconomicaAttiva: null,
    pagamentoPrevistoId: null,
    clienteEconomiaSelezionato: null,
    anagraficaEconomiaAperta: false,
    menuAzioneAperto: false,

    // Azioni rapide cliente
    clienteAzioniRapideId: null,
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
    salvandoVenditaEconomica: false,
    erroreEconomia: '',
    successoEconomia: '',

    selezionePrezzo: { modalita: 'catalogo', formula: 'mensile', upgrade: [] },
    erroriNuovoCliente: {},
    clienteInModificaId: null,
    salvandoCliente: false,

    confermaEliminazione: false,
    eliminandoCliente: false,

    cestino: [],
    erroreCestino: '',
    filtroTestoCestino: '',

    note: [],
    nuovaNotaTesto: '',
    aggiungendoNota: false,
    erroreScheda: '',

    attivitaCliente: [],
    caricandoAttivitaCliente: false,

    // pagamenti cliente
    venditaClienteAttiva: null,
    pagamentiCliente: [],
    caricandoPagamentiCliente: false,
    errorePagamentiCliente: '',
    scadenzePagamentoPerCliente: {},

    schedaAperture: { stato: true, pacchetto: false, contatti: false, attivita: true, note: false },

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

    async init() {
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

      this.sessione = await getSessioneCorrente();
      this.accountSlot = window.AccountSessions.getActiveSlot();
      await this.aggiornaStatoAccountSwitcher();

      if (this.sessione) { await this.dopoLogin(); }
      else { this.view = 'login'; }
    },

    aggiornaApp() {
      window.leAggiornaApp();
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
        await Promise.all([this.caricaClienti(), this.caricaStatisticheVenditore()]);
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
      this.view = this.isAdmin ? 'admin' : 'lista';
      if (!this.isAdmin) {
        await Promise.all([this.caricaClienti(), this.caricaStatisticheVenditore()]);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    vaiNuovoCliente() {
      if (this.isAdmin) return;
      this.apriNuovoCliente();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    apriAgenda() {
      this.agendaVista = 'oggi';
      this.agendaDataSelezionata = this.dataISOOggi();
      this.agendaMese = this.dataISOOggi().slice(0, 7);
      this.view = 'agenda';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    apriPipeline() {
      this.pipelineIndice = 0;
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

    totaleIncassatoCliente() {
      return this.pagamentiCliente
        .filter(p => p.stato === 'incassato')
        .reduce((totale, p) => totale + (Number(p.importo) || 0), 0);
    },

    totaleVenditaCliente() {
      return Number(this.venditaClienteAttiva?.importo_vendita) || 0;
    },

    residuoCliente() {
      return Math.max(0, this.totaleVenditaCliente() - this.totaleIncassatoCliente());
    },

    statoPagamentoCliente() {
      const totale = this.totaleVenditaCliente();
      const incassato = this.totaleIncassatoCliente();

      if (totale > 0 && incassato >= totale) return 'pagato';
      if (incassato > 0) return 'parziale';
      return 'da_pagare';
    },

    etichettaStatoPagamentoCliente() {
      const stato = this.statoPagamentoCliente();

      if (stato === 'pagato') return 'Pagato';
      if (stato === 'parziale') return 'Parziale';
      return 'Da pagare';
    },

    classeStatoPagamentoCliente() {
      return 'payment-' + this.statoPagamentoCliente();
    },

    async apriPagamentoCliente(cliente = this.clienteSelezionato(), pagamentoPrevisto = null) {
      if (!cliente) return;

      await this.apriEconomia('incasso');
      this.pagamentoPrevistoId = pagamentoPrevisto?.id || null;
      this.clienteEconomiaSelezionato = cliente;

      const { data, error } = await window.supabaseClient
        .from('vendite')
        .select('id,cliente_id,servizio,importo_vendita,data_vendita')
        .eq('cliente_id', cliente.id)
        .eq('stato', 'attiva')
        .order('data_vendita', { ascending: false })
        .order('creato_il', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        this.erroreEconomia = error
          ? 'Vendita non disponibile: ' + error.message
          : 'Nessuna vendita attiva per questo cliente.';
      } else {
        this.venditaEconomicaAttiva = data;
        this.venditaClienteAttiva = data;
        this.venditaEconomicaForm.clienteId = cliente.id;
        this.venditaEconomicaForm.clienteRicerca = cliente.nome || '';
        this.venditaEconomicaForm.servizio = data.servizio || '';
        this.venditaEconomicaForm.importoVendita = Number(data.importo_vendita) || 0;
        this.venditaEconomicaForm.importoIncassato = pagamentoPrevisto
          ? Number(pagamentoPrevisto.importo) || 0
          : this.residuoCliente();
        this.venditaEconomicaForm.dataPagamento = this.dataISOOggi();
      }

      this.view = 'economia';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    async apriEconomia(modalita = 'vendita') {
      this.venditaEconomicaForm = formVenditaEconomicaVuoto();
      this.modalitaEconomia = modalita;
      this.venditaEconomicaAttiva = null;
      this.pagamentoPrevistoId = null;
      this.clienteEconomiaSelezionato = null;
      this.anagraficaEconomiaAperta = false;
      this.erroreEconomia = '';
      this.successoEconomia = '';
      if (modalita === 'vendita') await this.inizializzaPartecipantiEconomia();
      this.view = 'economia';
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

    async inizializzaPartecipantiEconomia() {
      this.erroreEconomia = '';

      const { data, error } = await window.supabaseClient
        .rpc('get_partecipanti_economici');

      if (error) {
        this.venditaEconomicaForm.partecipanti = [];
        this.erroreEconomia =
          'Impossibile caricare i partecipanti: ' + error.message;
        return;
      }

      const profili = data || [];
      const referente = profili.find(p => p.ruolo_economico === 'referente');
      const tomas = profili.find(p => p.ruolo_economico === 'produzione');
      const corrente = profili.find(p => p.id === this.sessione?.user?.id);

      if (!referente) {
        this.erroreEconomia = 'Profilo economico di Alessandro non trovato.';
        this.venditaEconomicaForm.partecipanti = [];
        return;
      }

      if (!tomas) {
        this.erroreEconomia = 'Profilo economico di Tomas non trovato.';
        this.venditaEconomicaForm.partecipanti = [];
        return;
      }

      const creaPartecipante = (profilo, ruolo) => ({
        id: profilo.id,
        nome:
          ruolo === 'referente'
            ? 'Alessandro'
            : ruolo === 'produzione'
              ? 'Tomas'
              : (profilo.username || profilo.nome || 'Venditore'),
        ruolo,
        modalitaFatturazione: 'nessuna',
        importoFatturato: 0,
        faFattura: false,
        haVenduto: false,
        quotaOverride: false,
        quotaEffettiva: null,
        noteQuota: '',
        saldato: false,
        dataSaldo: null,
        bloccato: true
      });

      const partecipanti = [
        creaPartecipante(referente, 'referente')
      ];

      if (tomas.id !== referente.id) {
        partecipanti.push(creaPartecipante(tomas, 'produzione'));
      }

      if (
        corrente &&
        corrente.ruolo !== 'admin' &&
        corrente.id !== referente.id &&
        corrente.id !== tomas.id
      ) {
        partecipanti.push(creaPartecipante(corrente, 'venditore'));
      }

      // Alessandro è il venditore commerciale predefinito nei casi ordinari.
      // La scelta resta sempre modificabile dall'utente.
      const venditoreDefault = partecipanti.find(p => p.ruolo === 'referente');
      if (venditoreDefault) venditoreDefault.haVenduto = true;

      this.venditaEconomicaForm.partecipanti = partecipanti;
    },

    impostaVenditoreEconomia(partecipante) {
      this.venditaEconomicaForm.partecipanti.forEach(p => {
        p.haVenduto = p.id === partecipante.id;
      });
    },

    modalitaFatturazioneAdminEconomia() {
      const valore = this.venditaEconomicaForm.modalitaFatturazioneAdmin;
      return ['totale', 'mista', 'nessuna'].includes(valore)
        ? valore
        : 'nessuna';
    },

    importoFatturatoAdminEconomia() {
      const importo = Math.max(
        0,
        Number(this.venditaEconomicaForm.importoVendita) || 0
      );
      const modalita = this.modalitaFatturazioneAdminEconomia();

      if (modalita === 'totale') return importo;
      if (modalita === 'nessuna') return 0;

      return Math.min(
        importo,
        Math.max(
          0,
          Number(this.venditaEconomicaForm.importoFatturatoAdmin) || 0
        )
      );
    },

    percentualeFatturataAdminEconomia() {
      const importo = Math.max(
        0,
        Number(this.venditaEconomicaForm.importoVendita) || 0
      );
      if (!importo) return 0;
      return this.importoFatturatoAdminEconomia() / importo;
    },

    nettoDistribuibileEconomia() {
      const margine = this.margineEconomia();
      const tasse = percentualeTasseEconomia(
        this.venditaEconomicaForm.partecipanti
      );

      // Se Alessandro non fattura, il margine non viene ridotto.
      // Se fattura solo una parte, le tasse incidono in proporzione.
      const incidenzaTasse =
        (tasse / 100) * this.percentualeFatturataAdminEconomia();

      return Math.max(0, margine * (1 - incidenzaTasse));
    },

    quotaBaseLordaEconomia() {
      const numero = this.venditaEconomicaForm.partecipanti.length;
      if (!numero) return 0;
      return this.margineEconomia() / numero;
    },

    quotaBaseEconomia() {
      const numero = this.venditaEconomicaForm.partecipanti.length;
      if (!numero) return 0;
      return this.nettoDistribuibileEconomia() / numero;
    },

    bonusVenditoreEconomia() {
      const partecipanti = this.venditaEconomicaForm.partecipanti;
      if (partecipanti.length !== 2) return 0;

      const venditore = partecipanti.find(p => p.haVenduto);
      if (!venditore) return 0;

      return this.quotaBaseEconomia() * 0.12;
    },

    quotaTeoricaPartecipanteEconomia(partecipante) {
      const base = this.quotaBaseEconomia();
      const partecipanti = this.venditaEconomicaForm.partecipanti;

      if (partecipanti.length !== 2) return base;

      const bonus = this.bonusVenditoreEconomia();
      if (!bonus) return base;

      if (partecipante.haVenduto) return base + bonus;
      return Math.max(0, base - bonus);
    },

    modalitaFatturazionePartecipanteEconomia(partecipante) {
      const valore = partecipante.modalitaFatturazione || 'nessuna';
      return ['totale', 'mista', 'nessuna'].includes(valore)
        ? valore
        : 'nessuna';
    },

    importoFatturatoPartecipanteEconomia(partecipante, quota = null) {
      const riferimento = Math.max(
        0,
        quota == null
          ? this.quotaTeoricaPartecipanteEconomia(partecipante)
          : Number(quota) || 0
      );
      const modalita =
        this.modalitaFatturazionePartecipanteEconomia(partecipante);

      if (modalita === 'totale') return riferimento;
      if (modalita === 'nessuna') return 0;

      return Math.min(
        riferimento,
        Math.max(0, Number(partecipante.importoFatturato) || 0)
      );
    },

    percentualeNonFatturataPartecipanteEconomia(partecipante) {
      const quota = this.quotaTeoricaPartecipanteEconomia(partecipante);
      if (!quota) return 0;

      return Math.max(
        0,
        Math.min(
          1,
          (quota - this.importoFatturatoPartecipanteEconomia(
            partecipante,
            quota
          )) / quota
        )
      );
    },

    riduzioneNoFatturaPartecipanteEconomia(partecipante) {
      if (
        partecipante.ruolo === 'referente' ||
        percentualeTasseEconomia(this.venditaEconomicaForm.partecipanti) === 60
      ) return 0;

      const quotaTeorica =
        this.quotaTeoricaPartecipanteEconomia(partecipante);
      const riduzione = Math.max(
        0,
        Math.min(
          100,
          Number(this.venditaEconomicaForm.percentualeRiduzioneNoFattura) || 0
        )
      );

      // La riduzione del 20% esiste solo sulla quota collegata alla
      // parte fatturata da Alessandro e non fatturata dal collaboratore.
      return (
        quotaTeorica *
        this.percentualeFatturataAdminEconomia() *
        this.percentualeNonFatturataPartecipanteEconomia(partecipante) *
        (riduzione / 100)
      );
    },

    bonusNoFatturaAdminEconomia() {
      return this.venditaEconomicaForm.partecipanti
        .filter(p => p.ruolo !== 'referente')
        .reduce(
          (totale, p) =>
            totale + this.riduzioneNoFatturaPartecipanteEconomia(p),
          0
        );
    },

    quotaEffettivaPartecipanteEconomia(partecipante, quotaCalcolata = null) {
      const calcolata = Math.max(
        0,
        quotaCalcolata == null
          ? this.calcoloPartecipanteEconomia(partecipante).quotaCalcolata
          : Number(quotaCalcolata) || 0
      );

      if (!partecipante.quotaOverride) return calcolata;

      const valore = Number(partecipante.quotaEffettiva);
      return Number.isFinite(valore) && valore >= 0 ? valore : calcolata;
    },

    calcoloPartecipanteEconomia(partecipante) {
      const quotaBase = this.quotaBaseEconomia();
      const quotaTeorica =
        this.quotaTeoricaPartecipanteEconomia(partecipante);

      const bonusVendita =
        partecipante.haVenduto &&
        this.venditaEconomicaForm.partecipanti.length === 2
          ? this.bonusVenditoreEconomia()
          : 0;

      const percentualeRiduzione =
        Number(this.venditaEconomicaForm.percentualeRiduzioneNoFattura) || 0;

      const riduzioneNoFattura =
        this.riduzioneNoFatturaPartecipanteEconomia(partecipante);

      const bonusAdmin =
        partecipante.ruolo === 'referente'
          ? this.bonusNoFatturaAdminEconomia()
          : 0;

      const quotaCalcolata = Math.max(
        0,
        quotaTeorica - riduzioneNoFattura + bonusAdmin
      );

      const quotaEffettiva = partecipante.quotaOverride
        ? Math.max(0, Number(partecipante.quotaEffettiva) || 0)
        : quotaCalcolata;

      const percentualeTasseEffettiva =
        percentualeTasseEconomia(this.venditaEconomicaForm.partecipanti) *
        this.percentualeFatturataAdminEconomia();

      const importoTasse = Math.max(
        0,
        this.quotaBaseLordaEconomia() - quotaBase
      );

      const importoFatturato =
        partecipante.ruolo === 'referente'
          ? this.importoFatturatoAdminEconomia()
          : this.importoFatturatoPartecipanteEconomia(
              partecipante,
              quotaTeorica
            );

      return {
        quotaBase,
        quotaTeorica,
        bonusVendita,
        riduzioneNoFattura,
        bonusAdmin,
        quotaCalcolata,
        quotaFinale: quotaEffettiva,
        quotaEffettiva,
        percentualeRiduzione,
        percentualeTasseEffettiva,
        importoTasse,
        importoFatturato,
        importoNonFatturato:
          partecipante.ruolo === 'referente'
            ? Math.max(
                0,
                (Number(this.venditaEconomicaForm.importoVendita) || 0) -
                  this.importoFatturatoAdminEconomia()
              )
            : Math.max(0, quotaTeorica - importoFatturato)
      };
    },

    totaleQuoteFinaliEconomia() {
      return this.venditaEconomicaForm.partecipanti.reduce(
        (totale, partecipante) =>
          totale + this.calcoloPartecipanteEconomia(partecipante).quotaFinale,
        0
      );
    },

    totaleTrattenuteEconomia() {
      return this.venditaEconomicaForm.partecipanti
        .filter(partecipante => partecipante.ruolo !== 'referente')
        .reduce(
          (totale, partecipante) =>
            totale +
            this.calcoloPartecipanteEconomia(partecipante).riduzioneNoFattura,
          0
        );
    },

    etichettaRuoloEconomia(ruolo) {
      if (ruolo === 'referente') return 'Referente';
      if (ruolo === 'produzione') return 'Produzione sito';
      if (ruolo === 'venditore') return 'Venditore';
      return 'Collaboratore';
    },

    apriAnagraficaEconomia() {
      if (!this.clienteEconomiaSelezionato) return;
      this.anagraficaEconomiaAperta = true;
    },

    chiudiAnagraficaEconomia() {
      this.anagraficaEconomiaAperta = false;
    },

    creaCostoEconomia(descrizione, importo) {
      return {
        id: `${Date.now()}-${Math.random()}`,
        descrizione,
        importo
      };
    },

    impostaCostiClienteEconomia(cliente) {
      this.venditaEconomicaForm.costi = costiGestioneCliente(cliente)
        .map(costo => this.creaCostoEconomia(costo.descrizione, costo.importo));
    },

    clientiEconomiaFiltrati() {
      const testo = (this.venditaEconomicaForm.clienteRicerca || '')
        .trim()
        .toLowerCase();

      if (!testo || this.clienteEconomiaSelezionato) return [];

      return this.clienti
        .filter(cliente => {
          return [
            cliente.nome,
            cliente.referente,
            cliente.telefono,
            cliente.email,
            cliente.piva
          ]
            .filter(Boolean)
            .some(valore => String(valore).toLowerCase().includes(testo));
        })
        .slice(0, 8);
    },

    selezionaClienteEconomia(cliente) {
      if (this.modalitaEconomia === 'incasso') return this.apriPagamentoCliente(cliente);

      this.clienteEconomiaSelezionato = cliente;
      this.venditaEconomicaForm.clienteId = cliente.id;
      this.venditaEconomicaForm.clienteRicerca = cliente.nome || '';

      this.venditaEconomicaForm.servizio =
        cliente.nome_pacchetto || 'Servizio registrato';

      this.venditaEconomicaForm.importoVendita =
        Number(cliente.importo_abbonamento) || 0;

      this.venditaEconomicaForm.importoIncassato =
        Number(cliente.importo_abbonamento) || 0;

      this.impostaCostiClienteEconomia(cliente);
    },

    cambiaClienteEconomia() {
      this.clienteEconomiaSelezionato = null;
      this.anagraficaEconomiaAperta = false;
      this.venditaEconomicaForm.clienteId = null;
      this.venditaEconomicaForm.clienteRicerca = '';
      this.venditaEconomicaForm.servizio = '';
      this.venditaEconomicaForm.importoVendita = null;
      this.venditaEconomicaForm.importoIncassato = null;
      this.venditaEconomicaForm.costi = [];
    },

    aggiungiCostoEconomia(descrizione = '', importo = null) {
      const nome = (descrizione || '').trim();
      const valore = Number(importo);

      if (!nome || !Number.isFinite(valore) || valore < 0) return;

      this.venditaEconomicaForm.costi.push({
        id: `${Date.now()}-${Math.random()}`,
        descrizione: nome,
        importo: valore
      });

      this.venditaEconomicaForm.costoDescrizione = '';
      this.venditaEconomicaForm.costoImporto = null;
    },

    aggiungiCostoManualeEconomia() {
      this.aggiungiCostoEconomia(
        this.venditaEconomicaForm.costoDescrizione,
        this.venditaEconomicaForm.costoImporto
      );
    },

    rimuoviCostoEconomia(id) {
      this.venditaEconomicaForm.costi =
        this.venditaEconomicaForm.costi.filter(costo => costo.id !== id);
    },

    totaleCostiEconomia() {
      return this.venditaEconomicaForm.costi.reduce(
        (totale, costo) => totale + (Number(costo.importo) || 0),
        0
      );
    },

    margineEconomia() {
      const vendita = Number(this.venditaEconomicaForm.importoVendita) || 0;
      return Math.max(0, vendita - this.totaleCostiEconomia());
    },

    formattaEuroEconomia(valore) {
      return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR'
      }).format(Number(valore) || 0);
    },

    validaVenditaEconomica() {
      if (!this.venditaEconomicaForm.clienteId) {
        return 'Seleziona un cliente.';
      }

      if (!(Number(this.venditaEconomicaForm.importoVendita) > 0)) {
        return 'L\'importo della vendita deve essere maggiore di zero.';
      }

      if (!this.venditaEconomicaForm.partecipanti.length) {
        return 'Nessun partecipante disponibile.';
      }

      if (!this.venditaEconomicaForm.partecipanti.some(p => p.haVenduto)) {
        return 'Indica chi ha effettuato la vendita.';
      }

      if (this.modalitaFatturazioneAdminEconomia() === 'mista') {
        const fatturatoAdmin = this.importoFatturatoAdminEconomia();
        const totaleVendita =
          Number(this.venditaEconomicaForm.importoVendita) || 0;

        if (!(fatturatoAdmin > 0 && fatturatoAdmin < totaleVendita)) {
          return (
            'La parte fatturata da Alessandro deve essere maggiore di 0 ' +
            'e minore del totale vendita.'
          );
        }
      }

      for (const partecipante of this.venditaEconomicaForm.partecipanti) {
        if (
          partecipante.ruolo !== 'referente' &&
          this.modalitaFatturazionePartecipanteEconomia(partecipante) ===
            'mista'
        ) {
          const quota =
            this.calcoloPartecipanteEconomia(partecipante).quotaTeorica;
          const fatturato = Number(partecipante.importoFatturato) || 0;
          if (!(fatturato > 0 && fatturato < quota)) {
            return (
              'Per ' + partecipante.nome +
              ' la fattura mista deve essere maggiore di 0 e minore della quota.'
            );
          }
        }
      }

      const incasso = Math.max(
        0,
        Number(this.venditaEconomicaForm.importoIncassato) || 0
      );
      const vendita = Number(this.venditaEconomicaForm.importoVendita) || 0;

      if (this.venditaEconomicaForm.statoIncasso === 'incassato') {
        if (!(incasso > 0 && incasso <= vendita)) {
          return 'Inserisci un importo incassato valido.';
        }
      }

      if (this.venditaEconomicaForm.statoIncasso === 'parziale') {
        if (!(incasso > 0 && incasso < vendita)) {
          return 'Il pagamento parziale deve essere maggiore di 0 e minore del totale.';
        }
      }

      if (this.venditaEconomicaForm.statoIncasso === 'previsto') {
        if (!(incasso > 0 && incasso <= vendita)) return 'Inserisci un importo rata valido.';
        if (!this.venditaEconomicaForm.dataScadenza) return 'Inserisci la scadenza della rata.';
      }

      return '';
    },

    validaIncassoEconomia() {
      if (!this.venditaEconomicaAttiva) return 'Nessuna vendita attiva disponibile.';
      const importo = Number(this.venditaEconomicaForm.importoIncassato) || 0;
      const massimo = this.residuoCliente();
      if (!(importo > 0 && importo <= massimo)) return 'Inserisci un importo non superiore al residuo.';
      if (this.venditaEconomicaForm.statoIncasso === 'previsto' && !this.venditaEconomicaForm.dataScadenza) {
        return 'Inserisci la scadenza della rata.';
      }
      return '';
    },

    async salvaIncassoEconomia() {
      if (this.salvandoVenditaEconomica) return;
      this.erroreEconomia = this.validaIncassoEconomia();
      this.successoEconomia = '';
      if (this.erroreEconomia) return;

      this.salvandoVenditaEconomica = true;
      try {
        const previsto = this.venditaEconomicaForm.statoIncasso === 'previsto';
        const { error } = await window.supabaseClient.rpc('registra_pagamento_vendita', {
          p_vendita_id: this.venditaEconomicaAttiva.id,
          p_importo: Number(this.venditaEconomicaForm.importoIncassato),
          p_stato: previsto ? 'previsto' : 'incassato',
          p_data_scadenza: previsto ? this.venditaEconomicaForm.dataScadenza : null,
          p_data_pagamento: previsto ? null : (this.venditaEconomicaForm.dataPagamento || this.dataISOOggi()),
          p_metodo: (this.venditaEconomicaForm.metodoPagamento || '').trim() || null,
          p_note: (this.venditaEconomicaForm.notePagamento || '').trim() || null,
          p_pagamento_previsto_id: this.pagamentoPrevistoId
        });

        if (error) {
          this.erroreEconomia = 'Pagamento non salvato: ' + error.message;
          return;
        }

        this.successoEconomia = previsto ? 'Rata prevista registrata.' : 'Incasso registrato.';
        await this.caricaPagamentiCliente(this.venditaEconomicaAttiva.cliente_id);
        if (this.isAdmin) await this.caricaDashboardAdmin();
        else await Promise.all([this.caricaClienti(), this.caricaStatisticheVenditore()]);
      } finally {
        this.salvandoVenditaEconomica = false;
      }
    },

    salvaEconomia() {
      return this.modalitaEconomia === 'incasso'
        ? this.salvaIncassoEconomia()
        : this.salvaVenditaEconomica();
    },

    async salvaVenditaEconomica() {
      if (this.salvandoVenditaEconomica) return;

      this.erroreEconomia = this.validaVenditaEconomica();
      this.successoEconomia = '';
      if (this.erroreEconomia) return;

      const venditore =
        this.venditaEconomicaForm.partecipanti.find(p => p.haVenduto);
      const referente =
        this.venditaEconomicaForm.partecipanti.find(p => p.ruolo === 'referente');

      if (!venditore || !referente) {
        this.erroreEconomia = 'Venditore o referente economico non disponibile.';
        return;
      }

      const partecipanti = this.venditaEconomicaForm.partecipanti.map(p => {
        const calcolo = this.calcoloPartecipanteEconomia(p);
        const modalita = p.ruolo === 'referente'
          ? this.modalitaFatturazioneAdminEconomia()
          : this.modalitaFatturazionePartecipanteEconomia(p);

        return {
          profilo_id: p.id,
          ruolo: p.ruolo,
          fa_fattura: modalita === 'totale',
          quota_base: calcolo.quotaBase,
          percentuale_tasse: calcolo.percentualeTasseEffettiva,
          importo_tasse: calcolo.importoTasse,
          percentuale_riduzione:
            p.ruolo === 'referente' ? 0 : calcolo.percentualeRiduzione,
          importo_riduzione: calcolo.riduzioneNoFattura,
          importo_trasferito_admin:
            p.ruolo === 'referente' ? 0 : calcolo.riduzioneNoFattura,
          quota_finale: calcolo.quotaFinale,
          modalita_fatturazione: modalita,
          importo_fatturato: calcolo.importoFatturato,
          quota_calcolata: calcolo.quotaCalcolata,
          quota_effettiva: calcolo.quotaEffettiva,
          quota_override: !!p.quotaOverride,
          note_quota: (p.noteQuota || '').trim() || null,
          saldato: !!p.saldato,
          data_saldo: p.saldato
            ? (p.dataSaldo || this.dataISOOggi())
            : null
        };
      });

      const statoIncasso = this.venditaEconomicaForm.statoIncasso;
      let pagamento = null;

      if (Number(this.venditaEconomicaForm.importoIncassato) > 0) {
        pagamento = {
          importo: Number(this.venditaEconomicaForm.importoIncassato),
          stato: statoIncasso === 'previsto' ? 'previsto' : 'incassato',
          data_scadenza: statoIncasso === 'previsto'
            ? this.venditaEconomicaForm.dataScadenza
            : null,
          data_pagamento: statoIncasso === 'previsto'
            ? null
            : (this.venditaEconomicaForm.dataPagamento || null),
          metodo: (this.venditaEconomicaForm.metodoPagamento || '').trim() || null,
          note: (this.venditaEconomicaForm.notePagamento || '').trim() || null
        };
      }

      const payloadVendita = {
        cliente_id: this.venditaEconomicaForm.clienteId,
        venditore_id: venditore.id,
        admin_id: referente.id,
        servizio:
          this.venditaEconomicaForm.servizio || 'Servizio registrato',
        descrizione: null,
        importo_vendita:
          Number(this.venditaEconomicaForm.importoVendita) || 0,
        data_vendita: this.dataISOOggi(),
        modalita_fatturazione_admin:
          this.modalitaFatturazioneAdminEconomia(),
        importo_fatturato_admin: this.importoFatturatoAdminEconomia(),
        percentuale_tasse_admin: percentualeTasseEconomia(
          this.venditaEconomicaForm.partecipanti
        )
      };

      const costi = this.venditaEconomicaForm.costi.map(c => ({
        descrizione: c.descrizione,
        importo: Number(c.importo) || 0
      }));

      this.salvandoVenditaEconomica = true;

      try {
        const { data, error } = await window.supabaseClient.rpc(
          'registra_vendita_economica',
          {
            p_vendita: payloadVendita,
            p_costi: costi,
            p_partecipanti: partecipanti,
            p_pagamento: pagamento
          }
        );

        if (error) {
          this.erroreEconomia = error.code === '23505'
            ? 'Questo cliente ha già una vendita attiva. Usa Incassa oppure annulla prima la vendita esistente.'
            : 'Vendita non salvata: ' + error.message;
          return;
        }

        this.successoEconomia = 'Vendita registrata correttamente.';

        const clienteId = this.venditaEconomicaForm.clienteId;

        if (this.isAdmin) {
          await this.caricaDashboardAdmin();
        } else {
          await Promise.all([
            this.caricaClienti(),
            this.caricaStatisticheVenditore()
          ]);
        }

        if (clienteId) {
          this.clienteSelezionatoId = clienteId;
          await Promise.all([
        this.caricaPagamentiCliente(clienteId),
        this.caricaAttivitaCliente(clienteId)
      ]);
        }

        window.setTimeout(() => {
          if (this.successoEconomia) this.vaiHome();
        }, 700);
      } finally {
        this.salvandoVenditaEconomica = false;
      }
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
        this.view = this.clienteInModificaId
          ? 'scheda'
          : (this.isAdmin ? 'admin' : 'lista');
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

    apriProfilo() {
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
      if (error) { this.erroreClienti = 'Errore nel caricare i clienti: ' + error.message; return; }
      const idsAttribuiti = new Set(this.adminClientiPerVenditore[venditoreId] || []);
      this.clienti = usaAttribuzioneCondivisa
        ? data.filter(cliente => idsAttribuiti.has(cliente.id))
        : data;
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

      const clienteIds = this.clienti.map(cliente => cliente.id).filter(Boolean);
      if (!clienteIds.length) return;

      const { data: vendite, error: venditeError } = await window.supabaseClient
        .from('vendite')
        .select('id,cliente_id')
        .in('cliente_id', clienteIds)
        .eq('stato', 'attiva');

      if (venditeError) {
        console.warn('Scadenze pagamento non disponibili:', venditeError.message);
        return;
      }

      const venditePerId = Object.fromEntries(
        (vendite || []).map(vendita => [vendita.id, vendita])
      );
      const venditaIds = Object.keys(venditePerId);
      if (!venditaIds.length) return;

      const { data: pagamenti, error: pagamentiError } = await window.supabaseClient
        .from('pagamenti')
        .select('id,vendita_id,importo,stato,data_scadenza')
        .in('vendita_id', venditaIds)
        .eq('stato', 'previsto')
        .not('data_scadenza', 'is', null)
        .order('data_scadenza', { ascending: true });

      if (pagamentiError) {
        console.warn('Scadenze pagamento non disponibili:', pagamentiError.message);
        return;
      }

      const prossime = {};
      (pagamenti || []).forEach(pagamento => {
        const vendita = venditePerId[pagamento.vendita_id];
        const clienteId = vendita?.cliente_id;
        const data = this.normalizzaDataAgenda(pagamento.data_scadenza);
        if (!clienteId || !data) return;

        (prossime[clienteId] ||= []).push({
          id: pagamento.id,
          tipo: 'rata',
          label: 'Rata',
          data,
          importo: Number(pagamento.importo) || 0
        });
      });

      this.scadenzePagamentoPerCliente = prossime;
    },

    prossimaScadenzaCliente(cliente) {
      if (!cliente?.id) return null;

      const scadenze = [];
      const rinnovo = this.normalizzaDataAgenda(cliente.data_rinnovo);
      if (rinnovo) {
        scadenze.push({
          tipo: 'rinnovo',
          label: 'Rinnovo',
          data: rinnovo,
          importo: null
        });
      }

      const rata = this.scadenzePagamentoPerCliente[cliente.id]?.[0];
      if (rata?.data) scadenze.push(rata);

      if (!scadenze.length) return null;
      return scadenze.sort((a, b) => a.data.localeCompare(b.data))[0];
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
      this.statisticheVenditore = {
        generato: 0,
        incassato: 0,
        venduto: 0,
        mediaVendita: 0,
        numeroVendite: 0
      };

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
      if (!ids.length) return;

      const [vendite, pagamenti] = await Promise.all([
        window.supabaseClient
          .from('vendite')
          .select('id,cliente_id,importo_vendita,stato,venditore_id')
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
        Object.fromEntries(this.clienti.map(cliente => [cliente.id, cliente]))
      );
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
    },

    clientiPipeline(stato) {
      return this.clienti
        .filter(c => c.stato === stato)
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    },

    statiPipeline() {
      return [
        { valore: 'contattato', label: 'Contattato' },
        { valore: 'brief_mandato', label: 'Brief mandato' },
        { valore: 'in_lavorazione', label: 'In lavorazione' },
        { valore: 'pubblicato', label: 'Pubblicato' }
      ];
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
      const consentiti = ['contattato', 'brief_mandato', 'in_lavorazione', 'pubblicato'];
      if (!clienteId || !consentiti.includes(stato)) {
        return 'Stato non valido';
      }

      const { error } = await window.supabaseClient
        .rpc('imposta_stato_cliente', {
          p_cliente_id: clienteId,
          p_stato: stato
        });

      return error ? error.message : '';
    },

    async cambiaStatoDaPipeline(clienteId, stato) {
      this.erroreClienti = '';

      const errore = await this.impostaStatoCliente(clienteId, stato);

      if (errore) {
        this.erroreClienti = 'Stato non aggiornato: ' + errore;
        return;
      }

      await this.caricaClienti();
    },

    clienteAzioniRapide() {
      return this.clienti.find(
        cliente => cliente.id === this.clienteAzioniRapideId
      ) || {};
    },

    apriAzioniCliente(clienteId) {
      const cliente = this.clienti.find(c => c.id === clienteId);
      if (!cliente) return;

      this.clienteAzioniRapideId = clienteId;
      this.clienteAzioniStatoAperto = false;
      this.clienteAzioniContattoAperto = false;
      this.clienteAzioniNotaAperta = false;
      this.clienteNotaRapidaTesto = '';
      this.messaggioAzioneCliente = '';
      this.erroreAzioneCliente = '';
      this.clienteProssimoContattoData =
        this.normalizzaDataAgenda(cliente.prossimo_contatto) || '';
    },

    chiudiAzioniCliente() {
      this.clienteAzioniRapideId = null;
      this.clienteAzioniStatoAperto = false;
      this.clienteAzioniContattoAperto = false;
      this.clienteAzioniNotaAperta = false;
      this.clienteProssimoContattoData = '';
      this.clienteNotaRapidaTesto = '';
      this.messaggioAzioneCliente = '';
      this.erroreAzioneCliente = '';
    },

    async apriSchedaDaAzioni(sezione = null) {
      const clienteId = this.clienteAzioniRapideId;
      if (!clienteId) return;

      this.chiudiAzioniCliente();
      await this.apriScheda(clienteId);

      if (sezione && Object.prototype.hasOwnProperty.call(this.schedaAperture, sezione)) {
        this.schedaAperture[sezione] = true;
      }

      if (sezione === 'note') {
        setTimeout(() => {
          document.querySelector('textarea[x-model="nuovaNotaTesto"]')?.focus();
        }, 80);
      }
    },

    async cambiaStatoDaAzioni(stato) {
      const clienteId = this.clienteAzioniRapideId;
      if (!clienteId) return;

      this.erroreClienti = '';
      await this.cambiaStatoDaPipeline(clienteId, stato);

      if (!this.erroreClienti) {
        this.chiudiAzioniCliente();
      }
    },

    async salvaNotaRapida() {
      const clienteId = this.clienteAzioniRapideId;
      const testo = (this.clienteNotaRapidaTesto || '').trim();
      const venditoreId = this.sessione && this.sessione.user
        ? this.sessione.user.id
        : null;

      this.messaggioAzioneCliente = '';
      this.erroreAzioneCliente = '';

      if (!clienteId) {
        this.erroreAzioneCliente = 'Cliente non disponibile.';
        return;
      }

      if (!testo) {
        this.erroreAzioneCliente = 'Scrivi prima una nota.';
        return;
      }

      if (!venditoreId) {
        this.erroreAzioneCliente = 'Sessione non disponibile.';
        return;
      }

      if (this.salvandoNotaRapida) return;

      this.salvandoNotaRapida = true;

      try {
        const { data, error } = await window.supabaseClient
          .from('note')
          .insert({
            cliente_id: clienteId,
            venditore_id: venditoreId,
            testo
          })
          .select()
          .single();

        if (error) {
          console.error('Errore nota rapida:', error);
          this.erroreAzioneCliente = 'Nota non salvata: ' + error.message;
          return;
        }

        this.clienteNotaRapidaTesto = '';
        this.erroreAzioneCliente = '';
        this.messaggioAzioneCliente = 'Nota salvata';

        if (this.clienteSelezionatoId === clienteId && data) {
          this.note = [data, ...this.note.filter(n => n.id !== data.id)];
        }

        window.setTimeout(() => {
          if (this.messaggioAzioneCliente === 'Nota salvata') {
            this.chiudiAzioniCliente();
          }
        }, 650);

      } catch (err) {
        console.error('Errore nota rapida:', err);
        this.erroreAzioneCliente =
          'Errore durante il salvataggio della nota.';
      } finally {
        this.salvandoNotaRapida = false;
      }
    },

    async salvaProssimoContattoRapido() {
      const clienteId = this.clienteAzioniRapideId;

      this.messaggioAzioneCliente = '';
      this.erroreAzioneCliente = '';

      if (!clienteId || this.salvandoProssimoContattoRapido) return;

      this.salvandoProssimoContattoRapido = true;

      try {
        const { error } = await window.supabaseClient
          .rpc('imposta_prossimo_contatto_cliente', {
            p_cliente_id: clienteId,
            p_data: this.clienteProssimoContattoData || null
          });

        if (error) {
          console.error('Errore prossimo contatto:', error);
          this.erroreAzioneCliente =
            'Data non salvata: ' + error.message;
          return;
        }

        await this.caricaClienti();

        this.messaggioAzioneCliente =
          this.clienteProssimoContattoData
            ? 'Prossimo contatto salvato'
            : 'Prossimo contatto rimosso';

        window.setTimeout(() => {
          this.chiudiAzioniCliente();
        }, 650);

      } catch (err) {
        console.error('Errore prossimo contatto:', err);
        this.erroreAzioneCliente =
          'Errore durante il salvataggio.';
      } finally {
        this.salvandoProssimoContattoRapido = false;
      }
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

    telefonoPulito(cliente) {
      return String(cliente?.telefono || '').replace(/[^\d+]/g, '');
    },

    whatsappCliente(cliente) {
      const numero = String(cliente?.telefono || '').replace(/\D/g, '');
      return numero ? `https://wa.me/${numero}` : '';
    },

    sitoCliente(cliente) {
      const sito = String(cliente?.sito_url || '').trim();
      if (!sito) return '';
      if (/^https?:\/\//i.test(sito)) return sito;
      return `https://${sito}`;
    },

    async copiaTestoCliente(valore) {
      const testo = String(valore || '').trim();
      if (!testo) return;

      try {
        await navigator.clipboard.writeText(testo);
      } catch {
        this.erroreScheda = 'Impossibile copiare automaticamente questo dato.';
      }
    },

    clientiConRinnovoVicino(giorni = 30) {
      const oggi = new Date();
      const oggiUTC = Date.UTC(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());

      return this.clienti
        .filter(c => {
          if (!c.data_rinnovo) return false;
          const data = Date.parse(`${c.data_rinnovo}T00:00:00Z`);
          const diff = Math.ceil((data - oggiUTC) / 86400000);
          return diff >= 0 && diff <= giorni;
        })
        .sort((a, b) => (a.data_rinnovo || '').localeCompare(b.data_rinnovo || ''));
    },

    etichettaImportoCliente(cliente) {
      if (cliente.importo_abbonamento == null) return '-';

      const importo = this.formattaNumeroEuro(cliente.importo_abbonamento);
      const durata = Number(cliente.durata_contratto_anni) || 0;

      if (cliente.periodicita_contratto === 'mensile') return `${importo}/mese`;
      if (cliente.periodicita_contratto === 'annuale') return `${importo}/anno`;

      // Contratti legacy/custom senza periodicità esplicita:
      // se la durata è nota, mostra il valore sull'intero periodo.
      if (durata > 1) return `${importo}/${durata} anni`;
      if (durata === 1) return `${importo}/anno`;

      return importo;
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
      return this.clienti.filter(c => c.stato === 'pubblicato');
    },

    conteggiPerStato() {
      const conteggi = { contattato: 0, brief_mandato: 0, in_lavorazione: 0, pubblicato: 0 };
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

    // --- form cliente: nuovo + modifica condividono la stessa vista ---
    apriNuovoCliente() {
      this.clienteInModificaId = null;
      this.nuovoClienteForm = formModuloVuoto();
      this.selezionePrezzo = { modalita: 'catalogo', formula: 'mensile', upgrade: [] };
      this.nuovoClienteForm.periodicita_contratto = 'mensile';
      this.nuovoClienteForm.giorni_preavviso_notifica = 7;
      this.aggiornaPrezzoCliente();
      this.erroriNuovoCliente = {};
      this.view = 'nuovo';
    },

    apriModificaCliente(clienteId) {
      const c = this.clienti.find(x => x.id === clienteId);
      if (!c) return;
      this.clienteInModificaId = clienteId;
      this.nuovoClienteForm = {
        nome: c.nome || '', referente: c.referente || '', telefono: c.telefono || '',
        email: c.email || '', piva: c.piva || '', iban: c.iban || '',
        sito_url: c.sito_url || '', importo_abbonamento: c.importo_abbonamento,
        nome_pacchetto: c.nome_pacchetto || '', note_prezzo: c.note_prezzo || '',
        data_rinnovo: c.data_rinnovo || null,
        data_attivazione: c.data_attivazione || '',
        periodicita_contratto: c.periodicita_contratto || (
          c.nome_pacchetto === 'Start annuale' ? 'annuale' :
          c.nome_pacchetto === 'Start mensile' ? 'mensile' : null
        ),
        durata_contratto_anni: Math.max(1, Math.min(4, Number(c.durata_contratto_anni) || 1)),
        giorni_preavviso_notifica: Number(c.giorni_preavviso_notifica) || 7,
        sconto_tipo: c.sconto_tipo || '',
        sconto_valore: Number(c.sconto_valore) || 0,
        sconto_durata_anni: c.sconto_durata_anni == null
          ? null
          : Math.max(1, Math.min(
              Number(c.durata_contratto_anni) || 4,
              Number(c.sconto_durata_anni) || 1
            )),
        pagine_extra: Number(c.pagine_extra) || 0,
        lingue_extra: Number(c.lingue_extra) || 0,
        cliente_ha_dominio: c.cliente_ha_dominio !== false,
        dominio_it: !!c.dominio_it,
        dominio_com: !!c.dominio_com,
        email_5_caselle: !!c.email_5_caselle,
        pacchetto_sicurezza: !!c.pacchetto_sicurezza
      };
      this.ripristinaSelezionePrezzo(c);
      this.erroriNuovoCliente = {};
      this.view = 'nuovo';
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
      return (this.nuovoClienteForm.dominio_it ? a.dominioIt.prezzo : 0)
        + (this.nuovoClienteForm.dominio_com ? a.dominioCom.prezzo : 0)
        + (this.nuovoClienteForm.email_5_caselle ? a.email5.prezzo : 0);
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
        if (this.nuovoClienteForm.dominio_it) annuali.push('Dominio .it');
        if (this.nuovoClienteForm.dominio_com) annuali.push('Dominio .com');
        if (this.nuovoClienteForm.email_5_caselle) annuali.push('Email 5 caselle');
        if (annuali.length) d.push(`Annuali: ${annuali.join(', ')}`);
      }
      if (f.id === 'mensile' && this.nuovoClienteForm.pacchetto_sicurezza) d.push('Pacchetto sicurezza 100 € una tantum');
      d.unshift(f.id === 'annuale' ? 'Setup incluso' : 'Setup: 150 € una tantum');
      this.nuovoClienteForm.note_prezzo = d.join(' · ');
    },

    riepilogoSetupPrezzo() { return this.selezionePrezzo.formula==='annuale'?'Setup incluso':'Setup: 150 € una tantum'; },
    riepilogoUpgradePrezzo() { const m=this.prezzoUpgradeMensile(); if(!m)return ''; return this.selezionePrezzo.formula==='annuale'?`Upgrade: +${this.formattaNumeroEuro(m*12)}/anno`:`Upgrade: +${this.formattaNumeroEuro(m)}/mese`; },
    formattaNumeroEuro(v) { return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v)||0); },
    calcolaProssimoRinnovo(dataAttivazione, periodicita) {
      if (!dataAttivazione || !['mensile','annuale'].includes(periodicita)) return null;

      const parti = dataAttivazione.split('-').map(Number);
      if (parti.length !== 3 || parti.some(Number.isNaN)) return null;

      const [annoBase, meseBase, giornoBase] = parti;
      const oggi = new Date();
      const oggiUTC = Date.UTC(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());

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
      const pacchetto = (c.nome_pacchetto || '').trim();
      const eCatalogo = pacchetto === 'Start mensile' || pacchetto === 'Start annuale';
      if (!eCatalogo) {
        this.selezionePrezzo = { modalita: 'legacy', formula: 'mensile', upgrade: [] };
        return;
      }
      const n = c.note_prezzo || '';
      const f = pacchetto === 'Start annuale' ? 'annuale' : 'mensile';
      const cat = this.catalogoPrezzi();
      const u = cat.upgrade.filter(x => n.includes(x.nome)).map(x => x.id);
      this.selezionePrezzo = { modalita: 'catalogo', formula: f, upgrade: u };
      this.nuovoClienteForm.pagine_extra = Number(c.pagine_extra) || 0;
      this.nuovoClienteForm.lingue_extra = Number(c.lingue_extra) || 0;
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

    async salvaCliente() {
      if (this.salvandoCliente) return;
      if (this.selezionePrezzo.modalita === 'catalogo') {
        this.aggiornaPrezzoCliente();
        this.aggiornaPreviewRinnovo();

        if (!this.nuovoClienteForm.data_attivazione) {
          this.erroriNuovoCliente = {
            ...this.erroriNuovoCliente,
            data_attivazione: 'Inserisci la data di attivazione.'
          };
          return;
        }
      }
      const check = validaClienteForm(this.nuovoClienteForm);
      this.erroriNuovoCliente = check.errori;
      if (!check.valido) return;

      const cliente = normalizzaClientePerSalvataggio(this.nuovoClienteForm);
      this.salvandoCliente = true;
      try {
        if (this.clienteInModificaId) {
          const { error } = await window.supabaseClient.from('clienti')
            .update(cliente).eq('id', this.clienteInModificaId);
          if (error) { this.erroriNuovoCliente.generale = 'Salvataggio fallito: ' + error.message; return; }
        } else {
          const { error } = await window.supabaseClient.from('clienti').insert({
            ...cliente,
            venditore_id: this.sessione.user.id
          });
          if (error) { this.erroriNuovoCliente.generale = 'Salvataggio fallito: ' + error.message; return; }
        }

        const idModificato = this.clienteInModificaId;
        this.clienteInModificaId = null;
        this.nuovoClienteForm = formModuloVuoto();
        await Promise.all([this.caricaClienti(), this.caricaStatisticheVenditore()]);
        this.view = idModificato ? 'scheda' : 'lista';
        if (idModificato) { this.clienteSelezionatoId = idModificato; }
      } finally {
        this.salvandoCliente = false;
      }
    },

    clienteSelezionato() {
      return this.clienti.find(c => c.id === this.clienteSelezionatoId) || {};
    },

    async caricaPagamentiCliente(clienteId) {
      this.venditaClienteAttiva = null;
      this.pagamentiCliente = [];
      this.errorePagamentiCliente = '';
      if (!clienteId) return;

      this.caricandoPagamentiCliente = true;
      try {
        const { data: vendite, error: errVendite } = await window.supabaseClient
          .from('vendite')
          .select('id,importo_vendita,servizio,data_vendita')
          .eq('cliente_id', clienteId)
          .eq('stato', 'attiva')
          .order('data_vendita', { ascending: false })
          .order('creato_il', { ascending: false })
          .limit(1);

        if (errVendite) {
          this.errorePagamentiCliente = errVendite.message;
          return;
        }

        this.venditaClienteAttiva = (vendite || [])[0] || null;
        const ids = this.venditaClienteAttiva ? [this.venditaClienteAttiva.id] : [];
        if (!ids.length) return;

        const { data, error } = await window.supabaseClient
          .from('pagamenti')
          .select('*')
          .in('vendita_id', ids)
          .order('data_pagamento', { ascending: false, nullsFirst: false })
          .order('creato_il', { ascending: false });

        if (error) {
          this.errorePagamentiCliente = error.message;
          return;
        }

        this.pagamentiCliente = data || [];
      } finally {
        this.caricandoPagamentiCliente = false;
      }
    },

    async caricaAttivitaCliente(clienteId) {
      this.attivitaCliente = [];
      if (!clienteId) return;

      this.caricandoAttivitaCliente = true;

      try {
        const { data, error } = await window.supabaseClient
          .from('attivita_clienti')
          .select('*')
          .eq('cliente_id', clienteId)
          .order('creata_il', { ascending: false });

        if (error) {
          this.erroreScheda =
            'Timeline non disponibile: ' + error.message;
          return;
        }

        this.attivitaCliente = data || [];
      } finally {
        this.caricandoAttivitaCliente = false;
      }
    },

    timelineCliente() {
      const cliente = this.clienteSelezionato();
      const eventi = [];

      if (cliente.creato_il) {
        eventi.push({
          id: 'cliente-creato-' + cliente.id,
          data: cliente.creato_il,
          tipo: 'cliente',
          titolo: 'Cliente creato',
          dettaglio: ''
        });
      }

      this.note.forEach(nota => {
        eventi.push({
          id: 'nota-' + nota.id,
          data: nota.creata_il,
          tipo: 'nota',
          titolo: 'Nota aggiunta',
          dettaglio: nota.testo || ''
        });
      });

      this.pagamentiCliente.forEach(pagamento => {
        eventi.push({
          id: 'pagamento-' + pagamento.id,
          data: pagamento.creato_il ||
            pagamento.data_pagamento ||
            pagamento.data_scadenza,
          tipo: 'pagamento',
          titolo:
            pagamento.stato === 'incassato'
              ? 'Pagamento registrato'
              : pagamento.stato === 'previsto'
                ? 'Pagamento previsto'
                : 'Pagamento annullato',
          dettaglio: this.formattaNumeroEuro(pagamento.importo)
        });
      });

      this.attivitaCliente.forEach(attivita => {
        if (attivita.tipo === 'stato') {
          eventi.push({
            id: 'attivita-' + attivita.id,
            data: attivita.creata_il,
            tipo: 'stato',
            titolo: 'Stato aggiornato',
            dettaglio:
              `${this.formattaStato(attivita.valore_precedente)} → ` +
              `${this.formattaStato(attivita.valore_nuovo)}`
          });
        }

        if (attivita.tipo === 'contatto_completato') {
          eventi.push({
            id: 'attivita-' + attivita.id,
            data: attivita.creata_il,
            tipo: 'completato',
            titolo: 'Contatto completato',
            dettaglio: attivita.valore_precedente
              ? this.formattaData(attivita.valore_precedente)
              : ''
          });
        }

        if (attivita.tipo === 'prossimo_contatto') {
          const nuovaData = attivita.valore_nuovo;

          eventi.push({
            id: 'attivita-' + attivita.id,
            data: attivita.creata_il,
            tipo: 'contatto',
            titolo: nuovaData
              ? 'Prossimo contatto impostato'
              : 'Prossimo contatto rimosso',
            dettaglio: nuovaData
              ? this.formattaData(nuovaData)
              : ''
          });
        }
      });

      return eventi
        .filter(evento => evento.data)
        .sort((a, b) =>
          new Date(b.data).getTime() -
          new Date(a.data).getTime()
        );
    },

    async apriScheda(clienteId) {
      if (this.view !== 'scheda') this.viewPrecedenteScheda = this.view;
      this.clienteSelezionatoId = clienteId;
      this.view = 'scheda';
      this.erroreScheda = '';
      this.confermaEliminazione = false;
      const cliente = this.clienteSelezionato();
      this.schedaAperture = {
        stato: true,
        pacchetto: !!(cliente.importo_abbonamento != null || cliente.nome_pacchetto),
        contatti: false,
        attivita: true,
        note: false
      };
      const { data, error } = await window.supabaseClient
        .from('note').select('*').eq('cliente_id', clienteId)
        .order('creata_il', { ascending: false });
      if (error) { this.erroreScheda = 'Errore nel caricare le note: ' + error.message; return; }
      this.note = data;
      await Promise.all([
        this.caricaPagamentiCliente(clienteId),
        this.caricaAttivitaCliente(clienteId)
      ]);
    },

    tornaDaScheda() {
      this.view = ['clienti', 'ricerca', 'lista', 'admin', 'agenda', 'pipeline'].includes(this.viewPrecedenteScheda)
        ? this.viewPrecedenteScheda
        : (this.isAdmin ? 'admin' : 'lista');
    },

    toggleAccordion(sezione) {
      this.schedaAperture[sezione] = !this.schedaAperture[sezione];
    },

    async aggiungiNota() {
      if (this.aggiungendoNota || !this.nuovaNotaTesto.trim()) return;
      this.aggiungendoNota = true;
      try {
        const { error } = await window.supabaseClient.from('note').insert({
          cliente_id: this.clienteSelezionatoId,
          venditore_id: this.sessione.user.id,
          testo: this.nuovaNotaTesto
        });
        if (error) { this.erroreScheda = 'Nota non salvata: ' + error.message; return; }
        this.nuovaNotaTesto = '';
        await this.apriScheda(this.clienteSelezionatoId);
      } finally {
        this.aggiungendoNota = false;
      }
    },

    async cambiaStato(nuovoStato) {
      this.erroreScheda = '';

      const errore = await this.impostaStatoCliente(
        this.clienteSelezionatoId,
        nuovoStato
      );

      if (errore) {
        this.erroreScheda = 'Stato non aggiornato: ' + errore;
        return;
      }

      await this.caricaClienti();
    },

    async confermaEliminaCliente() {
      if (this.eliminandoCliente) return;
      this.eliminandoCliente = true;
      try {
        const { error } = await window.supabaseClient.from('clienti')
          .update({ cancellato_il: new Date().toISOString() }).eq('id', this.clienteSelezionatoId);
        if (error) { this.erroreScheda = 'Eliminazione fallita: ' + error.message; return; }
        this.confermaEliminazione = false;
        await this.caricaClienti();
        this.tornaDaScheda();
      } finally {
        this.eliminandoCliente = false;
      }
    },

    async caricaCestino() {
      this.erroreCestino = '';
      let query = window.supabaseClient.from('clienti').select('*')
        .not('cancellato_il', 'is', null)
        .order('cancellato_il', { ascending: false });
      if (this.isAdmin && this.filtroVenditoreId) {
        query = query.eq('venditore_id', this.filtroVenditoreId);
      } else if (!this.isAdmin) {
        query = query.eq('venditore_id', this.sessione.user.id);
      }
      const { data, error } = await query;
      if (error) { this.erroreCestino = 'Errore nel caricare il cestino: ' + error.message; return; }
      this.cestino = data;
    },

    async apriCestino() {
      this.filtroTestoCestino = '';
      await this.caricaCestino();
      this.view = 'cestino';
    },

    cestinoFiltrato() {
      const testo = this.filtroTestoCestino.trim().toLowerCase();
      if (!testo) return this.cestino;
      return this.cestino.filter(c =>
        (c.nome || '').toLowerCase().includes(testo)
        || (c.referente || '').toLowerCase().includes(testo));
    },

    async ripristinaCliente(clienteId) {
      const { error } = await window.supabaseClient.from('clienti')
        .update({ cancellato_il: null }).eq('id', clienteId);
      if (error) { this.erroreCestino = 'Ripristino fallito: ' + error.message; return; }
      await this.caricaCestino();
      // se questa fallisce, l'errore va in erroreClienti e si vede solo tornando alla vista lista
      await this.caricaClienti();
    },

    // --- dashboard admin ---
    async caricaDashboardAdmin() {
      this.erroreAdmin = '';

      const [
        profiliResult,
        clientiResult,
        venditeResult,
        partecipantiResult,
        pagamentiResult
      ] = await Promise.all([
        window.supabaseClient
          .from('profili')
          .select('id,nome,ruolo,ruolo_economico')
          .order('nome'),

        window.supabaseClient
          .from('clienti')
          .select('id,nome,venditore_id,stato,pubblicato_il,prossimo_contatto,data_rinnovo,periodicita_contratto,durata_contratto_anni,importo_abbonamento,nome_pacchetto')
          .is('cancellato_il', null),

        window.supabaseClient
          .from('vendite')
          .select('id,cliente_id,venditore_id,importo_vendita,stato'),

        window.supabaseClient
          .from('vendita_partecipanti')
          .select('vendita_id,profilo_id,quota_finale'),

        window.supabaseClient
          .from('pagamenti')
          .select('id,vendita_id,importo,stato,data_scadenza,data_pagamento')
      ]);

      const errore =
        profiliResult.error ||
        clientiResult.error ||
        venditeResult.error ||
        partecipantiResult.error ||
        pagamentiResult.error;

      if (errore) {
        this.erroreAdmin =
          'Errore nel caricare la dashboard: ' + errore.message;
        return;
      }

      const profili = profiliResult.data || [];
      const clienti = clientiResult.data || [];
      const vendite = venditeResult.data || [];
      const partecipanti = partecipantiResult.data || [];
      const pagamenti = pagamentiResult.data || [];
      const venditeAttive = vendite.filter(v => v.stato === 'attiva');
      const venditeAttiveIds = new Set(venditeAttive.map(v => v.id));

      const venditorePerCliente = Object.fromEntries(
        venditeAttive.map(vendita => [vendita.cliente_id, vendita.venditore_id])
      );

      this.adminClienti = clienti.map(cliente => ({
        ...cliente,
        venditore_id: venditorePerCliente[cliente.id] || cliente.venditore_id
      }));

      const profiliConPartecipazioni = new Set(
        partecipanti
          .filter(p => venditeAttiveIds.has(p.vendita_id))
          .map(p => p.profilo_id)
      );

      const idsVenditoriAttivi = new Set([
        ...venditeAttive.map(vendita => vendita.venditore_id),
        ...clienti.map(cliente => venditorePerCliente[cliente.id] || cliente.venditore_id)
      ]);

      // Mostra tutte le persone economicamente coinvolte:
      // referente, venditori attivi e produzione/developer con partecipazioni.
      const profiliVisibili = profili.filter(profilo =>
        profilo.ruolo !== 'admin' && (
          profilo.ruolo_economico === 'referente' ||
          profiliConPartecipazioni.has(profilo.id) ||
          idsVenditoriAttivi.has(profilo.id)
        )
      );

      const nomeProfiloAdmin = profilo => {
        if (profilo.ruolo_economico === 'referente') return 'Alessandro';
        if (profilo.ruolo_economico === 'produzione') return 'Tomas';
        return profilo.nome;
      };

      const ruoloProfiloAdmin = profilo => {
        if (profilo.ruolo_economico === 'produzione' || profilo.ruolo === 'developer') {
          return 'Developer';
        }
        if (profilo.ruolo_economico === 'referente') return 'Referente';
        return 'Venditore';
      };

      this.adminVenditoriPerId = Object.fromEntries(
        profiliVisibili.map(profilo => [profilo.id, nomeProfiloAdmin(profilo)])
      );

      // Popola le prossime rate anche nella vista admin.
      const venditaPerId = Object.fromEntries(
        venditeAttive.map(vendita => [vendita.id, vendita])
      );
      const prossimeRate = {};
      pagamenti
        .filter(p => p.stato === 'previsto' && p.data_scadenza && venditaPerId[p.vendita_id])
        .sort((a, b) => String(a.data_scadenza).localeCompare(String(b.data_scadenza)))
        .forEach(pagamento => {
          const clienteId = venditaPerId[pagamento.vendita_id]?.cliente_id;
          const data = this.normalizzaDataAgenda(pagamento.data_scadenza);
          if (!clienteId || !data) return;
          (prossimeRate[clienteId] ||= []).push({
            id: pagamento.id,
            tipo: 'rata',
            label: 'Rata',
            data,
            importo: Number(pagamento.importo) || 0
          });
        });
      this.scadenzePagamentoPerCliente = prossimeRate;

      const chiaveMese = (() => {
        const d = new Date();
        return (
          d.getFullYear() +
          '-' +
          String(d.getMonth() + 1).padStart(2, '0')
        );
      })();

      const pubblicati = clienti.filter(c => c.stato === 'pubblicato');

      const pubblicatiQuestoMese = pubblicati.filter(c => {
        if (!c.pubblicato_il) return false;
        const d = new Date(c.pubblicato_il);
        return (
          d.getFullYear() +
          '-' +
          String(d.getMonth() + 1).padStart(2, '0')
        ) === chiaveMese;
      });

      const clientiPerId = Object.fromEntries(
        clienti.map(cliente => [cliente.id, cliente])
      );
      const venditeUniche = new Map(
        venditeAttive.map(vendita => [vendita.cliente_id || vendita.id, vendita])
      );
      const volumeVendite = [...venditeUniche.values()].reduce(
        (totale, vendita) => totale + valoreContrattoVendita(vendita, clientiPerId),
        0
      );

      const incassatoEffettivo = pagamenti
        .filter(p => p.stato === 'incassato' && venditeAttiveIds.has(p.vendita_id))
        .reduce((totale, pagamento) => totale + (Number(pagamento.importo) || 0), 0);

      this.adminStats = {
        volumeVendite,
        incassatoEffettivo,
        residuoIncasso: Math.max(0, volumeVendite - incassatoEffettivo),
        venditeAttive: venditeAttive.length,
        clienti: clienti.length,
        pubblicati: pubblicati.length,
        pubblicatiMese: pubblicatiQuestoMese.length,
        inLavorazione: clienti.filter(c => c.stato === 'in_lavorazione').length
      };

      this.adminClientiPerVenditore = {};

      this.venditori = ordinaTeamEconomico(profiliVisibili.map(profilo => {
        const idsVenditePartecipate = new Set(
          partecipanti
            .filter(partecipazione =>
              partecipazione.profilo_id === profilo.id &&
              venditeAttiveIds.has(partecipazione.vendita_id)
            )
            .map(partecipazione => partecipazione.vendita_id)
        );

        venditeAttive
          .filter(vendita => vendita.venditore_id === profilo.id)
          .forEach(vendita => idsVenditePartecipate.add(vendita.id));

        const partecipazioniProfilo = partecipanti.filter(partecipazione =>
          partecipazione.profilo_id === profilo.id &&
          idsVenditePartecipate.has(partecipazione.vendita_id)
        );

        const suoiClienti = clientiAttribuitiAlProfilo(
          profilo.id,
          this.adminClienti,
          venditeAttive,
          partecipanti
        );

        this.adminClientiPerVenditore[profilo.id] =
          suoiClienti.map(cliente => cliente.id);

        const suoiPubblicati =
          suoiClienti.filter(cliente => cliente.stato === 'pubblicato');

        const suoiPubblicatiMese = suoiPubblicati.filter(cliente => {
          if (!cliente.pubblicato_il) return false;
          const d = new Date(cliente.pubblicato_il);
          return (
            d.getFullYear() +
            '-' +
            String(d.getMonth() + 1).padStart(2, '0')
          ) === chiaveMese;
        });

        const quotePerVendita = {};
        partecipazioniProfilo.forEach(partecipazione => {
          quotePerVendita[partecipazione.vendita_id] =
            (quotePerVendita[partecipazione.vendita_id] || 0) +
            (Number(partecipazione.quota_finale) || 0);
        });

        const venditeProfilo = venditeAttive.filter(
          vendita => idsVenditePartecipate.has(vendita.id)
        );

        const statistiche = calcolaStatisticheVenditore(
          venditeProfilo,
          pagamenti,
          quotePerVendita,
          profilo.id,
          clientiPerId
        );

        return {
          id: profilo.id,
          nome: nomeProfiloAdmin(profilo),
          ruolo: ruoloProfiloAdmin(profilo),
          totaleGenerato: statistiche.generato,
          totaleIncassato: statistiche.incassato,
          totaleResiduo: Math.max(0, statistiche.generato - statistiche.incassato),
          totaleVenduto: statistiche.venduto,
          mediaVendita: statistiche.mediaVendita,
          nVendite: ruoloProfiloAdmin(profilo) === 'Developer'
            ? idsVenditePartecipate.size
            : statistiche.numeroVendite,
          nClientiTotali: suoiClienti.length,
          nInLavorazione: suoiClienti.filter(cliente => cliente.stato === 'in_lavorazione').length,
          nPubblicati: suoiPubblicati.length,
          nPubblicatiMese: suoiPubblicatiMese.length
        };
      }));
    },

    totaleGeneraleAdmin() {
      return Number(this.adminStats.volumeVendite) || 0;
    },

    totaleIncassatoAdmin() {
      return Number(this.adminStats.incassatoEffettivo) || 0;
    },

    residuoIncassoAdmin() {
      return Number(this.adminStats.residuoIncasso) || 0;
    },

    totaleClientiAdmin() {
      return Number(this.adminStats.clienti) || 0;
    },

    mediaVenditaAdmin() {
      const vendite = Number(this.adminStats.venditeAttive) || 0;
      return vendite ? this.totaleGeneraleAdmin() / vendite : 0;
    },

    totalePubblicatiAdmin() {
      return Number(this.adminStats.pubblicati) || 0;
    },

    totalePubblicatiMeseAdmin() {
      return Number(this.adminStats.pubblicatiMese) || 0;
    },

    inizialeVenditoreAdmin(venditore) {
      const valore = venditore?.nome || '?';
      return valore.trim().charAt(0).toUpperCase();
    },

    venditoriFiltrati() {
      const testo = this.filtroTestoAdmin.trim().toLowerCase();
      if (!testo) return this.venditori;
      return this.venditori.filter(v => (v.nome || '').toLowerCase().includes(testo));
    },

    classificaVenditori() {
      return ordinaClassificaVenditori(this.venditori);
    },

    async apriEventoAdmin(evento) {
      await this.apriClientiVenditore(evento.venditoreId, evento.venditoreNome);
      await this.apriScheda(evento.clienteId);
    },

    async apriIncassoAgenda(evento) {
      if (this.isAdmin) await this.apriClientiVenditore(evento.venditoreId, evento.venditoreNome);
      const cliente = this.clienti.find(c => c.id === evento.clienteId);
      if (!cliente) return;
      await this.caricaPagamentiCliente(cliente.id);
      await this.apriPagamentoCliente(cliente, {
        id: evento.pagamentoId,
        importo: evento.importo
      });
    },

    async apriClientiVenditore(venditoreId, nomeVenditore) {
      this.filtroVenditoreId = venditoreId;
      this.filtroVenditoreNome = nomeVenditore;
      this.filtroTesto = '';
      this.filtroStato = '';
      this.filtroSoloRitardo = false;
      await this.caricaClienti();
      this.view = 'lista';
    },

    tornaAllaDashboard() {
      this.filtroVenditoreId = '';
      this.filtroVenditoreNome = '';
      this.filtroTestoAdmin = '';
      this.view = 'admin';
    }
  };
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
    clientiAttribuitiAlProfilo,
    clientiDelVenditoreRiferimento,
    ordinaClassificaVenditori,
    ordinaTeamEconomico,
    posizioneAvatarDaUrl,
    avatarUrlConPosizione
  };
}
