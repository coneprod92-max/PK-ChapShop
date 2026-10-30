
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'www');

const files = [
  'index.html',
  'admin.html',
  'admin.js',
  'advertiser.js',
  'annonceur.html',
  'app.js',
  'cart.html',
  'cart.js',
  'featured-carousel.js',
  'merchant.html',
  'merchant.js',
  'store.html',
  'store.js',
  'style.css',
  'tracking.html',
  'tracking.js'
];

if (!fs.existsSync(path.join(root, 'index.html'))) {
  throw new Error('La page index.html est introuvable.');
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const relativePath of files) {
  const source = path.join(root, relativePath);

  if (!fs.existsSync(source)) {
    throw new Error('Fichier source introuvable : ' + relativePath);
  }

  fs.copyFileSync(source, path.join(output, relativePath));
}

console.log(
  'Préparation mobile terminée : ' +
  files.length +
  ' fichiers copiés dans www/.'
);
