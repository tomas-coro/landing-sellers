const { test } = require('node:test');
const assert = require('node:assert');
const {
  filtroVenditoreClienti,
  ultimiClienti,
  filtraClientiVenditore,
  filtroVenditoreTeamIniziale,
  profiloVedeTuttiPerDefault,
  profiloHaAccessoGlobaleClienti,
  nomeVenditoreCliente,
  clientiHomeProfilo,
  appState
} = require('../js/app.js');

test('un venditore non filtra i clienti prima delle regole RLS', () => {
  assert.strictEqual(filtroVenditoreClienti(false, ''), '');
});

test('la barra clienti conta e azzera solo i filtri modificabili', () => {
  const stato = appState();
  stato.venditoriTeam = [{ id: 'a' }, { id: 'b' }];
  stato.filtroStato = 'brief_mandato';
  stato.filtroVenditoreTeamId = 'a';
  stato.filtroSoloRitardo = true;

  assert.strictEqual(stato.numeroFiltriClientiAttivi(), 3);
  stato.azzeraFiltriClienti();
  assert.strictEqual(stato.numeroFiltriClientiAttivi(), 0);
  assert.strictEqual(stato.paginaClienti, 1);
});

test('un admin può filtrare la dashboard per venditore', () => {
  assert.strictEqual(filtroVenditoreClienti(true, 'venditore-1'), 'venditore-1');
});

test('la home mostra solo gli ultimi cinque clienti senza mutare la lista', () => {
  const clienti = Array.from({ length: 7 }, (_, i) => ({ id: i, creato_il: `2026-09-0${i + 1}` }));
  assert.deepStrictEqual(ultimiClienti(clienti).map(c => c.id), [6, 5, 4, 3, 2]);
  assert.deepStrictEqual(clienti.map(c => c.id), [0, 1, 2, 3, 4, 5, 6]);
});

test('di default ognuno parte dai propri clienti, solo Tomas parte da tutti', () => {
  assert.strictEqual(
    filtroVenditoreTeamIniziale([{ id: 'nicholas' }, { id: 'selim' }], 'nicholas'),
    'nicholas'
  );
  assert.strictEqual(profiloVedeTuttiPerDefault({ ruolo: 'developer' }), true);
  assert.strictEqual(
    profiloVedeTuttiPerDefault({ ruolo: 'venditore', ruolo_economico: 'referente' }),
    false
  );
  assert.strictEqual(
    filtroVenditoreTeamIniziale([{ id: 'nicola' }], 'nicola'),
    'nicola'
  );
  assert.strictEqual(
    filtroVenditoreTeamIniziale([{ id: 'tomas' }], 'tomas', true),
    ''
  );
});

test('solo Tomas e Alessandro hanno accesso globale ai clienti', () => {
  assert.strictEqual(profiloHaAccessoGlobaleClienti({ ruolo: 'developer' }), true);
  assert.strictEqual(profiloHaAccessoGlobaleClienti({ ruolo: 'venditore', ruolo_economico: 'referente' }), true);
  assert.strictEqual(profiloHaAccessoGlobaleClienti({ ruolo: 'venditore' }), false);

  const clienti = [
    { id: 'a', venditore_id: 'alessandro' },
    { id: 'n', venditore_id: 'nicola' }
  ];

  assert.deepStrictEqual(clientiHomeProfilo(clienti, 'tomas', true), clienti);
  assert.deepStrictEqual(clientiHomeProfilo(clienti, 'alessandro', false), [clienti[0]]);
  assert.deepStrictEqual(clientiHomeProfilo(clienti, 'nicola', false), [clienti[1]]);
});

test('il filtro Tutti non nasconde clienti a chi ha accesso globale', () => {
  const stato = appState();
  stato.profilo = { ruolo: 'developer' };
  stato.venditoriTeam = [{ id: 'tomas' }, { id: 'alessandro' }];
  stato.clienti = [
    { id: 'a', venditore_id: 'alessandro' },
    { id: 'n', venditore_id: 'nicola' }
  ];
  stato.filtroVenditoreTeamId = '';

  assert.deepStrictEqual(stato.clientiFiltroVenditore(), stato.clienti);
});

test('Tomas non compare tra i filtri venditore dei clienti', () => {
  const stato = appState();
  stato.venditoriTeam = [
    { id: 't', nome: 'Tomas' },
    { id: 'a', nome: 'Alessandro' }
  ];

  assert.deepStrictEqual(stato.venditoriFiltroClienti(), [stato.venditoriTeam[1]]);
});

test('ogni cliente mostra il proprio venditore', () => {
  const venditori = [
    { id: 'tomas', nome: 'Tomas' },
    { id: 'alessandro', nome: 'Alessandro' }
  ];

  assert.strictEqual(nomeVenditoreCliente({ venditore_id: 'alessandro' }, venditori), 'Alessandro');
  assert.strictEqual(nomeVenditoreCliente({ venditore_id: 'sconosciuto' }, venditori), 'Non assegnato');
});

test('il filtro separa i clienti diretti da quelli del team', () => {
  const clienti = [
    { id: 'a', venditore_id: 'alessandro' },
    { id: 'n', venditore_id: 'nicholas' },
    { id: 's', venditore_id: 'selim' },
    { id: 'x', venditore_id: 'esterno' }
  ];

  assert.deepStrictEqual(
    filtraClientiVenditore(clienti, 'alessandro').map(c => c.id),
    ['a']
  );
  assert.deepStrictEqual(
    filtraClientiVenditore(clienti, '', ['alessandro', 'nicholas', 'selim']).map(c => c.id),
    ['a', 'n', 's']
  );
});
