const { test } = require('node:test');
const assert = require('node:assert/strict');

const { incassatoPerVenditaAnnoCorrente } = require('../js/app.js');

// La card "Incassato" in Home deve sommare solo i pagamenti incassati
// nell'anno corrente, come fa la vista di dettaglio "Il tuo incassato"
// (fatturatoAnno parte sempre dall'anno in corso). Prima del fix la card
// Home somma va l'incassato di sempre, mostrando un numero diverso da quello
// della vista di dettaglio per lo stesso venditore.
test('incassatoPerVenditaAnnoCorrente esclude i pagamenti di anni precedenti', () => {
  const righe = [
    { quota_effettiva: 200, pagamenti: { vendita_id: 'v1', data_pagamento: '2026-01-10' } },
    { quota_effettiva: 135, pagamenti: { vendita_id: 'v2', data_pagamento: '2025-11-05' } }
  ];

  const risultato = incassatoPerVenditaAnnoCorrente(righe, 2026);

  assert.equal(risultato.v1, 200);
  assert.equal(risultato.v2, undefined);
});

test('incassatoPerVenditaAnnoCorrente somma piu righe sulla stessa vendita', () => {
  const righe = [
    { quota_effettiva: 100, pagamenti: { vendita_id: 'v1', data_pagamento: '2026-02-01' } },
    { quota_effettiva: 50, pagamenti: { vendita_id: 'v1', data_pagamento: '2026-03-01' } }
  ];

  const risultato = incassatoPerVenditaAnnoCorrente(righe, 2026);

  assert.equal(risultato.v1, 150);
});

test('incassatoPerVenditaAnnoCorrente ignora righe senza vendita_id o data_pagamento', () => {
  const righe = [
    { quota_effettiva: 100, pagamenti: { vendita_id: null, data_pagamento: '2026-02-01' } },
    { quota_effettiva: 100, pagamenti: { vendita_id: 'v1', data_pagamento: null } }
  ];

  const risultato = incassatoPerVenditaAnnoCorrente(righe, 2026);

  assert.deepEqual(risultato, {});
});
