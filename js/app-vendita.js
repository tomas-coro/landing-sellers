// js/app-vendita.js
// Mixin di appState() con i metodi del dominio Vendita.
// Estratto meccanicamente da js/app.js, stesso pattern UMD-lite di js/economic-engine.js.
(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.appVenditaMixin = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return {
    configurazioneVendita() {
      return this.venditaEconomicaForm.configurazioneCommerciale;
    },

    selezionaFormulaVendita(formula) {
      const cfg = this.configurazioneVendita();

      cfg.formula = formula === 'annuale'
        ? 'annuale'
        : 'mensile';

      cfg.periodicita_contratto = cfg.formula;

      if (cfg.formula === 'annuale') {
        cfg.pacchetto_sicurezza = false;
      }

      this.aggiornaConfigurazioneVendita();
    },

    toggleUpgradeVendita(id) {
      const cfg = this.configurazioneVendita();
      const attuali = Array.isArray(cfg.upgrade)
        ? cfg.upgrade
        : [];

      cfg.upgrade = attuali.includes(id)
        ? attuali.filter(x => x !== id)
        : [...attuali, id];

      this.aggiornaConfigurazioneVendita();
    },

    setQuantitaExtraVendita(campo, delta, max) {
      const cfg = this.configurazioneVendita();
      const corrente = Number(cfg[campo]) || 0;

      cfg[campo] = Math.max(
        0,
        Math.min(max, corrente + Number(delta || 0))
      );

      this.aggiornaConfigurazioneVendita();
    },

    normalizzaQuantitaExtraVendita(campo, max) {
      const cfg = this.configurazioneVendita();

      cfg[campo] = Math.max(
        0,
        Math.min(max, Number(cfg[campo]) || 0)
      );

      this.aggiornaConfigurazioneVendita();
    },

    setDurataContrattoVendita(anni) {
      const cfg = this.configurazioneVendita();

      cfg.durata_contratto_anni = Math.max(
        1,
        Math.min(4, Number(anni) || 1)
      );

      if (
        cfg.sconto_durata_anni != null &&
        Number(cfg.sconto_durata_anni) >
          cfg.durata_contratto_anni
      ) {
        cfg.sconto_durata_anni =
          cfg.durata_contratto_anni;
      }

      this.aggiornaConfigurazioneVendita();
    },

    normalizzaScontoVendita() {
      const cfg = this.configurazioneVendita();

      let valore = Math.max(
        0,
        Number(cfg.sconto_valore) || 0
      );

      if (
        cfg.sconto_tipo === 'percentuale' &&
        valore > 100
      ) {
        valore = 100;
      }

      cfg.sconto_valore = valore;
      this.aggiornaConfigurazioneVendita();
    },

    setDurataScontoVendita(anni) {
      const cfg = this.configurazioneVendita();

      if (anni == null || anni === '') {
        cfg.sconto_durata_anni = null;
      } else {
        cfg.sconto_durata_anni = Math.max(
          1,
          Math.min(
            Number(cfg.durata_contratto_anni) || 1,
            Number(anni) || 1
          )
        );
      }

      this.aggiornaConfigurazioneVendita();
    },

    prezzoUpgradeMensileVendita() {
      const cfg = this.configurazioneVendita();
      const catalogo = this.catalogoPrezzi();

      const toggle = catalogo.upgrade
        .filter(u => (cfg.upgrade || []).includes(u.id))
        .reduce(
          (totale, u) =>
            totale + (Number(u.prezzoMensile) || 0),
          0
        );

      const pagine =
        (Number(cfg.pagine_extra) || 0) *
        (Number(catalogo.paginaExtra.prezzoMensile) || 0);

      const lingue =
        (Number(cfg.lingue_extra) || 0) *
        (Number(
          catalogo.multilingua.prezzoMensilePerLingua
        ) || 0);

      return toggle + pagine + lingue;
    },

    prezzoLordoRicorrenteVendita() {
      const cfg = this.configurazioneVendita();
      const catalogo = this.catalogoPrezzi();

      const formula =
        catalogo.formule[cfg.formula] ||
        catalogo.formule.mensile;

      const extraMensili =
        this.prezzoUpgradeMensileVendita();

      return formula.id === 'annuale'
        ? (Number(formula.prezzoBase) || 0) +
            extraMensili * 12
        : (Number(formula.prezzoBase) || 0) +
            extraMensili;
    },

    prezzoRicorrenteScontatoVendita() {
      return prezzoRicorrenteDaForm(
        this.prezzoLordoRicorrenteVendita(),
        this.configurazioneVendita()
      );
    },

    anniScontoEffettiviVendita() {
      const cfg = this.configurazioneVendita();

      if (
        !cfg.sconto_tipo ||
        Number(cfg.sconto_valore) <= 0
      ) {
        return 0;
      }

      const durata = Math.max(
        1,
        Math.min(
          4,
          Number(cfg.durata_contratto_anni) || 1
        )
      );

      if (cfg.sconto_durata_anni == null) {
        return durata;
      }

      return Math.max(
        1,
        Math.min(
          durata,
          Number(cfg.sconto_durata_anni) || 1
        )
      );
    },

    valoreCanoneContrattoVendita() {
      const cfg = this.configurazioneVendita();

      const durata = Math.max(
        1,
        Math.min(
          4,
          Number(cfg.durata_contratto_anni) || 1
        )
      );

      const lordo =
        this.prezzoLordoRicorrenteVendita();

      const scontato =
        prezzoRicorrenteDaForm(lordo, cfg);

      const anniScontati =
        this.anniScontoEffettiviVendita();

      const periodiPerAnno =
        cfg.periodicita_contratto === 'annuale'
          ? 1
          : 12;

      return (
        scontato *
          periodiPerAnno *
          anniScontati
        +
        lordo *
          periodiPerAnno *
          (durata - anniScontati)
      );
    },

    totaleAnnualiSeparatiVendita() {
      const cfg = this.configurazioneVendita();

      if (cfg.cliente_ha_dominio !== false) {
        return 0;
      }

      const annuali = this.catalogoPrezzi().annuali;

      return (
        (Number(cfg.dominio_it) || 0) * (Number(annuali.dominioIt.prezzo) || 0)
        +
        (Number(cfg.dominio_com) || 0) * (Number(annuali.dominioCom.prezzo) || 0)
        +
        (Number(cfg.email_5_caselle) || 0) * (Number(annuali.email5.prezzo) || 0)
      );
    },

    totaleUnaTantumVendita() {
      const cfg = this.configurazioneVendita();
      const catalogo = this.catalogoPrezzi();

      const formula =
        catalogo.formule[cfg.formula] ||
        catalogo.formule.mensile;

      return (
        (Number(formula.setup) || 0)
        +
        (
          formula.id === 'mensile' &&
          cfg.pacchetto_sicurezza
            ? Number(catalogo.sicurezza.prezzo) || 0
            : 0
        )
      );
    },

    valoreTotaleContrattoStimatoVendita() {
      const cfg = this.configurazioneVendita();

      const durata = Math.max(
        1,
        Math.min(
          4,
          Number(cfg.durata_contratto_anni) || 1
        )
      );

      return totaleContrattoDaForm(
        this.valoreCanoneContrattoVendita(),
        this.totaleUnaTantumVendita() +
          this.totaleAnnualiSeparatiVendita() *
            durata,
        cfg
      );
    },

    descrizioneConfigurazioneCommerciale(
      configurazione,
      fallback = '',
      usaDescrizioneSalvata = true
    ) {
      const cfg =
        configurazione &&
        typeof configurazione === 'object'
          ? configurazione
          : null;

      if (!cfg) {
        return String(fallback || '').trim();
      }

      /*
       * Le vendite nuove conservano anche la descrizione leggibile
       * nello snapshot. In consultazione questa e' prioritaria per
       * preservare esattamente il significato storico della vendita.
       */
      const salvata =
        String(cfg.descrizione_pacchetto || '').trim();

      if (usaDescrizioneSalvata && salvata) {
        return salvata;
      }

      const catalogo = this.catalogoPrezzi?.();

      if (!catalogo) {
        return String(fallback || '').trim();
      }

      const formulaId =
        cfg.formula ||
        cfg.periodicita_contratto ||
        null;

      const formula =
        catalogo.formule?.[formulaId] ||
        null;

      const voci = [];

      if (formula?.nome) {
        voci.push(formula.nome);
      }

      const upgradeSelezionati =
        Array.isArray(cfg.upgrade)
          ? cfg.upgrade
          : [];

      (catalogo.upgrade || [])
        .filter(upgrade =>
          upgradeSelezionati.includes(upgrade.id)
        )
        .forEach(upgrade => {
          if (upgrade.nome) {
            voci.push(upgrade.nome);
          }
        });

      const pagine =
        Number(cfg.pagine_extra) || 0;

      if (pagine > 0) {
        voci.push(
          `${pagine} ${
            pagine === 1
              ? 'pagina extra'
              : 'pagine extra'
          }`
        );
      }

      const lingue =
        Number(cfg.lingue_extra) || 0;

      if (lingue > 0) {
        voci.push(
          `${lingue} ${
            lingue === 1
              ? 'lingua extra'
              : 'lingue extra'
          }`
        );
      }

      /*
       * cliente_ha_dominio === false significa che il dominio/
       * servizio annuale viene acquistato tramite Landing Evolution.
       * Mostriamo solo le scelte realmente presenti nello snapshot.
       */
      if (cfg.cliente_ha_dominio === false) {
        const annuali = catalogo.annuali || {};

        const qtaIt =
          Number(cfg.dominio_it) || 0;

        const qtaCom =
          Number(cfg.dominio_com) || 0;

        const qtaEmail =
          Number(cfg.email_5_caselle) || 0;

        if (qtaIt > 0 && annuali.dominioIt?.nome) {
          voci.push(
            `${annuali.dominioIt.nome}${
              qtaIt > 1 ? ` x${qtaIt}` : ''
            }`
          );
        }

        if (qtaCom > 0 && annuali.dominioCom?.nome) {
          voci.push(
            `${annuali.dominioCom.nome}${
              qtaCom > 1 ? ` x${qtaCom}` : ''
            }`
          );
        }

        if (
          qtaEmail > 0 &&
          annuali.email5?.nome
        ) {
          voci.push(
            `${annuali.email5.nome}${
              qtaEmail > 1
                ? ` x${qtaEmail}`
                : ''
            }`
          );
        }
      }

      if (
        formula?.id === 'mensile' &&
        cfg.pacchetto_sicurezza &&
        catalogo.sicurezza?.nome
      ) {
        voci.push(catalogo.sicurezza.nome);
      }

      /*
       * Non inventiamo una descrizione se lo snapshot non contiene
       * abbastanza informazioni: in quel caso resta il testo storico.
       */
      return voci.length
        ? voci.join(' + ')
        : String(fallback || '').trim();
    },

    nomePacchettoVendita() {
      return this.descrizioneConfigurazioneCommerciale(
        this.configurazioneVendita(),
        '',
        false
      );
    },

    aggiornaConfigurazioneVendita() {
      const cfg = this.configurazioneVendita();

      if (!cfg) return;

      cfg.periodicita_contratto =
        cfg.formula === 'annuale'
          ? 'annuale'
          : 'mensile';

      if (cfg.formula === 'annuale') {
        cfg.pacchetto_sicurezza = false;
      }

      const descrizionePacchetto =
        this.nomePacchettoVendita();

      /*
       * Congela anche la descrizione leggibile nello snapshot:
       * in futuro eventuali rinominazioni del catalogo non alterano
       * la descrizione storica della vendita.
       */
      cfg.descrizione_pacchetto =
        descrizionePacchetto;

      this.venditaEconomicaForm.servizio =
        descrizionePacchetto;

      /*
       * Valore economico complessivo della vendita.
       * La configurazione resta mensile/annuale, ma quote,
       * margine e ripartizione lavorano sul valore contratto.
       */
      this.venditaEconomicaForm.importoVendita =
        this.valoreTotaleContrattoStimatoVendita();

      const automatici = costiGestioneCliente(
        cfg,
        false
      ).map((costo, indice) => ({
        id: `automatico-${indice}-${costo.descrizione}`,
        descrizione: costo.descrizione,
        importo: Number(costo.importo) || 0,
        automatico: true
      }));

      /*
       * Evita di mantenere come "manuale" una vecchia copia
       * dello stesso costo automatico.
       */
      const firmeAutomatiche = new Set(
        automatici.map(costo =>
          `${costo.descrizione}::${Number(costo.importo) || 0}`
        )
      );

      const manuali = (
        this.venditaEconomicaForm.costi || []
      ).filter(costo => {
        if (costo.automatico) return false;

        const firma =
          `${costo.descrizione}::${Number(costo.importo) || 0}`;

        return !firmeAutomatiche.has(firma);
      });

      this.venditaEconomicaForm.costi = [
        ...automatici,
        ...manuali
      ];
    },
  };
});
