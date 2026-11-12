(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.appGraficiMixin = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return {
    // ===== Grafici a linea (trend vendite) - geometria condivisa =====
    // viewBox fisso 640x200, preserveAspectRatio uniforme (mai "none":
    // deforma le etichette quando la card e' piu' stretta di 640px).
    trendVisibile(datiCompleti, range) {
      return range < 12 ? datiCompleti.slice(-range) : datiCompleti;
    },

    // Formato compatto per le etichette sempre visibili sopra i punti
    // (a differenza di formattaEuro, qui serve corto: "12k" non "12.000 €").
    formattaEuroCompatto(valore) {
      const v = Number(valore) || 0;
      if (!v) return '0€';
      if (v >= 1000) {
        const k = v / 1000;
        return (Number.isInteger(k) ? k : k.toFixed(1)) + 'k€';
      }
      return Math.round(v) + '€';
    },

    trendPuntiSerie(punti) {
      const w = 640, h = 200, pad = 28;
      if (punti.length < 2) return [];
      const maxVal = Math.max(1, ...punti.map(p => p.valore)) * 1.15;
      const stepX = (w - pad * 2) / (punti.length - 1);
      return punti.map((p, i) => ({
        x: pad + i * stepX,
        y: h - pad - (p.valore / maxVal) * (h - pad * 2 - 20),
        valore: p.valore,
        numero: p.numero || 0,
        label: p.label,
        chiave: p.chiave
      }));
    },

    trendPathLinea(punti) {
      const pts = this.trendPuntiSerie(punti);
      if (!pts.length) return '';
      return pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
    },

    trendPathArea(punti) {
      const pts = this.trendPuntiSerie(punti);
      if (!pts.length) return '';
      const h = 200, pad = 28;
      const linea = this.trendPathLinea(punti);
      const ultimo = pts[pts.length - 1];
      const primo = pts[0];
      return `${linea} L${ultimo.x},${h - pad} L${primo.x},${h - pad} Z`;
    },

    // Etichette dirette a fine linea con anti-sovrapposizione verticale:
    // se due serie finiscono a meno di 14 unita' viewBox, la piu' in alto
    // viene spinta ancora piu' su.
    trendEtichetteFinali(serie) {
      const MIN_GAP = 38;
      const etichette = serie
        .map(s => {
          const pts = this.trendPuntiSerie(s.punti);
          if (!pts.length) return null;
          const ultimo = pts[pts.length - 1];
          return {
            x: ultimo.x + 9,
            y: ultimo.y + 3,
            color: s.color,
            text: (ultimo.valore / 1000).toFixed(1) + 'k'
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.y - b.y);

      for (let i = 1; i < etichette.length; i++) {
        const gap = etichette[i].y - etichette[i - 1].y;
        if (gap < MIN_GAP) etichette[i - 1].y -= (MIN_GAP - gap);
      }
      return etichette;
    },

    trendGridLineY() {
      const h = 200, pad = 28;
      const step = (h - pad * 2 - 20) / 3;
      return [0, 1, 2, 3].map(i => pad + i * step);
    },

    trendEtichetteAsse(punti) {
      const pts = this.trendPuntiSerie(punti);
      if (!pts.length) return [];
      const passo = pts.length > 8 ? 2 : 1;
      return pts
        .filter((_, i) => (pts.length - 1 - i) % passo === 0)
        .map(p => ({ x: p.x, text: p.label, numero: p.numero }));
    },

    // ===== Tooltip dei grafici (barre + linea): condiviso da
    // disegnaMarkupBarreMensili/trendMarkupAdmin (qui) e da
    // disegnaMarkupTrendFatturato (app-fatturato.js). Il testo completo
    // "Mese · Serie · Valore · N siti" su una riga sola usciva dallo
    // schermo su mobile (viewBox 640 scalato su schermi stretti): qui si
    // spezza su piu' righe con <tspan> e si clampa la x stimando la
    // larghezza del testo, non solo il centro della barra/punto.
    tooltipXSicura(xCentro, righe) {
      const maxChar = Math.max(0, ...righe.map(r => r.length));
      const mezzaLarghezza = (maxChar * 13) / 2 + 8;
      const minX = 20 + mezzaLarghezza;
      const maxX = 620 - mezzaLarghezza;
      if (minX > maxX) return 320;
      return Math.max(minX, Math.min(maxX, xCentro));
    },

    markupTooltip(xCentro, ySopra, righe, classeExtra = '') {
      const passo = 24;
      const x = this.tooltipXSicura(xCentro, righe);
      const yBase = Math.max(20 + passo * (righe.length - 1), ySopra);
      const tspans = righe
        .map((r, i) => `<tspan x="${x.toFixed(1)}" y="${(yBase - passo * (righe.length - 1 - i)).toFixed(1)}">${r}</tspan>`)
        .join('');
      return `<text class="metrics-tooltip${classeExtra}" text-anchor="middle">${tspans}</text>`;
    },

    // ===== Grafico a barre mensile: condiviso tra il trend Home venditore
    // e la vista "Il tuo incassato". A differenza di linea+pallini ogni
    // mese occupa uno slot di larghezza fissa, quindi etichette e valori
    // non si accavallano mai anche con i font ingranditi in questa app
    // (era proprio quello il problema della linea con 12 punti ravvicinati).
    barrePuntiMensili(punti) {
      const w = 640, h = 248, padTop = 46, padBottom = 46, padSide = 16;
      const area = h - padTop - padBottom;
      const baseline = h - padBottom;
      const n = Math.max(1, punti.length);
      const slotW = (w - padSide * 2) / n;
      const barW = Math.min(slotW * 0.56, 36);
      const maxVal = Math.max(1, ...punti.map(p => p.valore));

      return punti.map((p, i) => {
        const altezza = p.valore > 0 ? Math.max(3, (p.valore / maxVal) * area) : 0;
        const x = padSide + i * slotW + (slotW - barW) / 2;
        return {
          x, w: barW, y: baseline - altezza, h: altezza, cx: x + barW / 2, baseline,
          valore: p.valore, label: p.label, chiave: p.chiave, numero: p.numero || 0
        };
      });
    },

    barreEtichetteVisibili(punti) {
      const passo = punti.length > 8 ? 2 : 1;
      return new Set(
        punti.filter((_, i) => (punti.length - 1 - i) % passo === 0).map(p => p.chiave)
      );
    },

    disegnaMarkupBarreMensili(punti, statoHoverProp, opzioni = {}) {
      if (!punti.some(p => p.valore > 0)) return '';

      const barre = this.barrePuntiMensili(punti);
      const etichetteVisibili = this.barreEtichetteVisibili(punti);
      const dark = opzioni.dark ? ' metrics-bar-dark' : '';
      const gridClass = opzioni.dark ? ' metrics-grid-line-dark' : '';
      const colore = opzioni.colore || 'var(--lime-deep)';
      const hoverIndex = this[statoHoverProp];
      const selezione = Number.isInteger(hoverIndex) && barre[hoverIndex] ? hoverIndex : null;
      const valoriInChiaro = selezione === null;
      const classeValore = punti.length > 9 ? ' metrics-bar-value-dense' : '';
      const stato = `Alpine.$data(document.getElementById('app')).${statoHoverProp}`;

      // Sfondo trasparente: toccare fuori dalle barre toglie la selezione.
      let svg = `<rect x="0" y="0" width="640" height="248" fill="transparent" onclick="${stato}=null"></rect>`;
      svg += `<line class="metrics-grid-line${gridClass}" x1="16" y1="${barre[0].baseline}" x2="624" y2="${barre[0].baseline}"></line>`;

      // Il mouse seleziona al passaggio; il tocco seleziona solo con il click
      // (con mouseenter + toggle il tocco selezionava e deselezionava subito).
      barre.forEach((b, i) => {
        const attenuata = selezione !== null && selezione !== i ? ' metrics-bar-dim' : '';
        svg += `<rect class="metrics-bar${dark}${attenuata}" x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" width="${b.w.toFixed(1)}" height="${Math.max(b.h, 1).toFixed(1)}" rx="5" style="fill:${colore}"
          onpointerenter="if(event.pointerType==='mouse')${stato}=${i}"
          onpointerleave="if(event.pointerType==='mouse')${stato}=null"
          onclick="event.stopPropagation();${stato}=${i}"></rect>`;

        // Con una barra selezionata i valori sulle altre spariscono: il valore
        // della selezionata sta nella riga fissa in alto, quindi niente testo
        // sopra le colonne che si possa fondere con le barre vicine.
        if (b.valore > 0 && valoriInChiaro) {
          svg += `<text class="metrics-bar-value${dark}${classeValore}" x="${b.cx.toFixed(1)}" y="${Math.max(20, b.y - 10).toFixed(1)}" text-anchor="middle">${this.formattaEuroCompatto(b.valore)}</text>`;
        }
        if (etichetteVisibili.has(b.chiave)) {
          svg += `<text class="metrics-bar-label${dark}${selezione === i ? ' metrics-bar-label-on' : ''}" x="${b.cx.toFixed(1)}" y="${(b.baseline + 26).toFixed(1)}" text-anchor="middle">${b.label}</text>`;
        }
      });

      if (selezione !== null) {
        const b = barre[selezione];
        const dettaglio = b.numero ? ' · ' + b.numero + ' sit' + (b.numero === 1 ? 'o' : 'i') : '';
        svg += `<text class="metrics-readout${dark}" x="320" y="26" text-anchor="middle">${b.label} · ${formattaEuro(b.valore)}${dettaglio}</text>`;
      }

      return svg;
    },

    // ===== Rendering SVG dei due grafici trend =====
    // Alpine x-for/x-if con <template> DENTRO <svg> non funziona (verificato:
    // il parser HTML non popola .content sul <template> in contesto SVG
    // foreign-content, Alpine lancia "Cannot read properties of undefined
    // (reading 'children')"). Si genera quindi la marcatura SVG come stringa
    // e si lega con x-html sull'elemento <svg>; l'hover/click sui punti usa
    // handler inline (non window.addEventListener, per non ripetere il bug
    // di doppia registrazione gia' documentato altrove in questo file) che
    // scrivono direttamente sullo stato Alpine via Alpine.$data(...).
    trendMarkupVenditore() {
      const punti = this.trendVisibile(this.trendDatiVenditore, this.trendRangeVenditore);
      return this.disegnaMarkupBarreMensili(punti, 'trendHoverVenditore', {
        dark: true,
        colore: 'var(--lime)'
      });
    },

    // Serie scelta con i chip (Tutti / venditore); se sparisce dai dati
    // (ricarico, venditore uscito dai primi 3) si torna al totale.
    trendSerieAdminScelta() {
      return this.trendDatiAdmin.find(s => s.id === this.trendSerieAdminId)
        || this.trendDatiAdmin[0]
        || { id: 'totale', nome: 'Totale', punti: [] };
    },

    impostaSerieTrendAdmin(id) {
      this.trendSerieAdminId = id;
      this.trendHoverAdmin = null;
    },

    // Stesso grafico a barre del venditore (disegnaMarkupBarreMensili):
    // una serie alla volta, valori visibili sopra le barre, tocco = dettaglio.
    trendMarkupAdmin() {
      const serie = this.trendSerieAdminScelta();
      const punti = this.trendVisibile(serie.punti, this.trendRangeAdmin);
      return this.disegnaMarkupBarreMensili(punti, 'trendHoverAdmin', { colore: 'var(--lime-deep)' });
    }
  };
});
