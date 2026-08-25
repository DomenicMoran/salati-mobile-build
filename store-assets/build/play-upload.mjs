#!/usr/bin/env node
// Aktualisiert das Google-Play-Listing fuer Salati (de.salatibox.de): NUR
// de-DE + en-US (Titel/Kurz/Voll + Phone-Screenshots + Feature-Graphic).
// Andere Sprachen (tr/ar/es/fr) bleiben unberuehrt. Kein AAB.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(__dirname, '..');
const b64url = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const signRS256 = (payload, key) => {
  const h = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const p = b64url(JSON.stringify(payload));
  const s = crypto.createSign('RSA-SHA256'); s.update(`${h}.${p}`); s.end();
  return `${h}.${p}.${b64url(s.sign(key))}`;
};

const PACKAGE = 'de.salatibox.de';
const SA_PATH = 'C:/Users/domen/Documents/90_Werkstatt/menucloud-mobile-build/play-service-account.json';

const FULL_DE = `Salati ist dein täglicher Begleiter im Deen – schön, respektvoll und komplett werbefrei. Alles, was du für Gebet, Koran und Alltag als Muslim brauchst, an einem Ort.

🕌 GEBETSZEITEN, DENEN DU VERTRAUST
• Präzise Zeiten für deinen Standort mit Countdown bis zum nächsten Gebet
• Alle gängigen Berechnungsmethoden (MWL, ISNA, Umm al-Qura, Ägypten u. v. m.)
• Asr nach Shafi/Maliki/Hanbali oder Hanafi
• Adhan-Benachrichtigungen, Vor-Erinnerung (z. B. für Wudu) und Iqama-Zeiten
• Reisemodus mit Qasr-Hinweis, Homescreen-Widgets & Kalender-Export

📖 DER GANZE KORAN – LESEN & HÖREN
• Kompletter Koran mit Übersetzung und Wort-für-Wort
• Lateinische Umschrift (Transliteration) zum Mitlesen
• Rezitation von mehreren bekannten Rezitatoren, auch offline
• Tafsir (Auslegung), Lesezeichen und Khatmah-Leseplan zum Durchlesen

🧭 QIBLA & MOSCHEEN
• Qibla-Kompass zeigt die Gebetsrichtung – überall auf der Welt
• Moscheen und Halal-Orte in deiner Nähe finden

✅ DRANBLEIBEN & WACHSEN
• Gebets-Tracker mit Serie und Qada-Zähler für nachzuholende Gebete
• Digitaler Tasbih (Dhikr-Zähler) mit Tagesziel und Verlauf
• Die 99 Namen Allahs – lernen und anhören
• Bittgebete (Duas) und eine Hadith-Sammlung
• Lernbereich: arabische Schrift (Alif-Ba), Tajwid, Hifz-Trainer & Quizze

🌙 ISLAMISCHER ALLTAG
• Islamischer Kalender mit Hijri-Datum und Feiertagen
• Fasten-Modus für den Ramadan
• Zakat-Rechner und Halal-Barcode-Scanner

✨ WARUM SALATI?
• 100 % werbefrei – kein Tracking, keine Ablenkung
• In 14 Sprachen verfügbar
• Von Gelehrten geprüfte Inhalte
• Schlicht, schnell und mit Liebe zum Detail gestaltet

Lade Salati und mach dein Gebet zur festen Gewohnheit. Barakallahu fikum.`;

const FULL_EN = `Salati is your daily companion in the deen – beautiful, respectful and completely ad-free. Everything you need for prayer, Quran and Muslim daily life in one place.

🕌 PRAYER TIMES YOU CAN TRUST
• Accurate times for your location with a countdown to the next prayer
• All common calculation methods (MWL, ISNA, Umm al-Qura, Egypt and more)
• Asr according to Shafi/Maliki/Hanbali or Hanafi
• Adhan notifications, pre-reminder (e.g. for wudu) and Iqama times
• Travel mode with Qasr hint, home screen widgets & calendar export

📖 THE ENTIRE QURAN – READ & LISTEN
• Complete Quran with translation and word-by-word
• Latin transliteration to read along
• Recitation by several well-known reciters, also offline
• Tafsir (commentary), bookmarks and a Khatmah reading plan

🧭 QIBLA & MOSQUES
• Qibla compass shows the prayer direction – anywhere in the world
• Find mosques and halal places near you

✅ STAY CONSISTENT & GROW
• Prayer tracker with streaks and a Qada counter for missed prayers
• Digital Tasbih (dhikr counter) with a daily goal and history
• The 99 Names of Allah – learn and listen
• Supplications (duas) and a hadith collection
• Learning hub: Arabic script (Alif-Ba), Tajwid, Hifz trainer & quizzes

🌙 MUSLIM DAILY LIFE
• Islamic calendar with Hijri dates and holidays
• Fasting mode for Ramadan
• Zakat calculator and halal barcode scanner

✨ WHY SALATI?
• 100% ad-free – no tracking, no distraction
• Available in 14 languages
• Content reviewed by scholars
• Clean, fast and crafted with attention to detail

Download Salati and make your prayer a lasting habit. Barakallahu fikum.`;

const LISTINGS = {
  'de-DE': {
    title: 'Salati: Gebetszeiten & Koran',
    short: 'Gebetszeiten, Koran, Qibla, Dhikr & Adhan – dein Begleiter im Deen. Werbefrei.',
    full: FULL_DE,
    shots: path.join(ASSETS, 'out/playstore/de'),
    feature: path.join(ASSETS, 'feature-graphic-de.png'),
  },
  'en-US': {
    title: 'Salati: Prayer Times & Quran',
    short: 'Prayer times, Quran, Qibla, Dhikr & Adhan – your companion in the deen. Ad-free.',
    full: FULL_EN,
    shots: path.join(ASSETS, 'out/playstore/en'),
    feature: path.join(ASSETS, 'feature-graphic-en.png'),
  },
};

const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
const now = Math.floor(Date.now() / 1000);
const assertion = signRS256(
  { iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 },
  sa.private_key,
);
const tok = await (await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
})).json();
const ACCESS = tok.access_token;
if (!ACCESS) { console.error('Token fehlgeschlagen', tok); process.exit(1); }

const BASE = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`;
const UPLOAD = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE}`;
const api = async (p, opts = {}) => {
  const r = await fetch(BASE + p, { ...opts, headers: { Authorization: `Bearer ${ACCESS}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  return { ok: r.ok, status: r.status, json: await r.json().catch(() => null) };
};
const upload = async (p, buf) => {
  const r = await fetch(UPLOAD + p, { method: 'POST', headers: { Authorization: `Bearer ${ACCESS}`, 'Content-Type': 'image/png' }, body: buf });
  return { ok: r.ok, status: r.status, json: await r.json().catch(() => null) };
};

const edit = await api('/edits', { method: 'POST', body: '{}' });
if (!edit.ok) { console.error('Edit fehlgeschlagen:', edit.status, JSON.stringify(edit.json)); process.exit(1); }
const editId = edit.json.id;
console.log('Edit:', editId);

for (const [locale, L] of Object.entries(LISTINGS)) {
  const lr = await api(`/edits/${editId}/listings/${locale}`, {
    method: 'PUT',
    body: JSON.stringify({ language: locale, title: L.title.slice(0, 30), shortDescription: L.short.slice(0, 80), fullDescription: L.full.slice(0, 4000) }),
  });
  console.log(`Listing ${locale}:`, lr.ok ? 'OK' : `${lr.status} ${JSON.stringify(lr.json?.error?.message ?? '')}`);

  for (const type of ['phoneScreenshots', 'featureGraphic']) {
    await api(`/edits/${editId}/listings/${locale}/${type}`, { method: 'DELETE' }).catch(() => {});
  }
  const fr = await upload(`/edits/${editId}/listings/${locale}/featureGraphic`, fs.readFileSync(L.feature));
  console.log(`  featureGraphic:`, fr.ok ? 'OK' : `${fr.status} ${JSON.stringify(fr.json?.error?.message ?? '')}`);
  for (const f of fs.readdirSync(L.shots).filter((f) => f.endsWith('.png')).sort()) {
    const sr = await upload(`/edits/${editId}/listings/${locale}/phoneScreenshots`, fs.readFileSync(path.join(L.shots, f)));
    console.log(`  phone ${f}:`, sr.ok ? 'OK' : `${sr.status} ${JSON.stringify(sr.json?.error?.message ?? '')}`);
  }
}

const commit = await api(`/edits/${editId}:commit`, { method: 'POST' });
console.log('Commit:', commit.ok ? 'OK — Listing aktualisiert in der Play Console' : `${commit.status} ${JSON.stringify(commit.json).slice(0, 400)}`);
