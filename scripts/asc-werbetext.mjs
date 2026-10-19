#!/usr/bin/env node
// Setzt den Werbetext ("Promotional Text") der aktuellen App-Store-Version.
//
// Warum ausgerechnet dieses Feld: Es steht ganz oben ueber der Beschreibung und
// ist das EINZIGE, das sich ohne neue Version und ohne neue Pruefung aendern
// laesst. Es war in beiden Sprachen leer — 170 Zeichen Platz an der
// sichtbarsten Stelle, ungenutzt.
//
// Aufruf:  node scripts/asc-werbetext.mjs            (nur anzeigen)
//          node scripts/asc-werbetext.mjs --setzen   (schreiben)
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire('C:/Users/domen/Documents/Projekte/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

const APP_ID = '6791867298';
const KEY_ID = process.env.ASC_KEY_ID || 'H73GL4Q2AQ';
const ISSUER = process.env.ASC_ISSUER_ID || 'de348707-2ec6-4079-b3a4-74c17c31ba0c';
const KEY_PATH = 'C:/Users/domen/Documents/Projektordner/90_Werkstatt/schluessel/AuthKey_H73GL4Q2AQ_Apple.p8';
const SETZEN = process.argv.includes('--setzen');
const GRENZE = 170;

/**
 * Bewusst nur Aussagen, die die App auch einloest — jede ist im Produkt
 * nachpruefbar (kein Konto, keine Werbung, kein Tracking; Wort-fuer-Wort-
 * Rezitation; 14 Sprachen). Keine Hardware, kein Zubehoer, kein Kauf.
 */
const TEXTE = {
  // Sichtbarste Zeile: das neue 1.56.0-Merkmal, plus die bestehenden Zusagen.
  'de-DE':
    'Neu: Hörbücher Pflichtwissen und Arabisch-Grammatik — Audio plus Präsentationsvideo in 14 Sprachen. Koran, Qibla, Hifz. Ohne Konto, Werbung und Tracking.',
  'en-US':
    'New: audiobooks on essential Islamic knowledge and Arabic grammar — audio plus presentation video in 14 languages. Quran, qibla, hifz. No account, ads or tracking.',
  'ar-SA':
    'جديد: كتب صوتية للعلم الواجب وقواعد العربية — صوت وفيديو تقديمي بـ14 لغة. قرآن، قبلة، حفظ. بلا حساب ولا إعلانات ولا تتبع.',
  'bn-BD':
    'নতুন: ওয়াজিব ইলম ও আরবি ব্যাকরণের অডিওবুক — ১৪ ভাষায় অডিও ও উপস্থাপনা ভিডিও। কুরআন, কিবলা, হিফজ। অ্যাকাউন্ট, বিজ্ঞাপন ও ট্র্যাকিং ছাড়া।',
  'es-ES':
    'Nuevo: audiolibros de conocimiento islámico esencial y gramática árabe — audio y vídeo en 14 idiomas. Corán, qibla, hifz. Sin cuenta, anuncios ni rastreo.',
  'fr-FR':
    'Nouveau : livres audio savoir islamique essentiel et grammaire arabe — audio et vidéo en 14 langues. Coran, qibla, hifz. Sans compte, pub ni pistage.',
  id: 'Baru: buku audio ilmu wajib Islam dan tata bahasa Arab — audio plus video presentasi dalam 14 bahasa. Quran, kiblat, hifz. Tanpa akun, iklan, pelacakan.',
  ms: 'Baharu: buku audio ilmu wajib Islam dan tatabahasa Arab — audio plus video pembentangan dalam 14 bahasa. Quran, kiblat, hifz. Tanpa akaun, iklan, penjejakan.',
  ru: 'Новое: аудиокниги обязательных знаний и арабской грамматики — аудио и видео на 14 языках. Коран, кибла, хифз. Без аккаунта, рекламы и слежки.',
  tr: 'Yeni: farz ilim ve Arap grameri sesli kitapları — 14 dilde ses ve sunum videosu. Kuran, kıble, hifz. Hesap, reklam ve takip yok.',
  'ur-PK':
    'نیا: فرض اسلامی علم اور عربی گرامر کی آڈیو بکس — ۱۴ زبانوں میں آڈیو اور پیشکشی ویڈیو۔ قرآن، قبلہ، حفظ۔ بغیر اکاؤنٹ، اشتہار اور ٹریکنگ۔',
};

const token = jwt.sign({ iss: ISSUER, aud: 'appstoreconnect-v1' }, fs.readFileSync(KEY_PATH, 'utf8'), {
  algorithm: 'ES256',
  expiresIn: '20m',
  header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' },
});

async function api(pfad, init = {}) {
  const r = await fetch(`https://api.appstoreconnect.apple.com/v1${pfad}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${init.method ?? 'GET'} ${pfad} -> ${r.status} ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
}

for (const [locale, text] of Object.entries(TEXTE)) {
  if (text.length > GRENZE) {
    console.error(`FEHLER ${locale}: ${text.length} Zeichen, erlaubt sind ${GRENZE}`);
    process.exit(1);
  }
}

const versionen = await api(`/apps/${APP_ID}/appStoreVersions?limit=1`);
const version = versionen.data[0];
console.log(`Version ${version.attributes.versionString} (${version.attributes.appStoreState})`);

const locs = await api(`/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`);
for (const l of locs.data) {
  const locale = l.attributes.locale;
  const neu = TEXTE[locale];
  if (!neu) {
    console.log(`  ${locale}: kein Text hinterlegt — uebersprungen`);
    continue;
  }
  console.log(`  ${locale}: ${neu.length}/${GRENZE} Zeichen`);
  if (!SETZEN) {
    console.log(`     wuerde gesetzt: "${neu}"`);
    continue;
  }
  await api(`/appStoreVersionLocalizations/${l.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: { type: 'appStoreVersionLocalizations', id: l.id, attributes: { promotionalText: neu } },
    }),
  });
  console.log('     gesetzt');
}

if (SETZEN) {
  // Zuruecklesen statt dem PATCH glauben.
  const nach = await api(`/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`);
  console.log('\nZurueckgelesen:');
  for (const l of nach.data) {
    console.log(`  ${l.attributes.locale}: ${l.attributes.promotionalText ? `${l.attributes.promotionalText.length} Zeichen` : 'LEER'}`);
  }
} else {
  console.log('\nNichts geschrieben. Mit --setzen ausfuehren.');
}
