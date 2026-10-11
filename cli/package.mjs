#!/usr/bin/env node
// Arma el paquete de instalación (sin código fuente) para GitHub Releases.
// Uso: node cli/package.mjs 1.0.0   →   release/turnos-1.0.0/

import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const version = (process.argv[2] || '').replace(/^v/, '');
if (!/^\d+\.\d+\.\d+/.test(version)) {
  console.error('Uso: node cli/package.mjs <versión>   (ej. 1.0.0)');
  process.exit(1);
}

const name = `turnos-${version}`;
const out = join(ROOT, 'release', name);
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'cli'), { recursive: true });

for (const file of ['turnos', 'turnos.cmd', 'cli/turnos.mjs', '.env.example', 'LICENSE', 'NOTICE'])
  copyFileSync(join(ROOT, file), join(out, file));
chmodSync(join(out, 'turnos'), 0o755);

// Sin código fuente no hay qué compilar: la imagen siempre se descarga
const compose = readFileSync(join(ROOT, 'docker-compose.yml'), 'utf8').replace(/^\s+build: \.\r?\n/m, '');
if (compose.includes('build:')) throw new Error('docker-compose.yml: no se pudo quitar "build"');
writeFileSync(join(out, 'docker-compose.yml'), compose);

writeFileSync(
  join(out, 'INSTALL.md'),
  `# Turnos ${version}

Requisito único: Docker (Docker Desktop en Windows/macOS, Docker Engine en Linux).

## Instalar

- **Windows:** abre esta carpeta en la terminal y ejecuta \`turnos install\` (en PowerShell: \`.\\turnos install\`).
- **Linux / macOS:** \`./turnos install\`

El asistente configura todo y al final muestra la dirección de la app y el usuario administrador.

## Comandos

\`turnos start\` · \`stop\` · \`status\` · \`logs\` · \`backup\` · \`restore <archivo>\` · \`update\` · \`config\` · \`db\` · \`help\`

Documentación completa: https://github.com/jmobandod2000/turnos

---

**English:** the only requirement is Docker. Run \`turnos install\` (Windows) or \`./turnos install\` (Linux/macOS) and follow the wizard. Set \`TURNOS_LANG=en\` for English prompts.
`,
);

if (!existsSync(join(out, 'docker-compose.yml'))) process.exit(1);
console.log(`Paquete listo: ${out}`);
