const { test } = require('node:test');
const assert = require('node:assert');
const { filtroVenditoreClienti } = require('../js/app.js');

test('un venditore non filtra i clienti prima delle regole RLS', () => {
  assert.strictEqual(filtroVenditoreClienti(false, ''), '');
});

test('un admin può filtrare la dashboard per venditore', () => {
  assert.strictEqual(filtroVenditoreClienti(true, 'venditore-1'), 'venditore-1');
});
