// js/app-rete.js
// Mixin di appState() per la sezione "Rete vendita": albero dei venditori
// (chi risponde a chi), venduto di rete con "di cui diretto", generato,
// incassato e media per venditore, filtro a foglio con spunte e ingresso nel
// ramo di un venditore toccandone il nome. Mockup approvato:
// mockups/08-rete-vendita-finale.html.
// Stesso pattern UMD-lite di js/app-fatturato.js.
(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.appReteMixin = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // ----- Funzioni pure (testate in test/rete-vendita.test.js) -----

  function escapaHtml(testo) {
    return String(testo ?? '').replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function euro(valore) {
    if (typeof formattaEuro === 'function') return formattaEuro(valore);
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
      .format(Number(valore) || 0);
  }

  // Righe di rete_vendita_albero() -> indice per id, radici e ordine di visita
  // (il padre prima dei figli, fratelli in ordine alfabetico).
  function indicizzaAlbero(nodi = []) {
    const perId = {};
    nodi.forEach(n => {
      perId[n.id] = { id: n.id, nome: n.nome || '', livello: n.livello, padre: n.responsabile_id || null, figli: [] };
    });

    const radici = [];
    Object.values(perId).forEach(n => {
      if (n.padre && perId[n.padre]) perId[n.padre].figli.push(n.id);
      else radici.push(n.id);
    });

    const perNome = (a, b) => {
      const nomeA = perId[a].nome.toLocaleLowerCase('it');
      const nomeB = perId[b].nome.toLocaleLowerCase('it');
      if (nomeA === 'nicola' && nomeB.startsWith('nicholas')) return -1;
      if (nomeB === 'nicola' && nomeA.startsWith('nicholas')) return 1;
      return perId[a].nome.localeCompare(perId[b].nome, 'it');
    };
    const ordine = [];
    const visita = id => {
      ordine.push(id);
      perId[id].figli.sort(perNome).forEach(visita);
    };
    radici.sort(perNome).forEach(visita);

    return { perId, radici, ordine };
  }

  // Il nodo e tutti quelli sotto di lui.
  function sottoalbero(albero, id) {
    if (!albero.perId[id]) return [];
    return [id, ...albero.perId[id].figli.flatMap(figlio => sottoalbero(albero, figlio))];
  }

  // Percorso dalla radice al nodo, per le briciole di pane.
  function percorsoNodo(albero, id) {
    const percorso = [];
    for (let corrente = id; corrente && albero.perId[corrente]; corrente = albero.perId[corrente].padre) {
      percorso.unshift(corrente);
    }
    return percorso;
  }

  // Statistiche di ogni venditore con la stessa funzione dei tile della Home
  // (calcolaStatisticheVenditore): venduto = valore dei contratti di cui e
  // venditore diretto, generato = sua quota su tutte le vendite a cui partecipa,
  // incassato = quote effettive incassate nell'anno.
  function calcolaStatisticheRete({
    albero, vendite = [], partecipazioni = [], incassi = [], clientiPerId = {}, calcola
  }) {
    const statistiche = {};

    albero.ordine.forEach(profiloId => {
      const quotePerVendita = {};
      partecipazioni
        .filter(p => p.profilo_id === profiloId)
        .forEach(p => {
          quotePerVendita[p.vendita_id] = (quotePerVendita[p.vendita_id] || 0) + (Number(p.quota_finale) || 0);
        });

      const incassatoPerVendita = {};
      incassi
        .filter(i => i.profilo_id === profiloId)
        .forEach(i => {
          incassatoPerVendita[i.vendita_id] = (incassatoPerVendita[i.vendita_id] || 0) + (Number(i.quota_effettiva) || 0);
        });

      const venditeDelNodo = vendite.filter(v =>
        v.venditore_id === profiloId || Object.prototype.hasOwnProperty.call(quotePerVendita, v.id)
      );

      statistiche[profiloId] = calcola(
        venditeDelNodo, [], quotePerVendita, profiloId, clientiPerId, incassatoPerVendita
      );
    });

    return statistiche;
  }

  // Cosa si vede ora: l'intersezione tra i venditori spuntati nel foglio e il
  // ramo in cui si e entrati. "Diretto" e il venduto del venditore al centro
  // della vista; "team" e il resto.
  function riepilogoRete({ albero, statistiche, selezionati = [], focusId = null }) {
    const centro = focusId && albero.perId[focusId] ? focusId : albero.radici[0] || null;
    const nelRamo = new Set(centro ? sottoalbero(albero, centro) : []);
    const spuntati = new Set(selezionati);
    const visibili = albero.ordine.filter(id => spuntati.has(id) && nelRamo.has(id));

    const somma = campo => visibili.reduce((tot, id) => tot + (Number(statistiche[id]?.[campo]) || 0), 0);
    const venduto = somma('venduto');
    const numeroVendite = somma('numeroVendite');
    const diretto = centro && visibili.includes(centro) ? Number(statistiche[centro]?.venduto) || 0 : 0;

    return {
      centro,
      visibili,
      venduto,
      diretto,
      team: venduto - diretto,
      generato: somma('generato'),
      incassato: somma('incassato'),
      numeroVendite,
      mediaVendita: numeroVendite > 0 ? venduto / numeroVendite : 0
    };
  }

  // Home: venduto di rete del solo spettatore = i suoi contratti diretti piu
  // quelli di chi sta sotto di lui. Stessa regola della sezione Rete vendita
  // (venduto di ogni nodo = contratti di cui e venditore diretto). null se lo
  // spettatore non e un nodo dell'albero (es. developer): la Home resta com'e.
  function vendutoReteVenditore({ albero, viewerId, vendite = [], clientiPerId = {}, calcola }) {
    if (!viewerId || !albero.perId[viewerId]) return null;

    const nodi = sottoalbero(albero, viewerId);
    let rete = 0;
    let numeroVendite = 0;
    let diretto = 0;

    nodi.forEach(id => {
      const s = calcola(vendite.filter(v => v.venditore_id === id), [], {}, id, clientiPerId, {});
      rete += s.venduto;
      numeroVendite += s.numeroVendite;
      if (id === viewerId) diretto = s.venduto;
    });

    return {
      rete,
      diretto,
      numeroVendite,
      mediaVendita: numeroVendite > 0 ? rete / numeroVendite : 0,
      haTeam: nodi.length > 1
    };
  }

  // Quote di rete 10% ricevute: righe di pagamento_quote_rete (la RLS le mostra
  // solo al gestore che riceve e ad Alessandro/Tomas) -> per gestore, totale e
  // nomi di chi le ha generate. Non entra in "generato": e una voce a parte.
  function aggregaQuoteRete(righe = [], albero) {
    const perGestore = {};
    righe.forEach(r => {
      const importo = Number(r.importo);
      if (!r.a_profilo_id || !Number.isFinite(importo) || importo <= 0) return;
      const voce = perGestore[r.a_profilo_id] || (perGestore[r.a_profilo_id] = { totale: 0, daNomi: [] });
      voce.totale = Math.round((voce.totale + importo) * 100) / 100;
      const nome = albero.perId[r.da_profilo_id]?.nome;
      if (nome && !voce.daNomi.includes(nome)) voce.daNomi.push(nome);
    });
    return perGestore;
  }

  // Markup dell'albero: riga con gomiti di collegamento, come nel mockup.
  // Il nome e l'unico testo libero e viene sempre escapato.
  function markupAlberoRete({ albero, statistiche, visibili, centro, viewerId, pendenti = new Set(), reinviabili = new Set(), quoteRete = {} }) {
    const nelloInsieme = new Set(visibili);
    const padreVisibile = id => {
      for (let p = albero.perId[id].padre; p; p = albero.perId[p]?.padre) {
        if (nelloInsieme.has(p)) return p;
      }
      return null;
    };
    const figliVisibili = id => visibili.filter(x => padreVisibile(x) === id);
    const freccia = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 2l4 4-4 4"/></svg>';

    const nodo = id => {
      const n = albero.perId[id];
      const s = statistiche[id] || {};
      const sotto = sottoalbero(albero, id).filter(x => nelloInsieme.has(x));
      const conTeam = sotto.length > 1;
      const puoEntrare = id !== centro;
      const teamVenduto = sotto.reduce((tot, x) => tot + (Number(statistiche[x]?.venduto) || 0), 0);
      const tag = puoEntrare ? 'button' : 'div';
      const figli = figliVisibili(id);
      const nomeMostrato = id === viewerId ? n.nome + ' (tu)' : n.nome;

      return '<div class="rete-item"><' + tag + (puoEntrare ? ' type="button"' : '') +
        ' class="rete-node' + (id === viewerId ? ' me' : '') + '" data-id="' + escapaHtml(id) + '">' +
        '<span><b>' + escapaHtml(nomeMostrato) + '</b>' +
        (puoEntrare ? '<span class="rete-go">' + freccia + '</span>' : '') + '</span>' +
        '<span class="rete-v">' + escapaHtml(euro(s.venduto || 0)) + '</span>' +
        '<small><span class="rete-lv">Lv ' + Number(n.livello) + '</span>' +
        (conTeam ? 'team ' + escapaHtml(euro(teamVenduto)) : 'senza team') + '</small>' +
        '<small class="r">generato ' + escapaHtml(euro(s.generato || 0)) + '</small>' +
        '</' + tag + '>' +
        (quoteRete[id]
          ? '<div class="rete-quota">quota di rete ' + escapaHtml(euro(quoteRete[id].totale)) +
            (quoteRete[id].daNomi.length ? ' da ' + escapaHtml(quoteRete[id].daNomi.join(', ')) : '') + '</div>'
          : '') +
        (pendenti.has(id)
          ? '<div class="rete-invito"><span>Invito inviato, non è ancora entrato</span>' +
            (reinviabili.has(id) ? '<button type="button" data-reinvia="' + escapaHtml(id) + '">Reinvia</button>' : '') +
            '</div>'
          : '') +
        (figli.length ? '<div class="rete-kids">' + figli.map(nodo).join('') + '</div>' : '') +
        '</div>';
    };

    return visibili.filter(id => !padreVisibile(id)).map(nodo).join('');
  }

  function dividiInBlocchi(lista, dimensione) {
    const blocchi = [];
    for (let i = 0; i < lista.length; i += dimensione) blocchi.push(lista.slice(i, i + dimensione));
    return blocchi;
  }

  // ----- Metodi di appState -----
  const mixin = {
    async apriRete() {
      this.view = 'rete';
      this.reteFocusId = null;
      this.reteSelezionati = []; // ogni apertura riparte da "tutti"
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await this.caricaRete();
    },

    // Venduto di rete per la tile della Home. Se non ha nessuno sotto (o la
    // rete non si carica) la Home resta sul venduto diretto di sempre: un errore
    // qui non deve rompere i numeri personali.
    async caricaVendutoReteHome() {
      this.vendutoReteHome = null;
      try {
        const db = window.supabaseClient;
        const { data: nodi, error } = await db.rpc('rete_vendita_albero');
        if (error) throw error;

        const albero = indicizzaAlbero(nodi || []);
        const viewerId = this.sessione?.user?.id;
        const ids = sottoalbero(albero, viewerId);
        if (ids.length < 2) return;

        let vendite = [];
        for (const blocco of dividiInBlocchi(ids, 100)) {
          const res = await db.from('vendite')
            .select('id,cliente_id,importo_vendita,stato,venditore_id,data_vendita')
            .in('venditore_id', blocco);
          if (res.error) throw res.error;
          vendite = vendite.concat(res.data || []);
        }

        const idsClienti = [...new Set(vendite.map(v => v.cliente_id).filter(Boolean))];
        const clientiPerId = {};
        for (const blocco of dividiInBlocchi(idsClienti, 100)) {
          const res = await db.from('clienti').select('*').in('id', blocco);
          if (res.error) throw res.error;
          (res.data || []).forEach(c => { clientiPerId[c.id] = c; });
        }

        this.vendutoReteHome = vendutoReteVenditore({
          albero, viewerId, vendite, clientiPerId, calcola: calcolaStatisticheVenditore
        });
      } catch (errore) {
        console.warn('Venduto di rete non disponibile:', errore?.message || errore);
      }
    },

    tornaDaRete() {
      return this.tornaIndietro();
    },

    reteAnni() {
      const anno = new Date().getFullYear();
      return [anno]; // solo l'anno in corso: niente storico per ora
    },

    async reteSelezionaAnno(anno) {
      this.reteAnno = anno;
      await this.caricaRete();
    },

    // Carica albero, quote, vendite, clienti e incassi dell'anno. Tutto passa
    // dalla RLS e dalle due funzioni rete_vendita_* : ognuno vede solo il suo ramo.
    async caricaRete() {
      this.erroreRete = '';
      this.caricandoRete = true;

      try {
        const db = window.supabaseClient;
        const { data: nodi, error: erroreAlbero } = await db.rpc('rete_vendita_albero');
        if (erroreAlbero) throw erroreAlbero;

        const albero = indicizzaAlbero(nodi || []);
        const ids = albero.ordine;
        if (!ids.length) {
          this.reteNodi = [];
          this.reteStatistiche = {};
          this.reteSelezionati = [];
          return;
        }

        const [partecipazioni, venditeDirette, incassi, quoteRete] = await Promise.all([
          db.from('vendita_partecipanti').select('vendita_id,profilo_id,quota_finale').in('profilo_id', ids),
          db.from('vendite')
            .select('id,cliente_id,importo_vendita,stato,venditore_id,data_vendita')
            .in('venditore_id', ids),
          db.rpc('rete_vendita_incassi', { p_anno: this.reteAnno }),
          // Quote di rete: la RLS ritorna righe solo a chi le riceve e ad admin/developer.
          db.from('pagamento_quote_rete')
            .select('a_profilo_id,da_profilo_id,importo')
            .gte('creato_il', this.reteAnno + '-01-01')
            .lt('creato_il', (this.reteAnno + 1) + '-01-01')
        ]);
        const errore = partecipazioni.error || venditeDirette.error || incassi.error || quoteRete.error;
        if (errore) throw errore;

        // Vendite a cui partecipano ma di cui non sono venditori (quote condivise).
        const idsDirette = new Set((venditeDirette.data || []).map(v => v.id));
        const idsExtra = [...new Set((partecipazioni.data || []).map(p => p.vendita_id))]
          .filter(id => !idsDirette.has(id));
        let venditeExtra = [];
        for (const blocco of dividiInBlocchi(idsExtra, 100)) {
          const { data, error } = await db.from('vendite')
            .select('id,cliente_id,importo_vendita,stato,venditore_id,data_vendita')
            .in('id', blocco);
          if (error) throw error;
          venditeExtra = venditeExtra.concat(data || []);
        }
        const vendite = (venditeDirette.data || []).concat(venditeExtra);

        // Il valore contratto dipende dal cliente (canone e periodicita).
        const idsClienti = [...new Set(vendite.map(v => v.cliente_id).filter(Boolean))];
        const clientiPerId = {};
        for (const blocco of dividiInBlocchi(idsClienti, 100)) {
          const { data, error } = await db.from('clienti').select('*').in('id', blocco);
          if (error) throw error;
          (data || []).forEach(c => { clientiPerId[c.id] = c; });
        }

        this.reteNodi = nodi;
        this.reteQuoteRete = aggregaQuoteRete(quoteRete.data || [], albero);
        await this.caricaInvitiPendenti();
        this.reteStatistiche = calcolaStatisticheRete({
          albero,
          vendite,
          partecipazioni: partecipazioni.data || [],
          incassi: incassi.data || [],
          clientiPerId,
          calcola: calcolaStatisticheVenditore
        });
        // Cambiare anno non deve azzerare il filtro: si tengono le spunte ancora valide.
        const spunteValide = this.reteSelezionati.filter(id => albero.perId[id]);
        this.reteSelezionati = spunteValide.length ? spunteValide : ids.slice();
        if (this.reteFocusId && !albero.perId[this.reteFocusId]) this.reteFocusId = null;
      } catch (errore) {
        console.warn('Rete vendita non disponibile:', errore?.message || errore);
        this.erroreRete = 'Non riesco a caricare la rete vendita. Riprova tra poco.';
      } finally {
        this.caricandoRete = false;
      }
    },

    reteAlbero() {
      return indicizzaAlbero(this.reteNodi);
    },

    reteHaSottoposti() {
      return this.reteNodi.length > 1;
    },

    reteVista() {
      return riepilogoRete({
        albero: this.reteAlbero(),
        statistiche: this.reteStatistiche,
        selezionati: this.reteSelezionati,
        focusId: this.reteFocusId
      });
    },

    reteMarkup() {
      const vista = this.reteVista();
      return markupAlberoRete({
        albero: this.reteAlbero(),
        statistiche: this.reteStatistiche,
        visibili: vista.visibili,
        centro: vista.centro,
        viewerId: this.sessione?.user?.id || null,
        pendenti: new Set(this.reteInvitiPendenti || []),
        reinviabili: new Set(this.reteNodiReinviabili()),
        quoteRete: this.reteQuoteRete || {}
      });
    },

    // ----- Aggiungi venditore (le regole vere stanno nella Edge Function) -----
    // Livello assoluto dell'utente nell'albero; null per Tomas (developer non e' un nodo).
    reteMioLivello() {
      const io = this.sessione?.user?.id;
      return this.reteNodi.find(n => n.id === io)?.livello ?? null;
    },

    // Tomas: developer o admin, non e' un nodo dell'albero e sceglie lui "sotto chi".
    ruoloFuoriAlbero() {
      return this.profilo?.ruolo === 'developer' || this.profilo?.ruolo === 'admin';
    },

    // Pulsante visibile solo a chi puo' creare: lv1 e lv2 (un lv3 non vede niente) e Tomas.
    reteMiPuoCreare() {
      if (this.ruoloFuoriAlbero()) return true;
      const livello = this.reteMioLivello();
      return livello !== null && livello < 3;
    },

    // Per Tomas: i nodi sotto cui si puo' ancora creare (lv1 e lv2).
    reteResponsabiliScelta() {
      return this.reteNodi.filter(n => n.livello < 3);
    },

    // Chi puo' avere "Reinvia": Tomas su chiunque, gli altri solo sui propri diretti.
    reteNodiReinviabili() {
      const io = this.sessione?.user?.id;
      const dev = this.ruoloFuoriAlbero();
      return this.reteNodi.filter(n => dev || n.responsabile_id === io).map(n => n.id);
    },

    async caricaInvitiPendenti() {
      // Solo un'etichetta: se non si carica la rete resta usabile.
      try {
        const { data, error } = await window.supabaseClient.rpc('rete_vendita_inviti_pendenti');
        if (error) throw error;
        this.reteInvitiPendenti = data || [];
      } catch (errore) {
        console.warn('Inviti in attesa non disponibili:', errore?.message || errore);
        this.reteInvitiPendenti = [];
      }
    },

    reteEtichettaTotale() {
      const vista = this.reteVista();
      const albero = this.reteAlbero();
      const filtrato = this.reteSelezionati.length < albero.ordine.length;
      if (this.reteFocusId) {
        const nome = albero.perId[this.reteFocusId].nome;
        return vista.visibili.length > 1 ? 'Venduto di ' + nome + ' e team' : 'Venduto di ' + nome;
      }
      return filtrato ? 'Venduto dei venditori scelti' : 'Venduto di rete';
    },

    reteEtichettaDiretto() {
      const albero = this.reteAlbero();
      const centro = this.reteVista().centro;
      if (!centro) return 'Diretto';
      return centro === this.sessione?.user?.id ? 'Tuo diretto' : 'Diretto di ' + albero.perId[centro].nome;
    },

    retePercentualeDiretto() {
      const vista = this.reteVista();
      return vista.venduto ? Math.round(vista.diretto / vista.venduto * 100) : 0;
    },

    retePercorso() {
      const albero = this.reteAlbero();
      if (!this.reteFocusId) return [];
      return percorsoNodo(albero, this.reteFocusId).map((id, i) => ({
        id,
        etichetta: i === 0 ? 'Tutta la rete' : albero.perId[id].nome
      }));
    },

    reteEntra(evento) {
      const reinvia = evento.target.closest('button[data-reinvia]');
      if (reinvia) {
        this.reinviaInvito(reinvia.dataset.reinvia);
        return;
      }
      const nodo = evento.target.closest('button.rete-node');
      if (nodo) this.reteFocusId = nodo.dataset.id;
    },

    reteVaiA(id) {
      const albero = this.reteAlbero();
      // Tornare al primo nodo del percorso significa "tutta la rete".
      this.reteFocusId = id === albero.radici[0] ? null : id;
    },

    reteCapFiltro() {
      const totale = this.reteNodi.length;
      const scelti = this.reteSelezionati.length;
      if (scelti === totale) return 'Tutti (' + totale + ')';
      if (scelti === 1) return this.reteAlbero().perId[this.reteSelezionati[0]]?.nome || '1';
      return scelti + ' di ' + totale;
    },

    reteApriFoglio() {
      this.reteFoglioTmp = this.reteSelezionati.slice();
      this.reteRicerca = '';
      this.reteFoglioAperto = true;
      this.bloccaScrollApp(true);
    },

    reteChiudiFoglio() {
      this.reteFoglioAperto = false;
      this.bloccaScrollApp(false);
    },

    reteElencoFoglio() {
      const albero = this.reteAlbero();
      const testo = this.reteRicerca.trim().toLowerCase();
      return albero.ordine
        .map(id => albero.perId[id])
        .filter(n => n.nome.toLowerCase().includes(testo));
    },

    reteToggleFoglio(id) {
      this.reteFoglioTmp = this.reteFoglioTmp.includes(id)
        ? this.reteFoglioTmp.filter(x => x !== id)
        : this.reteFoglioTmp.concat(id);
    },

    reteScorciatoia(tipo) {
      const albero = this.reteAlbero();
      const io = this.sessione?.user?.id;
      if (tipo === 'tutti') this.reteFoglioTmp = albero.ordine.slice();
      else if (tipo === 'io') this.reteFoglioTmp = albero.perId[io] ? [io] : [];
      else this.reteFoglioTmp = albero.perId[io] ? sottoalbero(albero, io) : albero.ordine.slice();
    },

    reteApplicaFoglio() {
      // Nessuna spunta equivale a "tutti": una vista vuota non servirebbe a niente.
      this.reteSelezionati = this.reteFoglioTmp.length ? this.reteFoglioTmp.slice() : this.reteAlbero().ordine.slice();
      this.reteChiudiFoglio();
    }
  };

  // Funzioni pure per i test: non enumerabili, cosi Object.assign(appState, mixin)
  // non le copia nello stato di Alpine.
  Object.defineProperty(mixin, '__puri', {
    value: {
      escapaHtml, indicizzaAlbero, sottoalbero, percorsoNodo,
      calcolaStatisticheRete, riepilogoRete, markupAlberoRete, vendutoReteVenditore,
      aggregaQuoteRete
    }
  });

  return mixin;
});
