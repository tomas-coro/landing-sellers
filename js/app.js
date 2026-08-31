// js/app.js
function formModuloVuoto() {
  return { nome: '', referente: '', telefono: '', email: '',
    piva: '', iban: '', sito_url: '', importo_abbonamento: null };
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
    nuovoClienteForm: formModuloVuoto(),
    erroriNuovoCliente: {},
    clienteInModificaId: null,

    confermaEliminazione: false,

    note: [],
    nuovaNotaTesto: '',
    erroreScheda: '',

    aggiornamentoDisponibile: false,

    // dashboard admin
    venditori: [],
    erroreAdmin: '',

    async init() {
      window.addEventListener('le:aggiornamento-pronto', () => { this.aggiornamentoDisponibile = true; });

      this.sessione = await getSessioneCorrente();
      if (this.sessione) { await this.dopoLogin(); }
      else { this.view = 'login'; }
    },

    aggiornaApp() { window.leAggiornaApp(); },
    controllaAggiornamenti() { window.leControllaAggiornamenti(); },

    async fareLogin() {
      this.erroreLogin = '';
      try {
        this.sessione = await login(this.emailInput, this.passwordInput);
        await this.dopoLogin();
      } catch (err) {
        this.erroreLogin = err.message;
      }
    },

    async dopoLogin() {
      const { data: profilo } = await window.supabaseClient
        .from('profili').select('ruolo').eq('id', this.sessione.user.id).single();
      this.isAdmin = profilo?.ruolo === 'admin';
      this.filtroTesto = '';
      this.filtroStato = '';

      if (this.isAdmin) { await this.caricaDashboardAdmin(); this.view = 'admin'; }
      else { await this.caricaClienti(); this.view = 'lista'; }
    },

    async fareLogout() {
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
      if (this.isAdmin && this.filtroVenditoreId) {
        query = query.eq('venditore_id', this.filtroVenditoreId);
      } else if (!this.isAdmin) {
        query = query.eq('venditore_id', this.sessione.user.id);
      }
      const { data, error } = await query;
      if (error) { this.erroreClienti = 'Errore nel caricare i clienti: ' + error.message; return; }
      this.clienti = data;
    },

    clientiFiltrati() {
      const testo = this.filtroTesto.trim().toLowerCase();
      return this.clienti.filter(c => {
        if (this.filtroStato && c.stato !== this.filtroStato) return false;
        if (!testo) return true;
        return (c.nome || '').toLowerCase().includes(testo)
          || (c.referente || '').toLowerCase().includes(testo);
      });
    },

    // --- statistiche venditore (home) ---
    clientiPubblicati() {
      return this.clienti.filter(c => c.stato === 'pubblicato');
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
        sito_url: c.sito_url || '', importo_abbonamento: c.importo_abbonamento
      };
      this.erroriNuovoCliente = {};
      this.view = 'nuovo';
    },

    async salvaCliente() {
      const check = validaClienteForm(this.nuovoClienteForm);
      this.erroriNuovoCliente = check.errori;
      if (!check.valido) return;

      if (this.clienteInModificaId) {
        const { error } = await window.supabaseClient.from('clienti')
          .update({ ...this.nuovoClienteForm }).eq('id', this.clienteInModificaId);
        if (error) { this.erroriNuovoCliente.generale = 'Salvataggio fallito: ' + error.message; return; }
      } else {
        const { error } = await window.supabaseClient.from('clienti').insert({
          ...this.nuovoClienteForm,
          venditore_id: this.sessione.user.id
        });
        if (error) { this.erroriNuovoCliente.generale = 'Salvataggio fallito: ' + error.message; return; }
      }

      const idModificato = this.clienteInModificaId;
      this.clienteInModificaId = null;
      this.nuovoClienteForm = formModuloVuoto();
      await this.caricaClienti();
      this.view = idModificato ? 'scheda' : 'lista';
      if (idModificato) { this.clienteSelezionatoId = idModificato; }
    },

    clienteSelezionato() {
      return this.clienti.find(c => c.id === this.clienteSelezionatoId) || {};
    },

    async apriScheda(clienteId) {
      this.clienteSelezionatoId = clienteId;
      this.view = 'scheda';
      this.erroreScheda = '';
      this.confermaEliminazione = false;
      const { data, error } = await window.supabaseClient
        .from('note').select('*').eq('cliente_id', clienteId)
        .order('creata_il', { ascending: false });
      if (error) { this.erroreScheda = 'Errore nel caricare le note: ' + error.message; return; }
      this.note = data;
    },

    async aggiungiNota() {
      if (!this.nuovaNotaTesto.trim()) return;
      const { error } = await window.supabaseClient.from('note').insert({
        cliente_id: this.clienteSelezionatoId,
        venditore_id: this.sessione.user.id,
        testo: this.nuovaNotaTesto
      });
      if (error) { this.erroreScheda = 'Nota non salvata: ' + error.message; return; }
      this.nuovaNotaTesto = '';
      await this.apriScheda(this.clienteSelezionatoId);
    },

    async cambiaStato(nuovoStato) {
      const { error } = await window.supabaseClient
        .from('clienti').update({ stato: nuovoStato }).eq('id', this.clienteSelezionatoId);
      if (error) { this.erroreScheda = 'Stato non aggiornato: ' + error.message; return; }
      await this.caricaClienti();
    },

    async confermaEliminaCliente() {
      const { error } = await window.supabaseClient.from('clienti')
        .update({ cancellato_il: new Date().toISOString() }).eq('id', this.clienteSelezionatoId);
      if (error) { this.erroreScheda = 'Eliminazione fallita: ' + error.message; return; }
      this.confermaEliminazione = false;
      await this.caricaClienti();
      this.view = 'lista';
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

    async apriClientiVenditore(venditoreId, nomeVenditore) {
      this.filtroVenditoreId = venditoreId;
      this.filtroVenditoreNome = nomeVenditore;
      this.filtroTesto = '';
      this.filtroStato = '';
      await this.caricaClienti();
      this.view = 'lista';
    },

    tornaAllaDashboard() {
      this.filtroVenditoreId = '';
      this.filtroVenditoreNome = '';
      this.view = 'admin';
    }
  };
}
