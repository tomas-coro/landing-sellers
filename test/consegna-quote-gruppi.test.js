const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { appState } = require('../js/app.js');

const sql = fs.readFileSync('supabase/migrations/20261112130000_consegna_quote_a_gruppi.sql', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

function stato(extra = {}) {
  return { ...appState(), ...extra };
}

test('una consegna va a un solo destinatario e le miste solo una alla volta', () => {
  assert.match(sql, /count\(distinct pp\.profilo_id\)\s*\n?\s*from public\.pagamento_partecipanti pp\s*\n?\s*where pp\.id = any\(v_ids\)\s*\n?\s*\) <> 1/);
  assert.match(sql, /'misto', 'sconosciuto'\) and array_length\(p_quota_ids, 1\) > 1/);
});

test('le funzioni di consegna sono chiuse ad anon e aperte solo ad authenticated', () => {
  for (const nome of ['segna_quote_consegnate', 'annulla_consegna_gruppo', 'conferma_gruppo_consegna', 'rifiuta_gruppo_consegna', 'conferma_quote_ricevute', 'annulla_conferma_gruppo']) {
    assert.match(sql, new RegExp('revoke all on function public\\.' + nome + '\\([^)]*\\) from public, anon'));
    assert.match(sql, new RegExp('grant execute on function public\\.' + nome + '\\([^)]*\\) to authenticated'));
  }
});

test('raggruppaConsegne unisce per gruppo, somma i totali e riconosce fatturato e cash', () => {
  const s = stato();
  const righe = [
    { consegna_gruppo_id: 'g1', pagamento_id: 'p1', quota_effettiva: 420, consegnata_il: '2026-11-12T10:00:00Z' },
    { consegna_gruppo_id: 'g1', pagamento_id: 'p2', quota_effettiva: 310, consegnata_il: '2026-11-12T10:00:00Z' },
    { consegna_gruppo_id: 'g2', pagamento_id: 'p3', quota_effettiva: 140, consegnata_il: '2026-11-12T11:00:00Z' }
  ];
  const gruppi = s.raggruppaConsegne(righe, () => 'Tomas', { p1: 100, p2: 100, p3: 0 });
  assert.equal(gruppi.length, 2);
  const g1 = gruppi.find(g => g.gruppoId === 'g1');
  assert.equal(g1.totale, 730);
  assert.equal(g1.tipo, 'FATTURATO');
  assert.equal(gruppi.find(g => g.gruppoId === 'g2').tipo, 'CASH');
  assert.equal(s.etichettaConsegna(g1), '2 incassi · 1 fattura');
});

test('colore non noto o misto vale M e si consegna una quota alla volta', () => {
  const s = stato();
  assert.equal(s.tipoQuotaConsegna({ percentualeFatturata: null }), 'M');
  assert.equal(s.tipoQuotaConsegna({ percentualeFatturata: 40 }), 'M');
  assert.equal(s.tipoQuotaConsegna({ percentualeFatturata: 100 }), 'F');
  assert.equal(s.tipoQuotaConsegna({ percentualeFatturata: 0 }), 'C');
  s.foglioConsegna = { aperto: true, destinatarioId: 'a', tipo: 'M', selezionate: [] };
  s.alternaQuotaConsegna('x');
  s.alternaQuotaConsegna('y');
  assert.deepEqual(s.foglioConsegna.selezionate, ['y']);
});

test('le consegne in arrivo entrano nei contatori della pagina Quote', () => {
  const s = stato({
    trasferimentiDaConfermare: [],
    consegneInArrivo: [{ gruppoId: 'g1', totale: 910, righe: [], controparteNome: 'Alessandro' }]
  });
  assert.equal(s.numeroConsegneInArrivo(), 1);
  assert.equal(s.totaleQuoteDaConfermare(), 910);
});

test('la pagina Quote mostra consegne in corso, foglio e storico chiuso', () => {
  for (const chiave of ['consegneInArrivo', 'consegneInviate', 'foglioConsegna.aperto', 'apriFoglioConsegna()', 'confermaConsegna(g)', 'annullaConsegna(g)', 'cons-storico']) {
    assert.ok(html.includes(chiave), chiave);
  }
  assert.doesNotMatch(html, /<details class="home-attention home-today-v3 cons-storico"[^>]* open/);
});

test('la scheda cliente non offre la conferma singola su una quota in consegna', () => {
  assert.ok(html.includes('!quota.ricevuta_il && !quota.consegnata_il'));
  assert.ok(html.includes('Pagata, conferma da Quote'));
  const cliente = fs.readFileSync('js/app-cliente.js', 'utf8');
  assert.ok(cliente.includes('ricevuta_il,consegnata_il,consegna_gruppo_id'));
});
