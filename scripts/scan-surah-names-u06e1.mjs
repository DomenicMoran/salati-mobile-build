#!/usr/bin/env node
/**
 * Scannt die 114 API-Surennamen auf U+06E1 (KFGQPC-Sukūn) — Regression für
 * QuranArabicText / keine Systemschrift-Kästchen.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const res = await fetch('https://api.alquran.cloud/v1/surah');
const json = await res.json();
const surahs = json.data ?? [];
const with06e1 = surahs.filter((s) => s.name?.includes('\u06e1'));
console.log(`Surahs with U+06E1: ${with06e1.length}`);
for (const s of with06e1) {
  console.log(`${s.number}\t${s.name}`);
}
if (with06e1.length < 30) {
  console.error('Expected dozens of surah names with U+06E1 — API mismatch?');
  process.exit(1);
}
console.log('OK');
