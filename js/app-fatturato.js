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

    // Nessuna cache: la vista Fatturato viene ricaricata da zero ogni volta
    // che si apre, così resta sempre coerente con l'ultimo incasso/vendita/
    // eliminazione registrati altrove nell'app.
    async caricaFatturato() {
      this.erroreFatturato = '';
      this.caricandoFatturato = true;

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
        .select('id,data_pagamento,stato')
        .in('id', idPagamenti);

      if (error) {
        this.erroreFatturato = 'Errore nel caricare i pagamenti: ' + error.message;
        return [];
      }

      const pagamentoPerId = Object.fromEntries((data || []).map(p => [p.id, p]));

      return partecipanti_a_righe(partecipazioni, pagamentoPerId, mappaExtra);
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
          const x = Math.max(50, Math.min(590, p.x));
          const y = Math.max(28, p.y - 24);
          const nomeSerie = serie.length > 1 ? ' · ' + s.nome : '';
          svg += `<text class="metrics-tooltip" x="${x}" y="${y}" text-anchor="middle">${p.label}${nomeSerie} · ${formattaEuro(p.valore)}</text>`;
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
