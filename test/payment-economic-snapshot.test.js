const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  calcolaSnapshotPagamento
} = require('../js/economic-engine.js');

function adioroPartecipanti({
  overrideTomas = false,
  overrideNicola = false
} = {}) {
  return [
    {
      id: 'alessandro',
      nome: 'Alessandro',
      ruolo: 'referente',
      modalitaFatturazione: 'totale',
      importoFatturato: 375
    },
    {
      id: 'tomas',
      nome: 'Tomas',
      ruolo: 'produzione',
      modalitaFatturazione: 'nessuna',
      quotaOverride: overrideTomas,
      quotaEffettiva: overrideTomas ? 50 : null
    },
    {
      id: 'nicola',
      nome: 'Nicola',
      ruolo: 'venditore',
      modalitaFatturazione: 'nessuna',
      haVenduto: true,
      quotaOverride: overrideNicola,
      quotaEffettiva: overrideNicola ? 50 : null
    }
  ];
}

test('prima rata Adioro applica esplicitamente i 40 euro di costi', () => {
  const risultato = calcolaSnapshotPagamento({
    importoPagamento: 375,
    costiApplicati: [
      {
        descrizione: 'Costi iniziali',
        importo: 40
      }
    ],
    partecipanti: adioroPartecipanti()
  });

  assert.equal(risultato.margine, 335);
  assert.equal(risultato.percentualeTasse, 60);
  assert.equal(risultato.importoTasse, 201);
  assert.equal(risultato.nettoDistribuibile, 134);
  assert.equal(risultato.valido, true);
});

test('prima rata Adioro rispetta 50 euro Tomas e 50 euro Nicola e assegna il residuo ad Alessandro', () => {
  const risultato = calcolaSnapshotPagamento({
    importoPagamento: 375,
    costiApplicati: [{ importo: 40 }],
    partecipanti: adioroPartecipanti({
      overrideTomas: true,
      overrideNicola: true
    })
  });

  const alessandro = risultato.partecipanti.find(
    p => p.id === 'alessandro'
  );

  const tomas = risultato.partecipanti.find(
    p => p.id === 'tomas'
  );

  const nicola = risultato.partecipanti.find(
    p => p.id === 'nicola'
  );

  assert.equal(risultato.nettoDistribuibile, 134);
  assert.equal(tomas.quotaFinale, 50);
  assert.equal(nicola.quotaFinale, 50);
  assert.equal(alessandro.quotaFinale, 34);

  assert.ok(
    Math.abs(
      risultato.totaleQuotePagamento - 134
    ) < 0.005
  );

  assert.equal(risultato.valido, true);
});

test('Spazio52: 270 euro in contanti, 25 euro di costi proporzionali, danno 122,50 euro ciascuno', () => {
  const risultato = calcolaSnapshotPagamento({
    importoPagamento: 270,
    costiApplicati: [{ descrizione: 'Costi proporzionali', importo: 25 }],
    partecipanti: [
      {
        id: 'alessandro',
        nome: 'Alessandro',
        ruolo: 'referente',
        modalitaFatturazione: 'mista',
        importoFatturato: 135
      },
      {
        id: 'tomas',
        nome: 'Tomas',
        ruolo: 'produzione',
        modalitaFatturazione: 'nessuna'
      }
    ],
    applicaBonusVenditore: false,
    esenteTasse: true
  });

  assert.equal(risultato.importoTasse, 0);
  assert.equal(risultato.nettoDistribuibile, 245);
  assert.deepEqual(
    risultato.partecipanti.map(p => p.quotaFinale),
    [122.5, 122.5]
  );
  assert.equal(risultato.valido, true);
});

test('il motore non applica costi che il chiamante non passa alla rata', () => {
  const risultato = calcolaSnapshotPagamento({
    importoPagamento: 375,
    costiApplicati: [],
    partecipanti: adioroPartecipanti()
  });

  assert.equal(risultato.totaleCosti, 0);
  assert.equal(risultato.margine, 375);

  // Nessun costo viene copiato automaticamente dalla vendita.
  assert.deepStrictEqual(
    risultato.costiApplicati,
    []
  );
});

test('una rata può avere costi propri differenti dalla vendita', () => {
  const risultato = calcolaSnapshotPagamento({
    importoPagamento: 200,
    costiApplicati: [
      { descrizione: 'Costo specifico rata', importo: 15 }
    ],
    partecipanti: [
      {
        id: 'a',
        ruolo: 'referente',
        modalitaFatturazione: 'totale'
      },
      {
        id: 't',
        ruolo: 'produzione',
        modalitaFatturazione: 'totale'
      }
    ]
  });

  assert.equal(risultato.totaleCosti, 15);
  assert.equal(risultato.margine, 185);
});

test('override collaboratori superiori al netto rendono il pagamento non valido', () => {
  const partecipanti = adioroPartecipanti({
    overrideTomas: true,
    overrideNicola: true
  });

  partecipanti[1].quotaEffettiva = 100;
  partecipanti[2].quotaEffettiva = 100;

  const risultato = calcolaSnapshotPagamento({
    importoPagamento: 200,
    costiApplicati: [],
    partecipanti
  });

  assert.equal(risultato.valido, false);
  assert.match(
    risultato.errore,
    /superano il netto distribuibile/i
  );
});

test('la ripartizione della rata quadra sempre quando non ci sono override impossibili', () => {
  const modalita = ['nessuna', 'mista', 'totale'];

  for (const admin of modalita) {
    for (const tomas of modalita) {
      for (const venditore of modalita) {
        const partecipanti = [
          {
            id: 'a',
            ruolo: 'referente',
            modalitaFatturazione: admin,
            importoFatturato:
              admin === 'mista' ? 150 : 300
          },
          {
            id: 't',
            ruolo: 'produzione',
            modalitaFatturazione: tomas,
            importoFatturato:
              tomas === 'mista' ? 20 : 0
          },
          {
            id: 'v',
            ruolo: 'venditore',
            modalitaFatturazione: venditore,
            importoFatturato:
              venditore === 'mista' ? 20 : 0,
            haVenduto: true
          }
        ];

        const risultato = calcolaSnapshotPagamento({
          importoPagamento: 300,
          costiApplicati: [{ importo: 40 }],
          partecipanti
        });

        assert.equal(
          risultato.valido,
          true,
          `A=${admin}, T=${tomas}, V=${venditore}`
        );

        assert.ok(
          Math.abs(
            risultato.differenzaQuadraturaPagamento
          ) < 0.005
        );
      }
    }
  }
});
