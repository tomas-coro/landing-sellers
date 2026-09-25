// js/app-cliente.js
// Mixin di appState() con i metodi del dominio Cliente (scheda, form nuovo/modifica,
// azioni rapide, note, cestino, contatti, totali di pagamento per singolo cliente).
// Estratto meccanicamente da js/app.js, stesso pattern UMD-lite di js/economic-engine.js.
(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.appClienteMixin = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return {
    totaleIncassatoCliente() {
      return this.pagamentiCliente
        .filter(p => p.stato === 'incassato')
        .reduce((totale, p) => totale + (Number(p.importo) || 0), 0);
    },

    totaleVenditaCliente() {
      const cliente = this.clienteEconomiaSelezionato?.id
        ? this.clienteEconomiaSelezionato
        : this.clienteSelezionato();

      return valoreAnnualeCliente(cliente) ||
        (Number(this.venditaClienteAttiva?.importo_vendita) || 0);
    },


    residuoCliente() {
      // Un pagamento in modifica non deve contarsi due volte nel residuo:
      // il suo importo vecchio va escluso, altrimenti il massimo consentito
      // risulterebbe più basso di quanto sia in realtà.
      const totaleIncassato = this.pagamentiCliente
        .filter(p => p.stato === 'incassato' && p.id !== this.pagamentoInModificaId)
        .reduce((totale, p) => totale + (Number(p.importo) || 0), 0);

      return Math.max(0, this.totaleVenditaCliente() - totaleIncassato);
    },

    statoPagamentoCliente() {
      if (!this.venditaClienteAttiva) return 'nessuna_vendita';

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
      if (stato === 'da_pagare') return 'Da pagare';
      return 'Nessuna vendita';
    },

    classeStatoPagamentoCliente() {
      return 'payment-' + this.statoPagamentoCliente();
    },

    pagamentiIncassatiCliente() {
      return (this.pagamentiCliente || [])
        .filter(pagamento => pagamento.stato === 'incassato');
    },

    ratePrevisteCliente() {
      return (this.pagamentiCliente || [])
        .filter(pagamento => pagamento.stato === 'previsto')
        .sort((a, b) => {
          const dataA = a.data_scadenza || '9999-12-31';
          const dataB = b.data_scadenza || '9999-12-31';
          return dataA.localeCompare(dataB);
        });
    },

    percentualeIncassataCliente() {
      const totale = this.totaleVenditaCliente();

      if (!(totale > 0)) return 0;

      return Math.max(
        0,
        Math.min(
          100,
          (this.totaleIncassatoCliente() / totale) * 100
        )
      );
    },

    prossimaRataPrevistaCliente() {
      return this.ratePrevisteCliente()[0] || null;
    },

    clienteAzioniRapide() {
      return this.clienti.find(
        cliente => cliente.id === this.clienteAzioniRapideId
      ) || {};
    },

    apriAzioniCliente(clienteId, event = null) {
      const cliente = this.clienti.find(c => c.id === clienteId);
      if (!cliente) return;

      const trigger = event?.currentTarget;
      const rect = trigger?.getBoundingClientRect?.();

      if (rect && window.innerWidth >= 1000) {
        const menuWidth = 360;
        const gap = 12;

        let left = rect.right + gap;

        if (left + menuWidth > window.innerWidth - 18) {
          left = rect.left - menuWidth - gap;
        }

        this.clienteAzioniPosizione = {
          left: Math.max(18, left),
          top: Math.max(
            18,
            Math.min(rect.top - 12, window.innerHeight - 500)
          )
        };
      }

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
      this.retryAzioneCliente = null;
    },

    richiediEliminazioneDaAzioniCliente() {
      const clienteId = this.clienteAzioniRapideId;
      if (!clienteId) return;

      this.clienteSelezionatoId = clienteId;
      this.eliminazioneDaAzioniRapide = true;
      this.chiudiAzioniCliente();
      this.confermaEliminazione = true;
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
      this.retryAzioneCliente = null;

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
          this.retryAzioneCliente = { fn: () => this.salvaNotaRapida() };
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
        this.retryAzioneCliente = { fn: () => this.salvaNotaRapida() };
      } finally {
        this.salvandoNotaRapida = false;
      }
    },

    async salvaProssimoContattoRapido() {
      const clienteId = this.clienteAzioniRapideId;

      this.messaggioAzioneCliente = '';
      this.erroreAzioneCliente = '';
      this.retryAzioneCliente = null;

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
          this.retryAzioneCliente = { fn: () => this.salvaProssimoContattoRapido() };
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
        this.retryAzioneCliente = { fn: () => this.salvaProssimoContattoRapido() };
      } finally {
        this.salvandoProssimoContattoRapido = false;
      }
    },

    telefonoPulito(cliente) {
      return String(cliente?.telefono || '').replace(/[^\d+]/g, '');
    },

    whatsappCliente(cliente) {
      const telefono = String(cliente?.telefono || '').trim();
      let numero = telefono.replace(/\D/g, '');
      if (!numero) return '';
      const internazionale = telefono.startsWith('+') || numero.startsWith('00');
      if (numero.startsWith('00')) numero = numero.slice(2);
      if (!internazionale && !numero.startsWith('39')) numero = '39' + numero;
      return `https://wa.me/${numero}`;
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
          const rinnovo =
            typeof this.rinnovoCalcolatoCliente === 'function'
              ? this.rinnovoCalcolatoCliente(c)
              : c.data_rinnovo;

          if (!rinnovo) return false;

          const data = Date.parse(`${rinnovo}T00:00:00Z`);
          const diff = Math.ceil(
            (data - oggiUTC) / 86400000
          );

          return diff >= 0 && diff <= giorni;
        })
        .sort((a, b) => {
          const dataA =
            this.rinnovoCalcolatoCliente?.(a) ||
            a.data_rinnovo ||
            '';

          const dataB =
            this.rinnovoCalcolatoCliente?.(b) ||
            b.data_rinnovo ||
            '';

          return dataA.localeCompare(dataB);
        });
    },

    etichettaImportoCliente(cliente) {
      const contratto =
        typeof this.riepilogoContrattoCliente === 'function'
          ? this.riepilogoContrattoCliente(cliente)
          : null;

      const annuale =
        Number(contratto?.valoreAnnuale) ||
        valoreAnnualeCliente(cliente);

      if (!(annuale > 0)) return '-';

      return `${this.formattaNumeroEuro(annuale)}/anno`;
    },

    // --- form cliente: nuovo + modifica condividono la stessa vista ---
    snapshotFormCliente() {
      return JSON.stringify({
        form: this.nuovoClienteForm,
        prezzo: this.selezionePrezzo
      });
    },

    clienteFormModificato() {
      return this.view === 'nuovo' &&
        this.clienteFormSnapshot !== null &&
        this.snapshotFormCliente() !== this.clienteFormSnapshot;
    },


    async confermaUscitaFormCliente() {
      if (
        this.clienteFormModificato() &&
        !(await this.chiediConferma(
          'Hai modifiche non salvate. Se esci perderai quanto inserito. Vuoi uscire?',
          'Esci senza salvare'
        ))
      ) {
        return false;
      }

      if (
        this.economiaFormModificato() &&
        !(await this.chiediConferma(
          'Hai modifiche non salvate nella vendita o nell’incasso. Se esci perderai quanto inserito. Vuoi uscire?',
          'Esci senza salvare'
        ))
      ) {
        return false;
      }

      return true;
    },

    async annullaFormCliente() {
      if (!(await this.confermaUscitaFormCliente())) return;

      if (
        !this.clienteInModificaId &&
        this.ritornoDopoNuovoCliente === 'economia-vendita'
      ) {
        this.ritornoDopoNuovoCliente = null;
        await this.apriEconomia('vendita');
        return;
      }

      this.view = this.clienteInModificaId ? 'scheda' : 'lista';
    },

    apriNuovoClienteDaVendita() {
      this.apriNuovoCliente('economia-vendita');

      requestAnimationFrame(() => {
        document.getElementById('app')?.scrollTo({
          top: 0,
          behavior: 'auto'
        });
      });
    },

    apriNuovoCliente(ritorno = null) {
      this.clienteInModificaId = null;
      this.ritornoDopoNuovoCliente = ritorno;
      this.clienteCreatoId = null;
      this.clienteCreatoPromptAperto = false;
      this.nuovoClienteForm = formModuloVuoto();
      this.selezionePrezzo = { modalita: 'catalogo', formula: 'mensile', upgrade: [] };
      this.nuovoClienteForm.periodicita_contratto = 'mensile';
      this.nuovoClienteForm.giorni_preavviso_notifica = 7;
      this.aggiornaPrezzoCliente();
      this.erroriNuovoCliente = {};
      this.view = 'nuovo';
      this.clienteFormSnapshot = this.snapshotFormCliente();
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
        brief_cliente: c.brief_cliente || '',
        prossima_azione: c.prossima_azione || '',
        prossimo_contatto: c.prossimo_contatto || '',
        esito_motivazione: c.esito_motivazione || '',
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
        dominio_it: Number(c.dominio_it) || 0,
        dominio_com: Number(c.dominio_com) || 0,
        email_5_caselle: Number(c.email_5_caselle) || 0,
        pacchetto_sicurezza: !!c.pacchetto_sicurezza
      };
      this.ripristinaSelezionePrezzo(c);
      this.erroriNuovoCliente = {};
      this.view = 'nuovo';
      this.clienteFormSnapshot = this.snapshotFormCliente();
    },

    async salvaCliente() {
      if (this.salvandoCliente) return;

      const modificaCliente = !!this.clienteInModificaId;

      const datiDaValidare = modificaCliente
        ? this.nuovoClienteForm
        : {
            nome: this.nuovoClienteForm.nome,
            referente: this.nuovoClienteForm.referente,
            telefono: this.nuovoClienteForm.telefono,
            email: this.nuovoClienteForm.email,
            piva: this.nuovoClienteForm.piva,
            iban: this.nuovoClienteForm.iban,
            sito_url: this.nuovoClienteForm.sito_url
          };

      const check = validaClienteForm(datiDaValidare);
      this.erroriNuovoCliente = check.errori;
      this.retryNuovoCliente = null;

      if (!check.valido) return;

      const cliente = modificaCliente
        ? normalizzaClientePerSalvataggio(this.nuovoClienteForm)
        : normalizzaAnagraficaClientePerSalvataggio(
            this.nuovoClienteForm
          );

      this.salvandoCliente = true;

      try {
        let clienteSalvatoId = this.clienteInModificaId;

        if (modificaCliente) {
          const { error } = await window.supabaseClient
            .from('clienti')
            .update(cliente)
            .eq('id', this.clienteInModificaId);

          if (error) {
            this.erroriNuovoCliente.generale =
              'Salvataggio fallito: ' + error.message;
            this.retryNuovoCliente = { fn: () => this.salvaCliente() };
            return;
          }
        } else {
          const { data, error } = await window.supabaseClient
            .from('clienti')
            .insert({
              ...cliente,
              venditore_id: this.sessione.user.id
            })
            .select('id')
            .single();

          if (error) {
            this.erroriNuovoCliente.generale =
              'Salvataggio fallito: ' + error.message;
            this.retryNuovoCliente = { fn: () => this.salvaCliente() };
            return;
          }

          clienteSalvatoId = data?.id || null;
        }

        const idModificato = this.clienteInModificaId;

        this.clienteInModificaId = null;
        this.nuovoClienteForm = formModuloVuoto();
        this.clienteFormSnapshot = null;

        await this.caricaClienti();
        await this.caricaStatisticheVenditore();

        if (idModificato) {
          this.clienteSelezionatoId = idModificato;
          this.view = 'scheda';
          this.mostraToast('success', 'Cliente aggiornato');
          return;
        }

        if (
          this.ritornoDopoNuovoCliente === 'economia-vendita' &&
          clienteSalvatoId
        ) {
          const clienteCreato = this.clienti.find(
            cliente => cliente.id === clienteSalvatoId
          );

          this.ritornoDopoNuovoCliente = null;
          this.clienteCreatoId = null;
          this.clienteCreatoPromptAperto = false;

          await this.apriEconomia('vendita');

          if (clienteCreato) {
            this.selezionaClienteEconomia(clienteCreato);
          }

          return;
        }

        this.clienteCreatoId = clienteSalvatoId;
        this.clienteCreatoPromptAperto = true;
        this.view = 'lista';
      } catch (err) {
        console.error('Errore salvataggio cliente:', err);
        this.erroriNuovoCliente.generale =
          'Errore durante il salvataggio del cliente.';
        this.retryNuovoCliente = { fn: () => this.salvaCliente() };
      } finally {
        this.salvandoCliente = false;
      }
    },

    chiudiPromptClienteCreato() {
      this.clienteCreatoPromptAperto = false;
      this.clienteCreatoId = null;
      this.ritornoDopoNuovoCliente = null;
    },

    async registraVenditaDopoCliente() {
      const cliente = this.clienti.find(
        c => c.id === this.clienteCreatoId
      );

      if (!cliente) return;

      this.clienteCreatoPromptAperto = false;
      this.clienteCreatoId = null;
      this.ritornoDopoNuovoCliente = null;

      await this.apriEconomia('vendita');
      this.selezionaClienteEconomia(cliente);
    },

    clienteSelezionato() {
      return this.clienti.find(c => c.id === this.clienteSelezionatoId) || {};
    },

    async caricaPagamentiCliente(
      clienteId,
      venditaId = null
    ) {
      this.venditaClienteAttiva = null;
      this.pagamentiCliente = [];
      this.errorePagamentiCliente = '';

      if (!clienteId) return;

      this.caricandoPagamentiCliente = true;

      try {
        let vendita = null;

        if (venditaId) {
          const { data, error } =
            await window.supabaseClient
              .from('vendite')
              .select(
                'id,cliente_id,importo_vendita,servizio,data_vendita,creato_il,configurazione_commerciale'
              )
              .eq('id', venditaId)
              .eq('cliente_id', clienteId)
              .maybeSingle();

          if (error) {
            this.errorePagamentiCliente = error.message;
            return;
          }

          vendita = data || null;
        } else {
          // Compatibilità con le viste che ancora usano
          // l'ultima vendita attiva del cliente.
          const { data, error } =
            await window.supabaseClient
              .from('vendite')
              .select(
                'id,cliente_id,importo_vendita,servizio,data_vendita,creato_il'
              )
              .eq('cliente_id', clienteId)
              .eq('stato', 'attiva')
              .order('data_vendita', { ascending: false })
              .order('creato_il', { ascending: false })
              .limit(1);

          if (error) {
            this.errorePagamentiCliente = error.message;
            return;
          }

          vendita = (data || [])[0] || null;
        }

        this.venditaClienteAttiva = vendita;

        if (!vendita?.id) {
          this.dettagliEconomiciPartecipanti = [];
          this.dettagliEconomiciCosti = [];
          return;
        }

        this.caricaDettagliEconomiciVendita(vendita.id);

        const { data, error } =
          await window.supabaseClient
            .from('pagamenti')
            .select('*')
            .eq('vendita_id', vendita.id)
            .order(
              'data_pagamento',
              { ascending: false, nullsFirst: false }
            )
            .order(
              'data_scadenza',
              { ascending: true, nullsFirst: false }
            )
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

    // PROBLEMA 3: legge la configurazione economica CONSOLIDATA della
    // vendita (vendita_partecipanti + costi_vendita) per la sezione
    // read-only "Dettagli economici" nella scheda cliente. Nessun
    // ricalcolo: mostra solo ciò che è stato realmente salvato.
    async caricaDettagliEconomiciVendita(venditaId) {
      this.dettagliEconomiciPartecipanti = [];
      this.dettagliEconomiciCosti = [];
      this.erroreDettagliEconomici = '';

      if (!venditaId) return;

      this.caricandoDettagliEconomici = true;

      try {
        const [partecipantiResult, costiResult] = await Promise.all([
          window.supabaseClient
            .from('vendita_partecipanti')
            .select(
              'profilo_id,ruolo,modalita_fatturazione,fa_fattura,importo_fatturato,quota_calcolata,quota_effettiva,quota_finale,quota_override,note_quota,saldato,data_saldo'
            )
            .eq('vendita_id', venditaId),

          window.supabaseClient
            .from('costi_vendita')
            .select('descrizione,importo')
            .eq('vendita_id', venditaId)
        ]);

        if (partecipantiResult.error) {
          this.erroreDettagliEconomici =
            partecipantiResult.error.message;
          return;
        }

        if (costiResult.error) {
          this.erroreDettagliEconomici = costiResult.error.message;
          return;
        }

        this.dettagliEconomiciPartecipanti =
          (partecipantiResult.data || []).map(partecipante => ({
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
            importoFatturato: Number(partecipante.importo_fatturato) || 0,
            quotaCalcolata: Number(partecipante.quota_calcolata) || 0,
            quotaOverride: !!partecipante.quota_override,
            quotaEffettiva:
              partecipante.quota_effettiva != null
                ? Number(partecipante.quota_effettiva)
                : null,
            quotaFinale: Number(partecipante.quota_finale) || 0
          }));

        this.dettagliEconomiciCosti =
          (costiResult.data || []).map(costo => ({
            descrizione: costo.descrizione || 'Costo',
            importo: Number(costo.importo) || 0
          }));
      } finally {
        this.caricandoDettagliEconomici = false;
      }
    },

    totaleCostiVenditaCliente() {
      return (this.dettagliEconomiciCosti || []).reduce(
        (totale, costo) => totale + (Number(costo.importo) || 0),
        0
      );
    },

    configurazioneCommercialeClienteAttiva() {
      const config = this.venditaClienteAttiva?.configurazione_commerciale;
      return config && typeof config === 'object' ? config : null;
    },

    async caricaAttivitaCliente(clienteId) {
      this.attivitaCliente = [];
      if (!clienteId) return;

      this.caricandoAttivitaCliente = true;

      try {
        const { data, error } = await window.supabaseClient
          .from('attivita_clienti')
          .select('*,attore:profili!attivita_clienti_attore_id_fkey(nome,username)')
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
        const eventoBase = {
          id: 'attivita-' + attivita.id,
          data: attivita.creata_il,
          attore: attivita.attore?.username || attivita.attore?.nome || ''
        };

        if (attivita.tipo === 'stato') {
          eventi.push({
            ...eventoBase,
            tipo: 'stato',
            titolo: 'Stato aggiornato',
            dettaglio:
              `${formattaStato(attivita.valore_precedente)} → ` +
              `${formattaStato(attivita.valore_nuovo)}`
          });
        }

        if (attivita.tipo === 'stato_produzione') {
          eventi.push({
            ...eventoBase,
            tipo: 'stato',
            titolo: 'Produzione aggiornata',
            dettaglio:
              `${this.formattaStatoProduzione(attivita.valore_precedente)} → ` +
              `${this.formattaStatoProduzione(attivita.valore_nuovo)}`
          });
        }

        if (attivita.tipo === 'brief') {
          eventi.push({
            ...eventoBase,
            tipo: 'nota',
            titolo: 'Brief cliente aggiornato',
            dettaglio: attivita.valore_nuovo || ''
          });
        }

        if (attivita.tipo === 'prossima_azione') {
          eventi.push({
            ...eventoBase,
            tipo: 'contatto',
            titolo: 'Prossima azione aggiornata',
            dettaglio: attivita.valore_nuovo || 'Rimossa'
          });
        }

        if (attivita.tipo === 'contatto_completato') {
          eventi.push({
            ...eventoBase,
            tipo: 'completato',
            titolo: 'Contatto completato',
            dettaglio: attivita.valore_precedente
              ? formattaData(attivita.valore_precedente)
              : ''
          });
        }

        if (attivita.tipo === 'prossimo_contatto') {
          const nuovaData = attivita.valore_nuovo;

          eventi.push({
            ...eventoBase,
            tipo: 'contatto',
            titolo: nuovaData
              ? 'Prossimo contatto impostato'
              : 'Prossimo contatto rimosso',
            dettaglio: nuovaData
              ? formattaData(nuovaData)
              : ''
          });
        }

        if (attivita.tipo === 'prezzo') {
          eventi.push({
            ...eventoBase,
            tipo: 'pagamento',
            titolo: 'Prezzo aggiornato',
            dettaglio:
              `${this.formattaNumeroEuro(attivita.valore_precedente)} → ` +
              `${this.formattaNumeroEuro(attivita.valore_nuovo)}`
          });
        }

        if (attivita.tipo === 'scadenza') {
          const formattaScadenza = valore => valore ? formattaData(valore) : 'Nessuna';
          eventi.push({
            ...eventoBase,
            tipo: 'contatto',
            titolo: 'Scadenza aggiornata',
            dettaglio:
              `${formattaScadenza(attivita.valore_precedente)} → ` +
              `${formattaScadenza(attivita.valore_nuovo)}`
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

      requestAnimationFrame(() => {
        document.getElementById('app')?.scrollTo({
          top: 0,
          behavior: 'auto'
        });
      });

      this.erroreScheda = '';
      this.confermaEliminazione = false;
      const cliente = this.clienteSelezionato();
      this.schedaAperture = {
        stato: true,
        crm: true,
        pacchetto: !!(
          cliente.importo_abbonamento != null ||
          cliente.nome_pacchetto
        ),
        contatti: false,
        attivita: false,
        note: false,
        economia: false
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
      if (
        this._historyInizializzata &&
        history.state?.le
      ) {
        history.back();
        return;
      }

      this.view = [
        'clienti',
        'ricerca',
        'lista',
        'admin',
        'agenda',
        'pipeline'
      ].includes(this.viewPrecedenteScheda)
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
      if (this.cambiandoStato) return;
      this.cambiandoStato = true;
      this.erroreScheda = '';

      try {
        const errore = await this.impostaStatoCliente(
          this.clienteSelezionatoId,
          nuovoStato
        );

        if (errore) {
          this.erroreScheda = 'Stato non aggiornato: ' + errore;
          return;
        }

        await Promise.all([
          this.caricaClienti(),
          this.caricaAttivitaCliente(this.clienteSelezionatoId)
        ]);
        this.mostraToast('success', 'Stato commerciale aggiornato');
      } finally {
        this.cambiandoStato = false;
      }
    },

    async confermaEliminaCliente() {
      if (this.eliminandoCliente) return;
      this.eliminandoCliente = true;
      try {
        const { error } = await window.supabaseClient
          .rpc('sposta_cliente_nel_cestino', {
            p_cliente_id: this.clienteSelezionatoId
          });
        if (error) { this.erroreScheda = 'Eliminazione fallita: ' + error.message; return; }
        this.confermaEliminazione = false;
        await this.caricaClienti();

        if (this.eliminazioneDaAzioniRapide) {
          this.eliminazioneDaAzioniRapide = false;
          this.clienteSelezionatoId = null;
        } else {
          this.tornaDaScheda();
        }
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
      if (this.ripristinandoClienteId) return;
      this.ripristinandoClienteId = clienteId;

      try {
        const { error } = await window.supabaseClient
          .rpc('ripristina_cliente_dal_cestino', {
            p_cliente_id: clienteId
          });

        if (error) {
          this.erroreCestino = 'Ripristino fallito: ' + error.message;
          return;
        }
        await this.caricaCestino();
        // se questa fallisce, l'errore va in erroreClienti e si vede solo tornando alla vista lista
        await this.caricaClienti();
      } finally {
        this.ripristinandoClienteId = null;
      }
    },
  };
});
