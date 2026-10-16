const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const funzione = path.join(__dirname, '../supabase/functions/admin-crea-profilo');
let regole;
test.before(async () => {
  // Node 24 carica direttamente il .ts (solo sintassi cancellabile).
  regole = await import(path.join(funzione, 'regole.ts'));
});

test('lv1 crea sotto di se', () => {
  const e = regole.responsabileDelNuovo('ale', 'venditore', 1, null, null);
  assert.deepEqual(e, { ok: true, responsabileId: 'ale' });
});

test('lv2 crea sotto di se', () => {
  const e = regole.responsabileDelNuovo('nic', 'venditore', 2, null, null);
  assert.deepEqual(e, { ok: true, responsabileId: 'nic' });
});

test('lv3 non puo creare (tetto lv3)', () => {
  const e = regole.responsabileDelNuovo('sel', 'venditore', 3, null, null);
  assert.equal(e.ok, false);
  assert.equal(e.status, 403);
});

test('chi non e nell albero non puo creare', () => {
  const e = regole.responsabileDelNuovo('x', 'venditore', null, null, null);
  assert.equal(e.ok, false);
  assert.equal(e.status, 403);
});

test('lv1 non puo piazzare un lv3 sotto Nicola passando responsabile_id', () => {
  const e = regole.responsabileDelNuovo('ale', 'venditore', 1, 'nic', 2);
  assert.equal(e.ok, false);
  assert.equal(e.status, 403);
});

test('lv2 passare se stesso come responsabile e ammesso', () => {
  const e = regole.responsabileDelNuovo('nic', 'venditore', 2, 'nic', null);
  assert.deepEqual(e, { ok: true, responsabileId: 'nic' });
});

test('developer sceglie il responsabile ma non oltre lv3', () => {
  assert.deepEqual(regole.responsabileDelNuovo('tom', 'developer', null, 'nic', 2), { ok: true, responsabileId: 'nic' });
  assert.equal(regole.responsabileDelNuovo('tom', 'developer', null, 'sel', 3).status, 403);
  assert.equal(regole.responsabileDelNuovo('tom', 'developer', null, null, null).status, 400);
  assert.equal(regole.responsabileDelNuovo('tom', 'developer', null, 'fuori', null).status, 400);
});

test('admin si comporta come developer (fuori dall albero, sceglie il responsabile)', () => {
  assert.deepEqual(regole.responsabileDelNuovo('tom', 'admin', null, 'ale', 1), { ok: true, responsabileId: 'ale' });
  assert.equal(regole.responsabileDelNuovo('tom', 'admin', null, 'sel', 3).status, 403);
  assert.equal(regole.puoReinviare('tom', 'admin', null, 'qualcuno'), true);
});

test('reinvio: developer su tutti, gli altri solo sui propri diretti', () => {
  assert.equal(regole.puoReinviare('tom', 'developer', null, 'qualcuno'), true);
  assert.equal(regole.puoReinviare('nic', 'venditore', 2, 'nic'), true);
  assert.equal(regole.puoReinviare('nic', 'venditore', 2, 'nho'), false);
  assert.equal(regole.puoReinviare('x', 'venditore', null, 'x'), false);
});

test('la function usa le regole, non accetta il ruolo dal body e non e piu solo admin', () => {
  const src = fs.readFileSync(path.join(funzione, 'index.ts'), 'utf8');
  assert.match(src, /responsabileDelNuovo\(/);
  assert.match(src, /puoReinviare\(/);
  assert.doesNotMatch(src, /ruolo !== "admin"/);
  assert.doesNotMatch(src, /body\.ruolo/);
  assert.match(src, /email_confirm: true/);
});

test('migration: livello_rete solo service_role, registro con RLS', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261017140000_crea_venditori_sotto_di_te.sql'), 'utf8');
  assert.match(sql, /revoke all on function public\.livello_rete\(uuid\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.livello_rete\(uuid\) to service_role/);
  assert.match(sql, /alter table public\.registro_inviti enable row level security/);
});

// ----- Lato UI (js/app-rete.js) -----
const mixin = require('../js/app-rete.js');
const NODI = [
  { id: 'ale', nome: 'Alessandro', responsabile_id: null, livello: 1 },
  { id: 'nic', nome: 'Nicola', responsabile_id: 'ale', livello: 2 },
  { id: 'sel', nome: 'Selim', responsabile_id: 'nic', livello: 3 }
];
const come = (io, ruolo) => ({ ...mixin, reteNodi: NODI, sessione: { user: { id: io } }, profilo: { ruolo } });

test('il pulsante "Aggiungi venditore" lo vedono lv1, lv2 e Tomas, non lv3', () => {
  assert.equal(come('ale', 'venditore').reteMiPuoCreare(), true);
  assert.equal(come('nic', 'venditore').reteMiPuoCreare(), true);
  assert.equal(come('sel', 'venditore').reteMiPuoCreare(), false);
  assert.equal(come('tom', 'developer').reteMiPuoCreare(), true);
  assert.equal(come('tom', 'admin').reteMiPuoCreare(), true);
});

test('Tomas sceglie il responsabile solo tra lv1 e lv2', () => {
  assert.deepEqual(come('tom', 'developer').reteResponsabiliScelta().map(n => n.id), ['ale', 'nic']);
});

test('Reinvia solo sui propri diretti (Tomas su tutti)', () => {
  assert.deepEqual(come('ale', 'venditore').reteNodiReinviabili(), ['nic']);
  assert.deepEqual(come('nic', 'venditore').reteNodiReinviabili(), ['sel']);
  assert.deepEqual(come('tom', 'developer').reteNodiReinviabili(), ['ale', 'nic', 'sel']);
});

test('l albero mostra "invito inviato" e Reinvia solo dove consentito', () => {
  const { indicizzaAlbero, markupAlberoRete } = mixin.__puri;
  const albero = indicizzaAlbero(NODI);
  const html = markupAlberoRete({
    albero, statistiche: {}, visibili: ['ale', 'nic', 'sel'], centro: null, viewerId: 'ale',
    pendenti: new Set(['nic', 'sel']), reinviabili: new Set(['nic'])
  });
  assert.equal((html.match(/Invito inviato/g) || []).length, 2);
  assert.match(html, /data-reinvia="nic"/);
  assert.doesNotMatch(html, /data-reinvia="sel"/);
});
