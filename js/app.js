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

function etichettaDurataScontoForm(form) {
  if (form.sconto_durata_anni == null) return 'Per sempre';
  const anni = Number(form.sconto_durata_anni) || 1;
  return anni === 1 ? 'Per il primo anno' : `Per i primi ${anni} anni`;
}

function posizioneAvatarDaUrl(url = '') {
  const match = String(url).match(/#(?:pos|crop)=(\d{1,3}),(\d{1,3})(?:,([\d.]+))?$/);
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

function calcolaStatisticheVenditore(vendite = [], pagamenti = []) {
  const venditeAttive = vendite.filter(v => v.stato === 'attiva');
  const ids = new Set(venditeAttive.map(v => v.id));
  return {
    generato: venditeAttive.reduce((totale, v) => totale + (Number(v.importo_vendita) || 0), 0),
    incassato: pagamenti
      .filter(p => p.stato === 'incassato' && ids.has(p.vendita_id))
      .reduce((totale, p) => totale + (Number(p.importo) || 0), 0)
  };
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
    percentualeTasseFattura: 40,
    percentualeRiduzioneNoFattura: 20,

    modalitaFatturazioneAdmin: 'nessuna',
    importoFatturatoAdmin: 0,

    statoIncasso: 'incassato',
    importoIncassato: null,
    dataPagamento: '',
    metodoPagamento: '',
    notePagamento: '',

    partecipanti: [],
    nuovoPartecipanteNome: ''
  };
}

function appState() {
  return {
    view: 'login',
    sessione: null,
    clienteSelezionatoId: null,
    erroreLogin: '',
    emailInput: '',
    passwordInput: '',

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

    // mini CRM
    agendaVista: 'oggi',
    agendaMese: new Date().toISOString().slice(0, 7),
    agendaDataSelezionata: new Date().toISOString().slice(0, 10),

    pipelineIndice: 0,
    statisticheVenditore: { generato: 0, incassato: 0 },

    ricercaGlobale: '',
    indiceNoteRicerca: [],
    erroreRicerca: '',
    nuovoClienteForm: formModuloVuoto(),

    // CRM economico / vendite
    venditaEconomicaForm: formVenditaEconomicaVuoto(),
    clienteEconomiaSelezionato: null,
    anagraficaEconomiaAperta: false,
    menuAzioneAperto: false,
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

    // pagamenti cliente
    pagamentiCliente: [],
    caricandoPagamentiCliente: false,
    errorePagamentiCliente: '',

    schedaAperture: { stato: true, pacchetto: false, contatti: false, note: true },

    aggiornamentoDisponibile: false,
    aggiornamentoStato: 'controllo', // controllo | aggiornato | disponibile | errore
    accedendo: false,

    // notifiche push (Web Push standard)
    pushStato: 'inattivo', // 'non-supportato' | 'bloccato' | 'attivo' | 'inattivo'
    pushInCorso: false,
    pushErrore: '',

    // dashboard admin
    venditori: [],
    erroreAdmin: '',
    filtroTestoAdmin: '',

    profilo: { nome: '', username: '', avatar_url: '', ruolo: '' },
    profiloForm: { username: '' },
    avatarPosizione: { x: 50, y: 50, zoom: 1 },
    avatarTrascinamento: null,
    profiloErrore: '',
    profiloSalvando: false,
    avatarCaricando: false,

    // navigazione mobile
    swipeStartX: null,
    swipeStartY: null,
    swipeLastX: null,
    swipeStartedAt: 0,
    swipeTracking: false,
    swipeDirection: null,
    swipeElement: null,

    async init() {
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
      if (this.sessione) { await this.dopoLogin(); }
      else { this.view = 'login'; }
    },

    aggiornaApp() {
      window.leAggiornaApp();
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
      const { data: profilo } = await window.supabaseClient
        .from('profili').select('nome,ruolo,username,avatar_url').eq('id', this.sessione.user.id).single();
      this.profilo = {
        nome: profilo?.nome || '',
        ruolo: profilo?.ruolo || 'venditore',
        username: profilo?.username || '',
        avatar_url: profilo?.avatar_url || ''
      };
      this.profiloForm.username = this.profilo.username;
      this.avatarPosizione = posizioneAvatarDaUrl(this.profilo.avatar_url);
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

    apriRicerca() {
      this.ricercaGlobale = '';
      this.erroreRicerca = '';
      this.view = 'ricerca';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    totaleIncassatoCliente() {
      return this.pagamentiCliente
        .filter(p => p.stato === 'incassato')
        .reduce((totale, p) => totale + (Number(p.importo) || 0), 0);
    },

    residuoCliente() {
      const cliente = this.clienteSelezionato();
      if (!cliente) return 0;

      const totale = Number(cliente.importo_abbonamento) || 0;
      return Math.max(0, totale - this.totaleIncassatoCliente());
    },

    statoPagamentoCliente() {
      const cliente = this.clienteSelezionato();
      if (!cliente) return 'da_pagare';

      const totale = Number(cliente.importo_abbonamento) || 0;
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

    async apriPagamentoCliente() {
      const cliente = this.clienteSelezionato();
      if (!cliente) return;

      await this.apriEconomia();
      this.selezionaClienteEconomia(cliente);
    },

    async apriEconomia() {
      this.venditaEconomicaForm = formVenditaEconomicaVuoto();
      this.clienteEconomiaSelezionato = null;
      this.anagraficaEconomiaAperta = false;
      this.erroreEconomia = '';
      this.successoEconomia = '';
      await this.inizializzaPartecipantiEconomia();
      this.view = 'economia';
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
      const tasse = Math.max(
        0,
        Math.min(
          100,
          Number(this.venditaEconomicaForm.percentualeTasseFattura) || 0
        )
      );

      // Se Alessandro non fattura, il margine non viene ridotto.
      // Se fattura solo una parte, il 40% incide solo in proporzione
      // alla parte fatturata al cliente.
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
      if (partecipante.ruolo === 'referente') return 0;

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
        (Number(this.venditaEconomicaForm.percentualeTasseFattura) || 0) *
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
      const costi = [];

      const multipagina = Number(cliente.pagine_extra || 0) > 0;

      costi.push(
        this.creaCostoEconomia(
          multipagina ? 'Hosting Multipagina' : 'Hosting Landing',
          multipagina ? 25 : 20
        )
      );

      if (cliente.dominio_it || cliente.dominio_com) {
        costi.push(this.creaCostoEconomia('Dominio', 20));
      }

      if (cliente.email_5_caselle) {
        costi.push(this.creaCostoEconomia('Mail', 10));
      }

      costi.push(
        this.creaCostoEconomia('Claude - Creazione e Skill', 20)
      );

      this.venditaEconomicaForm.costi = costi;
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

      return '';
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

      if (statoIncasso !== 'previsto') {
        pagamento = {
          importo: Math.max(
            0,
            Number(this.venditaEconomicaForm.importoIncassato) || 0
          ),
          stato: 'incassato',
          data_pagamento: this.venditaEconomicaForm.dataPagamento || null,
          metodo:
            (this.venditaEconomicaForm.metodoPagamento || '').trim() || null,
          note:
            (this.venditaEconomicaForm.notePagamento || '').trim() || null
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
        percentuale_tasse_admin:
          Number(this.venditaEconomicaForm.percentualeTasseFattura) || 0
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
          this.erroreEconomia =
            'Vendita non salvata: ' + error.message;
          return;
        }

        this.successoEconomia = 'Vendita registrata correttamente.';

        const clienteId = this.venditaEconomicaForm.clienteId;
        await Promise.all([this.caricaClienti(), this.caricaStatisticheVenditore()]);

        if (clienteId) {
          this.clienteSelezionatoId = clienteId;
          await this.caricaPagamentiCliente(clienteId);
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
        'admin',
        'nuovo',
        'profilo',
        'agenda',
        'pipeline',
        'ricerca',
        'economia'
      ].includes(this.view);
    },

    swipeStart(event) {
      if (event.touches?.length !== 1) return;

      const target = event.target;
      if (target.closest(
        '.economy-content, .client-form, input, textarea, select, button, label, a, [role="button"], [contenteditable="true"]'
      )) return;

      const touch = event.touches[0];
      const isBackView = ['profilo', 'cestino', 'scheda', 'nuovo', 'agenda', 'pipeline', 'ricerca'].includes(this.view);
      const isForwardView = ['lista', 'admin'].includes(this.view);

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

        const allowedRight = ['profilo', 'cestino', 'scheda', 'nuovo', 'agenda', 'pipeline', 'ricerca'].includes(this.view);
        const allowedLeft = ['lista', 'admin'].includes(this.view);

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

    eseguiNavigazioneGesture(direction) {
      if (direction === 'left') {
        if (this.view === 'lista' || this.view === 'admin') {
          this.apriProfilo();
        }
        return;
      }

      if (this.view === 'profilo') {
        this.vaiHome();
        return;
      }

      if (this.view === 'cestino') {
        this.apriProfilo();
        return;
      }

      if (['agenda', 'pipeline', 'ricerca'].includes(this.view)) {
        this.vaiHome();
        return;
      }

      if (this.view === 'scheda') {
        this.view = this.isAdmin ? 'admin' : 'lista';
        return;
      }

      if (this.view === 'nuovo') {
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

    tornaDaProfilo() {
      this.view = this.isAdmin ? 'admin' : 'lista';
    },

    inizialeProfilo() {
      const s = this.profilo.username || this.profilo.nome || this.sessione?.user?.email || '?';
      return s.trim().charAt(0).toUpperCase();
    },

    avatarStile() {
      return `object-position:${this.avatarPosizione.x}% ${this.avatarPosizione.y}%;transform:scale(${this.avatarPosizione.zoom})`;
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
      } finally {
        this.avatarCaricando = false;
        event.target.value = '';
      }
    },

    async fareLogout() {
      try {
        await window.WebPush.disattivaSottoscrizioneCorrente();
      } catch (err) {
        // il logout non deve mai bloccarsi per un problema sulla push:
        // nel peggiore dei casi la subscription resta attiva sul server
        // finche' non si ripete un logout riuscito.
        console.warn('Disattivazione notifiche push fallita al logout:', err);
      }
      await logout();
      this.sessione = null;
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
      if (venditoreId) query = query.eq('venditore_id', venditoreId);
      const { data, error } = await query;
      if (error) { this.erroreClienti = 'Errore nel caricare i clienti: ' + error.message; return; }
      this.clienti = data;
      await this.caricaIndiceNoteRicerca();
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

    clientiInRitardo() {
      return this.clienti.filter(c => classeUrgenza(c.prossimo_contatto) === 'ritardo');
    },

    async caricaStatisticheVenditore() {
      this.statisticheVenditore = { generato: 0, incassato: 0 };

      const partecipazioni = await window.supabaseClient
        .from('vendita_partecipanti')
        .select('vendita_id')
        .eq('profilo_id', this.sessione.user.id);

      if (partecipazioni.error) {
        console.warn('Statistiche economiche non disponibili:', partecipazioni.error.message);
        return;
      }

      const ids = [...new Set((partecipazioni.data || []).map(p => p.vendita_id))];
      if (!ids.length) return;

      const [vendite, pagamenti] = await Promise.all([
        window.supabaseClient
          .from('vendite')
          .select('id,importo_vendita,stato')
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

      this.statisticheVenditore = calcolaStatisticheVenditore(vendite.data || [], pagamenti.data || []);
    },

    eventiOggiHome() {
      const oggi = this.dataISOOggi();

      return this.eventiAgenda().filter(evento =>
        evento.data === oggi ||
        (evento.tipo === 'contatto' && evento.data < oggi)
      );
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

      this.clienti.forEach(cliente => {
        const contatto = this.normalizzaDataAgenda(cliente.prossimo_contatto);
        if (contatto) {
          eventi.push({
            id: `contatto-${cliente.id}-${contatto}`,
            clienteId: cliente.id,
            clienteNome: cliente.nome,
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
            data: rinnovo,
            tipo: 'rinnovo',
            titolo: cliente.periodicita_contratto === 'annuale'
              ? 'Rinnovo annuale'
              : 'Rinnovo contratto',
            scaduto: false
          });
        }
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
          (e.tipo === 'contatto' && e.data < oggi)
        );
      }

      if (this.agendaVista === '7giorni') {
        const fine = this.aggiungiGiorniISO(oggi, 7);
        return eventi.filter(e =>
          (e.data >= oggi && e.data <= fine) ||
          (e.tipo === 'contatto' && e.data < oggi)
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

    async cambiaStatoDaPipeline(clienteId, stato) {
      const consentiti = ['contattato', 'brief_mandato', 'in_lavorazione', 'pubblicato'];
      if (!consentiti.includes(stato)) return;

      const { error } = await window.supabaseClient
        .from('clienti')
        .update({ stato })
        .eq('id', clienteId);

      if (error) {
        this.erroreClienti = 'Stato non aggiornato: ' + error.message;
        return;
      }

      await this.caricaClienti();
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
      if (cliente.periodicita_contratto === 'mensile') return `${importo}/mese`;
      if (cliente.periodicita_contratto === 'annuale') return `${importo}/anno`;
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
      this.pagamentiCliente = [];
      this.errorePagamentiCliente = '';
      if (!clienteId) return;

      this.caricandoPagamentiCliente = true;
      try {
        const { data: vendite, error: errVendite } = await window.supabaseClient
          .from('vendite')
          .select('id')
          .eq('cliente_id', clienteId)
          .eq('stato', 'attiva');

        if (errVendite) {
          this.errorePagamentiCliente = errVendite.message;
          return;
        }

        const ids = (vendite || []).map(v => v.id);
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

    async apriScheda(clienteId) {
      this.clienteSelezionatoId = clienteId;
      this.view = 'scheda';
      this.erroreScheda = '';
      this.confermaEliminazione = false;
      const cliente = this.clienteSelezionato();
      this.schedaAperture = {
        stato: true,
        pacchetto: !!(cliente.importo_abbonamento != null || cliente.nome_pacchetto),
        contatti: false,
        note: true
      };
      const { data, error } = await window.supabaseClient
        .from('note').select('*').eq('cliente_id', clienteId)
        .order('creata_il', { ascending: false });
      if (error) { this.erroreScheda = 'Errore nel caricare le note: ' + error.message; return; }
      this.note = data;
      await this.caricaPagamentiCliente(clienteId);
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
      const { error } = await window.supabaseClient
        .from('clienti').update({ stato: nuovoStato }).eq('id', this.clienteSelezionatoId);
      if (error) { this.erroreScheda = 'Stato non aggiornato: ' + error.message; return; }
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
        this.view = 'lista';
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
      const { data: profili, error: erroreProfili } = await window.supabaseClient
        .from('profili').select('id, nome, ruolo').eq('ruolo', 'venditore').order('nome');
      if (erroreProfili) { this.erroreAdmin = 'Errore nel caricare i venditori: ' + erroreProfili.message; return; }

      const { data: clienti, error: erroreClienti } = await window.supabaseClient
        .from('clienti').select('*').is('cancellato_il', null);
      if (erroreClienti) { this.erroreAdmin = 'Errore nel caricare i clienti: ' + erroreClienti.message; return; }

      const oraChiaveMese = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); })();

      this.venditori = profili.map(v => {
        const suoi = clienti.filter(c => c.venditore_id === v.id);
        const pubblicati = suoi.filter(c => c.stato === 'pubblicato');
        const pubblicatiQuestoMese = pubblicati.filter(c => {
          if (!c.pubblicato_il) return false;
          const d = new Date(c.pubblicato_il);
          return (d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')) === oraChiaveMese;
        });
        return {
          id: v.id, nome: v.nome,
          totaleGenerato: pubblicati.reduce((s, c) => s + (Number(c.importo_abbonamento) || 0), 0),
          nPubblicati: pubblicati.length,
          nPubblicatiMese: pubblicatiQuestoMese.length,
          nClientiTotali: suoi.length
        };
      });
    },

    totaleGeneraleAdmin() {
      return this.venditori.reduce((s, v) => s + v.totaleGenerato, 0);
    },

    venditoriFiltrati() {
      const testo = this.filtroTestoAdmin.trim().toLowerCase();
      if (!testo) return this.venditori;
      return this.venditori.filter(v => (v.nome || '').toLowerCase().includes(testo));
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
    normalizzaClientePerSalvataggio,
    prezzoRicorrenteDaForm,
    etichettaDurataScontoForm,
    totaleContrattoDaForm,
    calcolaStatisticheVenditore,
    posizioneAvatarDaUrl,
    avatarUrlConPosizione
  };
}
