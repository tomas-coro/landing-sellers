// Copia in www/ solo i file della web app che Capacitor deve impacchettare.
// Non tocca la web app in root: GitHub Pages continua a servirla da lì.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const wwwDir = path.join(root, 'www');

const filesToCopy = ['index.html', 'manifest.json', 'service-worker.js'];
const dirsToCopy = ['css', 'js', 'icons'];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

fs.rmSync(wwwDir, { recursive: true, force: true });
fs.mkdirSync(wwwDir, { recursive: true });

for (const file of filesToCopy) {
  const src = path.join(root, file);
  if (fs.existsSync(src)) {
    copyRecursive(src, path.join(wwwDir, file));
    console.log(`copiato ${file}`);
  } else {
    console.warn(`ATTENZIONE: ${file} non trovato, saltato`);
  }
}

for (const dir of dirsToCopy) {
  const src = path.join(root, dir);
  if (fs.existsSync(src)) {
    copyRecursive(src, path.join(wwwDir, dir));
    console.log(`copiata cartella ${dir}/`);
  } else {
    console.warn(`ATTENZIONE: cartella ${dir}/ non trovata, saltata`);
  }
}

console.log('build www/ completata');
