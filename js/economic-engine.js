(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.EconomicEngine = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const MODALITA = new Set(['nessuna', 'mista', 'totale']);

  function numero(valore) {
    const n = Number(valore);
    return Number.isFinite(n) ? n : 0;
  }

  function limita(valore, min, max) {
    return Math.max(min, Math.min(max, valore));
  }

  function arrotonda(valore) {
    return Math.round((numero(valore) + Number.EPSILON) * 100) / 100;
  }

  function modalitaValida(valore) {
    return MODALITA.has(valore) ? valore : 'nessuna';
  }

  function normalizzaCosti(costi = []) {
    return costi.map(costo => ({
      descrizione: costo?.descrizione || '',
      importo: Math.max(0, numero(costo?.importo))
    }));
  }

  function totaleCosti(costi = []) {
    return arrotonda(
      normalizzaCosti(costi)
        .reduce((totale, costo) => totale + costo.importo, 0)
    );
  }

  function importoFatturatoSoggetto(soggetto, riferimento) {
    const quota = Math.max(0, numero(riferimento));
    const modalita = modalitaValida(soggetto?.modalitaFatturazione);

    if (modalita === 'totale') return quota;
    if (modalita === 'nessuna') return 0;

    return limita(
      numero(soggetto?.importoFatturato),
      0,
      quota
    );
  }

  function percentualeTasse(partecipanti = []) {
    const collaboratori = partecipanti.filter(
      partecipante => partecipante.ruolo !== 'referente'
    );

    // La tassa piena al 60% scatta solo quando ci sono almeno due
    // collaboratori e nessuno di loro fattura al referente. Con un
    // solo collaboratore resta al 40%: se non fattura, ci pensa la
    // riduzione -20% individuale (vedi riduzioneNoFattura) a penalizzarlo.
    if (collaboratori.length < 2) return 40;

    return collaboratori.every(
      partecipante =>
        modalitaValida(partecipante.modalitaFatturazione) === 'nessuna'
    )
      ? 60
      : 40;
  }

  // Frazione della quota teorica di un collaboratore che corrisponde
  // alla parte della vendita che il referente ha fatturato al cliente,
  // già al netto della tassa applicata su quella parte. È il valore che
  // il collaboratore fattura automaticamente al referente in modalità
  // "mista" (nessun importo manuale), ed è la base su cui si calcola
  // la riduzione -20% quando il collaboratore non fattura per niente.
  function frazioneFatturataComponente(
    percentualeFatturataAdmin,
    tassePercentuali
  ) {
    const t = tassePercentuali / 100;
    const p = limita(numero(percentualeFatturataAdmin), 0, 1);
    const denominatore = 1 - t * p;

    if (denominatore <= 0) return 0;

    return limita((p * (1 - t)) / denominatore, 0, 1);
  }

  function importoFatturatoCollaboratore(
    partecipante,
    quotaTeorica,
    frazioneFatturataAdAlessandro
  ) {
    const quota = Math.max(0, numero(quotaTeorica));
    const modalita = modalitaValida(partecipante?.modalitaFatturazione);

    if (modalita === 'totale') return quota;
    if (modalita === 'nessuna') return 0;

    return quota * frazioneFatturataAdAlessandro;
  }

  function calcolaRipartizioneEconomica({
    importoVendita = 0,
    costi = [],
    partecipanti = [],
    percentualeRiduzioneNoFattura = 20,
    applicaBonusVenditore = true,
    esenteTasse = false
  } = {}) {
    const vendita = Math.max(0, numero(importoVendita));
    const costiNormalizzati = normalizzaCosti(costi);
    const costiTotali = totaleCosti(costiNormalizzati);
    const margine = Math.max(0, vendita - costiTotali);

    const persone = partecipanti.map(partecipante => ({
      ...partecipante,
      ruolo: partecipante?.ruolo || 'collaboratore',
      modalitaFatturazione: modalitaValida(
        partecipante?.modalitaFatturazione
      )
    }));

    const referente = persone.find(p => p.ruolo === 'referente');
    const numeroPartecipanti = persone.length;

    if (!numeroPartecipanti) {
      return {
        importoVendita: arrotonda(vendita),
        costi: costiNormalizzati,
        totaleCosti: arrotonda(costiTotali),
        margine: arrotonda(margine),
        percentualeTasse: 0,
        percentualeFatturataAdmin: 0,
        importoTasse: 0,
        nettoDistribuibile: 0,
        partecipanti: [],
        totaleQuote: 0,
        differenzaQuadratura: arrotonda(margine)
      };
    }

    const tassePercentuali = esenteTasse
      ? 0
      : percentualeTasse(persone);

    const importoFatturatoAdmin = referente
      ? importoFatturatoSoggetto(referente, vendita)
      : 0;

    const percentualeFatturataAdmin = vendita > 0
      ? importoFatturatoAdmin / vendita
      : 0;

    const incidenzaTasse =
      (tassePercentuali / 100) * percentualeFatturataAdmin;

    const frazioneFatturataAdAlessandro = frazioneFatturataComponente(
      percentualeFatturataAdmin,
      tassePercentuali
    );

    const nettoDistribuibile = Math.max(
      0,
      margine * (1 - incidenzaTasse)
    );

    const importoTasse = Math.max(
      0,
      margine - nettoDistribuibile
    );

    const quotaBaseLorda = margine / numeroPartecipanti;
    const quotaBase = nettoDistribuibile / numeroPartecipanti;

    const venditore = persone.find(p => p.haVenduto);
    const bonusVenditore =
      applicaBonusVenditore && numeroPartecipanti === 2 && venditore
        ? quotaBase * 0.12
        : 0;

    function quotaTeorica(partecipante) {
      if (numeroPartecipanti !== 2 || !bonusVenditore) {
        return quotaBase;
      }

      return partecipante.haVenduto
        ? quotaBase + bonusVenditore
        : Math.max(0, quotaBase - bonusVenditore);
    }

    function riduzioneNoFattura(partecipante, quota) {
      if (
        esenteTasse ||
        partecipante.ruolo === 'referente' ||
        tassePercentuali === 60 ||
        partecipante.modalitaFatturazione !== 'nessuna'
      ) {
        return 0;
      }

      const riduzione = limita(
        numero(percentualeRiduzioneNoFattura),
        0,
        100
      );

      return (
        quota *
        frazioneFatturataAdAlessandro *
        (riduzione / 100)
      );
    }

    const provvisori = persone.map(partecipante => {
      const teorica = quotaTeorica(partecipante);
      const fatturato = partecipante.ruolo === 'referente'
        ? importoFatturatoAdmin
        : importoFatturatoCollaboratore(
            partecipante,
            teorica,
            frazioneFatturataAdAlessandro
          );

      const riduzione = riduzioneNoFattura(
        partecipante,
        teorica
      );

      return {
        ...partecipante,
        quotaBaseLorda,
        quotaBase,
        quotaTeorica: teorica,
        importoFatturato: fatturato,
        importoNonFatturato:
          partecipante.ruolo === 'referente'
            ? Math.max(0, vendita - importoFatturatoAdmin)
            : Math.max(0, teorica - fatturato),
        riduzioneNoFattura: riduzione
      };
    });

    const bonusAdmin = provvisori
      .filter(p => p.ruolo !== 'referente')
      .reduce(
        (totale, p) => totale + p.riduzioneNoFattura,
        0
      );

    const risultati = provvisori.map(partecipante => {
      const quotaCalcolata = Math.max(
        0,
        partecipante.quotaTeorica -
          partecipante.riduzioneNoFattura +
          (partecipante.ruolo === 'referente'
            ? bonusAdmin
            : 0)
      );

      const quotaFinale = partecipante.quotaOverride
        ? Math.max(0, numero(partecipante.quotaEffettiva))
        : quotaCalcolata;

      return {
        id: partecipante.id || null,
        nome: partecipante.nome || '',
        ruolo: partecipante.ruolo,
        haVenduto: !!partecipante.haVenduto,
        modalitaFatturazione:
          partecipante.modalitaFatturazione,

        // Manteniamo la precisione completa nei valori di calcolo.
        // L'arrotondamento a centesimi avviene solo quando il dato
        // viene mostrato o persistito.
        quotaBaseLorda: partecipante.quotaBaseLorda,
        quotaBase: partecipante.quotaBase,
        quotaTeorica: partecipante.quotaTeorica,

        importoFatturato: arrotonda(
          partecipante.importoFatturato
        ),
        importoNonFatturato: arrotonda(
          partecipante.importoNonFatturato
        ),

        riduzioneNoFattura:
          partecipante.riduzioneNoFattura,

        bonusAdmin:
          partecipante.ruolo === 'referente'
            ? bonusAdmin
            : 0,

        quotaCalcolata,
        quotaOverride: !!partecipante.quotaOverride,
        quotaFinale
      };
    });

    const totaleQuote = risultati.reduce(
      (totale, partecipante) =>
        totale + partecipante.quotaFinale,
      0
    );

    return {
      importoVendita: arrotonda(vendita),
      costi: costiNormalizzati,
      totaleCosti: arrotonda(costiTotali),
      margine: arrotonda(margine),

      percentualeTasse: tassePercentuali,
      percentualeFatturataAdmin:
        arrotonda(percentualeFatturataAdmin * 100),

      importoTasse: arrotonda(importoTasse),
      nettoDistribuibile: arrotonda(nettoDistribuibile),

      partecipanti: risultati,
      totaleQuote,

      differenzaQuadratura: arrotonda(
        nettoDistribuibile - totaleQuote
      )
    };
  }


  function calcolaSnapshotPagamento({
    importoPagamento = 0,
    costiApplicati = [],
    partecipanti = [],
    percentualeRiduzioneNoFattura = 20,
    applicaBonusVenditore = true,
    esenteTasse = false
  } = {}) {
    const base = calcolaRipartizioneEconomica({
      importoVendita: importoPagamento,
      costi: costiApplicati,
      partecipanti,
      percentualeRiduzioneNoFattura,
      applicaBonusVenditore,
      esenteTasse
    });

    const risultati = base.partecipanti.map(
      partecipante => ({ ...partecipante })
    );

    const referente = risultati.find(
      partecipante => partecipante.ruolo === 'referente'
    );

    if (!referente) {
      return {
        ...base,
        importoPagamento: base.importoVendita,
        costiApplicati: base.costi,
        valido: false,
        errore: 'Referente economico non trovato.',
        partecipanti: risultati
      };
    }

    const altri = risultati.filter(
      partecipante => partecipante.ruolo !== 'referente'
    );

    const totaleAltri = altri.reduce(
      (totale, partecipante) =>
        totale + partecipante.quotaFinale,
      0
    );

    // Nei pagamenti il referente assorbe il residuo economico.
    // In questo modo eventuali quote concordate/override dei
    // collaboratori non creano o distruggono denaro.
    const residuoReferente =
      base.nettoDistribuibile - totaleAltri;

    if (residuoReferente < -0.005) {
      return {
        ...base,
        importoPagamento: base.importoVendita,
        costiApplicati: base.costi,
        valido: false,
        errore:
          'Le quote dei collaboratori superano il netto distribuibile.',
        partecipanti: risultati,
        totaleQuotePagamento: totaleAltri,
        differenzaQuadraturaPagamento: residuoReferente
      };
    }

    referente.quotaFinale = Math.max(
      0,
      residuoReferente
    );

    referente.quotaEffettiva =
      referente.quotaFinale;

    const totaleQuotePagamento =
      risultati.reduce(
        (totale, partecipante) =>
          totale + partecipante.quotaFinale,
        0
      );

    const differenzaQuadraturaPagamento =
      base.nettoDistribuibile -
      totaleQuotePagamento;

    return {
      ...base,
      importoPagamento: base.importoVendita,
      costiApplicati: base.costi,

      partecipanti: risultati,

      totaleQuotePagamento,
      differenzaQuadraturaPagamento,

      valido:
        Math.abs(differenzaQuadraturaPagamento) < 0.005,

      errore:
        Math.abs(differenzaQuadraturaPagamento) < 0.005
          ? ''
          : 'La ripartizione del pagamento non quadra.'
    };
  }

  return {
    arrotonda,
    totaleCosti,
    percentualeTasse,
    calcolaRipartizioneEconomica,
    calcolaSnapshotPagamento
  };
});
