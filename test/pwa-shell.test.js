const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const serviceWorker = fs.readFileSync('service-worker.js', 'utf8');

test('le dipendenze necessarie all’avvio sono locali e disponibili offline', () => {
  for (const file of [
    'js/vendor/supabase-2.117.1.min.js',
    'js/vendor/alpine-3.17.4.min.js'
  ]) {
    assert.match(html, new RegExp(`src=["']${file}["']`));
    assert.match(serviceWorker, new RegExp(`['"]\\./${file}['"]`));
    assert.ok(fs.statSync(file).size > 1000, `${file} è vuoto o mancante`);
  }

  assert.doesNotMatch(html, /cdn\.jsdelivr\.net/);
});

test('la registrazione usa la stessa versione della cache', () => {
  const cacheVersion = serviceWorker.match(/venditori-le-shell-v(\d+)/)?.[1];
  const registrationVersion = html.match(/service-worker\.js\?v=(\d+)/)?.[1];
  assert.strictEqual(registrationVersion, cacheVersion);
});
