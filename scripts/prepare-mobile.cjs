
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'www');

const excluded = new Set([
  '.git',
  '.github',
  'node_modules',
  'www',
  'android',
  'ios'
]);

const allowedExtensions = new Set([
  '.html',
  '.css',
  '.js',
  '.json',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.svg',
  '.gif',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.mp4',
  '.webm'
]);

function copyDirectory(source, destination) {
  fs.mkdirSync(destination, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;

    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (sourcePath === output || sourcePath.startsWith(output + path.sep)) {
      continue;
    }

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destinationPath);
      continue;
    }

    if (allowedExtensions.has(path.extname(entry.name).toLowerCase())) {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

const requiredFiles = [
  'index.html',
  'style.css',
  'app.js'
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    throw new Error('Fichier indispensable introuvable : ' + file);
  }
}

fs.mkdirSync(output, { recursive: true });
copyDirectory(root, output);

console.log('Préparation mobile terminée.');
console.log('Les fichiers web ont été copiés dans www/.');
