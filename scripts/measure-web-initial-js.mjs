#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const re = /\/_expo\/static\/js\/web\/[^"']+/g;
const scripts = [...new Set(html.match(re) ?? [])];
let total = 0;
const rows = [];
for (const s of scripts) {
  const p = path.join(dist, s.replace(/^\//, ''));
  const b = fs.existsSync(p) ? fs.statSync(p).size : 0;
  total += b;
  rows.push({ s, b });
}
rows.sort((a, b) => b.b - a.b);
console.log(JSON.stringify({ scriptCount: scripts.length, initialBytes: total, initialMB: +(total / 1e6).toFixed(2), top: rows.slice(0, 10).map((r) => ({ file: r.s, mb: +(r.b / 1e6).toFixed(2) })) }, null, 2));
