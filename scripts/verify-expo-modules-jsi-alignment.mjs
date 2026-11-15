#!/usr/bin/env node
/**
 * Verhindert erneut ASC-Builds mit veraltetem expo-modules-jsi (DYLD vor JS).
 * expo-modules-core@57.0.6+ erwartet JavaScriptActor.runIsolated in ExpoModulesJSI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIN_JSI = '57.0.6';
const lockPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../pnpm-lock.yaml',
);

function parseLockVersion(text) {
  const key = text.match(/^\s+expo-modules-jsi@([\d.]+):/m);
  if (!key) return null;
  const block = text.slice(text.indexOf(key[0]));
  const depLine = block.match(/^\s+expo-modules-jsi:\s+([\d.]+)/m);
  return depLine?.[1] ?? key[1];
}

function cmp(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

const lock = fs.readFileSync(lockPath, 'utf8');
const resolved = parseLockVersion(lock);
if (!resolved) {
  console.error('[verify-expo-modules-jsi] expo-modules-jsi not found in pnpm-lock.yaml');
  process.exit(1);
}
if (cmp(resolved, MIN_JSI) < 0) {
  console.error(
    `[verify-expo-modules-jsi] resolved ${resolved} < ${MIN_JSI} (need runIsolated in ExpoModulesJSI)`,
  );
  process.exit(1);
}
console.log(`[verify-expo-modules-jsi] ok: expo-modules-jsi@${resolved} (min ${MIN_JSI})`);