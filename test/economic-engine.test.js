const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  calcolaRipartizioneEconomica,
  percentualeTasse
} = require('../js/economic-engine.js');

function partecipanti({
  admin = 'totale',
  adminImporto = 300,
  tomas = 'nessuna',
  tomasImporto = 0,
  venditore = 'nessuna',
  venditoreImporto = 0
} = {}) {
  return [
    {
      id: 'alessandro',
      nome: 'Alessandro',
      ruolo: 'referente',
      modalitaFatturazione: admin,
      importoFatturato: adminImporto
    },
    {
      id: 'tomas',
      nome: 'Tomas',
      ruolo: 'produzione',
      modalitaFatturazione: tomas,
      importoFatturato: tomasImporto
    },
    {
      id: 'venditore',
      nome: 'Venditore',
      ruolo: 'venditore',
      modalitaFatturazione: venditore,
      importoFatturato: venditoreImporto,
      haVenduto: true
    }
  ];
}

test('nessun collaboratore fattura -> 60%', () => {
  assert.equal(
    percentualeTasse(
      partecipanti({
        tomas: 'nessuna',
        venditore: 'nessuna'
      })
    ),
    60
  );
});

test('almeno un collaboratore fattura -> 40%', () => {
  assert.equal(
    percentualeTasse(
      partecipanti({
        tomas: 'totale',
        venditore: 'nessuna'
      })
    ),
    40
  );

  assert.equal(
    percentualeTasse(
      partecipanti({
        tomas: 'nessuna',
        venditore: 'mista'
      })
    ),
    40
  );
});

test('caso attuale: 300 - 40 costi, admin totale, nessuno fattura -> 104 netti', () => {
  const r = calcolaRipartizioneEconomica({
    importoVendita: 300,
    costi: [{ descrizione: 'Costi', importo: 40 }],
    partecipanti: partecipanti({
      admin: 'totale',
      tomas: 'nessuna',
      venditore: 'nessuna'
    })
  });

  assert.equal(r.margine, 260);
  assert.equal(r.percentualeTasse, 60);
  assert.equal(r.importoTasse, 156);
  assert.equal(r.nettoDistribuibile, 104);

  assert.ok(
    Math.abs(
      r.partecipanti[0].quotaCalcolata - 34.67
    ) <= 0.01
  );
});

test('caso attuale: Tomas fattura, venditore no -> riduzione solo sul venditore', () => {
  const r = calcolaRipartizioneEconomica({
    importoVendita: 300,
    costi: [{ descrizione: 'Costi', importo: 40 }],
    partecipanti: partecipanti({
      admin: 'totale',
      tomas: 'totale',
      venditore: 'nessuna'
    })
  });

  const alessandro = r.partecipanti.find(
    p => p.id === 'alessandro'
  );
  const tomas = r.partecipanti.find(
    p => p.id === 'tomas'
  );
  const venditore = r.partecipanti.find(
    p => p.id === 'venditore'
  );

  assert.equal(r.percentualeTasse, 40);
  assert.equal(r.nettoDistribuibile, 156);

  assert.equal(tomas.quotaCalcolata, 52);
  assert.equal(venditore.quotaCalcolata, 41.6);
  assert.equal(alessandro.quotaCalcolata, 62.4);
});

test('admin non fattura -> nessuna incidenza fiscale sul margine', () => {
  const r = calcolaRipartizioneEconomica({
    importoVendita: 300,
    costi: [{ importo: 40 }],
    partecipanti: partecipanti({
      admin: 'nessuna',
      adminImporto: 0,
      tomas: 'nessuna',
      venditore: 'nessuna'
    })
  });

  assert.equal(r.margine, 260);
  assert.equal(r.nettoDistribuibile, 260);
  assert.equal(r.importoTasse, 0);
});

test('admin misto -> tassazione proporzionale alla parte fatturata', () => {
  const r = calcolaRipartizioneEconomica({
    importoVendita: 300,
    costi: [{ importo: 40 }],
    partecipanti: partecipanti({
      admin: 'mista',
      adminImporto: 150,
      tomas: 'nessuna',
      venditore: 'nessuna'
    })
  });

  assert.equal(r.percentualeFatturataAdmin, 50);
  assert.equal(r.percentualeTasse, 60);
  assert.equal(r.importoTasse, 78);
  assert.equal(r.nettoDistribuibile, 182);
});

test('fatturazione mista collaboratore agisce solo sulla parte non fatturata', () => {
  const r = calcolaRipartizioneEconomica({
    importoVendita: 300,
    costi: [{ importo: 40 }],
    partecipanti: partecipanti({
      admin: 'totale',
      tomas: 'mista',
      tomasImporto: 26,
      venditore: 'totale'
    })
  });

  const tomas = r.partecipanti.find(
    p => p.id === 'tomas'
  );

  assert.equal(r.percentualeTasse, 40);
  assert.equal(tomas.quotaTeorica, 52);
  assert.equal(tomas.importoFatturato, 26);
  assert.equal(tomas.importoNonFatturato, 26);
  assert.equal(tomas.riduzioneNoFattura, 5.2);
  assert.equal(tomas.quotaCalcolata, 46.8);
});

test('con tre partecipanti non esiste bonus venditore 12%', () => {
  const r = calcolaRipartizioneEconomica({
    importoVendita: 300,
    costi: [],
    partecipanti: partecipanti({
      admin: 'nessuna',
      tomas: 'totale',
      venditore: 'totale'
    })
  });

  assert.equal(
    r.partecipanti[1].quotaTeorica,
    r.partecipanti[2].quotaTeorica
  );
});

test('override modifica solo la quota effettiva, non il calcolo teorico', () => {
  const persone = partecipanti({
    admin: 'totale',
    tomas: 'nessuna',
    venditore: 'nessuna'
  });

  persone[1].quotaOverride = true;
  persone[1].quotaEffettiva = 50;

  const r = calcolaRipartizioneEconomica({
    importoVendita: 750,
    costi: [{ importo: 40 }],
    partecipanti: persone
  });

  const tomas = r.partecipanti.find(
    p => p.id === 'tomas'
  );

  assert.equal(tomas.quotaOverride, true);
  assert.equal(tomas.quotaFinale, 50);
  assert.notEqual(tomas.quotaCalcolata, 50);
});

test('costi non possono produrre margine negativo', () => {
  const r = calcolaRipartizioneEconomica({
    importoVendita: 100,
    costi: [{ importo: 150 }],
    partecipanti: partecipanti()
  });

  assert.equal(r.margine, 0);
  assert.equal(r.nettoDistribuibile, 0);
  assert.equal(r.totaleQuote, 0);
});

test('matrice completa delle 27 combinazioni di fatturazione', () => {
  const modalita = ['nessuna', 'mista', 'totale'];

  for (const admin of modalita) {
    for (const tomas of modalita) {
      for (const venditore of modalita) {
        const r = calcolaRipartizioneEconomica({
          importoVendita: 600,
          costi: [
            { descrizione: 'Gestione', importo: 30 },
            { descrizione: 'Dominio', importo: 10 }
          ],
          partecipanti: partecipanti({
            admin,
            adminImporto: admin === 'mista' ? 300 : 0,
            tomas,
            tomasImporto: tomas === 'mista' ? 50 : 0,
            venditore,
            venditoreImporto:
              venditore === 'mista' ? 50 : 0
          })
        });

        assert.equal(r.partecipanti.length, 3);
        assert.ok(r.margine >= 0);
        assert.ok(r.nettoDistribuibile >= 0);
        assert.ok(r.importoTasse >= 0);

        for (const p of r.partecipanti) {
          assert.ok(p.quotaCalcolata >= 0);
          assert.ok(p.quotaFinale >= 0);
          assert.ok(p.importoFatturato >= 0);
          assert.ok(p.importoNonFatturato >= 0);
        }

        // Senza override le quote devono sempre quadrare col netto.
        assert.ok(
          Math.abs(r.differenzaQuadratura) <= 0.02,
          `Quadratura fallita: A=${admin}, T=${tomas}, V=${venditore}`
        );
      }
    }
  }
});

test('Adioro: struttura fiscale reale della vendita', () => {
  const persone = [
    {
      id: 'alessandro',
      ruolo: 'referente',
      modalitaFatturazione: 'totale',
      importoFatturato: 750
    },
    {
      id: 'tomas',
      ruolo: 'produzione',
      modalitaFatturazione: 'nessuna',
      quotaOverride: true,
      quotaEffettiva: 50
    },
    {
      id: 'nicola',
      ruolo: 'venditore',
      modalitaFatturazione: 'nessuna',
      haVenduto: true,
      quotaOverride: true,
      quotaEffettiva: 50
    }
  ];

  const r = calcolaRipartizioneEconomica({
    importoVendita: 750,
    costi: [{ descrizione: 'Costi storici', importo: 40 }],
    partecipanti: persone
  });

  assert.equal(r.percentualeTasse, 60);

  const tomas = r.partecipanti.find(p => p.id === 'tomas');
  const nicola = r.partecipanti.find(p => p.id === 'nicola');

  assert.equal(tomas.quotaFinale, 50);
  assert.equal(nicola.quotaFinale, 50);
});
