// js/app.js
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
    nuovoClienteForm: { nome: '', referente: '', telefono: '', email: '',
      piva: '', iban: '', importo_abbonamento: null },
    erroriNuovoCliente: {},

    note: [],
    nuovaNotaTesto: '',
    erroreScheda: '',

    async init() {
      this.sessione = await getSessioneCorrente();
      if (this.sessione) { await this.caricaClienti(); this.view = 'lista'; }
      else { this.view = 'login'; }
    },

    async fareLogin() {
      this.erroreLogin = '';
      try {
        this.sessione = await login(this.emailInput, this.passwordInput);
        await this.caricaClienti();
        this.view = 'lista';
      } catch (err) {
        this.erroreLogin = err.message;
      }
    },

    async fareLogout() {
      await logout();
      this.sessione = null;
      this.view = 'login';
    },

    async caricaClienti() {
      this.erroreClienti = '';
      const { data: profilo } = await window.supabaseClient
        .from('profili').select('ruolo').eq('id', this.sessione.user.id).single();
      this.isAdmin = profilo?.ruolo === 'admin';

      let query = window.supabaseClient.from('clienti').select('*').order('creato_il', { ascending: false });
      if (this.isAdmin && this.filtroVenditoreId) {
        query = query.eq('venditore_id', this.filtroVenditoreId);
      }
      const { data, error } = await query;
      if (error) { this.erroreClienti = 'Errore nel caricare i clienti: ' + error.message; return; }
      this.clienti = data;
    },

    async creaCliente() {
      const check = validaClienteForm(this.nuovoClienteForm);
      this.erroriNuovoCliente = check.errori;
      if (!check.valido) return;

      const { error } = await window.supabaseClient.from('clienti').insert({
        ...this.nuovoClienteForm,
        venditore_id: this.sessione.user.id
      });
      if (error) { this.erroriNuovoCliente.generale = 'Salvataggio fallito: ' + error.message; return; }

      this.nuovoClienteForm = { nome: '', referente: '', telefono: '', email: '',
        piva: '', iban: '', importo_abbonamento: null };
      await this.caricaClienti();
      this.view = 'lista';
    },

    clienteSelezionato() {
      return this.clienti.find(c => c.id === this.clienteSelezionatoId) || {};
    },

    async apriScheda(clienteId) {
      this.clienteSelezionatoId = clienteId;
      this.view = 'scheda';
      this.erroreScheda = '';
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
    }
  };
}
