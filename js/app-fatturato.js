// js/app-fatturato.js
// Mixin di appState() con i metodi del dominio Fatturato (vista storica
// mensile/annuale: venduto e incassato azienda per l'admin, guadagni
// personali - quota_effettiva dei pagamenti incassati - per ogni utente).
// Stesso pattern UMD-lite di js/economic-engine.js.
(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.appFatturatoMixin = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return {
    async apriFatturato() {
      this.view = 'fatturato';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await this.caricaFatturato();
    },

    // Vista personale aperta dal tile "Incassato" in Home (IL TUO LAVORO):
    // stessi dati/loader di apriFatturato, ma un template dedicato con solo
    // il resoconto mese/anno del venditore - niente sezioni azienda.
    async apriIncassato() {
      this.view = 'incassato';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.portafoglioModo = 'incassi';
      this.portafoglioPeriodo = '1M';
      this.portafoglioHover = null;
      await this.caricaFatturato();
      this.fatturatoMeseSelezionato = meseInizialeIncassato(this.incassatoSerie());
    },

    // Serie mensile della vista "I tuoi incassi": da agosto 2026 (vedi
    // serieIncassatoAnno in app.js), niente mesi vuoti prima dell'avvio.
    incassatoSerie() {
      return serieIncassatoAnno(this.fatturatoGuadagniRighe, this.fatturatoAnno);
    },

    incassatoTotaleAnno() {
      return this.incassatoSerie().reduce((somma, m) => somma + m.valore, 0);
    },

    incassatoMeseFuturo(chiave) {
      const oggi = new Date();
      const chiaveOggi = oggi.getFullYear() + '-' + String(oggi.getMonth() + 1).padStart(2, '0');
      return chiave > chiaveOggi;
    },

    // Altezza (in px) della barra: proporzionale al mese migliore, con un
    // minimo visibile per i mesi con incasso e un filo per quelli vuoti.
    incassatoAltezzaBarra(valore) {
      const massimo = Math.max(1, ...this.incassatoSerie().map(m => m.valore));
      if (!valore) return 4;
      return Math.max(8, Math.round((valore / massimo) * 112));
    },

    // Con 12 mesi non c'e' spazio per le cifre sopra le barre: resta
    // l'iniziale del mese e l'importo si legge nel riepilogo sotto.
    incassatoBarreStrette() {
      return this.incassatoSerie().length > 6;
    },

    incassatoEtichettaMese(chiave) {
      const serie = this.incassatoSerie();
      const mese = serie.find(m => m.chiave === chiave);
      return mese ? mese.label : '';
    },

    incassatoValoreMeseSelezionato() {
      const mese = this.incassatoSerie().find(m => m.chiave === this.fatturatoMeseSelezionato);
      return mese ? mese.valore : 0;
    },

    // Elenco dettagliato (cliente, giorno, importo) degli incassi che
    // compongono il totale del mese selezionato: il grafico mostra solo la
    // somma, qui si vede cosa c'è dentro, senza dover indovinare perché il
    // totale è cambiato.
    // Cambiare anno nella vista "Il tuo incassato" deve aggiornare anche il
    // mese selezionato, altrimenti il dettaglio resta ancorato a un mese
    // dell'anno precedente (quasi certamente vuoto) senza spiegazione.
    selezionaAnnoIncassato(anno) {
      this.fatturatoAnno = anno;
      this.fatturatoMeseSelezionato = meseInizialeIncassato(this.incassatoSerie());
    },

    fatturatoRigheDelMeseSelezionato() {
      const chiave = this.fatturatoMeseSelezionato;
      if (!chiave) return [];

      return this.fatturatoGuadagniRighe
        .filter(riga => riga.data && String(riga.data).slice(0, 7) === chiave)
        .slice()
        .sort((a, b) => b.data.localeCompare(a.data));
    },

    portafoglioDati(oggi = new Date()) {
      const primoIncasso = this.fatturatoGuadagniRighe.map(r => r.data).filter(Boolean).sort()[0];
      const minimo = new Date(Math.max(new Date(2026, 7, 1).getTime(), primoIncasso ? new Date(primoIncasso.slice(0, 7) + '-01T00:00:00').getTime() : 0));
      const inizio = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
      const periodo = this.portafoglioPeriodo;
      if (periodo === 'Tutto') inizio.setTime(minimo.getTime());
      else if (periodo === '1S') inizio.setDate(inizio.getDate() - 6);
      else if (periodo !== '1G') inizio.setMonth(inizio.getMonth() - ({ '1M': 1, '3M': 3, '6M': 6, '12M': 12 }[periodo] || 1));
      if (inizio < minimo) inizio.setTime(minimo.getTime());
      const dataISO = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const origine = this.portafoglioModo === 'incassi' ? this.fatturatoGuadagniRighe : this.portafoglioVendite;
      const righe = origine.filter(r => r.data >= dataISO(inizio) && r.data <= dataISO(oggi)).slice().sort((a, b) => b.data.localeCompare(a.data));
      const totale = righe.reduce((n, r) => n + (Number(r.valore) || 0), 0);
      const primaFine = new Date(inizio); primaFine.setDate(primaFine.getDate() - 1);
      const primaInizio = new Date(primaFine);
      primaInizio.setDate(primaInizio.getDate() - Math.round((oggi - inizio) / 86400000));
      const precedente = origine.filter(r => r.data >= dataISO(primaInizio) && r.data <= dataISO(primaFine))
        .reduce((n, r) => n + (Number(r.valore) || 0), 0);
      const perGiorno = new Map();
      righe.forEach(r => perGiorno.set(r.data, (perGiorno.get(r.data) || 0) + (Number(r.valore) || 0)));
      const giorni = [];
      for (const d = new Date(inizio); d <= oggi; d.setDate(d.getDate() + 1)) {
        const chiave = dataISO(d);
        giorni.push({ data: chiave, valore: perGiorno.get(chiave) || 0 });
      }
      return { righe, totale, precedente, giorni, inizio: dataISO(inizio), fine: dataISO(oggi) };
    },

    portafoglioGrafico(oggi = new Date()) {
      const { giorni, inizio, fine } = this.portafoglioDati(oggi);
      if (!giorni.length) return '';
      const periodo = this.portafoglioPeriodo;
      const campioni = giorni;
      let cumulato = 0;
      const punti = campioni.map((g, i) => ({ ...g, indice: i, cumulato: (cumulato += g.valore) }));
      const massimo = Math.max(1, cumulato), picco = Math.max(1, ...campioni.map(g => g.valore));
      const scala = ['3M', '6M'].includes(periodo) ? 'settimane' : ['12M', 'Tutto'].includes(periodo) ? 'mesi' : 'giorni';
      const scelti = punti.filter((p, i) => i === 0 || i === punti.length - 1 || scala === 'giorni' || (scala === 'settimane' && new Date(p.data + 'T00:00:00').getDay() === 0) || (scala === 'mesi' && p.data.endsWith('-01')));
      const x = i => punti.length === 1 ? 340 : 20 + i * 320 / (punti.length - 1);
      const y = p => 152 - p.cumulato / massimo * 120;
      const linea = (punti.length === 1 ? 'M20 152 L340 ' + y(punti[0]).toFixed(1) : scelti.map((p, i) => (i ? 'L' : 'M') + x(p.indice).toFixed(1) + ' ' + y(p).toFixed(1)).join(' '));
      const larghezza = Math.max(.6, Math.min(8, 180 / punti.length));
      const barre = punti.map(p => p.valore > 0 ? `<rect x="${(x(p.indice) - larghezza / 2).toFixed(1)}" y="${(197 - p.valore / picco * 29).toFixed(1)}" width="${larghezza}" height="${(p.valore / picco * 29).toFixed(1)}" rx="1"/>` : '').join('');
      return `<line class="port-grid" x1="20" y1="32" x2="340" y2="32"/><line class="port-grid" x1="20" y1="92" x2="340" y2="92"/><line class="port-grid" x1="20" y1="152" x2="340" y2="152"/><path class="port-area" d="${linea} L340 152 L20 152 Z"/><path class="port-line" d="${linea}"/><g class="port-bars">${barre}</g><text x="20" y="220">${inizio.slice(5)}</text><text x="340" y="220" text-anchor="end">${fine.slice(5)}</text>`;
    },

    portafoglioPunta(evento) {
      const svg = evento.currentTarget;
      const x = Math.max(0, Math.min(1, (evento.clientX - svg.getBoundingClientRect().left) / svg.getBoundingClientRect().width));
      const { giorni, totale } = this.portafoglioDati();
      if (!giorni.length) return;
      const indice = Math.round(x * (giorni.length - 1));
      const data = giorni[indice].data;
      const quota = giorni[indice].valore;
      const cumulato = giorni.slice(0, indice + 1).reduce((n, d) => n + d.valore, 0);
      this.portafoglioHover = { data, quota, cumulato, x: Math.max(18, Math.min(82, x * 100)), y: 152 - cumulato / Math.max(1, totale) * 120 };
    },

    // Nessuna cache: la vista Fatturato viene ricaricata da zero ogni volta
    // che si apre, così resta sempre coerente con l'ultimo incasso/vendita/
    // eliminazione registrati altrove nell'app.
    async caricaFatturato() {
      this.erroreFatturato = '';
      this.caricandoFatturato = true;
      if (this.view === 'incassato') { this.fatturatoGuadagniRighe = []; this.portafoglioVendite = []; }

      const userId = this.sessione?.user?.id;
      if (!userId) {
        this.caricandoFatturato = false;
        return;
      }

      try {
        const miePartecipazioni = await window.supabaseClient
          .from('pagamento_partecipanti')
          .select('pagamento_id,quota_effettiva')
          .eq('profilo_id', userId);

        if (miePartecipazioni.error) {
          this.erroreFatturato =
            'Errore nel caricare i tuoi guadagni: ' + miePartecipazioni.error.message;
          return;
        }

        this.fatturatoGuadagniRighe = await this.righeIncassatePerPartecipazioni(
          miePartecipazioni.data || []
        );
        if (this.erroreFatturato) return;
        if (this.view === 'incassato') {
          const quote = await window.supabaseClient.from('vendita_partecipanti')
            .select('vendita_id,quota_finale').eq('profilo_id', userId);
          if (quote.error) { this.erroreFatturato = 'Errore nel caricare le vendite: ' + quote.error.message; return; }
          const ids = [...new Set((quote.data || []).map(q => q.vendita_id))];
          if (ids.length) {
            const vendite = await window.supabaseClient.from('vendite')
              .select('id,stato,data_vendita,importo_vendita,clienti(nome)').in('id', ids);
            if (vendite.error) { this.erroreFatturato = 'Errore nel caricare le vendite: ' + vendite.error.message; return; }
            const perId = Object.fromEntries((vendite.data || []).filter(v => v.stato === 'attiva').map(v => [v.id, v]));
            this.portafoglioVendite = (quote.data || []).filter(q => perId[q.vendita_id]?.data_vendita).map(q => ({
              data: perId[q.vendita_id].data_vendita,
              valore: Number(q.quota_finale) || 0,
              clienteNome: perId[q.vendita_id].clienti?.nome || 'Cliente',
              importoPagato: Number(perId[q.vendita_id].importo_vendita) || 0,
              pagamentoId: q.vendita_id
            }));
          }
        }

        if (this.isAdmin) {
          const ok = await this.caricaFatturatoAzienda();
          if (!ok) return;
        } else {
          this.fatturatoVenditeRighe = [];
          this.fatturatoIncassiRighe = [];
          this.fatturatoBreakdownRighe = [];
        }

        this.fatturatoAnniDisponibili = anniDisponibiliFatturato([
          this.fatturatoVenditeRighe,
          this.fatturatoIncassiRighe,
          this.fatturatoGuadagniRighe
        ]);

        if (!this.fatturatoAnniDisponibili.includes(this.fatturatoAnno)) {
          this.fatturatoAnno =
            this.fatturatoAnniDisponibili[0] || new Date().getFullYear();
        }
      } catch (errore) {
        this.erroreFatturato = 'Connessione non disponibile. Riprova.';
      } finally {
        this.caricandoFatturato = false;
      }
    },

    // Incrocia le partecipazioni (pagamento_id, quota_effettiva) con i
    // pagamenti collegati per sapere data e stato dell'incasso. Query
    // separata (non select annidata): se la RLS su pagamenti fosse più
    // stretta di quella su pagamento_partecipanti, una select annidata
    // tornerebbe pagamenti:null in silenzio e il filtro stato==='incassato'
    // scarterebbe quelle righe come se non fossero mai state incassate -
    // un numero sbagliato senza errore visibile. Con due query, un problema
    // di permessi emerge come errore esplicito invece che come cifra silenziosamente errata.
    async righeIncassatePerPartecipazioni(partecipazioni, mappaExtra = null) {
      const idPagamenti = [...new Set(partecipazioni.map(p => p.pagamento_id))];
      if (!idPagamenti.length) return [];

      const { data, error } = await window.supabaseClient
        .from('pagamenti')
        .select('id,data_pagamento,stato,vendita_id,importo')
        .in('id', idPagamenti);

      if (error) {
        this.erroreFatturato = 'Errore nel caricare i pagamenti: ' + error.message;
        return [];
      }

      // Un pagamento incassato su una vendita poi annullata non deve contare
      // nei guadagni: stessa regola gia' applicata dalla card Home
      // (calcolaStatisticheVenditore filtra vendite.stato === 'attiva').
      const idVendite = [...new Set((data || []).map(p => p.vendita_id).filter(Boolean))];
      const venditeNonAttiveIds = new Set();
      const clienteNomePerVenditaId = {};
      if (idVendite.length) {
        const { data: vendite, error: erroreVendite } = await window.supabaseClient
          .from('vendite')
          .select('id,stato,clienti(nome)')
          .in('id', idVendite);

        if (erroreVendite) {
          this.erroreFatturato = 'Errore nel caricare le vendite: ' + erroreVendite.message;
          return [];
        }

        (vendite || []).forEach(v => {
          if (v.stato !== 'attiva') venditeNonAttiveIds.add(v.id);
          clienteNomePerVenditaId[v.id] = v.clienti?.nome || '';
        });
      }

      const pagamentoPerId = Object.fromEntries(
        (data || [])
          .filter(p => !venditeNonAttiveIds.has(p.vendita_id))
          .map(p => [p.id, p])
      );

      // Il nome cliente/giorno per riga serve all'elenco dettagliato "Il tuo
      // incassato" (non solo il totale mensile): sempre applicato, poi si
      // compone con un eventuale arricchimento extra del chiamante.
      const arricchisciConCliente = (riga, p) => {
        riga.pagamentoId = p.pagamento_id;
        riga.importoPagato = Number(pagamentoPerId[p.pagamento_id]?.importo) || 0;
        riga.clienteNome = clienteNomePerVenditaId[pagamentoPerId[p.pagamento_id]?.vendita_id] || '';
        if (mappaExtra) mappaExtra(riga, p);
      };

      return partecipanti_a_righe(partecipazioni, pagamentoPerId, arricchisciConCliente);
    },

    async caricaFatturatoAzienda() {
      const [clientiResult, venditeResult, pagamentiResult, partecipazioniResult, profiliResult] =
        await Promise.all([
          window.supabaseClient
            .from('clienti')
            .select('id,importo_abbonamento,periodicita_contratto'),

          window.supabaseClient
            .from('vendite')
            .select('id,cliente_id,importo_vendita,stato,data_vendita'),

          window.supabaseClient
            .from('pagamenti')
            .select('id,importo,stato,data_pagamento'),

          window.supabaseClient
            .from('pagamento_partecipanti')
            .select('pagamento_id,profilo_id,quota_effettiva'),

          window.supabaseClient
            .from('profili')
            .select('id,nome,ruolo_economico')
        ]);

      const errore =
        clientiResult.error ||
        venditeResult.error ||
        pagamentiResult.error ||
        partecipazioniResult.error ||
        profiliResult.error;

      if (errore) {
        this.erroreFatturato = 'Errore nel caricare il fatturato azienda: ' + errore.message;
        return false;
      }

      const clientiPerId = Object.fromEntries(
        (clientiResult.data || []).map(c => [c.id, c])
      );

      this.fatturatoVenditeRighe = (venditeResult.data || [])
        .filter(v => v.stato === 'attiva' && v.data_vendita)
        .map(v => ({
          data: v.data_vendita,
          valore: valoreContrattoVendita(v, clientiPerId)
        }));

      const pagamentoPerId = Object.fromEntries(
        (pagamentiResult.data || []).map(p => [p.id, p])
      );

      this.fatturatoIncassiRighe = (pagamentiResult.data || [])
        .filter(p => p.stato === 'incassato' && p.data_pagamento)
        .map(p => ({ data: p.data_pagamento, valore: Number(p.importo) || 0 }));

      const nomeProfilo = profilo => {
        if (profilo.ruolo_economico === 'referente') return 'Alessandro';
        if (profilo.ruolo_economico === 'produzione') return 'Tomas';
        return profilo.nome || 'Collaboratore';
      };
      const nomePerProfiloId = Object.fromEntries(
        (profiliResult.data || []).map(p => [p.id, nomeProfilo(p)])
      );

      this.fatturatoBreakdownRighe = partecipanti_a_righe(
        partecipazioniResult.data || [],
        pagamentoPerId,
        (riga, p) => {
          riga.profiloId = p.profilo_id;
          riga.nome = nomePerProfiloId[p.profilo_id] || 'Collaboratore';
        }
      );

      return true;
    },

    // ===== Aggregazioni derivate per l'anno selezionato =====

    fatturatoVenditaMensile() {
      return serieMensileAnno(this.fatturatoVenditeRighe, this.fatturatoAnno);
    },

    fatturatoIncassoMensile() {
      return serieMensileAnno(this.fatturatoIncassiRighe, this.fatturatoAnno);
    },

    fatturatoGuadagniMensile() {
      return serieMensileAnno(this.fatturatoGuadagniRighe, this.fatturatoAnno);
    },

    fatturatoTotaleAnno(righe) {
      return (totaliPerAnno(righe)[this.fatturatoAnno]) || 0;
    },

    fatturatoConfrontoAnni() {
      const venduto = totaliPerAnno(this.fatturatoVenditeRighe);
      const incassato = totaliPerAnno(this.fatturatoIncassiRighe);
      const guadagni = totaliPerAnno(this.fatturatoGuadagniRighe);

      return this.fatturatoAnniDisponibili.map(anno => ({
        anno,
        venduto: venduto[anno] || 0,
        incassato: incassato[anno] || 0,
        guadagni: guadagni[anno] || 0
      }));
    },

    fatturatoBreakdownPersone() {
      const perPersona = {};

      this.fatturatoBreakdownRighe.forEach(riga => {
        const chiave = riga.profiloId;
        if (!perPersona[chiave]) {
          perPersona[chiave] = { profiloId: chiave, nome: riga.nome, righe: [] };
        }
        perPersona[chiave].righe.push(riga);
      });

      return Object.values(perPersona)
        .map(persona => ({
          profiloId: persona.profiloId,
          nome: persona.nome,
          totaleAnno: this.fatturatoTotaleAnno(persona.righe)
        }))
        .filter(persona => persona.totaleAnno > 0)
        .sort((a, b) => b.totaleAnno - a.totaleAnno);
    },

    // ===== Rendering SVG (stesso schema di trendMarkupAdmin/Venditore:
    // stringa generata e legata con x-html, vedi commento a trendMarkupAdmin
    // in app.js per il perché niente <template> dentro <svg>) =====

    fatturatoMarkupAzienda() {
      const serie = [
        { id: 'venduto', nome: 'Venduto', color: 'var(--lime-deep)', punti: this.fatturatoVenditaMensile() },
        { id: 'incassato', nome: 'Incassato', color: 'var(--cat-2)', punti: this.fatturatoIncassoMensile() }
      ];

      if (!serie.some(s => s.punti.some(p => p.valore > 0))) return '';

      return this.disegnaMarkupTrendFatturato(serie, 'fatturatoHoverAzienda');
    },

    // Grafico a barre della vista "Il tuo incassato" (tile Home): stesso
    // generatore condiviso del trend Home (this.disegnaMarkupBarreMensili,
    // definito in app.js), niente lista di 12 righe.
    incassatoMarkupMensile() {
      return this.disegnaMarkupBarreMensili(this.fatturatoGuadagniMensile(), 'incassatoHoverMensile', {
        colore: 'var(--lime-deep)'
      });
    },

    fatturatoMarkupGuadagni() {
      const punti = this.fatturatoGuadagniMensile();
      if (!punti.some(p => p.valore > 0)) return '';

      const serie = [
        { id: 'guadagni', nome: 'I tuoi guadagni', color: 'var(--lime-deep)', punti }
      ];

      return this.disegnaMarkupTrendFatturato(serie, 'fatturatoHoverPersonale');
    },

    // Generatore condiviso: le funzioni trendPuntiSerie/trendPathLinea/
    // trendGridLineY/trendEtichetteAsse sono generiche su un array di punti
    // {chiave,label,valore} e già usate da trendMarkupAdmin/Venditore in
    // app.js - qui vengono riusate senza modifiche.
    disegnaMarkupTrendFatturato(serie, statoHoverProp) {
      let svg = '';

      this.trendGridLineY().forEach(y => {
        svg += `<line class="metrics-grid-line" x1="28" y1="${y}" x2="632" y2="${y}"></line>`;
      });

      this.trendEtichetteAsse(serie[0].punti).forEach(a => {
        svg += `<text class="metrics-axis-label" x="${a.x}" y="196" text-anchor="middle">${a.text}</text>`;
      });

      serie.forEach(s => {
        svg += `<path class="metrics-trend-line" style="stroke:${s.color}" d="${this.trendPathLinea(s.punti)}"></path>`;
      });

      serie.forEach((s, si) => {
        this.trendPuntiSerie(s.punti).forEach((p, pi) => {
          svg += `<circle class="metrics-trend-dot" cx="${p.x}" cy="${p.y}" r="3.5" style="fill:${s.color}"
            onmouseenter="Alpine.$data(document.getElementById('app')).${statoHoverProp}={si:${si},pi:${pi}}"
            onmouseleave="Alpine.$data(document.getElementById('app')).${statoHoverProp}=null"
            onclick="const __d=Alpine.$data(document.getElementById('app'));const __h=__d.${statoHoverProp};__d.${statoHoverProp}=(__h&&__h.si===${si}&&__h.pi===${pi})?null:{si:${si},pi:${pi}}"></circle>`;
        });
      });

      this.trendEtichetteFinali(serie).forEach(e => {
        svg += `<text class="metrics-direct-label" x="${e.x}" y="${e.y}" style="fill:${e.color}">${e.text}</text>`;
      });

      const hover = this[statoHoverProp];
      if (hover) {
        const s = serie[hover.si];
        const p = s && this.trendPuntiSerie(s.punti)[hover.pi];
        if (p) {
          const righe = serie.length > 1
            ? [p.label + ' · ' + s.nome, formattaEuro(p.valore)]
            : [p.label + ' · ' + formattaEuro(p.valore)];
          svg += this.markupTooltip(p.x, p.y - 24, righe);
        }
      }

      return svg;
    }
  };

  // Trasforma [{pagamento_id, profilo_id?, quota_effettiva}] in righe
  // {data, valore} filtrando solo i pagamenti realmente incassati.
  // `arricchisci(riga, partecipazione)` è opzionale, per aggiungere campi
  // extra (es. profiloId/nome nella vista admin per persona).
  function partecipanti_a_righe(partecipazioni, pagamentoPerId, arricchisci) {
    return partecipazioni
      .map(p => {
        const pagamento = pagamentoPerId[p.pagamento_id];
        const riga = {
          data: pagamento?.data_pagamento || null,
          valore: Number(p.quota_effettiva) || 0,
          _stato: pagamento?.stato || null
        };
        if (arricchisci) arricchisci(riga, p);
        return riga;
      })
      .filter(riga => riga.data && riga._stato === 'incassato');
  }
});
