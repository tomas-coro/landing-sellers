// js/app-economia.js
// Mixin di appState() con i metodi del dominio Economia (wizard incasso/vendita,
// motore di ripartizione tra partecipanti, costi). Estratto meccanicamente da
// js/app.js, stesso pattern UMD-lite di js/economic-engine.js.
(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.appEconomiaMixin = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return {
    valoreAnnualeVenditaEconomia(vendita) {
      return valoreAnnualeCliente(this.clienteEconomiaSelezionato) ||
        (Number(vendita?.importo_vendita) || 0);
    },

    scorriEconomiaA(selettore, mostraValidita = false) {
      const scorri = () => {
        const elemento = globalThis.document?.querySelector(selettore);
        elemento?.scrollIntoView({ behavior: 'smooth', block: 'center' });

        if (mostraValidita) {
          elemento?.focus({ preventScroll: true });
          elemento?.reportValidity?.();
        }
      };

      return typeof this.$nextTick === 'function'
        ? this.$nextTick(scorri)
        : scorri();
    },

    async apriEconomia(modalita = 'vendita') {
      if (!(await this.confermaUscitaFormCliente())) return;
      this.venditaEconomicaForm = formVenditaEconomicaVuoto();
      this.modalitaEconomia = modalita;
      this.venditaEconomicaAttiva = null;

      this.venditeClienteIncasso = [];
      this.venditaIncassoSelezionataId = null;
      this.caricandoVenditeIncasso = false;

      this.costiVenditaRiferimento = [];
      this.pagamentoPrevistoId = null;
      this.pagamentoInModificaId = null;
      this.clienteEconomiaSelezionato = null;
      this.anagraficaEconomiaAperta = false;
      this.erroreEconomia = '';
      this.successoEconomia = '';
      if (modalita === 'vendita') {
        await this.inizializzaPartecipantiEconomia();
        this.aggiornaConfigurazioneVendita();
      }

      this.view = 'economia';
      this.azzeraRicercaClienteEconomia();
      this.aggiornaSnapshotEconomia();

      window.scrollTo({ top: 0, behavior: 'smooth' });
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

      this.venditaEconomicaForm.venditoriDisponibili =
        profili
          .filter(profilo => profilo?.id)
          .filter(
            (profilo, indice, array) =>
              array.findIndex(p => p.id === profilo.id) === indice
          );

      const referente = profili.find(
        p => p.ruolo_economico === 'referente'
      );

      const tomas = profili.find(
        p => p.ruolo_economico === 'produzione'
      );

      if (!referente) {
        this.erroreEconomia =
          'Profilo economico di Alessandro non trovato.';
        this.venditaEconomicaForm.partecipanti = [];
        return;
      }

      if (!tomas) {
        this.erroreEconomia =
          'Profilo economico di Tomas non trovato.';
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
              : (
                  profilo.username ||
                  profilo.nome ||
                  'Venditore'
                ),

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

      /*
       * La vendita parte sempre dai due partecipanti strutturali.
       * Eventuali venditori terzi vengono aggiunti esplicitamente.
       */
      const partecipanti = [
        creaPartecipante(referente, 'referente')
      ];

      if (tomas.id !== referente.id) {
        partecipanti.push(
          creaPartecipante(tomas, 'produzione')
        );
      }

      const utenteCorrente = !this.isAdmin && profili.find(
        profilo => profilo.id === this.sessione?.user?.id
      );
      if (utenteCorrente && !partecipanti.some(p => p.id === utenteCorrente.id)) {
        partecipanti.push(creaPartecipante(utenteCorrente, 'venditore'));
      }

      const venditoreDefault =
        partecipanti.find(p => p.id === utenteCorrente?.id) ||
        partecipanti.find(
          partecipante => partecipante.ruolo === 'referente'
        );

      if (venditoreDefault) {
        venditoreDefault.haVenduto = true;
        this.venditaEconomicaForm.incassatoDa = venditoreDefault.id;
      }

      this.venditaEconomicaForm.partecipanti = partecipanti;
    },

    venditoriTerziDisponibiliEconomia() {
      const presenti = new Set(
        this.venditaEconomicaForm.partecipanti
          .map(partecipante => partecipante.id)
      );

      return (
        this.venditaEconomicaForm.venditoriDisponibili || []
      ).filter(profilo => !presenti.has(profilo.id));
    },

    aggiungiVenditoreTerzoEconomia(profiloId) {
      if (!profiloId) return;

      const profilo = (
        this.venditaEconomicaForm.venditoriDisponibili || []
      ).find(p => p.id === profiloId);

      if (!profilo) return;

      const esiste =
        this.venditaEconomicaForm.partecipanti.some(
          p => p.id === profilo.id
        );

      if (esiste) return;

      const partecipante = {
        id: profilo.id,

        nome:
          profilo.username ||
          profilo.nome ||
          'Venditore',

        ruolo: 'venditore',

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
      };

      this.venditaEconomicaForm.partecipanti.push(
        partecipante
      );

      /*
       * Se aggiungo esplicitamente un venditore terzo,
       * viene considerato il venditore della vendita.
       */
      this.impostaVenditoreEconomia(partecipante);
    },

    rimuoviVenditoreTerzoEconomia(partecipante) {
      if (!partecipante || partecipante.ruolo !== 'venditore') {
        return;
      }

      const eraVenditore = partecipante.haVenduto;

      this.venditaEconomicaForm.partecipanti =
        this.venditaEconomicaForm.partecipanti.filter(
          p => p.id !== partecipante.id
        );

      if (eraVenditore) {
        const referente =
          this.venditaEconomicaForm.partecipanti.find(
            p => p.ruolo === 'referente'
          );

        if (referente) {
          this.impostaVenditoreEconomia(referente);
        }
      }
    },

    impostaVenditoreEconomia(partecipante) {
      this.venditaEconomicaForm.partecipanti.forEach(p => {
        p.haVenduto = p.id === partecipante.id;
      });
      if (this.modalitaEconomia === 'vendita') {
        this.venditaEconomicaForm.incassatoDa = partecipante.id;
      }
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

    partecipantiPerMotoreEconomia() {
      return this.venditaEconomicaForm.partecipanti.map(partecipante => {
        if (partecipante.ruolo !== 'referente') {
          return { ...partecipante };
        }

        return {
          ...partecipante,
          modalitaFatturazione:
            this.modalitaFatturazioneAdminEconomia(),
          importoFatturato:
            this.importoFatturatoAdminEconomia()
        };
      });
    },

    risultatoMotoreEconomia() {
      const engine = economicEngineApi();

      if (!engine) {
        throw new Error(
          'Motore economico non disponibile.'
        );
      }

      return engine.calcolaRipartizioneEconomica({
        importoVendita:
          Number(this.venditaEconomicaForm.importoVendita) || 0,
        costi: this.venditaEconomicaForm.costi || [],
        partecipanti: this.partecipantiPerMotoreEconomia(),
        percentualeRiduzioneNoFattura:
          Number(
            this.venditaEconomicaForm.percentualeRiduzioneNoFattura
          ) || 0,
        applicaBonusVenditore:
          this.venditaEconomicaForm.applicaBonusVenditore !== false
      });
    },

    risultatoPartecipanteMotoreEconomia(partecipante) {
      const risultato = this.risultatoMotoreEconomia();

      if (partecipante.id) {
        const perId = risultato.partecipanti.find(
          p => p.id === partecipante.id
        );

        if (perId) return perId;
      }

      if (partecipante.nome) {
        const perNomeERuolo = risultato.partecipanti.find(
          p =>
            p.ruolo === partecipante.ruolo &&
            p.nome === partecipante.nome
        );

        if (perNomeERuolo) return perNomeERuolo;
      }

      // Nei test e nei dati legacy può mancare id/nome.
      // I ruoli economici principali sono univoci nella vendita,
      // quindi il ruolo è un fallback sicuro.
      const stessoRuolo = risultato.partecipanti.filter(
        p => p.ruolo === partecipante.ruolo
      );

      return stessoRuolo.length === 1
        ? stessoRuolo[0]
        : null;
    },

    percentualeFatturataAdminEconomia() {
      return (
        this.risultatoMotoreEconomia()
          .percentualeFatturataAdmin / 100
      );
    },

    nettoDistribuibileEconomia() {
      return this.risultatoMotoreEconomia()
        .nettoDistribuibile;
    },

    partecipanteUtenteCorrenteEconomia() {
      const partecipanti =
        this.venditaEconomicaForm.partecipanti || [];

      const userId = this.sessione?.user?.id;

      if (userId) {
        const perId = partecipanti.find(
          partecipante => partecipante.id === userId
        );

        if (perId) return perId;
      }

      const identita = [
        this.profilo?.nome,
        this.profilo?.username,
        this.profiloPersonale?.nome,
        this.profiloPersonale?.username
      ]
        .filter(Boolean)
        .map(valore => String(valore).trim().toLowerCase());

      return partecipanti.find(partecipante =>
        identita.includes(
          String(partecipante.nome || '')
            .trim()
            .toLowerCase()
        )
      ) || null;
    },

    quotaUtenteCorrenteEconomia() {
      const partecipante =
        this.partecipanteUtenteCorrenteEconomia();

      if (!partecipante) return 0;

      return this.calcoloPartecipanteEconomia(
        partecipante
      ).quotaFinale || 0;
    },

    quotaBaseLordaEconomia() {
      const risultato = this.risultatoMotoreEconomia();
      return risultato.partecipanti[0]?.quotaBaseLorda || 0;
    },

    quotaBaseEconomia() {
      const risultato = this.risultatoMotoreEconomia();
      return risultato.partecipanti[0]?.quotaBase || 0;
    },

    bonusVenditoreEconomia() {
      if (
        this.venditaEconomicaForm.partecipanti.length !== 2
      ) {
        return 0;
      }

      const venditore =
        this.risultatoMotoreEconomia().partecipanti.find(
          p => p.haVenduto
        );

      if (!venditore) return 0;

      return Math.max(
        0,
        venditore.quotaTeorica - venditore.quotaBase
      );
    },

    quotaTeoricaPartecipanteEconomia(partecipante) {
      return (
        this.risultatoPartecipanteMotoreEconomia(partecipante)
          ?.quotaTeorica || 0
      );
    },

    modalitaFatturazionePartecipanteEconomia(partecipante) {
      const valore =
        partecipante.modalitaFatturazione || 'nessuna';

      return ['totale', 'mista', 'nessuna'].includes(valore)
        ? valore
        : 'nessuna';
    },

    riduzioneNoFatturaPartecipanteEconomia(partecipante) {
      return (
        this.risultatoPartecipanteMotoreEconomia(partecipante)
          ?.riduzioneNoFattura || 0
      );
    },

    bonusNoFatturaAdminEconomia() {
      const referente =
        this.risultatoMotoreEconomia().partecipanti.find(
          p => p.ruolo === 'referente'
        );

      return referente?.bonusAdmin || 0;
    },

    quotaEffettivaPartecipanteEconomia(
      partecipante,
      quotaCalcolata = null
    ) {
      if (quotaCalcolata == null) {
        return (
          this.risultatoPartecipanteMotoreEconomia(partecipante)
            ?.quotaFinale || 0
        );
      }

      const calcolata = Math.max(
        0,
        Number(quotaCalcolata) || 0
      );

      if (!partecipante.quotaOverride) {
        return calcolata;
      }

      const valore = Number(partecipante.quotaEffettiva);

      return Number.isFinite(valore) && valore >= 0
        ? valore
        : calcolata;
    },

    calcoloPartecipanteEconomia(partecipante) {
      const risultato =
        this.risultatoPartecipanteMotoreEconomia(
          partecipante
        );

      if (!risultato) {
        return {
          quotaBase: 0,
          quotaTeorica: 0,
          bonusVendita: 0,
          riduzioneNoFattura: 0,
          bonusAdmin: 0,
          quotaCalcolata: 0,
          quotaFinale: 0,
          quotaEffettiva: 0,
          percentualeRiduzione: 0,
          percentualeTasseEffettiva: 0,
          importoTasse: 0,
          importoFatturato: 0,
          importoNonFatturato: 0
        };
      }

      const motore = this.risultatoMotoreEconomia();

      const bonusVendita =
        partecipante.haVenduto &&
        this.venditaEconomicaForm.partecipanti.length === 2
          ? Math.max(
              0,
              risultato.quotaTeorica - risultato.quotaBase
            )
          : 0;

      return {
        quotaBase: risultato.quotaBase,
        quotaTeorica: risultato.quotaTeorica,
        bonusVendita,
        riduzioneNoFattura:
          risultato.riduzioneNoFattura,
        bonusAdmin: risultato.bonusAdmin,
        quotaCalcolata: risultato.quotaCalcolata,
        quotaFinale: risultato.quotaFinale,
        quotaEffettiva: risultato.quotaFinale,

        percentualeRiduzione:
          Number(
            this.venditaEconomicaForm.percentualeRiduzioneNoFattura
          ) || 0,

        percentualeTasseEffettiva:
          motore.percentualeTasse *
          (motore.percentualeFatturataAdmin / 100),

        importoTasse: Math.max(
          0,
          risultato.quotaBaseLorda -
            risultato.quotaBase
        ),

        importoFatturato:
          risultato.importoFatturato,

        importoNonFatturato:
          risultato.importoNonFatturato
      };
    },

    totaleQuoteFinaliEconomia() {
      return this.risultatoMotoreEconomia()
        .totaleQuote;
    },

    totaleTrattenuteEconomia() {
      return this.risultatoMotoreEconomia()
        .partecipanti
        .filter(p => p.ruolo !== 'referente')
        .reduce(
          (totale, p) =>
            totale + p.riduzioneNoFattura,
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

    azzeraRicercaClienteEconomia() {
      this.venditaEconomicaForm.clienteRicerca = '';

      globalThis.requestAnimationFrame(() => {
        const campo =
          document.querySelector('.economy-client-searchbox');

        if (campo) {
          campo.textContent = '';
        }
      });
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
      if (this.modalitaEconomia === 'incasso') {
        return this.apriPagamentoCliente(cliente);
      }

      this.clienteEconomiaSelezionato = cliente;
      this.venditaEconomicaForm.clienteId = cliente.id;
      this.azzeraRicercaClienteEconomia();

      /*
       * Una nuova vendita parte dal configuratore corrente.
       * Non eredita prezzo, pacchetto o costi storici del cliente.
       */
      this.aggiornaConfigurazioneVendita();
      this.aggiornaSnapshotEconomia();
    },

    async registraVenditaPerClienteEconomia() {
      const cliente = this.clienteEconomiaSelezionato;
      if (!cliente?.id) return;

      await this.apriEconomia('vendita');
      this.selezionaClienteEconomia(cliente);
    },

    // Riapre lo stesso configuratore usato per registrare un pagamento,
    // precompilato con i dati del pagamento esistente: sull'invio si va a
    // correggere quel pagamento (RPC modifica_pagamento_economico) invece
    // di crearne uno nuovo. Così il ricalcolo delle quote usa lo stesso
    // motore economico della registrazione originale.
    async modificaPagamentoCliente(cliente, pagamento) {
      if (!cliente?.id || !pagamento?.id || pagamento.stato === 'annullato') return;
      if (pagamento.stato === 'incassato' && !this.isAdmin) return;

      await this.apriEconomia('incasso');
      this.clienteEconomiaSelezionato = cliente;
      this.erroreEconomia = '';
      this.successoEconomia = '';
      this.caricandoVenditeIncasso = true;

      try {
        const { data, error } = await window.supabaseClient
          .from('vendite')
          .select('id,cliente_id,venditore_id,servizio,importo_vendita,data_vendita,creato_il,applica_bonus_venditore')
          .eq('id', pagamento.vendita_id)
          .maybeSingle();

        if (error || !data) {
          this.erroreEconomia = 'Vendita collegata al pagamento non disponibile.';
          return;
        }

        this.venditeClienteIncasso = [data];
        await this.selezionaVenditaIncasso(data.id);

        // pagamentoInModificaId segna "sono qui per correggere questo
        // pagamento" (label e pulsante Annulla in UI). pagamentoPrevistoId
        // resta solo l'instradamento RPC per le rate previste: è lo stesso
        // campo che apriPagamentoCliente() usa per il flusso "Incassa" già
        // esistente, che NON deve ereditare l'etichetta di modifica.
        this.pagamentoInModificaId = pagamento.id;

        if (pagamento.stato === 'previsto') {
          this.pagamentoPrevistoId = pagamento.id;
          this.venditaEconomicaForm.statoIncasso = 'previsto';
        } else {
          this.pagamentoPrevistoId = null;
          this.venditaEconomicaForm.statoIncasso = 'incassato';
        }

        this.venditaEconomicaForm.importoIncassato = Number(pagamento.importo) || null;
        this.venditaEconomicaForm.metodoPagamento = pagamento.metodo || '';
        this.venditaEconomicaForm.notePagamento = pagamento.note || '';
        this.venditaEconomicaForm.dataPagamento = pagamento.data_pagamento || this.dataISOOggi();
        this.venditaEconomicaForm.dataScadenza = pagamento.data_scadenza || '';
        this.venditaEconomicaForm.incassatoDa =
          pagamento.incassato_da || data.venditore_id || null;

        this.aggiornaSnapshotEconomia();
      } finally {
        this.caricandoVenditeIncasso = false;
      }

      this.view = 'economia';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    annullaModificaPagamento() {
      this.cambiaClienteEconomia();
    },

    // Un incasso torna a essere una rata prevista tramite RPC atomica:
    // resta così visibile in Agenda/Home e può essere registrato di nuovo.
    async eliminaPagamentoCliente(cliente, pagamento) {
      if (!cliente?.id || !pagamento?.id || this.eliminandoPagamentoId) return;
      if (pagamento.stato === 'incassato' && !this.isAdmin) return;

      const annullaIncasso = pagamento.stato === 'incassato';
      const messaggio = annullaIncasso
        ? `Annullare l’incasso di ${formattaEuro(pagamento.importo)}? Tornerà tra i pagamenti da registrare.`
        : `Eliminare questa rata prevista da ${formattaEuro(pagamento.importo)}?`;

      const confermato = await this.chiediConferma(
        messaggio,
        annullaIncasso ? 'Annulla incasso' : 'Elimina'
      );
      if (!confermato) return;

      this.eliminandoPagamentoId = pagamento.id;
      this.errorePagamentiCliente = '';

      try {
        const risultato = annullaIncasso
          ? await window.supabaseClient.rpc(
              'annulla_incasso_economico',
              { p_pagamento_id: pagamento.id }
            )
          : await window.supabaseClient
              .from('pagamenti')
              .delete()
              .eq('id', pagamento.id)
              .select('id');
        const { data, error } = risultato;

        if (error) {
          this.errorePagamentiCliente =
            `Pagamento non ${annullaIncasso ? 'annullato' : 'eliminato'}: ${error.message}`;
          return;
        }

        // La RLS filtra in silenzio: se non torna alcuna riga il permesso
        // manca, ma error resta null. Senza questo controllo l'utente non
        // saprebbe perché il pagamento è ancora lì dopo aver confermato.
        if (!data || (!annullaIncasso && data.length === 0)) {
          this.errorePagamentiCliente =
            `Pagamento non ${annullaIncasso ? 'annullato' : 'eliminato'}: non hai i permessi necessari.`;
          return;
        }

        await this.caricaPagamentiCliente(cliente.id, pagamento.vendita_id);

        if (this.isAdmin) {
          await this.caricaDashboardAdmin();
        } else {
          await this.caricaClienti();
          await this.caricaStatisticheVenditore();
        }
      } finally {
        this.eliminandoPagamentoId = null;
      }
    },

    nomePartecipanteTrasferimento(quota) {
      if (quota?.ruolo === 'referente') return 'Alessandro';
      if (quota?.ruolo === 'produzione') return 'Tomas';
      return quota?.profilo?.username || quota?.profilo?.nome ||
        this.nomeVenditorePerId(quota?.profilo_id) || 'Venditore';
    },

    // Nomi di tutti i venditori, presi dalla RPC get_partecipanti_economici
    // (security definer: bypassa la RLS su profili, che altrimenti lascia
    // leggere solo il proprio profilo). Serve per mostrare "a chi"/"da chi"
    // nelle quote di un collega, dove il join diretto su profili torna vuoto.
    async caricaMappaNomiVenditori() {
      if (Object.keys(this.mappaNomiVenditori).length) return;

      const { data, error } = await window.supabaseClient
        .rpc('get_partecipanti_economici');
      if (error || !data) return;

      this.mappaNomiVenditori = data.reduce((mappa, profilo) => {
        if (!profilo?.id) return mappa;
        mappa[profilo.id] =
          profilo.ruolo_economico === 'referente'
            ? 'Alessandro'
            : profilo.ruolo_economico === 'produzione'
              ? 'Tomas'
              : (profilo.username || profilo.nome || 'Venditore');
        return mappa;
      }, {});
    },

    nomeVenditorePerId(profiloId) {
      return this.mappaNomiVenditori[profiloId] || '';
    },

    // Raggruppa più pagamenti reali dello stesso cliente/controparte in
    // un'unica riga (es. Tarantella incassata 2 volte = 1 riga da 60€, non
    // 2 righe da 30€): la causa non era un duplicato, erano 2 incassi veri.
    _raggruppaQuote(lista, chiaveFn) {
      const gruppi = lista.reduce((mappa, quota) => {
        const chiave = chiaveFn(quota);
        if (!mappa[chiave]) {
          mappa[chiave] = { ...quota, quota_effettiva: 0, pagamentoIds: [] };
        }
        mappa[chiave].quota_effettiva += Number(quota.quota_effettiva || 0);
        mappa[chiave].pagamentoIds.push(quota.pagamento_id);
        return mappa;
      }, {});
      return Object.values(gruppi);
    },

    trasferimentiDaConfermareRaggruppati() {
      return this._raggruppaQuote(
        this.trasferimentiDaConfermare,
        quota => (quota.clienteId || '') + '|' + (quota.controparteNome || '')
      );
    },

    quoteDaTrasferireRaggruppate() {
      return this._raggruppaQuote(
        this.quoteDaTrasferire,
        quota => (quota.clienteId || '') + '|' + (quota.aChiNome || '')
      );
    },

    quoteAdminRaggruppate() {
      return this._raggruppaQuote(
        this.quoteAdmin,
        quota => (quota.clienteId || '') + '|' + (quota.daChiNome || '') + '|' + (quota.aChiNome || '')
      );
    },

    trasferimentoPagamentoCompleto(pagamento) {
      return (pagamento?.quote_trasferimento || [])
        .filter(quota =>
          quota.profilo_id !== pagamento.incassato_da &&
          Number(quota.quota_effettiva) > 0
        )
        .every(quota => !!quota.ricevuta_il);
    },

    async caricaTrasferimentiDaConfermare() {
      const profiloId = this.sessione?.user?.id;
      this.trasferimentiDaConfermare = [];
      if (!profiloId) return;

      const { data, error } = await window.supabaseClient
        .from('pagamento_partecipanti')
        .select(`
          id,
          pagamento_id,
          quota_effettiva,
          ricevuta_il,
          pagamenti!inner(
            id,
            incassato_da,
            stato,
            data_pagamento,
            vendite!inner(cliente_id, clienti(nome))
          )
        `)
        .eq('profilo_id', profiloId)
        .is('ricevuta_il', null)
        .gt('quota_effettiva', 0)
        .eq('pagamenti.stato', 'incassato');

      if (error) {
        this.mostraToast('error', 'Quote da confermare non caricate', error.message);
        return;
      }

      await this.caricaMappaNomiVenditori();

      this.trasferimentiDaConfermare = (data || [])
        .filter(quota => quota.pagamenti?.incassato_da !== profiloId)
        .map(quota => ({
          ...quota,
          clienteId: quota.pagamenti?.vendite?.cliente_id || null,
          clienteNome: quota.pagamenti?.vendite?.clienti?.nome || '',
          controparteNome: this.nomeVenditorePerId(quota.pagamenti?.incassato_da)
        }));
    },

    // Quote che altri partecipanti devono ancora ricevere da pagamenti che
    // HAI incassato tu: risponde a "quanto devo e a chi" lato venditore.
    async caricaQuoteDaTrasferire() {
      const profiloId = this.sessione?.user?.id;
      this.quoteDaTrasferire = [];
      if (!profiloId) return;

      const { data, error } = await window.supabaseClient
        .from('pagamento_partecipanti')
        .select(`
          id,
          pagamento_id,
          profilo_id,
          quota_effettiva,
          ricevuta_il,
          pagamenti!inner(
            id,
            incassato_da,
            stato,
            data_pagamento,
            vendite!inner(cliente_id, clienti(nome))
          )
        `)
        .eq('pagamenti.incassato_da', profiloId)
        .neq('profilo_id', profiloId)
        .is('ricevuta_il', null)
        .gt('quota_effettiva', 0)
        .eq('pagamenti.stato', 'incassato');

      if (error) {
        this.mostraToast('error', 'Quote da trasferire non caricate', error.message);
        return;
      }

      await this.caricaMappaNomiVenditori();

      this.quoteDaTrasferire = (data || []).map(quota => ({
        ...quota,
        clienteId: quota.pagamenti?.vendite?.cliente_id || null,
        clienteNome: quota.pagamenti?.vendite?.clienti?.nome || '',
        aChiNome: this.nomeVenditorePerId(quota.profilo_id)
      }));
    },

    // Totale da trasferire per destinatario (es. "Quanto devo a Tomas",
    // "Quanto devo ad Alessandro"): riepilogo sopra l'elenco riga per riga.
    quoteDaTrasferirePerDestinatario() {
      const totali = this.quoteDaTrasferire.reduce((mappa, quota) => {
        const nome = quota.aChiNome || 'Da definire';
        mappa[nome] = (mappa[nome] || 0) + Number(quota.quota_effettiva || 0);
        return mappa;
      }, {});
      return Object.entries(totali)
        .map(([nome, totale]) => ({ nome, totale }))
        .sort((a, b) => b.totale - a.totale);
    },

    // Ultime quote confermate da te: permette di annullare un tap per
    // errore senza dover intervenire sul database.
    async caricaQuoteConfermateRecenti() {
      const profiloId = this.sessione?.user?.id;
      this.quoteConfermateRecenti = [];
      if (!profiloId) return;

      const { data, error } = await window.supabaseClient
        .from('pagamento_partecipanti')
        .select(`
          id,
          pagamento_id,
          quota_effettiva,
          ricevuta_il,
          pagamenti!inner(
            id,
            incassato_da,
            stato,
            vendite!inner(cliente_id, clienti(nome))
          )
        `)
        .eq('profilo_id', profiloId)
        .not('ricevuta_il', 'is', null)
        .gt('quota_effettiva', 0)
        .eq('pagamenti.stato', 'incassato')
        .order('ricevuta_il', { ascending: false })
        .limit(10);

      if (error) {
        this.mostraToast('error', 'Quote confermate non caricate', error.message);
        return;
      }

      await this.caricaMappaNomiVenditori();

      this.quoteConfermateRecenti = (data || [])
        .filter(quota => quota.pagamenti?.incassato_da !== profiloId)
        .map(quota => ({
          ...quota,
          clienteNome: quota.pagamenti?.vendite?.clienti?.nome || '',
          controparteNome: this.nomeVenditorePerId(quota.pagamenti?.incassato_da)
        }));
    },

    // Vista admin: tutte le quote ancora da trasferire, per capire chi deve
    // pagare chi su ogni cliente senza dover aprire ogni scheda.
    async caricaQuoteAdmin() {
      this.quoteAdmin = [];
      if (!this.isAdmin) return;

      const { data, error } = await window.supabaseClient
        .from('pagamento_partecipanti')
        .select(`
          id,
          pagamento_id,
          profilo_id,
          quota_effettiva,
          ricevuta_il,
          profilo:profili(nome),
          pagamenti!inner(
            id,
            incassato_da,
            stato,
            vendite!inner(cliente_id, clienti(nome)),
            incassato_da_profilo:profili!pagamenti_incassato_da_fkey(nome)
          )
        `)
        .is('ricevuta_il', null)
        .gt('quota_effettiva', 0)
        .eq('pagamenti.stato', 'incassato');

      if (error) {
        this.mostraToast('error', 'Quote non caricate', error.message);
        return;
      }

      this.quoteAdmin = (data || [])
        .filter(quota => quota.pagamenti?.incassato_da !== quota.profilo_id)
        .map(quota => ({
          ...quota,
          clienteId: quota.pagamenti?.vendite?.cliente_id || null,
          clienteNome: quota.pagamenti?.vendite?.clienti?.nome || '',
          daChiNome: quota.pagamenti?.incassato_da_profilo?.nome || '',
          aChiNome: quota.profilo?.nome || ''
        }));
    },

    // Mostra sempre il dettaglio (cliente, controparte, importo) prima di
    // scrivere la conferma: un tap sulla riga non basta più da solo, per
    // evitare conferme involontarie come quella che ha generato questo bug.
    async confermaQuotaConDettaglio(quota) {
      const pagamentoIds = quota?.pagamentoIds?.length
        ? quota.pagamentoIds
        : (quota?.pagamento_id ? [quota.pagamento_id] : []);
      if (!pagamentoIds.length) return;

      const dettaglio = [
        `Confermi di aver ricevuto ${this.formattaEuro(quota.quota_effettiva)}`,
        quota.controparteNome ? `da ${quota.controparteNome}` : '',
        quota.clienteNome ? `per ${quota.clienteNome}` : '',
        pagamentoIds.length > 1 ? `(${pagamentoIds.length} incassi)` : ''
      ].filter(Boolean).join(' ') + '?';

      const confermato = await this.chiediConferma(dettaglio, 'Conferma ricezione');
      if (!confermato) return;

      for (const pagamentoId of pagamentoIds) {
        await this.confermaRicezioneQuota(pagamentoId);
      }
    },

    async confermaRicezioneQuota(pagamentoId) {
      if (!pagamentoId || this.confermandoTrasferimentoId) return;
      this.confermandoTrasferimentoId = pagamentoId;

      try {
        const { error } = await window.supabaseClient.rpc(
          'conferma_quota_pagamento',
          { p_pagamento_id: pagamentoId }
        );

        if (error) {
          this.mostraToast('error', 'Conferma non salvata', error.message);
          return;
        }

        await this.caricaTrasferimentiDaConfermare();
        await this.caricaQuoteConfermateRecenti();
        if (this.clienteSelezionatoId) {
          await this.caricaPagamentiCliente(this.clienteSelezionatoId);
        }
        this.mostraToast('success', 'Quota ricevuta confermata.');
      } finally {
        this.confermandoTrasferimentoId = null;
      }
    },

    async annullaConfermaQuota(pagamentoId) {
      if (!pagamentoId || this.annullandoConfermaQuotaId) return;

      const confermato = await this.chiediConferma(
        'Annulli la conferma di ricezione di questa quota? Tornerà tra quelle da confermare.',
        'Annulla conferma'
      );
      if (!confermato) return;

      this.annullandoConfermaQuotaId = pagamentoId;

      try {
        const { error } = await window.supabaseClient.rpc(
          'annulla_conferma_quota_pagamento',
          { p_pagamento_id: pagamentoId }
        );

        if (error) {
          this.mostraToast('error', 'Annullamento non riuscito', error.message);
          return;
        }

        await this.caricaTrasferimentiDaConfermare();
        await this.caricaQuoteConfermateRecenti();
        if (this.clienteSelezionatoId) {
          await this.caricaPagamentiCliente(this.clienteSelezionatoId);
        }
        this.mostraToast('success', 'Conferma annullata.');
      } finally {
        this.annullandoConfermaQuotaId = null;
      }
    },

    cambiaClienteEconomia() {
      this.clienteEconomiaSelezionato = null;
      this.anagraficaEconomiaAperta = false;

      if (this.modalitaEconomia === 'incasso') {
        this.venditeClienteIncasso = [];
        this.venditaIncassoSelezionataId = null;
        this.venditaEconomicaAttiva = null;
        this.venditaClienteAttiva = null;
        this.pagamentiCliente = [];
        this.costiVenditaRiferimento = [];
        this.pagamentoPrevistoId = null;
        this.pagamentoInModificaId = null;
        this.erroreEconomia = '';
        this.successoEconomia = '';
      }
      this.venditaEconomicaForm.clienteId = null;
      this.azzeraRicercaClienteEconomia();
      this.venditaEconomicaForm.servizio = '';
      this.venditaEconomicaForm.importoVendita = null;
      this.venditaEconomicaForm.importoIncassato = null;
      this.venditaEconomicaForm.costi = [];

      this.aggiornaSnapshotEconomia();
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

    aggiungiCostoRataEconomia() {
      const descrizione =
        (this.venditaEconomicaForm.costoRataDescrizione || '').trim();

      const importo =
        Number(this.venditaEconomicaForm.costoRataImporto);

      if (
        !descrizione ||
        !Number.isFinite(importo) ||
        importo <= 0
      ) {
        return;
      }

      this.venditaEconomicaForm.costiRata.push({
        id: `${Date.now()}-${Math.random()}`,
        descrizione,
        importo
      });

      this.venditaEconomicaForm.costoRataDescrizione = '';
      this.venditaEconomicaForm.costoRataImporto = null;
    },

    rimuoviCostoRataEconomia(id) {
      this.venditaEconomicaForm.costiRata =
        this.venditaEconomicaForm.costiRata.filter(
          costo => costo.id !== id
        );
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

      /*
       * L'importo fatturato dai collaboratori ad Alessandro in modalità
       * "mista" è calcolato in automatico dal motore economico (vedi
       * economic-engine.js -> importoFatturatoCollaboratore): non è più
       * un dato inserito a mano, quindi qui non c'è nulla da validare.
       */

      /*
       * Il pagamento iniziale è facoltativo: importoIncassato > 0 è il
       * segnale che l'utente vuole registrarlo insieme alla vendita.
       * Se lasciato vuoto/0 non viene creato alcun pagamento.
       */
      const importoIniziale =
        Number(this.venditaEconomicaForm.importoIncassato) || 0;

      if (importoIniziale > 0) {
        const totaleVendita =
          Number(this.venditaEconomicaForm.importoVendita) || 0;

        if (importoIniziale > totaleVendita) {
          return 'Il pagamento iniziale non può superare l\'importo della vendita.';
        }

        if (!this.venditaEconomicaForm.metodoPagamento) {
          return 'Seleziona il metodo di pagamento.';
        }
        if (!this.venditaEconomicaForm.partecipanti.some(
          p => p.id === this.venditaEconomicaForm.incassatoDa
        )) {
          return 'Indica chi ha incassato.';
        }
      }

      return '';
    },

    partecipantiPerMotoreRataEconomia() {
      return this.derivaPartecipantiRataDaConsolidato(
        this.venditaEconomicaForm.partecipanti,
        Number(this.venditaEconomicaForm.importoIncassato) || 0,
        Number(this.venditaEconomicaForm.importoVendita) || 0
      );
    },

    previewPagamentoEconomia() {
      if (
        this.modalitaEconomia !== 'incasso' ||
        this.venditaEconomicaForm.statoIncasso === 'previsto' ||
        !this.venditaEconomicaAttiva ||
        !(Number(this.venditaEconomicaForm.importoIncassato) > 0) ||
        !this.venditaEconomicaForm.partecipanti.length
      ) return null;

      try {
        return this.snapshotPagamentoEconomia();
      } catch {
        return null;
      }
    },

    snapshotPagamentoEconomia() {
      const engine = economicEngineApi();

      if (!engine?.calcolaSnapshotPagamento) {
        throw new Error(
          'Motore economico dei pagamenti non disponibile.'
        );
      }

      return engine.calcolaSnapshotPagamento({
        importoPagamento:
          Number(this.venditaEconomicaForm.importoIncassato) || 0,

        costiApplicati:
          this.costiPerMotoreRataEconomia(),

        partecipanti:
          this.partecipantiPerMotoreRataEconomia(),

        percentualeRiduzioneNoFattura:
          Number(
            this.venditaEconomicaForm.percentualeRiduzioneNoFattura
          ) || 0,

        // Deve restare la stessa scelta fatta alla registrazione della
        // vendita (vedi caricamento in selezionaVenditaIncasso), non il
        // default del form vuoto: altrimenti due pagamenti della stessa
        // vendita userebbero condizioni economiche diverse.
        applicaBonusVenditore:
          this.venditaEconomicaForm.applicaBonusVenditore !== false,

        esenteTasse:
          this.venditaEconomicaForm.metodoPagamento === 'Contanti'
      });
    },

    payloadSnapshotPagamentoEconomia(
      snapshot = this.snapshotPagamentoEconomia()
    ) {
      return {
        calcolo: {
          importo_pagamento:
            Number(snapshot.importoPagamento) || 0,

          importo_costi:
            Number(snapshot.totaleCosti) || 0,

          margine:
            Number(snapshot.margine) || 0,

          percentuale_tasse:
            Number(snapshot.percentualeTasse) || 0,

          percentuale_fatturata_admin:
            Number(snapshot.percentualeFatturataAdmin) || 0,

          importo_tasse:
            Number(snapshot.importoTasse) || 0,

          netto_distribuibile:
            Number(snapshot.nettoDistribuibile) || 0,

          costi_snapshot:
            (snapshot.costiApplicati || []).map(costo => ({
              descrizione:
                (costo.descrizione || '').trim() || 'Costo',
              importo:
                Number(costo.importo) || 0
            }))
        },

        partecipanti:
          (snapshot.partecipanti || []).map(partecipante => ({
            profilo_id:
              partecipante.id || partecipante.profilo_id,

            ruolo:
              partecipante.ruolo || null,

            modalita_fatturazione:
              partecipante.modalitaFatturazione || 'nessuna',

            importo_fatturato:
              Number(partecipante.importoFatturato) || 0,

            quota_base:
              Number(partecipante.quotaBase) || 0,

            quota_teorica:
              Number(partecipante.quotaTeorica) || 0,

            percentuale_riduzione:
              Number(partecipante.percentualeRiduzione) || 0,

            importo_riduzione:
              Number(partecipante.riduzioneNoFattura) || 0,

            bonus_admin:
              Number(partecipante.bonusAdmin) || 0,

            quota_calcolata:
              Number(partecipante.quotaCalcolata) || 0,

            // Nello snapshot del pagamento conta la quota realmente
            // attribuita a quella rata, cioè quotaFinale.
            quota_effettiva:
              Number(partecipante.quotaFinale) || 0,

            quota_override:
              !!partecipante.quotaOverride,

            note_quota: null
          }))
      };
    },

    validaIncassoEconomia() {
      if (!this.venditaEconomicaAttiva) return 'Nessuna vendita attiva disponibile.';
      const importo = Number(this.venditaEconomicaForm.importoIncassato) || 0;
      const massimo = this.residuoCliente();
      if (!(importo > 0 && importo <= massimo)) return 'Inserisci un importo non superiore al residuo.';
      if (this.venditaEconomicaForm.statoIncasso === 'previsto' && !this.venditaEconomicaForm.dataScadenza) {
        return 'Inserisci la scadenza della rata.';
      }
      if (
        this.venditaEconomicaForm.statoIncasso !== 'previsto' &&
        !this.venditaEconomicaForm.metodoPagamento
      ) {
        return 'Seleziona il metodo di pagamento.';
      }
      if (
        this.venditaEconomicaForm.statoIncasso !== 'previsto' &&
        !this.venditaEconomicaForm.partecipanti.some(
          p => p.id === this.venditaEconomicaForm.incassatoDa
        )
      ) {
        return 'Indica chi ha incassato.';
      }

    if (this.venditaEconomicaForm.statoIncasso !== 'previsto') {
  const importoRata = importo;

  const partecipanti =
    this.partecipantiPerMotoreRataEconomia();

  for (const partecipante of partecipanti) {
    // Solo il referente fattura davvero il cliente: per i collaboratori
    // l'importo fatturato ad Alessandro in modalità "mista" è calcolato
    // in automatico dal motore economico, quindi non va validato qui.
    if (
      partecipante.ruolo === 'referente' &&
      partecipante.modalitaFatturazione === 'mista' &&
      !(
        partecipante.importoFatturato > 0 &&
        partecipante.importoFatturato < importoRata
      )
    ) {
      return 'L’importo della fatturazione mista deve essere maggiore di 0 e inferiore alla rata.';
    }

    if (
      partecipante.quotaOverride &&
      (
        partecipante.quotaEffettiva == null ||
        partecipante.quotaEffettiva < 0
      )
    ) {
      return 'Inserisci una quota manuale valida per la rata.';
    }
  }

  const snapshot = this.snapshotPagamentoEconomia();

  if (!snapshot.valido) {
    return snapshot.errore ||
      'La ripartizione economica della rata non quadra.';
  }
}
      return '';
    },

    async salvaIncassoEconomia() {
      if (this.salvandoVenditaEconomica) return;

      this.erroreEconomia = this.validaIncassoEconomia();
      this.successoEconomia = '';

      if (this.erroreEconomia) {
        const metodoMancante =
          this.erroreEconomia === 'Seleziona il metodo di pagamento.';

        this.mostraToast('error', 'Completa i dati', this.erroreEconomia);
        this.scorriEconomiaA(
          metodoMancante ? '#metodo-incasso' : '.payment-entry-panel',
          metodoMancante
        );
        return;
      }

      this.salvandoVenditaEconomica = true;

      try {
        const previsto =
          this.venditaEconomicaForm.statoIncasso === 'previsto';

        const modificaId = this.pagamentoInModificaId;

        let rpcNome;
        let rpcPayload;

        if (previsto) {
          rpcNome = 'registra_pagamento_vendita';

          rpcPayload = {
            p_vendita_id:
              this.venditaEconomicaAttiva.id,

            p_importo:
              Number(
                this.venditaEconomicaForm.importoIncassato
              ),

            p_stato: 'previsto',

            p_data_scadenza:
              this.venditaEconomicaForm.dataScadenza,

            p_data_pagamento: null,

            p_metodo: null,

            p_note:
              (this.venditaEconomicaForm.notePagamento || '')
                .trim() || null,

            p_pagamento_previsto_id:
              this.pagamentoPrevistoId
          };
        } else {
          const snapshot =
            this.snapshotPagamentoEconomia();

          if (!snapshot.valido) {
            this.erroreEconomia =
              snapshot.errore ||
              'La ripartizione economica della rata non quadra.';
            return;
          }

          const payloadEconomico =
            this.payloadSnapshotPagamentoEconomia(snapshot);

          // Se pagamentoPrevistoId è ancora impostato, questo pagamento è
          // una rata prevista che sta passando a incassato ora: deve
          // seguire il percorso di conversione esistente (che scrive anche
          // lo snapshot per la prima volta), non la RPC di modifica - che
          // per un pagamento ancora 'previsto' salterebbe lo snapshot e
          // lascerebbe lo stato invariato.
          if (modificaId && !this.pagamentoPrevistoId) {
            rpcNome = 'modifica_pagamento_con_trasferimenti';

            rpcPayload = {
              p_pagamento_id: modificaId,

              p_importo:
                Number(
                  this.venditaEconomicaForm.importoIncassato
                ),

              p_data_pagamento:
                this.venditaEconomicaForm.dataPagamento ||
                this.dataISOOggi(),

              p_metodo:
                (this.venditaEconomicaForm.metodoPagamento || '')
                  .trim() || null,

              p_note:
                (this.venditaEconomicaForm.notePagamento || '')
                  .trim() || null,

              p_calcolo:
                payloadEconomico.calcolo,

              p_partecipanti:
                payloadEconomico.partecipanti,

              p_incassato_da:
                this.venditaEconomicaForm.incassatoDa
            };
          } else {
            rpcNome = 'registra_pagamento_con_trasferimenti';

            rpcPayload = {
              p_vendita_id:
                this.venditaEconomicaAttiva.id,

              p_importo:
                Number(
                  this.venditaEconomicaForm.importoIncassato
                ),

              p_data_pagamento:
                this.venditaEconomicaForm.dataPagamento ||
                this.dataISOOggi(),

              p_metodo:
                (this.venditaEconomicaForm.metodoPagamento || '')
                  .trim() || null,

              p_note:
                (this.venditaEconomicaForm.notePagamento || '')
                  .trim() || null,

              p_pagamento_previsto_id:
                this.pagamentoPrevistoId,

              p_calcolo:
                payloadEconomico.calcolo,

              p_partecipanti:
                payloadEconomico.partecipanti,

              p_incassato_da:
                this.venditaEconomicaForm.incassatoDa
            };
          }
        }

        const { error } =
          await window.supabaseClient.rpc(
            rpcNome,
            rpcPayload
          );

        if (error) {
          this.erroreEconomia =
            'Pagamento non salvato: ' + error.message;
          return;
        }

        this.successoEconomia = modificaId
          ? 'Pagamento aggiornato.'
          : previsto
            ? 'Rata prevista registrata.'
            : 'Incasso registrato.';

        this.pagamentoInModificaId = null;

        await this.caricaPagamentiCliente(
          this.venditaEconomicaAttiva.cliente_id,
          this.venditaEconomicaAttiva.id
        );

        this.aggiornaSnapshotEconomia();

        if (this.isAdmin) {
          await this.caricaDashboardAdmin();
        } else {
          await this.caricaClienti();
          await this.caricaStatisticheVenditore();
        }

        await this.caricaTrasferimentiDaConfermare();
        this.mostraToast('success', this.successoEconomia);
        this.scorriEconomiaA('.payment-history-panel');
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

      /*
       * Pagamento iniziale opzionale (PROBLEMA 1): se l'utente ha indicato
       * un importo già incassato, viene registrato nella stessa
       * transazione della vendita, con lo stesso snapshot economico
       * (calcolo + partecipanti) usato dal flusso Incassa - stessa logica,
       * derivata dalla configurazione consolidata appena costruita sopra
       * (vedi derivaPartecipantiRataDaConsolidato), non da campi "rata"
       * editabili a parte.
       */
      const importoPagamentoIniziale =
        Number(this.venditaEconomicaForm.importoIncassato) || 0;

      let pagamento = null;

      if (importoPagamentoIniziale > 0) {
        const partecipantiConsolidatiEngine =
          this.venditaEconomicaForm.partecipanti.map(p => {
            const calcolo = this.calcoloPartecipanteEconomia(p);
            const modalita = p.ruolo === 'referente'
              ? this.modalitaFatturazioneAdminEconomia()
              : this.modalitaFatturazionePartecipanteEconomia(p);

            return {
              id: p.id,
              nome: p.nome,
              ruolo: p.ruolo,
              haVenduto: !!p.haVenduto,
              modalitaFatturazione: modalita,
              importoFatturato: calcolo.importoFatturato,
              quotaOverride: !!p.quotaOverride,
              quotaEffettiva: calcolo.quotaEffettiva
            };
          });

        const partecipantiRata = this.derivaPartecipantiRataDaConsolidato(
          partecipantiConsolidatiEngine,
          importoPagamentoIniziale,
          Number(this.venditaEconomicaForm.importoVendita) || 0
        );

        const engine = economicEngineApi();
        const snapshot = engine.calcolaSnapshotPagamento({
          importoPagamento: importoPagamentoIniziale,
          costiApplicati: this.costiPerMotoreRataEconomia(
            this.venditaEconomicaForm.costi
          ),
          partecipanti: partecipantiRata,
          percentualeRiduzioneNoFattura:
            Number(
              this.venditaEconomicaForm.percentualeRiduzioneNoFattura
            ) || 0,
          applicaBonusVenditore:
            this.venditaEconomicaForm.applicaBonusVenditore !== false,
          esenteTasse:
            this.venditaEconomicaForm.metodoPagamento === 'Contanti'
        });

        if (!snapshot.valido) {
          this.erroreEconomia =
            snapshot.errore ||
            'La ripartizione del pagamento iniziale non quadra.';
          return;
        }

        const payloadEconomico =
          this.payloadSnapshotPagamentoEconomia(snapshot);

        pagamento = {
          importo: importoPagamentoIniziale,
          stato: 'incassato',
          data_pagamento:
            this.venditaEconomicaForm.dataPagamento ||
            this.dataISOOggi(),
          metodo:
            (this.venditaEconomicaForm.metodoPagamento || '').trim() ||
            null,
          note:
            (this.venditaEconomicaForm.notePagamento || '').trim() ||
            null,
          incassato_da: this.venditaEconomicaForm.incassatoDa,
          calcolo: payloadEconomico.calcolo,
          partecipanti: payloadEconomico.partecipanti
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
        ),
        applica_bonus_venditore:
          this.venditaEconomicaForm.applicaBonusVenditore !== false
      };

      const costi = this.venditaEconomicaForm.costi.map(c => ({
        descrizione: c.descrizione,
        importo: Number(c.importo) || 0
      }));

      this.salvandoVenditaEconomica = true;

      try {
        const { data, error } = await window.supabaseClient.rpc(
          'registra_vendita_con_trasferimenti',
          {
            p_vendita: payloadVendita,
            p_configurazione:
              this.venditaEconomicaForm.configurazioneCommerciale,
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
        this.aggiornaSnapshotEconomia();

        const clienteId = this.venditaEconomicaForm.clienteId;

        if (this.isAdmin) {
          await this.caricaDashboardAdmin();
        } else {
          await this.caricaClienti();
          await this.caricaStatisticheVenditore();
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

    async apriEconomiaDaAzioniCliente() {
      const cliente = this.clienteAzioniRapide();
      if (!cliente?.id) return;

      this.chiudiAzioniCliente();

      if (cliente.haVenditaAttiva) {
        await this.apriPagamentoCliente(cliente);
        return;
      }

      await this.apriEconomia('vendita');
      this.selezionaClienteEconomia(cliente);
    },

    snapshotFormEconomia() {
      const {
        clienteRicerca,
        ...form
      } = this.venditaEconomicaForm || {};

      return JSON.stringify({
        modalita: this.modalitaEconomia,
        clienteId: this.clienteEconomiaSelezionato?.id || null,
        venditaId: this.venditaEconomicaAttiva?.id || null,
        pagamentoPrevistoId: this.pagamentoPrevistoId || null,
        form
      });
    },

    economiaFormModificato() {
      return this.view === 'economia' &&
        this.economiaFormSnapshot !== null &&
        this.snapshotFormEconomia() !== this.economiaFormSnapshot;
    },

    aggiornaSnapshotEconomia() {
      this.economiaFormSnapshot = this.snapshotFormEconomia();
    },
  };
});
