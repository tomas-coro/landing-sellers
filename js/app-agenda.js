(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.appAgendaMixin = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return {
    eventiOggiHome() {
      const oggi = this.dataISOOggi();
      const limite = this.aggiungiGiorniISO(oggi, 7);

      return this.eventiAgenda()
        .filter(evento => {
          if (evento.tipo === 'contatto') {
            return evento.data <= oggi;
          }

          if (evento.tipo === 'mancante') return evento.data <= oggi;

          if (evento.tipo === 'rinnovo' || evento.tipo === 'rata') {
            // Scaduto e non ancora gestito: resta visibile come per i
            // contatti, invece di sparire da solo al passare della data.
            return evento.data < oggi || (evento.data >= oggi && evento.data <= limite);
          }

          return false;
        })
        .map(evento => {
          let priorita = 4;

          if (evento.tipo === 'contatto' && evento.data < oggi) priorita = 1;
          else if (evento.data === oggi) priorita = 2;
          else if (evento.tipo === 'rinnovo') priorita = 3;
          else if (evento.tipo === 'rata' || evento.tipo === 'mancante') priorita = 3;

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
        if (evento.brief) return evento.data < oggi ? 'Brief da inviare · in ritardo' : 'Brief da inviare oggi';
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

    oraAgenda(value) {
      if (!value || !String(value).includes('T')) return '';
      const data = new Date(value);
      return Number.isNaN(data.getTime())
        ? ''
        : new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(data);
    },

    aggiungiGiorniISO(iso, giorni) {
      const [y, m, d] = iso.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d + giorni));
      return date.toISOString().slice(0, 10);
    },

    eventiAgenda() {
      const oggi = this.dataISOOggi();
      const eventi = [];
      const clientiAgenda = this.isAdmin ? this.adminClienti : this.clientiDiretti();

      clientiAgenda.forEach(cliente => {
        const contattoImpostato = this.normalizzaDataAgenda(cliente.prossimo_contatto);

        // Cliente "contattato" senza una data di contatto scelta: il brief e la
        // prima cosa da fare, quindi compare in agenda con il flag "Brief".
        // Vale il giorno di creazione: se passa senza brief diventa in ritardo.
        // Con una data di contatto gia impostata resta il normale contatto.
        // Gli admin non hanno creato_il nel loro elenco e non mandano brief.
        const briefDaInviare = !this.isAdmin && cliente.stato === 'contattato' && !contattoImpostato;
        const contatto = contattoImpostato ||
          (briefDaInviare ? (this.normalizzaDataAgenda(cliente.creato_il) || oggi) : null);

        if (contatto && this.puoRicontattareCliente(cliente)) {
          eventi.push({
            id: briefDaInviare
              ? `brief-${cliente.id}`
              : `contatto-${cliente.id}-${contatto}`,
            clienteId: cliente.id,
            clienteNome: cliente.nome,
            venditoreId: cliente.venditore_id,
            venditoreNome: this.adminVenditoriPerId[cliente.venditore_id] || '',
            data: contatto,
            dataOra: cliente.prossimo_contatto,
            ora: this.oraAgenda(cliente.prossimo_contatto),
            tipo: 'contatto',
            brief: briefDaInviare,
            titolo: briefDaInviare
              ? 'Brief da inviare'
              : (contatto < oggi ? 'Contatto in ritardo' : 'Contatto cliente'),
            scaduto: contatto < oggi
          });
        }

        // Piu vendite attive = un rinnovo per contratto, calcolato dalla
        // vendita (data attivazione + periodicita), non dal cliente.
        const venditeCliente = this.venditeAttivePerCliente?.[cliente.id] || [];
        if (venditeCliente.length > 1) {
          venditeCliente.forEach(vendita => {
            const cfg = vendita.configurazione_commerciale || {};
            const periodicita = cfg.periodicita_contratto || cfg.formula;
            const base =
              this.normalizzaDataAgenda(cfg.data_attivazione) ||
              this.normalizzaDataAgenda(vendita.data_vendita || vendita.creato_il);
            if (!['mensile', 'annuale'].includes(periodicita) || !base) return;
            const data = this.calcolaProssimoRinnovo(base, periodicita, oggi);
            if (!data) return;
            const nomeVendita = (cfg.nome_vendita || vendita.servizio || '').trim();
            eventi.push({
              id: `rinnovo-${cliente.id}-${vendita.id}-${data}`,
              clienteId: cliente.id,
              clienteNome: cliente.nome,
              venditaId: vendita.id,
              venditoreId: cliente.venditore_id,
              venditoreNome: this.adminVenditoriPerId[cliente.venditore_id] || '',
              data,
              tipo: 'rinnovo',
              titolo: (periodicita === 'annuale' ? 'Rinnovo annuale' : 'Rinnovo contratto') +
                (nomeVendita ? ' - ' + nomeVendita : ''),
              scaduto: data < oggi
            });
          });
        }

        const rinnovo = venditeCliente.length > 1
          ? null
          : this.normalizzaDataAgenda(cliente.data_rinnovo);
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

        this.mesiNonRegistratiCliente(cliente).forEach(mese => {
          eventi.push({
            id: `mancante-${cliente.id}-${mese.chiaveMese}`,
            venditaId: mese.venditaId,
            importo: mese.importo,
            clienteId: cliente.id,
            clienteNome: cliente.nome,
            venditoreId: cliente.venditore_id,
            venditoreNome: this.adminVenditoriPerId[cliente.venditore_id] || '',
            data: mese.data,
            tipo: 'mancante',
            titolo: mese.importo > 0
              ? `Pagamento non registrato · ${this.formattaNumeroEuro(mese.importo)}`
              : 'Pagamento non registrato',
            scaduto: true
          });
        });
      });

      // Quote ricevute da altri che devi ancora confermare: compaiono in
      // agenda alla data dell'incasso, finché non confermi o annulli.
      (this.trasferimentiDaConfermare || []).forEach(quota => {
        const data = this.normalizzaDataAgenda(quota.pagamenti?.data_pagamento) || oggi;
        eventi.push({
          id: `quota-${quota.pagamento_id}`,
          pagamentoId: quota.pagamento_id,
          importo: quota.quota_effettiva,
          clienteId: quota.clienteId,
          clienteNome: quota.clienteNome || 'Cliente',
          controparteNome: quota.controparteNome,
          venditoreId: this.sessione?.user?.id,
          venditoreNome: '',
          data,
          tipo: 'quota',
          titolo: `Quota da confermare · ${this.formattaNumeroEuro(quota.quota_effettiva)}`,
          scaduto: false
        });
      });

      // Quote di rete (10%) da riscattare: una voce per ogni riga, chiave q.id
      // perché sullo stesso pagamento possono esserci più righe rete.
      (this.quoteReteDaConfermare || []).forEach(q => {
        const data = this.normalizzaDataAgenda(q.dataPagamento) || oggi;
        const sotto = this.nomeVenditorePerId(q.da_profilo_id);
        eventi.push({
          id: `quota-rete-${q.id}`,
          pagamentoId: q.pagamento_id,
          importo: q.importo,
          clienteId: null,
          clienteNome: q.clienteNome || 'Cliente',
          controparteNome: q.controparteNome,
          sottotitolo: sotto ? `Dalla vendita di ${sotto}` : '',
          venditoreId: this.sessione?.user?.id,
          venditoreNome: '',
          data,
          tipo: 'quota',
          rete: true,
          titolo: `Quota di rete da riscattare · ${this.formattaNumeroEuro(q.importo)}`,
          scaduto: false
        });
      });

      return eventi.sort((a, b) =>
        a.data.localeCompare(b.data) ||
        a.clienteNome.localeCompare(b.clienteNome)
      );
    },

    // Mesi/anni di canone già scaduti per cui non esiste in pagamenti
    // nessuna riga (previsto o incassata): la rata non è mai stata creata,
    // quindi senza questo controllo l'importo spariva senza lasciare traccia
    // in agenda. L'ancora è data_attivazione (o pubblicato_il se manca) e i
    // candidati seguono lo stesso schema di calcolaProssimoRinnovo/
    // calcola_prossimo_rinnovo lato DB, partendo da n=1 perché il primo
    // periodo è quello incassato alla vendita.
    mesiNonRegistratiCliente(cliente) {
      const periodicita = cliente.periodicita_contratto;
      if (!['mensile', 'annuale'].includes(periodicita)) return [];

      const anchor =
        this.normalizzaDataAgenda(cliente.data_attivazione) ||
        this.normalizzaDataAgenda(cliente.pubblicato_il);
      if (!anchor) return [];

      // Due mappe separate (mai condivise) perché hanno scope diversi: quella
      // admin è costruita una volta sola, su TUTTI i clienti, in
      // caricaDashboardAdmin; quella venditore viene ricostruita ogni volta
      // che si apre la lista clienti ed è scoped a this.clienti - mischiarle
      // vorrebbe dire che aprire "Registra" su una riga admin restringe la
      // copertura e genera mancanti falsi su tutti gli altri clienti.
      // Senza admin la copertura arriva da una query a parte (pagamenti) che
      // può fallire dopo che pacchettoVenditaPerCliente è già popolato: se
      // non è andata a buon fine, "non lo so" non deve leggersi come
      // "non pagato mai".
      if (!this.isAdmin && !this.coperturaPagamentiAffidabile) return [];

      const venditaId = this.isAdmin
        ? this.venditaIdPerClienteAdmin?.[cliente.id] || null
        : this.pacchettoVenditaPerCliente?.[cliente.id]?.venditaId || null;
      if (!venditaId) return [];

      const mesiCoperti = this.isAdmin
        ? this.mesiCopertiPerVenditaAdmin?.[venditaId] || new Set()
        : this.mesiCopertiPerVenditaVenditore?.[venditaId] || new Set();
      const importoAtteso = Number(cliente.importo_abbonamento) || 0;
      const oggi = this.dataISOOggi();

      const [annoBase, meseBase, giornoBase] = anchor.split('-').map(Number);
      const risultati = [];

      for (let n = 1; n <= 600; n += 1) {
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
        const candidato =
          `${anno}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;

        if (candidato > oggi) break;

        const chiaveMese = `${anno}-${String(mese).padStart(2, '0')}`;
        if (!mesiCoperti.has(chiaveMese)) {
          risultati.push({
            data: candidato,
            chiaveMese,
            venditaId,
            importo: importoAtteso
          });
        }
      }

      return risultati;
    },

    eventiAgendaVisibili() {
      const oggi = this.dataISOOggi();
      const eventi = this.eventiAgenda();

      if (this.agendaVista === 'oggi') {
        return eventi.filter(e => e.data === oggi || e.scaduto);
      }

      // Nessuna finestra temporale: deve restare visibile tutto l'arretrato
      // non gestito, anche di mesi passati, finché non viene registrato o
      // evaso - altrimenti un pagamento mai creato sparisce senza lasciare
      // traccia (il bug che ha fatto perdere di vista Mr Smoky, Giuly Style...).
      if (this.agendaVista === 'non_completate') {
        return eventi.filter(e => e.scaduto);
      }

      return eventi.filter(e => e.data === this.agendaDataSelezionata);
    },

    giorniCalendarioAgenda() {
      const [anno, mese] = this.agendaMese.split('-').map(Number);
      const primo = new Date(Date.UTC(anno, mese - 1, 1));
      const offset = (primo.getUTCDay() + 6) % 7;
      const start = new Date(Date.UTC(anno, mese - 1, 1 - offset));
      const oggi = this.dataISOOggi();

      // eventiAgenda() ricalcola anche i mesi non registrati per ogni
      // cliente: va chiamata una sola volta, non 42 volte (una per giorno).
      const eventi = this.eventiAgenda();
      const conteggioPerGiorno = {};
      eventi.forEach(evento => {
        conteggioPerGiorno[evento.data] = (conteggioPerGiorno[evento.data] || 0) + 1;
      });

      return Array.from({ length: 42 }, (_, i) => {
        const d = new Date(start.getTime() + i * 86400000);
        const iso = d.toISOString().slice(0, 10);
        return {
          iso,
          giorno: d.getUTCDate(),
          nelMese: d.getUTCMonth() === mese - 1,
          oggi: iso === oggi,
          eventi: conteggioPerGiorno[iso] || 0
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
    }
  };
});
