const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/style.css', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');
const migration = fs.readFileSync(
  'supabase/migrations/20261017190000_codice_referente.sql',
  'utf8'
);
const migrationCodiciProgressivi = fs.readFileSync(
  'supabase/migrations/20261017200000_codici_referente_progressivi.sql',
  'utf8'
);

test('il profilo carica e mostra il codice referente stabile', () => {
  assert.match(migration, /add column if not exists codice_referente text/);
  assert.match(migration, /generated always as/);
  assert.match(migration, /create unique index if not exists profili_codice_referente_unique/);
  assert.match(app, /username,avatar_url,codice_referente/);
  assert.match(html, /Codice referente/);
  assert.match(html, /x-text="profilo\.codice_referente"/);
});

test('i codici referente usano nome e progressivo con le due eccezioni concordate', () => {
  assert.match(migrationCodiciProgressivi, /alter column codice_referente drop expression/);
  assert.match(migrationCodiciProgressivi, /'Nicola001'/);
  assert.match(migrationCodiciProgressivi, /'Nicholas002'/);
  assert.match(migrationCodiciProgressivi, /'Selim003'/);
  assert.match(migrationCodiciProgressivi, /'LandingTop000'/);
  assert.match(migrationCodiciProgressivi, /'LandingDev000'/);
  assert.match(migrationCodiciProgressivi, /create trigger trg_assegna_codice_referente/);
  assert.match(migrationCodiciProgressivi, /nextval\('public\.codice_referente_seq'/);
});

test('la foto zoomata è contenuta separatamente dal badge più', () => {
  assert.match(html, /class="profile-avatar-media"/);
  assert.match(css, /\.profile-avatar-media\s*\{[^}]*overflow:hidden[^}]*border-radius:inherit/s);
  assert.match(css, /\.profile-avatar-edit i\s*\{[^}]*align-items:center[^}]*justify-content:center/s);
  assert.match(html, /<svg x-show="!avatarCaricando"[^>]*>[\s\S]*M12 5v14M5 12h14/);
});
