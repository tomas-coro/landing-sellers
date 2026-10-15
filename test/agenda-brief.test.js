const { test } = require('node:test');
const assert = require('node:assert');
const { appState } = require('../js/app.js');

function stato(clienti, oggi = '2026-10-15') {
  const s = appState();
  s.isAdmin = false;
  s.dataISOOggi = () => oggi;
  s.clientiDiretti = () => clienti;
  s.mesiNonRegistratiCliente = () => [];
  s.scadenzePagamentoPerCliente = {};
  s.trasferimentiDaConfermare = [];
  return s;
}

test('un cliente appena creato senza data di contatto ha il brief da inviare in agenda', () => {
  const s = stato([{ id: 'c1', nome: 'Rossi', stato: 'contattato', creato_il: '2026-10-15T09:30:00Z', prossimo_contatto: null }]);
  const [e] = s.eventiAgenda();
  assert.strictEqual(e.brief, true);
  assert.strictEqual(e.tipo, 'contatto');
  assert.strictEqual(e.titolo, 'Brief da inviare');
  assert.strictEqual(e.data, '2026-10-15');
  assert.strictEqual(e.scaduto, false);
  assert.strictEqual(s.descrizioneEventoHome(e), 'Brief da inviare oggi');
});

test('il brief non mandato dopo il giorno di creazione risulta in ritardo', () => {
  const s = stato([{ id: 'c1', nome: 'Rossi', stato: 'contattato', creato_il: '2026-10-12T09:00:00Z' }]);
  const [e] = s.eventiAgenda();
  assert.strictEqual(e.scaduto, true);
  assert.strictEqual(s.descrizioneEventoHome(e), 'Brief da inviare · in ritardo');
  assert.ok(s.eventiOggiHome().some(x => x.id === 'brief-c1'));
});

test('con una data di contatto scelta resta il normale contatto, senza flag', () => {
  const s = stato([{ id: 'c2', nome: 'Bianchi', stato: 'contattato', creato_il: '2026-10-10T09:00:00Z', prossimo_contatto: '2026-10-20' }]);
  const [e] = s.eventiAgenda();
  assert.ok(!e.brief);
  assert.strictEqual(e.id, 'contatto-c2-2026-10-20');
});

test('dopo "Brief mandato" l evento sparisce e per gli admin non compare', () => {
  assert.strictEqual(stato([{ id: 'c3', nome: 'Verdi', stato: 'brief_mandato', creato_il: '2026-10-10T09:00:00Z' }]).eventiAgenda().length, 0);
  const admin = stato([{ id: 'c4', nome: 'Neri', stato: 'contattato', creato_il: '2026-10-10T09:00:00Z' }]);
  admin.isAdmin = true;
  admin.adminClienti = [{ id: 'c4', nome: 'Neri', stato: 'contattato' }];
  admin.adminVenditoriPerId = {};
  assert.strictEqual(admin.eventiAgenda().filter(e => e.brief).length, 0);
});
