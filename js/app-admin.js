// js/app-admin.js
// Mixin di appState() con i metodi del dominio Admin (dashboard multi-venditore:
// totali, classifica, filtro per venditore, eventi/agenda admin).
// Estratto meccanicamente da js/app.js, stesso pattern UMD-lite di js/economic-engine.js.
(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.appAdminMixin = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return {
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
          .select('id,nome,venditore_id,stato,stato_produzione,pubblicato_il,prossimo_contatto,data_rinnovo,periodicita_contratto,durata_contratto_anni,importo_abbonamento,nome_pacchetto')
          .is('cancellato_il', null),

        window.supabaseClient
          .from('vendite')
          .select('id,cliente_id,venditore_id,importo_vendita,stato,data_vendita'),

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

      const pubblicati = clienti.filter(c => c.stato_produzione === 'pubblicato');

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
        inLavorazione: clienti.filter(c => c.stato_produzione === 'in_lavorazione').length
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
          suoiClienti.filter(cliente => cliente.stato_produzione === 'pubblicato');

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
          nInLavorazione: suoiClienti.filter(cliente => cliente.stato_produzione === 'in_lavorazione').length,
          nPubblicati: suoiPubblicati.length,
          nPubblicatiMese: suoiPubblicatiMese.length
        };
      }));

      const coloriCategorici = ['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)'];
      this.trendDatiAdmin = [
        {
          id: 'totale',
          nome: 'Totale',
          color: 'var(--lime-deep)',
          punti: serieMensileValore(vendite, clientiPerId, null)
        },
        ...this.classificaVenditori().slice(0, 3).map((venditore, indice) => ({
          id: venditore.id,
          nome: venditore.nome,
          color: coloriCategorici[indice],
          punti: serieMensileValore(vendite, clientiPerId, venditore.id)
        }))
      ];
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
  };
});
