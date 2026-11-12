const fs = require('node:fs');
const crypto = require('node:crypto');

function versioneCache() {
  const sw = fs.readFileSync('service-worker.js', 'utf8');
  return Number(sw.match(/venditori-le-shell-v(\d+)/)[1]);
}

function fileDellaShell() {
  const sw = fs.readFileSync('service-worker.js', 'utf8');
  const elenco = sw.match(/const APP_SHELL = \[([\s\S]*?)\];/)[1];
  return [...elenco.matchAll(/'\.\/([^']+)'/g)]
    .map(m => m[1])
    .filter(f => fs.existsSync(f) && fs.statSync(f).isFile())
    .sort();
}

function calcolaImpronta() {
  const hash = crypto.createHash('sha256');
  for (const file of fileDellaShell()) {
    let contenuto = fs.readFileSync(file);
    if (file === 'index.html') {
      contenuto = Buffer.from(
        contenuto.toString('utf8').replace(/service-worker\.js\?v=\d+/, 'service-worker.js?v=X')
      );
    }
    hash.update(file + '\0');
    hash.update(contenuto);
    hash.update('\0');
  }
  return hash.digest('hex');
}

module.exports = { versioneCache, fileDellaShell, calcolaImpronta };

if (require.main === module) {
  const scheda = { cache: versioneCache(), impronta: calcolaImpronta() };
  fs.writeFileSync('test/impronta-shell.json', JSON.stringify(scheda, null, 2) + '\n');
  console.log('Impronta aggiornata: cache v' + scheda.cache);
}
