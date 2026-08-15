#!/usr/bin/env node
// Prüft die Store-Listings in store/listing/*.md gegen Googles Grenzen
// (Titel 30, Kurzbeschreibung 80, Vollbeschreibung 4000 Zeichen) und meldet,
// welche der üblichen Suchbegriffe je Sprache im indexierten Text vorkommen.
// Play indexiert NUR Titel + Kurz- + Vollbeschreibung — der Keywords-Abschnitt
// der .md ist reines App-Store-Material und zählt hier nicht mit.
//
// Usage: node scripts/play-listing-check.mjs
import fs from 'fs';
import path from 'path';

const DIR = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), '..', 'store', 'listing');

/** Parst title/short/full aus einer store/listing/*.md (identisch zu play-publish.mjs). */
export function parseListing(rohMd) {
  const md = rohMd.replace(/\r\n/g, '\n');
  const title = /^#\s+(.+)$/m.exec(md)?.[1]?.trim();
  const sections = md.split(/^##\s+/m);
  let short = null;
  let full = null;
  for (const sec of sections) {
    const [head, ...rest] = sec.split('\n');
    const body = rest.join('\n').replace(/\(\d+\/\d+ Zeichen\)/g, '').replace(/^\([^)]*\)$/gm, '').trim();
    const h = head.trim().toLowerCase();
    if (/kurz|short|kısa|القصير|corta|courte/.test(h)) short = body.split('\n\n')[0].trim();
    if (/vollständige|full description|tam açıklama|الوصف الكامل|completa|complète/.test(h)) full = body.trim();
  }
  return { title, short, full };
}

const BEGRIFFE = {
  de: ['Gebetszeiten', 'Adhan', 'Qibla', 'Koran', 'Ramadan', 'Hijri', 'Tasbih', 'Dhikr', 'Moschee', 'Zakat', 'Hadith', 'Dua', 'Kalender'],
  en: ['prayer times', 'Adhan', 'Qibla', 'Quran', 'Ramadan', 'Hijri', 'Tasbih', 'Dhikr', 'mosque', 'Zakat', 'Hadith', 'dua', 'Islamic calendar'],
  tr: ['namaz vakitleri', 'ezan', 'kıble', "Kur'an", 'Ramazan', 'hicri', 'tesbih', 'zikir', 'cami', 'zekât', 'hadis', 'dua'],
  ar: ['مواقيت الصلاة', 'أذان', 'القبلة', 'القرآن', 'رمضان', 'هجري', 'تسبيح', 'أذكار', 'مسجد', 'زكاة', 'حديث', 'دعاء'],
  es: ['oración', 'Adhan', 'Qibla', 'Corán', 'Ramadán', 'hégira', 'tasbih', 'dhikr', 'mezquita', 'zakat', 'hadiz', 'dua'],
  fr: ['heures de prière', 'Adhan', 'Qibla', 'Coran', 'Ramadan', 'hégirien', 'tasbih', 'dhikr', 'mosquée', 'zakat', 'hadith', 'doua'],
};

let fehler = 0;
// data-safety.md ist Dokumentation zum Data-Safety-Formular, kein Store-Listing.
const KEIN_LISTING = new Set(['data-safety.md']);
for (const datei of fs.readdirSync(DIR).filter((f) => f.endsWith('.md') && !KEIN_LISTING.has(f)).sort()) {
  const lang = path.basename(datei, '.md');
  const { title, short, full } = parseListing(fs.readFileSync(path.join(DIR, datei), 'utf8'));
  if (!title || !short || !full) { console.log(`${lang}: PARSE-FEHLER`); fehler++; continue; }
  const marker = (n, max) => (n > max ? `!! ${n}/${max}` : `${n}/${max}`);
  if (title.length > 30 || short.length > 80 || full.length > 4000) fehler++;
  console.log(`${lang.padEnd(3)} Titel ${marker(title.length, 30).padEnd(9)} Kurz ${marker(short.length, 80).padEnd(9)} Voll ${marker(full.length, 4000)}`);
  const begriffe = BEGRIFFE[lang];
  if (begriffe) {
    const text = `${title} ${short} ${full}`.toLowerCase();
    const fehlend = begriffe.filter((b) => !text.includes(b.toLowerCase()));
    console.log(`    fehlende Suchbegriffe: ${fehlend.length ? fehlend.join(', ') : '—'}`);
  }
}
process.exit(fehler ? 1 : 0);
