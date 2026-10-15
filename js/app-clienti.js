// js/app-clienti.js
// Mixin di appState() per la pagina Clienti del venditore (view === 'clienti'):
// barra "azioni scadute", gruppi per tappa, filtro Venditori a foglio, ricerca.
// Mockup approvato: mockups/12-clienti-barra-da-fare.html.
// Perimetro dei venditori = stessa regola dell'albero rete_vendita_albero().
// Stesso pattern UMD-lite di js/app-rete.js.
(function (root, factory) {
  const api = factory(
    root && root.appReteMixin
      ? root.appReteMixin
      : (typeof require === 'function' ? require('./app-rete.js') : null)
  );

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.appClientiMixin = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (reteMixin) {
  // Albero e sottoalbero vengono da app-rete.js: una sola definizione.
  const { escapaHtml, indicizzaAlbero, sottoalbero } = reteMixin.__puri;

  const TAPPE = [
    { n: 1, nome: 'Brief' },
    { n: 2, nome: 'Mandato' },
    { n: 3, nome: 'Produzione' },
    { n: 4, nome: 'Online' },
    { n: 5, nome: 'Mancati' }
  ];
  const MASSIMO_VISIBILI = 3;

  // contattato -> Brief, brief_mandato -> Mandato, vinto -> Produzione finche'
  // non e' pubblicato, poi Online. perso -> Mancati (quinto gruppo, chiuso).
  function tappaCliente(cliente = {}) {
    if (cliente.stato === 'perso') return 5;
    if (cliente.stato === 'brief_mandato') return 2;
    if (cliente.stato === 'vinto') return cliente.stato_produzione === 'pubblicato' ? 4 : 3;
    return 1;
  }

  // 2026-10-13 -> "13/10" (la data arriva gia' normalizzata da prossimaScadenzaCliente).
  function dataBreve(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? m[3] + '/' + m[2] : '';
  }

  // Una riga della lista, calcolata una sola volta a partire dalla scheda gia'
  // pronta (schedaClienteCompleta). "Scaduta" = prossima scadenza (contatto,
  // rata o rinnovo) nel passato; i clienti mancati non hanno urgenze.
  function rigaCliente(cliente, scheda) {
    const tappa = tappaCliente(cliente);
    const scadenza = scheda?.prossimaScadenza || null;
    const azioneScritta = String(cliente.prossima_azione || '').trim();
    const ritardo = tappa !== 5 && Boolean(scheda?.prossimaScadenzaInRitardo);
    const breve = dataBreve(scadenza?.data);

    return {
      id: cliente.id,
      nome: scheda?.nome || cliente.nome || 'Cliente senza nome',
      venditoreId: cliente.venditore_id || null,
      referente: String(cliente.referente || ''),
      tappa,
      valore: Number(scheda?.totalePagamento) > 0
        ? Number(scheda.totalePagamento)
        : Number(scheda?.valoreAnnuale) || 0,
      pagato: scheda && Number(scheda.totalePagamento) > 0
        ? Math.round(Number(scheda.percentualeIncassata) || 0)
        : 0,
      azione: azioneScritta || (scadenza ? scheda.prossimaScadenzaLabel : 'Nessuna scadenza'),
      data: scadenza?.data || '',
      dataEtichetta: breve ? (ritardo ? 'dal ' : '') + breve : '',
      ritardo
    };
  }

  // Prima i ritardi, poi la scadenza piu' vicina, in fondo chi non ne ha.
  function ordinaRighe(righe) {
    return [...righe].sort((a, b) => {
      if (a.ritardo !== b.ritardo) return a.ritardo ? -1 : 1;
      if (a.data !== b.data) {
        if (!a.data) return 1;
        if (!b.data) return -1;
        return a.data.localeCompare(b.data);
      }
      return a.nome.localeCompare(b.nome, 'it');
    });
  }

  function raggruppaPerTappa(righe) {
    return TAPPE.map(t => {
      const del = ordinaRighe(righe.filter(r => r.tappa === t.n));
      return { ...t, righe: del, totale: del.reduce((s, r) => s + r.valore, 0) };
    }).filter(g => g.righe.length);
  }

  // Chi vede cosa. `albero` = indicizzaAlbero(rete_vendita_albero()).
  // - nodo = chi guarda e' un venditore dell'albero; Tomas (developer) o un
  //   profilo di produzione non lo sono: vedono la rete e basta.
  // - segmento "I miei diretti / Tutta la rete" solo se il nodo ha sottoposti.
  // - ids === null significa "nessun filtro per venditore" (compresi i clienti
  //   non assegnati): vale per chi non e' nodo e non ha scelto nessuno.
  function perimetroClienti({ albero, viewerId, modo = 'own', scelti = [] }) {
    const nodo = Boolean(albero.perId[viewerId]);
    const scope = nodo ? sottoalbero(albero, viewerId) : albero.ordine.slice();
    const haSegmento = nodo && scope.length > 1;
    const modoEffettivo = haSegmento ? modo : (nodo ? 'own' : 'rete');
    const scelteValide = scelti.filter(id => scope.includes(id));
    const filtrato = scelteValide.length > 0 && scelteValide.length < scope.length;

    let ids;
    if (modoEffettivo === 'own') ids = [viewerId];
    else if (filtrato) ids = scelteValide;
    else ids = nodo ? scope : null;

    return {
      nodo,
      scope,
      haSegmento,
      modo: modoEffettivo,
      haCampo: modoEffettivo === 'rete' && scope.length > 1,
      filtrato,
      ids
    };
  }

  function markupGruppi({ gruppi, aperti, altri, cerca, mostraVenditore, nomeVenditore }) {
    return gruppi.map(g => {
      const apertoGruppo = Boolean(aperti[g.n]);
      const tutte = altri[g.n] || cerca;
      const visibili = tutte ? g.righe : g.righe.slice(0, MASSIMO_VISIBILI);
      const righe = visibili.map(r =>
        '<button type="button" class="cli-it' + (r.ritardo ? ' lt' : '') + '" data-cliente="' + escapaHtml(r.id) + '">' +
          '<span class="cli-it-main">' +
            '<b>' + escapaHtml(r.nome) +
              (mostraVenditore ? '<span class="cli-sel">' + escapaHtml(nomeVenditore(r.venditoreId)) + '</span>' : '') +
            '</b>' +
            '<small class="' + (r.ritardo ? 'late' : '') + '">' + escapaHtml(r.azione) +
              (r.dataEtichetta ? ' · ' + escapaHtml(r.dataEtichetta) : '') + '</small>' +
            (r.pagato ? '<span class="cli-mt"><span class="cli-pg"><i style="width:' + r.pagato + '%"></i></span><span class="cli-pc">' + r.pagato + '%</span></span>' : '') +
          '</span>' +
          '<span class="cli-val">' + escapaHtml(r.valore > 0 ? euroIntero(r.valore) : '-') + '</span>' +
        '</button>'
      ).join('');
      const altro = !tutte && g.righe.length > MASSIMO_VISIBILI
        ? '<button type="button" class="cli-mo" data-altri="' + g.n + '">Mostra altri ' + (g.righe.length - MASSIMO_VISIBILI) + '</button>'
        : '';

      return '<div class="cli-grp">' +
        '<button type="button" class="cli-gh" data-gruppo="' + g.n + '" aria-expanded="' + apertoGruppo + '">' +
          '<span class="cli-n">' + g.n + '</span><b>' + escapaHtml(g.nome) + '</b>' +
          '<small>' + g.righe.length + (g.n === 5 ? '' : ' · ' + escapaHtml(euroIntero(g.totale))) + '</small>' +
          '<svg class="cli-ch" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6l5 5 5-5"/></svg>' +
        '</button>' +
        (apertoGruppo ? '<div class="cli-gk">' + righe + altro + '</div>' : '') +
      '</div>';
    }).join('');
  }

  function euroIntero(valore) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
      .format(Number(valore) || 0);
  }

  // ----- Metodi di appState -----
  const mixin = {
    // Albero dei venditori: serve per sapere chi sta sotto chi. Se la funzione
    // fallisce lo diciamo (nessuna lista vuota che finge di essere corretta).
    async caricaAlberoClienti() {
      this.erroreAlberoClienti = '';
      const { data, error } = await window.supabaseClient.rpc('rete_vendita_albero');
      if (error) {
        console.warn('Albero venditori non disponibile:', error.message);
        this.erroreAlberoClienti = 'Non riesco a caricare i venditori. Riprova tra poco.';
        this.clientiNodi = null;
        return;
      }
      this.clientiNodi = data || [];
    },

    clientiPerimetro() {
      return perimetroClienti({
        albero: indicizzaAlbero(this.clientiNodi || []),
        viewerId: this.sessione?.user?.id || '',
        modo: this.clientiModo,
        scelti: this.clientiScelti
      });
    },

    // Clienti del perimetro scelto (prima di ricerca e gruppi).
    clientiNelPerimetro() {
      const p = this.clientiPerimetro();
      const ids = p.ids ? new Set(p.ids) : null;
      return this.clienti.filter(c => !ids || ids.has(c.venditore_id));
    },

    // --- Scheda cliente: percorso a 4 tappe (mockup 09) ---
    tappaSchedaCliente() {
      return tappaCliente(this.clienteSelezionato());
    },

    tappeScheda() {
      const corrente = this.tappaSchedaCliente();
      const scelta = this.schedaTappa || (corrente === 5 ? 0 : corrente);
      return TAPPE.filter(t => t.n <= 4).map(t => ({
        ...t,
        stato: corrente === 5 ? 'next' : (t.n < corrente ? 'ok' : (t.n === corrente ? 'cur' : 'next')),
        selezionata: t.n === scelta
      }));
    },

    selezionaTappaScheda(n) {
      this.schedaTappa = n === this.tappaSchedaCliente() ? 0 : n;
    },

    tappaSelezionataSchedaCorrente() {
      return !this.schedaTappa || this.schedaTappa === this.tappaSchedaCliente();
    },

    descrizioneTappaScheda() {
      const sel = this.schedaTappa || this.tappaSchedaCliente();
      const corrente = this.tappaSchedaCliente();
      if (sel < corrente) return 'Tappa completata';
      if (sel > corrente) return 'Non ancora raggiunta';
      return {
        1: 'Raccogli il brief dal cliente',
        2: 'Contratto da chiudere',
        3: 'Il sito è in lavorazione',
        4: 'Il sito è online'
      }[sel] || '';
    },

    clientiRighe() {
      return this.clientiNelPerimetro().map(c => rigaCliente(c, this.schedaClienteCompleta(c)));
    },

    clientiScadute() {
      return ordinaRighe(this.clientiRighe().filter(r => r.ritardo));
    },

    clientiVistaGruppi() {
      const testo = this.clientiTesto.trim().toLowerCase();
      const righe = this.clientiRighe().filter(r =>
        !testo || r.nome.toLowerCase().includes(testo) || r.referente.toLowerCase().includes(testo)
      );
      return raggruppaPerTappa(righe);
    },

    clientiMarkup() {
      const p = this.clientiPerimetro();
      const gruppi = this.clientiVistaGruppi();
      if (!gruppi.length) {
        return '<div class="cli-empty">' +
          (this.clientiTesto.trim() ? 'Nessun cliente con questa ricerca' : 'Nessun cliente da mostrare qui') + '</div>';
      }
      return markupGruppi({
        gruppi,
        aperti: this.clientiAperti,
        altri: this.clientiAltri,
        cerca: Boolean(this.clientiTesto.trim()),
        mostraVenditore: !p.ids || p.ids.length > 1,
        nomeVenditore: id => this.nomeVenditoreCliente({ venditore_id: id })
      });
    },

    clientiMarkupDaFare() {
      const ids = this.clientiPerimetro().ids;
      const mostraVenditore = !ids || ids.length > 1;
      return this.clientiScadute().map(r =>
        '<div class="cli-td"><div class="cli-tdi"><b>' + escapaHtml(r.nome) + '</b><small>' +
          escapaHtml(r.azione) + (r.dataEtichetta ? ' · ' + escapaHtml(r.dataEtichetta) : '') +
          (mostraVenditore ? ' · ' + escapaHtml(this.nomeVenditoreCliente({ venditore_id: r.venditoreId })) : '') +
        '</small></div><button type="button" class="cli-tdb" data-cliente="' + escapaHtml(r.id) + '">Apri</button></div>'
      ).join('');
    },

    clientiEtichettaSottotitolo() {
      const p = this.clientiPerimetro();
      if (!p.nodo) return 'Tutta la rete';
      return p.haSegmento
        ? (p.modo === 'own' ? 'I tuoi clienti diretti' : 'I clienti di tutta la tua rete')
        : 'I tuoi clienti';
    },

    clientiCapFiltro() {
      const p = this.clientiPerimetro();
      const albero = indicizzaAlbero(this.clientiNodi || []);
      if (!p.filtrato) return 'Tutti (' + p.scope.length + ')';
      return p.ids.length === 1 ? (albero.perId[p.ids[0]]?.nome || '1') : p.ids.length + ' di ' + p.scope.length;
    },

    clientiElencoFoglio() {
      const albero = indicizzaAlbero(this.clientiNodi || []);
      return this.clientiPerimetro().scope.map(id => albero.perId[id]).filter(Boolean);
    },

    clientiImpostaModo(modo) {
      this.clientiModo = modo;
      this.clientiScelti = []; // cambiare modo riparte da "tutti"
      this.clientiAltri = {};
    },

    clientiGestisciClick(evento) {
      const gruppo = evento.target.closest('[data-gruppo]');
      if (gruppo) {
        const n = gruppo.dataset.gruppo;
        this.clientiAperti = { ...this.clientiAperti, [n]: !this.clientiAperti[n] };
        return;
      }
      const altri = evento.target.closest('[data-altri]');
      if (altri) {
        this.clientiAltri = { ...this.clientiAltri, [altri.dataset.altri]: true };
        return;
      }
      const cliente = evento.target.closest('[data-cliente]');
      if (cliente) this.clientiApriCliente(cliente.dataset.cliente);
    },

    clientiApriCliente(id) {
      this.clientiChiudiFogli();
      this.apriScheda(id);
    },

    // Fogli: un solo flag per foglio; chiuderli ripristina lo scroll della pagina.
    clientiApriFoglioVenditori() {
      this.clientiFoglioTmp = (this.clientiScelti.length ? this.clientiScelti : this.clientiPerimetro().scope).slice();
      this.clientiFoglio = 'venditori';
      document.body.style.overflow = 'hidden';
    },

    clientiApriFoglioDaFare() {
      this.clientiFoglio = 'dafare';
      document.body.style.overflow = 'hidden';
    },

    clientiChiudiFogli() {
      this.clientiFoglio = '';
      document.body.style.overflow = '';
    },

    clientiToggleFoglio(id) {
      this.clientiFoglioTmp = this.clientiFoglioTmp.includes(id)
        ? this.clientiFoglioTmp.filter(x => x !== id)
        : this.clientiFoglioTmp.concat(id);
    },

    clientiApplicaFoglio() {
      const scope = this.clientiPerimetro().scope;
      // Nessuna spunta o tutte equivalgono a "tutti": nessun filtro.
      this.clientiScelti = this.clientiFoglioTmp.length && this.clientiFoglioTmp.length < scope.length
        ? this.clientiFoglioTmp.slice()
        : [];
      this.clientiAltri = {};
      this.clientiChiudiFogli();
    },

    clientiReset() {
      this.clientiModo = 'own';
      this.clientiScelti = [];
      this.clientiTesto = '';
      this.clientiAperti = { 1: true, 2: true, 3: true, 4: true, 5: false };
      this.clientiAltri = {};
      this.clientiChiudiFogli();
    }
  };

  // Funzioni pure per i test: non enumerabili, cosi Object.assign(appState, mixin)
  // non le copia nello stato di Alpine.
  Object.defineProperty(mixin, '__puri', {
    value: { tappaCliente, rigaCliente, ordinaRighe, raggruppaPerTappa, perimetroClienti, markupGruppi, TAPPE }
  });

  return mixin;
});
