#!/usr/bin/env node
// Weitet den App-Store-Eintrag auf weitere Sprachen aus — aus den Texten, die
// in store/listing/<sprache>.md schon liegen.
//
// Warum es das Skript gibt (06.09.2026): Der Apple-Eintrag hat genau zwei
// Sprachen (en-US, de-DE), waehrend fuer vierzehn Sprachen fertige Texte im
// Repo liegen. In der Weboberflaeche muesste man jede Sprache einzeln anlegen
// und vier Felder von Hand einfuegen — bei elf Sprachen sind das 44 Felder,
// jedes mit einer eigenen Laengengrenze, die Apple erst BEIM Senden prueft.
//
// Bewusste Entscheidungen:
//   - Voreinstellung ist Trockenlauf. Geschrieben wird nur mit --schreiben.
//   - Keine Uebersetzung, keine Kuerzung, keine Erfindung. Was in der Datei
//     fehlt oder zu lang ist, wird gemeldet und NICHT gesendet. Ein selbsttaetig
//     gekuerzter Beschreibungstext waere ein Text, den nie jemand gelesen hat.
//   - Welche Sprachkennungen Apple annimmt, wird ERFRAGT, nicht geraten: ein
//     absichtlich unvollstaendiger POST scheitert immer, verraet aber im
//     Fehlertext, ob die Kennung gueltig ist ("Un-supported locale: <x>" bzw.
//     "The language specified is not listed for localization"). Apples Liste
//     aendert sich; eine fest eingebaute Liste waere irgendwann still falsch.
//     Beleg 06.09.2026: bn-BD und ur-PK werden angenommen, fa/fa-IR/fa-AF,
//     ps/ps-AF und sw/sw-KE/sw-TZ nicht.
//   - Zustandspruefung vor dem Schreiben. Apple im Wortlaut, gemessen an
//     Version 1.53.0 in WAITING_FOR_REVIEW:
//       "Cannot create localization after the app version has been submitted
//        for review."
//     Neue Sprachen entstehen also erst an einer Fassung, die noch nicht
//     eingereicht ist. Das Skript bricht dann mit Befund ab statt zu raten.
//
// Kein process.exit(): das reisst unter Windows die offenen fetch-Verbindungen
// mit und endet in einer libuv-Assertion mit Rueckgabewert 127 — ein Lauf, den
// man am Rueckgabewert prueft, gilt dann faelschlich als gescheitert.
//
// Aufruf:
//   node scripts/asc-sprachen.mjs                       # Trockenlauf (Vorgabe)
//   node scripts/asc-sprachen.mjs --schreiben           # wirklich senden
//   node scripts/asc-sprachen.mjs --notizen store/whatsnew-1.54.0.json
//   node scripts/asc-sprachen.mjs --nur tr,id           # auf Sprachen begrenzen
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire('C:/Users/domen/Documents/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

const APP_ID = '6791867298';
const KEY_ID = process.env.ASC_KEY_ID || 'H73GL4Q2AQ';
const ISSUER = process.env.ASC_ISSUER_ID || 'de348707-2ec6-4079-b3a4-74c17c31ba0c';
const KEY_PATH = 'C:/Users/domen/Documents/90_Werkstatt/schluessel/AuthKey_H73GL4Q2AQ_Apple.p8';

/** Apples harte Grenzen — laengere Felder weist die API zurueck. Quelle: asc-auftritt.mjs */
const GRENZEN = { name: 30, subtitle: 30, keywords: 100, promotionalText: 170, description: 4000 };

/**
 * Zustaende, in denen Apple die Metadaten einer Fassung noch bearbeiten laesst.
 * Positivliste: ein unbekannter neuer Zustand gilt als "gesperrt", damit im
 * Zweifel nichts an einer laufenden Pruefung gedreht wird.
 */
const BEARBEITBAR = new Set([
  'PREPARE_FOR_SUBMISSION',
  'DEVELOPER_REJECTED',
  'REJECTED',
  'METADATA_REJECTED',
  'INVALID_BINARY',
]);

/**
 * Dateiname in store/listing/ -> Apple-Kennungen, in Reihenfolge der Vorliebe.
 * Welche davon Apple wirklich nimmt, entscheidet die API (siehe kennungPruefen),
 * nicht diese Tabelle. Sie sagt nur, WAS ueberhaupt in Frage kommt.
 */
const KANDIDATEN = {
  ar: ['ar-SA'],
  bn: ['bn-BD', 'bn'],
  de: ['de-DE'],
  en: ['en-US', 'en-GB'],
  es: ['es-ES', 'es-MX'],
  fa: ['fa-IR', 'fa'],
  fr: ['fr-FR', 'fr-CA'],
  id: ['id'],
  ms: ['ms'],
  ps: ['ps-AF', 'ps'],
  ru: ['ru'],
  sw: ['sw-KE', 'sw'],
  tr: ['tr'],
  ur: ['ur-PK', 'ur'],
};

/** Dateien in store/listing/, die kein Store-Text sind. */
const KEINE_SPRACHE = new Set(['data-safety']);

// ---------------------------------------------------------------- Argumente
const argv = process.argv.slice(2);
const wertVon = (n) => {
  const i = argv.indexOf(n);
  return i >= 0 ? argv[i + 1] : undefined;
};
const SCHREIBEN = argv.includes('--schreiben');
const NOTIZEN = wertVon('--notizen');
const NUR = (wertVon('--nur') || '').split(',').map((s) => s.trim()).filter(Boolean);

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LISTING = path.join(WURZEL, 'store', 'listing');

// ------------------------------------------------------------------ Zugriff
const token = jwt.sign({ iss: ISSUER, aud: 'appstoreconnect-v1' }, fs.readFileSync(KEY_PATH, 'utf8'), {
  algorithm: 'ES256',
  expiresIn: '20m',
  header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' },
});

async function roh(methode, pfad, koerper) {
  const r = await fetch(`https://api.appstoreconnect.apple.com/v1${pfad}`, {
    method: methode,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: koerper ? JSON.stringify(koerper) : undefined,
  });
  return { status: r.status, ok: r.ok, text: await r.text() };
}

async function api(pfad) {
  const r = await roh('GET', pfad);
  if (!r.ok) throw new Error(`${pfad} -> ${r.status} ${r.text.slice(0, 200)}`);
  return JSON.parse(r.text);
}

/** Apples Fehlerliste als lesbare Zeilen; bei Nicht-JSON der Rohtext. */
function fehlerZeilen(text) {
  try {
    return JSON.parse(text).errors.map((e) => e.detail || e.title);
  } catch {
    return [text.slice(0, 300)];
  }
}

// -------------------------------------------------------------- Dateilesung
/** Holt den Rumpf eines "## Ueberschrift"-Abschnitts, ohne die "(n/m Zeichen)"-Notiz. */
function abschnitt(md, ueberschrift) {
  const re = new RegExp(`^##\\s+${ueberschrift}\\s*$`, 'm');
  const start = md.search(re);
  if (start < 0) return null;
  const ab = md.slice(start).split('\n').slice(1);
  const bis = ab.findIndex((z) => /^#{1,2}\s/.test(z));
  const rumpf = (bis < 0 ? ab : ab.slice(0, bis))
    .filter((z) => !/^\(.*Zeichen\)\s*$/.test(z.trim()))
    .join('\n')
    .trim();
  return rumpf || null;
}

function texteLesen(datei) {
  const md = fs.readFileSync(datei, 'utf8');
  const kopf = md.match(/^#\s+(.+?)\s*$/m);
  return {
    name: kopf ? kopf[1].trim() : null,
    subtitle: abschnitt(md, 'App-Store-Untertitel'),
    description: abschnitt(md, 'Vollständige Beschreibung'),
    keywords: abschnitt(md, 'Keywords'),
    kurz: abschnitt(md, 'Kurzbeschreibung'), // Play-Kurztext, hat bei Apple kein Feld
  };
}

// ------------------------------------------------------- Kennungen erfragen
/**
 * Holt die Versionshinweise fuer eine Apple-Kennung aus einer Notizen-Datei.
 *
 * Die einzigen handkuratierten Uebersetzungen der Versionshinweise liegen in
 * store/play-notes-<version>.json — changelog.ts fuehrt nur Deutsch und
 * Englisch (siehe Kopf von scripts/release-notes.mjs). Play benennt dieselben
 * Sprachen aber teils anders als Apple, und ein blosser Nachschlag ueber
 * Kennung und Sprachstamm laesst genau zwei durchfallen: Play sagt "tr-TR"
 * und "ru-RU", wo Apple "tr" und "ru" fuehrt. Ohne diese Tabelle blieben
 * Tuerkisch und Russisch stumm liegen, waehrend die Uebersetzung danebensteht.
 */
const NOTIZ_ALIASSE = {
  'ar-SA': ['ar-SA', 'ar'],
  'bn-BD': ['bn-BD', 'bn'],
  'de-DE': ['de-DE', 'de'],
  de: ['de', 'de-DE'],
  'en-US': ['en-US', 'en'],
  'en-GB': ['en-GB', 'en-US', 'en'],
  'es-ES': ['es-ES', 'es'],
  'fr-FR': ['fr-FR', 'fr'],
  id: ['id', 'id-ID'],
  ms: ['ms', 'ms-MY'],
  ru: ['ru', 'ru-RU'],
  tr: ['tr', 'tr-TR'],
  'ur-PK': ['ur-PK', 'ur'],
};

function notizHolen(notizen, locale, sprache) {
  if (!notizen) return null;
  for (const k of NOTIZ_ALIASSE[locale] ?? []) {
    if (notizen[k]) return notizen[k];
  }
  return notizen[locale] ?? notizen[sprache] ?? null;
}

/**
 * Fragt Apple, ob eine Sprachkennung fuer diesen Eintrag zulaessig ist.
 * Der POST ist absichtlich unvollstaendig und scheitert IMMER (409) — er
 * aendert also nichts. Interessant ist nur, ob Apple die Kennung bemaengelt.
 */
async function kennungPruefen(versionId, locale) {
  const r = await roh('POST', '/appStoreVersionLocalizations', {
    data: {
      type: 'appStoreVersionLocalizations',
      attributes: { locale },
      relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } } },
    },
  });
  if (r.status === 201) {
    // Darf nach Apples Pflichtfeldern nicht vorkommen. Falls doch: sofort zurueck.
    const id = JSON.parse(r.text).data.id;
    await roh('DELETE', `/appStoreVersionLocalizations/${id}`);
    return { ok: true, grund: null };
  }
  const zeilen = fehlerZeilen(r.text);
  const mangel = zeilen.find((d) => /Un-supported locale|not listed for localization/i.test(d));
  return { ok: !mangel, grund: mangel || null };
}

// ------------------------------------------------------------------- Bericht
const anteil = (wert, grenze) => `${String(wert ?? 0).padStart(4)}/${grenze}`;

async function main() {
  if (!fs.existsSync(LISTING)) {
    console.error(`Ordner fehlt: ${LISTING}`);
    return 1;
  }

  console.log(
    `Store-Eintrag auf weitere Sprachen ausweiten — ${SCHREIBEN ? 'SCHREIBLAUF' : 'Trockenlauf (nichts wird gesendet)'}\n`
  );

  // ---- 1. Zustand bei Apple ----
  const versionen = (await api(`/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&limit=5`)).data;
  if (!versionen.length) {
    console.error('Keine iOS-Versionen gefunden — Abbruch.');
    return 1;
  }
  const version = versionen[0];
  const zustand = version.attributes.appStoreState;

  const infos = (await api(`/apps/${APP_ID}/appInfos?limit=5`)).data;
  // Die bearbeitbare App-Info ist die, die NICHT auf READY_FOR_SALE steht.
  const info = infos.find((i) => i.attributes.appStoreState !== 'READY_FOR_SALE') || infos[0];

  console.log('── Zustand bei Apple ─────────────────────');
  for (const v of versionen.slice(0, 3)) {
    console.log(`   Version ${v.attributes.versionString.padEnd(8)} ${v.attributes.appStoreState}`);
  }
  console.log(`   App-Info ${info.id.slice(0, 8)}… ${info.attributes.appStoreState}`);

  const offen = BEARBEITBAR.has(zustand);
  console.log(
    `   -> Metadaten ${offen ? 'bearbeitbar' : 'GESPERRT'}: ${version.attributes.versionString} steht auf ${zustand}.`
  );

  // ---- 2. Bestand: welche Sprachen liegen schon an? ----
  const vLocs = (await api(`/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`)).data;
  const iLocs = (await api(`/appInfos/${info.id}/appInfoLocalizations?limit=50`)).data;
  const vNach = new Map(vLocs.map((l) => [l.attributes.locale, l]));
  const iNach = new Map(iLocs.map((l) => [l.attributes.locale, l]));
  console.log(`   Vorhanden: ${[...vNach.keys()].join(', ') || '(keine)'}\n`);

  // URLs sind sprachneutral und werden vom Haupteintrag uebernommen, nicht erfunden.
  const vorbild = vNach.get('en-US') || vLocs[0];
  const supportUrl = vorbild?.attributes.supportUrl ?? null;
  const marketingUrl = vorbild?.attributes.marketingUrl ?? null;

  // "Neu in dieser Version" ist beim Anlegen einer Sprache Pflicht — aber kein
  // Text aus store/listing/. Nur aus einer ausdruecklich benannten Datei.
  let notizen = null;
  if (NOTIZEN) {
    const p = path.isAbsolute(NOTIZEN) ? NOTIZEN : path.join(WURZEL, NOTIZEN);
    if (!fs.existsSync(p)) {
      console.error(`Notizen-Datei fehlt: ${p} — Abbruch.`);
      return 1;
    }
    notizen = JSON.parse(fs.readFileSync(p, 'utf8'));
    console.log(`   Versionshinweise aus ${NOTIZEN}: ${Object.keys(notizen).join(', ')}\n`);
  }

  // ---- 3. Dateien lesen und Kennungen erfragen ----
  const dateien = fs
    .readdirSync(LISTING)
    .filter((f) => f.endsWith('.md') && !KEINE_SPRACHE.has(f.replace(/\.md$/, '')))
    .filter((f) => NUR.length === 0 || NUR.includes(f.replace(/\.md$/, '')))
    .sort();

  console.log(`── Sprachen aus store/listing/ (${dateien.length} Dateien) ──\n`);

  const bereit = [];
  const ohneApple = [];
  const mitMangel = [];

  for (const datei of dateien) {
    const sprache = datei.replace(/\.md$/, '');
    const texte = texteLesen(path.join(LISTING, datei));

    // Welche Apple-Kennung passt? Erst nachsehen, was schon angelegt ist,
    // sonst der Reihe nach bei Apple anfragen.
    const kandidaten = KANDIDATEN[sprache] || [sprache];
    let locale = kandidaten.find((k) => vNach.has(k) || iNach.has(k)) || null;
    const abgelehnt = [];
    if (!locale) {
      for (const k of kandidaten) {
        const p = await kennungPruefen(version.id, k);
        if (p.ok) {
          locale = k;
          break;
        }
        abgelehnt.push(`${k}: ${p.grund}`);
      }
    }

    if (!locale) {
      ohneApple.push({ sprache, abgelehnt });
      console.log(`── ${sprache} ── bei Apple NICHT verfuegbar`);
      for (const a of abgelehnt) console.log(`   ${a}`);
      console.log('   -> Text bleibt liegen; Apple fuehrt diese Sprache im App Store nicht.\n');
      continue;
    }

    const neu = !vNach.has(locale);
    console.log(`── ${sprache} -> ${locale} ── ${neu ? 'NEU anlegen' : 'aktualisieren'}`);

    const felder = [
      ['name', texte.name],
      ['subtitle', texte.subtitle],
      ['keywords', texte.keywords],
      ['description', texte.description],
    ];
    const zuLang = [];
    const fehlt = [];
    for (const [feld, wert] of felder) {
      if (!wert) {
        fehlt.push(feld);
        console.log(`   ${feld.padEnd(12)} FEHLT in ${datei}`);
        continue;
      }
      const laenge = wert.length;
      if (laenge > GRENZEN[feld]) zuLang.push(`${feld} ${laenge}/${GRENZEN[feld]}`);
      const marke = laenge > GRENZEN[feld] ? '  !! ZU LANG — wird nicht gesendet' : '';
      console.log(`   ${feld.padEnd(12)} ${anteil(laenge, GRENZEN[feld])}${marke}`);
    }
    // Werbetext hat in store/listing/ kein Gegenstueck — nicht erfinden, nur nennen.
    const werbetext = vNach.get(locale)?.attributes.promotionalText;
    console.log(
      `   promoText    ${
        werbetext
          ? `${anteil(werbetext.length, GRENZEN.promotionalText)} (steht bei Apple)`
          : 'kein Text in store/listing/ — bleibt leer'
      }`
    );

    const whatsNew = notizHolen(notizen, locale, sprache);
    if (neu) {
      console.log(
        `   whatsNew     ${whatsNew ? `${whatsNew.length} Zeichen` : 'FEHLT — Apple verlangt es beim Anlegen einer Sprache'}`
      );
      if (!whatsNew) fehlt.push('whatsNew');
      if (!supportUrl) fehlt.push('supportUrl');
    }

    if (zuLang.length || fehlt.length) {
      mitMangel.push({ sprache, locale, zuLang, fehlt });
      const gruende = [...zuLang.map((z) => `zu lang (${z})`), ...fehlt.map((f) => `${f} fehlt`)];
      console.log(`   -> nicht sendefaehig: ${gruende.join(', ')}\n`);
      continue;
    }

    bereit.push({ sprache, locale, neu, texte, whatsNew });
    console.log('   -> sendefaehig\n');
  }

  // ---- 4. Zusammenfassung ----
  console.log('── Befund ────────────────────────────────');
  console.log(`   sendefaehig            ${bereit.length}  ${bereit.map((b) => b.locale).join(', ') || '—'}`);
  console.log(`   bei Apple nicht moegl. ${ohneApple.length}  ${ohneApple.map((o) => o.sprache).join(', ') || '—'}`);
  console.log(`   mit Mangel             ${mitMangel.length}  ${mitMangel.map((m) => m.locale).join(', ') || '—'}`);

  if (!SCHREIBEN) {
    console.log('\nTrockenlauf — es wurde nichts gesendet. Zum Schreiben: --schreiben');
    if (!offen) {
      console.log(
        `Hinweis: solange ${version.attributes.versionString} auf ${zustand} steht, wuerde --schreiben abbrechen ` +
          '("Cannot create localization after the app version has been submitted for review.").'
      );
    }
    return 0;
  }

  // ---- 5. Schreiben ----
  if (!offen) {
    console.error(
      `\nAbbruch: ${version.attributes.versionString} steht auf ${zustand}. ` +
        'Apple lehnt neue Sprach-Lokalisierungen an einer eingereichten Fassung ab ' +
        '("Cannot create localization after the app version has been submitted for review."). ' +
        'Erst nach Abschluss der Pruefung an der naechsten Fassung erneut ausfuehren.'
    );
    return 1;
  }
  if (!bereit.length) {
    console.log('\nNichts zu senden.');
    return 0;
  }

  let fehler = 0;
  for (const b of bereit) {
    // Name und Untertitel haengen an der App-Info.
    const iVorhanden = iNach.get(b.locale);
    const iAttr = { name: b.texte.name, subtitle: b.texte.subtitle };
    const iAntwort = iVorhanden
      ? await roh('PATCH', `/appInfoLocalizations/${iVorhanden.id}`, {
          data: { type: 'appInfoLocalizations', id: iVorhanden.id, attributes: iAttr },
        })
      : await roh('POST', '/appInfoLocalizations', {
          data: {
            type: 'appInfoLocalizations',
            attributes: { locale: b.locale, ...iAttr },
            relationships: { appInfo: { data: { type: 'appInfos', id: info.id } } },
          },
        });
    if (!iAntwort.ok) {
      fehler++;
      console.error(`${b.locale} Name/Untertitel -> ${iAntwort.status}`);
      for (const z of fehlerZeilen(iAntwort.text)) console.error(`   ${z}`);
      continue;
    }

    // Beschreibung und Keywords haengen an der Version.
    const vVorhanden = vNach.get(b.locale);
    const vAttr = { description: b.texte.description, keywords: b.texte.keywords };
    const vAntwort = vVorhanden
      ? await roh('PATCH', `/appStoreVersionLocalizations/${vVorhanden.id}`, {
          data: { type: 'appStoreVersionLocalizations', id: vVorhanden.id, attributes: vAttr },
        })
      : await roh('POST', '/appStoreVersionLocalizations', {
          data: {
            type: 'appStoreVersionLocalizations',
            attributes: {
              locale: b.locale,
              ...vAttr,
              supportUrl,
              ...(marketingUrl ? { marketingUrl } : {}),
              whatsNew: b.whatsNew,
            },
            relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } } },
          },
        });
    if (!vAntwort.ok) {
      fehler++;
      console.error(`${b.locale} Beschreibung/Keywords -> ${vAntwort.status}`);
      for (const z of fehlerZeilen(vAntwort.text)) console.error(`   ${z}`);
      continue;
    }
    console.log(`${b.locale} geschrieben (${b.neu ? 'neu angelegt' : 'aktualisiert'}).`);
  }

  console.log(
    `\n${fehler === 0 ? 'Alle Sprachen geschrieben.' : `${fehler} Sprache(n) fehlgeschlagen.`} ` +
      'Nicht eingereicht — das bleibt ein eigener Schritt.'
  );
  return fehler === 0 ? 0 : 1;
}

process.exitCode = await main();
