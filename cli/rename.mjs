#!/usr/bin/env node
// Cambia el nombre del producto en todo el proyecto (textos, comando, imagen Docker, archivos).
// Uso: node cli/rename.mjs <NombreActual> <NombreNuevo>   ej.: node cli/rename.mjs Turnos TeToca
// Reemplaza las variantes "Nombre", "nombre" y "NOMBRE". Revisa el resultado con git diff antes de confirmar.

import { readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [from, to] = process.argv.slice(2);
if (!from || !to || !/^[A-Za-z][A-Za-z0-9]*$/.test(to)) {
  console.error('Uso: node cli/rename.mjs <NombreActual> <NombreNuevo>  (solo letras y números)');
  process.exit(1);
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.quasar', 'postgres-data', 'backups', 'release']);
const SKIP_FILES = new Set(['pnpm-lock.yaml', 'LICENSE', 'rename.mjs']);
const TEXT_EXT = new Set(['.ts', '.js', '.mjs', '.vue', '.json', '.md', '.yml', '.yaml', '.html', '.scss', '.css', '.sh', '.cmd', '.example', '.txt', '']);

const variants = [
  [from, to],
  [from.toLowerCase(), to.toLowerCase()],
  [from.toUpperCase(), to.toUpperCase()],
];

const changed = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) walk(path);
      continue;
    }
    if (SKIP_FILES.has(entry) || !TEXT_EXT.has(extname(entry))) continue;
    const original = readFileSync(path, 'utf8');
    if (original.includes('\u0000')) continue;
    const updated = variants.reduce((text, [a, b]) => text.split(a).join(b), original);
    if (updated !== original) {
      writeFileSync(path, updated);
      changed.push(relative(ROOT, path));
    }
  }
};
walk(ROOT);

// Archivos con el nombre (comando, CLI, logos): turnos, turnos.cmd, cli/turnos.mjs, assets/brand/turnos-logo.png...
const renameFiles = (dir) => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) renameFiles(path);
      continue;
    }
    if (entry.includes(from.toLowerCase()))
      renameSync(path, join(dir, entry.split(from.toLowerCase()).join(to.toLowerCase())));
  }
};
renameFiles(ROOT);

console.log(`${changed.length} archivos actualizados de "${from}" a "${to}".`);
console.log('Pendiente a mano: logo e íconos en assets/brand y web/public, y el nombre del repositorio en GitHub.');
