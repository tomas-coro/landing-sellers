const { test } = require('node:test');
const assert = require('node:assert');
require('../js/app.js');
const mixin = require('../js/app-vendita.js');

// Contesto minimo: catalogo finto e configurazione con dominio, email e sicurezza.
function contesto(cfg) {
  return {
    ...mixin,
    configurazioneVendita: () => cfg,
    valoreCanoneContrattoVendita: () => 750,
    catalogoPrezzi: () => ({
      formule: { mensile: { id: 'mensile', setup: 200 }, annuale: { id: 'annuale', setup: 0 } },
      sicurezza: { prezzo: 60 },
      annuali: {
        dominioIt: { prezzo: 30 },
        dominioCom: { prezzo: 40 },
        email5: { prezzo: 25 }
      }
    })
  };
}

test('il totale vendita non include dominio ed email annuali', () => {
  const c = contesto({
    formula: 'mensile', pacchetto_sicurezza: true, cliente_ha_dominio: false,
    dominio_it: 1, dominio_com: 0, email_5_caselle: 1, durata_contratto_anni: 2
  });
  // canone 750 + realizzazione 200 + sicurezza 60, senza 30 + 25 annuali
  assert.strictEqual(c.valoreTotaleContrattoStimatoVendita(), 1010);
});

test('il riepilogo separa una tantum e costi annuali a carico del cliente', () => {
  const c = contesto({
    formula: 'mensile', pacchetto_sicurezza: true, cliente_ha_dominio: false,
    dominio_it: 2, dominio_com: 0, email_5_caselle: 1
  });
  assert.deepStrictEqual(c.righeUnaTantumVendita(), [
    { descrizione: 'Realizzazione', importo: 200 },
    { descrizione: 'Sicurezza', importo: 60 }
  ]);
  assert.deepStrictEqual(c.righeAnnualiClienteVendita(), [
    { descrizione: 'Dominio .it x2', importo: 60 },
    { descrizione: 'Email 5 caselle', importo: 25 }
  ]);
});

test('se il cliente ha già il dominio non ci sono costi annuali', () => {
  const c = contesto({ formula: 'annuale', cliente_ha_dominio: true });
  assert.deepStrictEqual(c.righeAnnualiClienteVendita(), []);
});
