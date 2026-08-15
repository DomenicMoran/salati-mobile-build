#!/usr/bin/env node
// Orchestriert store-screenshots.mjs fuer alle 6 App-Sprachen gegen den
// bereits gebauten Web-Export (dist/), damit CI mit einem Befehl alle
// Store-Screenshots erzeugen kann (npm run build && npm run screenshots).
import { spawn } from 'child_process';

const LOCALES = ['de', 'en', 'tr', 'ar', 'es', 'fr'];
const BASE = 'http://localhost:8085';

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

async function waitForServer() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return;
    } catch {
      // noch nicht bereit
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server unter ${BASE} nicht erreichbar`);
}

const server = spawn('npx', ['serve', 'dist', '-l', '8085'], {
  stdio: 'ignore',
  shell: process.platform === 'win32',
});

try {
  await waitForServer();
  for (const locale of LOCALES) {
    console.log(`--- Screenshots: ${locale} ---`);
    await run('node', ['scripts/store-screenshots.mjs', locale]);
  }
} finally {
  server.kill();
}
