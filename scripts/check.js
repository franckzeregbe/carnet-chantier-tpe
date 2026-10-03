// Vérifie la syntaxe de tous les fichiers JS de l'application.
import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const fichiers = ['sw.js', ...readdirSync('js').filter((f) => f.endsWith('.js')).map((f) => join('js', f)),
  ...readdirSync('js/views').map((f) => join('js', 'views', f))];
let erreurs = 0;
for (const f of fichiers) {
  const type = f === 'sw.js' ? 'commonjs' : 'module';
  const r = spawnSync(process.execPath, [`--input-type=${type}`, '--check'], { input: readFileSync(f) });
  if (r.status !== 0) {
    erreurs += 1;
    console.error(`✗ ${f}\n${r.stderr}`);
  }
}
// Le cache hors ligne doit contenir tous les fichiers de l'app, avec les mêmes ?v= que index.html.
const sw = readFileSync('sw.js', 'utf8');
const index = readFileSync('index.html', 'utf8');
const enCache = new Set([...sw.matchAll(/^\s*'([^']+)',$/gm)].map((m) => m[1]));
for (const f of fichiers.filter((x) => x !== 'sw.js').map((x) => x.replace(/\\/g, '/'))) {
  if (![...enCache].some((c) => c.split('?')[0] === f)) {
    erreurs += 1;
    console.error(`✗ ${f} absent de la liste FICHIERS de sw.js (l'app planterait hors ligne)`);
  }
}
for (const ref of index.matchAll(/(?:href|src)="((?:css|js)\/[^"]+)"/g)) {
  if (!enCache.has(ref[1])) {
    erreurs += 1;
    console.error(`✗ ${ref[1]} (index.html) ne correspond à aucune entrée de sw.js : vérifie le ?v=`);
  }
}

console.log(erreurs ? `${erreurs} problème(s)` : `${fichiers.length} fichiers OK, cache hors ligne complet`);
process.exit(erreurs ? 1 : 0);
