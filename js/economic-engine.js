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

    if (!collaboratori.length) return 40;

    return collaboratori.every(
      partecipante =>
        modalitaValida(partecipante.modalitaFatturazione) === 'nessuna'
    )
      ? 60
      : 40;
  }

  function calcolaRipartizioneEconomica({
    importoVendita = 0,
    costi = [],
    partecipanti = [],
    percentualeRiduzioneNoFattura = 20
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

    const tassePercentuali = percentualeTasse(persone);

    const importoFatturatoAdmin = referente
      ? importoFatturatoSoggetto(referente, vendita)
      : 0;

    const percentualeFatturataAdmin = vendita > 0
      ? importoFatturatoAdmin / vendita
      : 0;

    const incidenzaTasse =
      (tassePercentuali / 100) * percentualeFatturataAdmin;

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
      numeroPartecipanti === 2 && venditore
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

    function percentualeNonFatturata(partecipante, quota) {
      if (!quota) return 0;

      const fatturato = importoFatturatoSoggetto(
        partecipante,
        quota
      );

      return limita(
        (quota - fatturato) / quota,
        0,
        1
      );
    }

    function riduzioneNoFattura(partecipante, quota) {
      if (
        partecipante.ruolo === 'referente' ||
        tassePercentuali === 60
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
        percentualeFatturataAdmin *
        percentualeNonFatturata(partecipante, quota) *
        (riduzione / 100)
      );
    }

    const provvisori = persone.map(partecipante => {
      const teorica = quotaTeorica(partecipante);
      const fatturato = partecipante.ruolo === 'referente'
        ? importoFatturatoAdmin
        : importoFatturatoSoggetto(partecipante, teorica);

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

        quotaBaseLorda: arrotonda(partecipante.quotaBaseLorda),
        quotaBase: arrotonda(partecipante.quotaBase),
        quotaTeorica: arrotonda(partecipante.quotaTeorica),

        importoFatturato: arrotonda(
          partecipante.importoFatturato
        ),
        importoNonFatturato: arrotonda(
          partecipante.importoNonFatturato
        ),

        riduzioneNoFattura: arrotonda(
          partecipante.riduzioneNoFattura
        ),

        bonusAdmin:
          partecipante.ruolo === 'referente'
            ? arrotonda(bonusAdmin)
            : 0,

        quotaCalcolata: arrotonda(quotaCalcolata),
        quotaOverride: !!partecipante.quotaOverride,
        quotaFinale: arrotonda(quotaFinale)
      };
    });

    const totaleQuote = arrotonda(
      risultati.reduce(
        (totale, partecipante) =>
          totale + partecipante.quotaFinale,
        0
      )
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

  return {
    arrotonda,
    totaleCosti,
    percentualeTasse,
    calcolaRipartizioneEconomica
  };
});
