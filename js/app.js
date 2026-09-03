// js/app.js
function formModuloVuoto() {
  return { nome: '', referente: '', telefono: '', email: '',
    piva: '', iban: '', sito_url: '', importo_abbonamento: null,
    nome_pacchetto: '', note_prezzo: '', data_rinnovo: null };
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
    nuovoClienteForm: formModuloVuoto(),
    selezionePrezzo: { formula: 'mensile', upgrade: [], lingueExtra: 0 },
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
    schedaAperture: { stato: true, pacchetto: false, contatti: false, note: true },

    aggiornamentoDisponibile: false,
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
    profiloErrore: '',
    profiloSalvando: false,
    avatarCaricando: false,

    async init() {
      window.addEventListener('le:aggiornamento-pronto', () => { this.aggiornamentoDisponibile = true; });

      this.sessione = await getSessioneCorrente();
      if (this.sessione) { await this.dopoLogin(); }
      else { this.view = 'login'; }
    },

    aggiornaApp() { window.leAggiornaApp(); },
    controllaAggiornamenti() { window.leControllaAggiornamenti(); },

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
      this.isAdmin = profilo?.ruolo === 'admin';
      this.filtroTesto = '';
      this.filtroStato = '';
      this.filtroSoloRitardo = false;

      if (this.isAdmin) { await this.caricaDashboardAdmin(); this.view = 'admin'; }
      else { await this.caricaClienti(); this.view = 'lista'; }

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

    etichettaPush() {
      if (this.pushStato === 'non-supportato') return 'Notifiche non supportate';
      if (this.pushStato === 'bloccato') return 'Notifiche bloccate';
      if (this.pushStato === 'attivo') return 'Notifiche attive';
      return 'Attiva notifiche';
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
        const { error } = await window.supabaseClient.rpc('update_my_profile', {
          p_username: username || null,
          p_avatar_url: this.profilo.avatar_url || null
        });
        if (error) {
          this.profiloErrore = error.message.includes('duplicate') ? 'Username gia utilizzato.' : 'Profilo non salvato: ' + error.message;
          return;
        }
        this.profilo.username = username;
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
        const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
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
      this.selezionePrezzo = { formula: 'mensile', upgrade: [], lingueExtra: 0 };
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
        data_rinnovo: c.data_rinnovo || null
      };
      this.ripristinaSelezionePrezzo(c);
      this.erroriNuovoCliente = {};
      this.view = 'nuovo';
    },

    catalogoPrezzi() { return window.CATALOGO_PREZZI_LE; },
    selezionaFormulaPrezzo(formula) { this.selezionePrezzo.formula = formula; this.aggiornaPrezzoCliente(); },
    toggleUpgradePrezzo(id) { const a=this.selezionePrezzo.upgrade; this.selezionePrezzo.upgrade=a.includes(id)?a.filter(x=>x!==id):[...a,id]; this.aggiornaPrezzoCliente(); },
    toggleMultilinguaPrezzo(attivo) { this.selezionePrezzo.lingueExtra=attivo?Math.max(1,Number(this.selezionePrezzo.lingueExtra)||1):0; this.aggiornaPrezzoCliente(); },
    prezzoUpgradeMensile() { const c=this.catalogoPrezzi(); return c.upgrade.filter(u=>this.selezionePrezzo.upgrade.includes(u.id)).reduce((s,u)=>s+u.prezzoMensile,0)+((Number(this.selezionePrezzo.lingueExtra)||0)*c.multilingua.prezzoMensilePerLingua); },
    aggiornaPrezzoCliente() { const c=this.catalogoPrezzi(), f=c.formule[this.selezionePrezzo.formula]||c.formule.mensile, up=this.prezzoUpgradeMensile(); this.nuovoClienteForm.importo_abbonamento=f.id==='annuale'?f.prezzoBase+(up*12):f.prezzoBase+up; this.nuovoClienteForm.nome_pacchetto=f.nome; const d=c.upgrade.filter(u=>this.selezionePrezzo.upgrade.includes(u.id)).map(u=>`${u.nome} (+${u.prezzoMensile} €/mese)`); if((Number(this.selezionePrezzo.lingueExtra)||0)>0)d.push(`Multilingua: ${Number(this.selezionePrezzo.lingueExtra)} lingue extra (+${Number(this.selezionePrezzo.lingueExtra)*c.multilingua.prezzoMensilePerLingua} €/mese)`); d.unshift(f.id==='annuale'?'Setup incluso':'Setup: 150 € una tantum'); this.nuovoClienteForm.note_prezzo=d.join(' · '); },
    riepilogoSetupPrezzo() { return this.selezionePrezzo.formula==='annuale'?'Setup incluso':'Setup: 150 € una tantum'; },
    riepilogoUpgradePrezzo() { const m=this.prezzoUpgradeMensile(); if(!m)return ''; return this.selezionePrezzo.formula==='annuale'?`Upgrade: +${this.formattaNumeroEuro(m*12)}/anno`:`Upgrade: +${this.formattaNumeroEuro(m)}/mese`; },
    formattaNumeroEuro(v) { return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v)||0); },
    ripristinaSelezionePrezzo(c) { const n=c.note_prezzo||'', f=(c.nome_pacchetto||'').toLowerCase().includes('annuale')?'annuale':'mensile', cat=this.catalogoPrezzi(), u=cat.upgrade.filter(x=>n.includes(x.nome)).map(x=>x.id), m=n.match(/Multilingua:\s*(\d+)\s*lingue extra/i); this.selezionePrezzo={formula:f,upgrade:u,lingueExtra:m?Number(m[1]):0}; },

    async salvaCliente() {
      if (this.salvandoCliente) return;
      this.aggiornaPrezzoCliente();
      const check = validaClienteForm(this.nuovoClienteForm);
      this.erroriNuovoCliente = check.errori;
      if (!check.valido) return;

      this.salvandoCliente = true;
      try {
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
      } finally {
        this.salvandoCliente = false;
      }
    },

    clienteSelezionato() {
      return this.clienti.find(c => c.id === this.clienteSelezionatoId) || {};
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
