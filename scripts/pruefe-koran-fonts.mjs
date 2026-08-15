// Prueft jede in features/quran/fonts.ts gelistete Schrift daraufhin, ob sie
// koranischen Text ueberhaupt vollstaendig darstellen kann - und ob die dort
// hinterlegten Metriken zur Datei passen.
//
// Warum als Skript und nicht als Jest-Test: die TTF-Dateien werden hier BYTEWEISE
// gelesen (cmap/head/hhea/OS-2/glyf). Das gehoert nicht in die Test-Suite, die
// bei jedem Speichern laeuft, sondern vor ein Release bzw. beim Hinzufuegen
// einer Schrift.
//
// Aufruf:  node scripts/pruefe-koran-fonts.mjs
// Exit 1, sobald eine Schrift ein noetiges Zeichen NICHT hat oder eine Metrik
// in fonts.ts von der Datei abweicht.
//
// Hintergrund: an genau dieser Pruefung sind am 2026-07-31 fuenf naheliegende
// Kandidaten gescheitert (Noto Nastaliq Urdu, Gulzar, Markazi Text, Mirza,
// Alkalami) - alle haetten mitten im Vers Tofu-Kaestchen erzeugt, weil ihnen
// die Waqf-/Rezitationszeichen fehlen. Eine Schrift "sieht arabisch aus" heisst
// nicht, dass sie den Koran setzen kann.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MOBILE = path.join(HIER, '..');
const FONT_DIR = path.join(MOBILE, 'assets', 'fonts');

/** Datei je Schrift-Kennung aus features/quran/useQuranFont.ts (FONT_ASSETS). */
const DATEIEN = {
  kfgqpc: 'kfgqpc-hafs.ttf',
  'amiri-quran': 'amiri-quran.ttf',
  amiri: 'amiri.ttf',
  scheherazade: 'scheherazade-new.ttf',
  lateef: 'lateef.ttf',
  harmattan: 'harmattan.ttf',
  noto: 'noto-naskh-arabic.ttf',
  'noto-sans': 'noto-sans-arabic.ttf',
};

/**
 * Pflicht-Zeichenbereiche fuer koranischen Text. Bewusst NICHT dabei:
 * U+06E5/U+06E6 (kleines Waw/Ya) fehlen selbst guten Naskh-Schriften
 * gelegentlich - sie stehen weiter unten als reine WARNUNG.
 */
const PFLICHT = {
  'Harakat/Tanwin': [0x064b, 0x0652],
  'Hamza-Aufsaetze': [0x0653, 0x0655],
  'Alif khanjariyya': [0x0670, 0x0670],
  'Alif wasla': [0x0671, 0x0671],
  'Waqf-/Rezitationszeichen': [0x06d6, 0x06dc],
  'Koranzeichen (Fortsetzung)': [0x06df, 0x06e4],
  'Koranzeichen (Schluss)': [0x06ea, 0x06ed],
  'Sure-/Vers-Ende': [0x06dd, 0x06dd],
  'Arabische Ziffern': [0x0660, 0x0669],
};
const WARNUNG = { 'Kleines Waw/Ya': [0x06e5, 0x06e6] };

/**
 * Zeichen, die die App AUSSERHALB der Versdaten mit der Koran-Schrift setzt.
 * Sie stehen hier getrennt, weil eine Schrift sie nur dann braucht, wenn sie
 * das Vers-Ende nicht selbst als Ornament zeichnet (s. `ORNAMENT_AUSNAHME`).
 */
const UI_ZEICHEN = {
  'Ornament-Klammer auf U+FD3F': 0xfd3f,
  'Ornament-Klammer zu U+FD3E': 0xfd3e,
};
/** Zeichen, die JEDE Schrift koennen muss (Traeger und Sajda-Zeichen). */
const UI_ZEICHEN_IMMER = {
  'Sajda U+06E9': 0x06e9,
  'NBSP U+00A0': 0x00a0,
  'Tatweel U+0640': 0x0640,
};

/**
 * Zeichenvorrat des INDOPAK-Schriftbildes (api.quran.com/quran/verses/indopak,
 * 6.236 Verse), nach derselben Normalisierung, die die App anwendet
 * (lib/arabicText.ts: PUA raus, Sonder-Leerzeichen vereinheitlicht,
 * Praesentationsformen aufgeloest).
 *
 * Darin stecken Buchstaben, die im arabischen Korantext NICHT vorkommen —
 * Keheh U+06A9, Heh Doachashmee U+06BE, Heh Goal U+06C1, Farsi Yeh U+06CC,
 * Yeh Barree U+06D2, hohe Hamza U+0674. Zwei der acht Schriften haben sie nicht;
 * die duerfen dieses Schriftbild deshalb nicht setzen (canRenderIndoPak).
 */
const INDOPAK_KORPUS = [
  0x0614, 0x0615, 0x0621, 0x0622, 0x0624, 0x0626, 0x0627, 0x0628, 0x0629, 0x062a,
  0x062b, 0x062c, 0x062d, 0x062e, 0x062f, 0x0630, 0x0631, 0x0632, 0x0633, 0x0634,
  0x0635, 0x0636, 0x0637, 0x0638, 0x0639, 0x063a, 0x0640, 0x0641, 0x0642, 0x0643,
  0x0644, 0x0645, 0x0646, 0x0647, 0x0648, 0x0649, 0x064a, 0x064b, 0x064c, 0x064d,
  0x064e, 0x064f, 0x0650, 0x0651, 0x0652, 0x0653, 0x0654, 0x0655, 0x0656, 0x0657,
  0x066e, 0x0670, 0x0674, 0x06a9, 0x06aa, 0x06be, 0x06c1, 0x06cc, 0x06d2, 0x06d6,
  0x06d8, 0x06d9, 0x06da, 0x06db, 0x06dc, 0x06df, 0x06e1, 0x06e2, 0x06e4, 0x06e6,
  0x06e8, 0x06e9, 0x06eb, 0x06ed,
];

/**
 * Der VOLLSTAENDIGE Zeichenvorrat des Uthmani-Lesepfads — am 2026-07-31 aus
 * beiden Textquellen der App ausgezaehlt (api.quran.com/quran/verses/uthmani und
 * api.alquran.cloud/quran/quran-uthmani, je 6.236 Verse). Nicht die frueher
 * gepflegte Wunschliste, sondern das, was tatsaechlich auf dem Bildschirm landet.
 */
const UTHMANI_KORPUS = [
  0x0621, 0x0622, 0x0623, 0x0624, 0x0625, 0x0626, 0x0627, 0x0628, 0x0629, 0x062a,
  0x062b, 0x062c, 0x062d, 0x062e, 0x062f, 0x0630, 0x0631, 0x0632, 0x0633, 0x0634,
  0x0635, 0x0636, 0x0637, 0x0638, 0x0639, 0x063a, 0x0640, 0x0641, 0x0642, 0x0643,
  0x0644, 0x0645, 0x0646, 0x0647, 0x0648, 0x0649, 0x064a, 0x064b, 0x064c, 0x064d,
  0x064e, 0x064f, 0x0650, 0x0651, 0x0652, 0x0653, 0x0654, 0x0670, 0x0671, 0x06d6,
  0x06d7, 0x06d8, 0x06d9, 0x06da, 0x06db, 0x06dc, 0x06de, 0x06df, 0x06e0, 0x06e2,
  0x06e3, 0x06e5, 0x06e6, 0x06e7, 0x06e8, 0x06e9, 0x06ea, 0x06eb, 0x06ec, 0x06ed,
];

/**
 * Die Umschreibung aus features/quran/fonts.ts (`adaptQuranText`) — hier
 * gespiegelt, damit die Pruefung genau die Zeichen sieht, die nach der
 * Anpassung wirklich gerendert werden. fonts.test.ts haelt beide Seiten
 * zusammen; weicht eine ab, faellt es dort auf.
 */
const KFGQPC_ABBILDUNG = new Map([
  [0x0652, 0x06e1],
  [0x06df, 0x0652],
  [0x06e3, 0x06dc],
  [0x06eb, 0x06ec],
]);
function angepasst(cp, encoding) {
  return encoding === 'kfgqpc' ? (KFGQPC_ABBILDUNG.get(cp) ?? cp) : cp;
}

const u16 = (b, o) => b.readUInt16BE(o);
const i16 = (b, o) => b.readInt16BE(o);
const u32 = (b, o) => b.readUInt32BE(o);

function tabellen(buf) {
  const n = u16(buf, 4);
  const t = {};
  for (let i = 0; i < n; i++) {
    const o = 12 + i * 16;
    t[buf.toString('ascii', o, o + 4)] = { off: u32(buf, o + 8), len: u32(buf, o + 12) };
  }
  return t;
}

function gid(buf, t, cp) {
  const base = t.cmap.off;
  const n = u16(buf, base + 2);
  let sub = null;
  for (let i = 0; i < n; i++) {
    const r = base + 4 + i * 8;
    const pid = u16(buf, r);
    const eid = u16(buf, r + 2);
    const off = base + u32(buf, r + 4);
    const fmt = u16(buf, off);
    if (fmt === 4 && pid === 3) sub = { off, fmt };
    if (fmt === 12 && pid === 3 && eid === 10) {
      sub = { off, fmt };
      break;
    }
  }
  if (!sub) return 0;
  if (sub.fmt === 4) {
    const o = sub.off;
    const segX2 = u16(buf, o + 6);
    const endO = o + 14;
    const startO = endO + segX2 + 2;
    const deltaO = startO + segX2;
    const rangeO = deltaO + segX2;
    for (let i = 0; i < segX2 / 2; i++) {
      const end = u16(buf, endO + i * 2);
      const start = u16(buf, startO + i * 2);
      if (cp < start || cp > end) continue;
      const ro = u16(buf, rangeO + i * 2);
      if (ro === 0) return (cp + u16(buf, deltaO + i * 2)) & 0xffff;
      const g = u16(buf, rangeO + i * 2 + ro + (cp - start) * 2);
      return g ? (g + u16(buf, deltaO + i * 2)) & 0xffff : 0;
    }
    return 0;
  }
  const o = sub.off;
  const gruppen = u32(buf, o + 12);
  for (let i = 0; i < gruppen; i++) {
    const g = o + 16 + i * 12;
    if (cp >= u32(buf, g) && cp <= u32(buf, g + 4)) return u32(buf, g + 8) + (cp - u32(buf, g));
  }
  return 0;
}

function fehlend(buf, t, bereiche) {
  const raus = [];
  for (const [label, [a, z]] of Object.entries(bereiche)) {
    for (let cp = a; cp <= z; cp++) {
      if (gid(buf, t, cp) === 0) raus.push(`${label} U+${cp.toString(16).toUpperCase()}`);
    }
  }
  return raus;
}

/**
 * Rohe Glyph-Daten (glyf-Eintrag) eines Codepoints — Grundlage der
 * Platzhalter-Erkennung.
 *
 * WARUM das noetig ist: ein cmap-Eintrag beweist NICHT, dass eine Schrift das
 * Zeichen zeichnen kann. Der KFGQPC-Font traegt 171 Codepoints ein, die er
 * nicht unterstuetzt, und zeigt fuer alle DENSELBEN Platzhalter (ausgefuellter
 * Punkt in gepunktetem Kreis) statt .notdef. Genau daran ist die alte Pruefung
 * vorbeigelaufen: sie fragte nur die cmap.
 *
 * Erkennungsregel: ein Umriss, den sich im Bereich U+0600–U+06FF zehn oder mehr
 * Codepoints teilen, kann kein echter Buchstabe sein.
 */
function glyphDaten(buf, t, cp) {
  if (!t.glyf || !t.loca) return null;
  const langLoca = i16(buf, t.head.off + 50) === 1;
  const g = gid(buf, t, cp);
  if (g === 0) return null;
  const off = langLoca ? u32(buf, t.loca.off + g * 4) : u16(buf, t.loca.off + g * 2) * 2;
  const end = langLoca ? u32(buf, t.loca.off + (g + 1) * 4) : u16(buf, t.loca.off + (g + 1) * 2) * 2;
  if (end <= off) return null;
  return buf.toString('base64', t.glyf.off + off, t.glyf.off + end);
}

/** Umrisse, die sich >= GETEILT_AB Codepoints teilen = Platzhalter. */
const GETEILT_AB = 10;
function platzhalterUmrisse(buf, t) {
  const zaehler = new Map();
  for (let cp = 0x0600; cp <= 0x06ff; cp++) {
    const d = glyphDaten(buf, t, cp);
    if (d) zaehler.set(d, (zaehler.get(d) ?? 0) + 1);
  }
  return new Set([...zaehler.entries()].filter(([, n]) => n >= GETEILT_AB).map(([d]) => d));
}

/** Bounding-Box eines Glyphen aus der glyf-Tabelle, in em. */
function glyphBox(buf, t, cp) {
  if (!t.glyf || !t.loca) return null;
  const upem = u16(buf, t.head.off + 18);
  const langLoca = i16(buf, t.head.off + 50) === 1;
  const g = gid(buf, t, cp);
  const off = langLoca ? u32(buf, t.loca.off + g * 4) : u16(buf, t.loca.off + g * 2) * 2;
  const end = langLoca ? u32(buf, t.loca.off + (g + 1) * 4) : u16(buf, t.loca.off + (g + 1) * 2) * 2;
  if (end <= off) return null;
  const b = t.glyf.off + off;
  // glyf-Kopf: numberOfContours, xMin, yMin, xMax, yMax (je int16)
  const xMin = i16(buf, b + 2), yMin = i16(buf, b + 4), xMax = i16(buf, b + 6), yMax = i16(buf, b + 8);
  return { breiteEm: (xMax - xMin) / upem, hoeheEm: (yMax - yMin) / upem, yMaxEm: yMax / upem };
}

/** Ink-Box (usWinAscent + usWinDescent), Alif-Hoehe und Ziffern-Box in em. */
function metriken(buf, t) {
  const upem = u16(buf, t.head.off + 18);
  const os2 = t['OS/2'].off;
  const lineBoxEm = (u16(buf, os2 + 74) + u16(buf, os2 + 76)) / upem;
  const alif = glyphBox(buf, t, 0x0627);
  return { lineBoxEm, alifEm: alif ? alif.yMaxEm : null, ziffer: glyphBox(buf, t, 0x0667) };
}

/**
 * Woran man erkennt, dass eine Schrift die Versnummer selbst als Vers-Ende-
 * Ornament setzt (verzierter Kreis mit der Nummer darin, Druckbild der Madina-
 * Ausgabe): ihre Ziffern sind deutlich KLEINER als ihr Alif, weil sie fuer das
 * Innere des Kreises gezeichnet sind.
 *
 * Das Ornament selbst steht nicht in der cmap — es entsteht erst beim Formen
 * durch eine GSUB-Ersetzung. Bytewise sichtbar ist deshalb nur die Ziffer, und
 * genau deren Groessenverhaeltnis trennt sauber. Gemessen am 2026-07-31 ueber
 * alle acht Dateien (Ziffer U+0667 zu Alif U+0627, jeweils Ink-Hoehe):
 *
 *   KFGQPC HAFS     0.27 / 0.633 = 0.43   <- Ziffer fuer das Kreisinnere
 *   Scheherazade    0.59 / 0.700 = 0.84   <- naechster Wert
 *   uebrige sechs                  0.85 - 1.01
 *
 * Gegenprobe mit HarfBuzz (gleicher Tag): "٢٥٦" ergibt bei KFGQPC EINEN Glyphen
 * von 0.89 × 0.72 em, bei jeder anderen Schrift drei Ziffern-Glyphen.
 */
const ORNAMENT_ZIFFER_ZU_ALIF = 0.65;

/** fonts.ts ist TypeScript — die Zahlen werden per Regex gelesen, kein Import. */
function registry() {
  const quelle = readFileSync(path.join(MOBILE, 'src', 'features', 'quran', 'fonts.ts'), 'utf8');
  const eintraege = [];
  const re =
    /id:\s*'([a-z-]+)',[\s\S]*?lineBoxEm:\s*([\d.]+),\s*sizeFactor:\s*([^,]+),\s*digitsAreAyahOrnament:\s*(true|false),\s*textEncoding:\s*'(unicode|kfgqpc)',\s*canRenderIndoPak:\s*(true|false),/g;
  let m;
  while ((m = re.exec(quelle))) {
    const roh = m[3].trim();
    const teil = roh.match(/REFERENCE_ALIF_EM\s*\/\s*([\d.]+)/);
    eintraege.push({
      id: m[1],
      lineBoxEm: Number(m[2]),
      alifEm: teil ? Number(teil[1]) : 0.633,
      ornament: m[4] === 'true',
      encoding: m[5],
      indopak: m[6] === 'true',
    });
  }
  return eintraege;
}

let fehler = 0;
const eintraege = registry();
if (eintraege.length === 0) {
  console.error('fonts.ts konnte nicht gelesen werden (Regex passt nicht mehr).');
  process.exit(1);
}

for (const eintrag of eintraege) {
  const datei = DATEIEN[eintrag.id];
  if (!datei) {
    console.error(`FEHLER ${eintrag.id}: keine Datei in DATEIEN hinterlegt`);
    fehler++;
    continue;
  }
  const buf = readFileSync(path.join(FONT_DIR, datei));
  const t = tabellen(buf);
  const luecken = fehlend(buf, t, PFLICHT);
  const warnungen = fehlend(buf, t, WARNUNG);
  const gemessen = metriken(buf, t);

  const kb = (buf.length / 1024).toFixed(0);
  if (luecken.length > 0) {
    console.error(`FEHLER ${eintrag.id} (${datei}, ${kb} KB): ${luecken.length} Zeichen fehlen`);
    console.error(`        ${luecken.slice(0, 8).join(', ')}${luecken.length > 8 ? ' …' : ''}`);
    fehler++;
    continue;
  }

  const boxAb = Math.abs(gemessen.lineBoxEm - eintrag.lineBoxEm);
  const alifAb = gemessen.alifEm === null ? 0 : Math.abs(gemessen.alifEm - eintrag.alifEm);
  if (boxAb > 0.01 || alifAb > 0.01) {
    console.error(
      `FEHLER ${eintrag.id}: Metrik weicht ab — fonts.ts sagt ${eintrag.lineBoxEm}/${eintrag.alifEm}, ` +
        `Datei sagt ${gemessen.lineBoxEm.toFixed(3)}/${gemessen.alifEm?.toFixed(3)}`,
    );
    fehler++;
    continue;
  }

  // Zeichnet die Schrift die Ziffer als Vers-Ende-Ornament? Das entscheidet,
  // ob die App die Ornament-Klammern ﴿ ﴾ selbst setzen darf (fonts.ts:ayahMarker).
  const z = gemessen.ziffer;
  const verhaeltnis = z !== null && gemessen.alifEm ? z.hoeheEm / gemessen.alifEm : null;
  const istOrnament = verhaeltnis !== null && verhaeltnis < ORNAMENT_ZIFFER_ZU_ALIF;
  if (istOrnament !== eintrag.ornament) {
    console.error(
      `FEHLER ${eintrag.id}: digitsAreAyahOrnament steht auf ${eintrag.ornament}, gemessen ist ` +
        `${istOrnament} (Ziffer/Alif = ${verhaeltnis?.toFixed(2) ?? 'keine Box'})`,
    );
    fehler++;
    continue;
  }

  // Eine Schrift ohne eigenes Ornament muss die Klammern ﴿ ﴾ liefern können —
  // sonst holt Android sie aus einer fremden Schrift (geschweifte Klammern
  // statt Ornament, Befund vom 2026-07-31).
  const uiLuecken = [
    ...Object.entries(UI_ZEICHEN_IMMER),
    ...(istOrnament ? [] : Object.entries(UI_ZEICHEN)),
  ]
    .filter(([, cp]) => gid(buf, t, cp) === 0)
    .map(([label]) => label);
  if (uiLuecken.length > 0) {
    console.error(`FEHLER ${eintrag.id}: Zeichen der Oberfläche fehlen — ${uiLuecken.join(', ')}`);
    fehler++;
    continue;
  }

  // Die eigentliche Probe: zeigt die Schrift JEDES Zeichen wirklich — oder nur
  // ihren Platzhalter? (Ein cmap-Eintrag beweist nichts.)
  const platzhalter = platzhalterUmrisse(buf, t);
  const pruefeKorpus = (korpus) => {
    const raus = [];
    for (const cp of korpus) {
      const ziel = angepasst(cp, eintrag.encoding);
      const d = glyphDaten(buf, t, ziel);
      if (d === null) raus.push({ cp, ziel, grund: 'kein Glyph' });
      else if (platzhalter.has(d)) raus.push({ cp, ziel, grund: 'Platzhalter' });
    }
    return raus;
  };
  const melde = (schriftbild, kaputt) => {
    console.error(`FEHLER ${eintrag.id}: ${kaputt.length} ${schriftbild}-Zeichen werden nicht dargestellt`);
    for (const k of kaputt) {
      const via = k.ziel === k.cp ? '' : ` (angepasst aus U+${k.cp.toString(16).toUpperCase()})`;
      console.error(`        U+${k.ziel.toString(16).toUpperCase().padStart(4, '0')}${via}: ${k.grund}`);
    }
    fehler++;
  };

  const uthmaniLuecken = pruefeKorpus(UTHMANI_KORPUS);
  if (uthmaniLuecken.length > 0) {
    // Uthmani MUSS jede gelistete Schrift koennen — das ist der Lesepfad.
    melde('Uthmani', uthmaniLuecken);
    continue;
  }

  // IndoPak darf eine Schrift nicht koennen; dann muss sie sich aber als
  // `canRenderIndoPak: false` deklarieren, damit die App sie dafuer nicht nimmt.
  const indopakLuecken = pruefeKorpus(INDOPAK_KORPUS);
  if (indopakLuecken.length > 0 && eintrag.indopak) {
    melde('IndoPak', indopakLuecken);
    continue;
  }
  if (indopakLuecken.length === 0 && !eintrag.indopak) {
    console.error(
      `FEHLER ${eintrag.id}: canRenderIndoPak steht auf false, die Schrift setzt IndoPak aber vollstaendig`,
    );
    fehler++;
    continue;
  }

  console.log(
    `OK    ${eintrag.id.padEnd(13)} ${datei.padEnd(24)} ${kb.padStart(4)} KB  ` +
      `Box ${gemessen.lineBoxEm.toFixed(3)} em  Alif ${gemessen.alifEm?.toFixed(3)} em  ` +
      `Ziffer/Alif ${verhaeltnis?.toFixed(2) ?? '—'}${istOrnament ? ' (Ornament)' : ''}` +
      (warnungen.length > 0 ? `  (Hinweis: ${warnungen.join(', ')} fehlt)` : ''),
  );
}

const gesamt = Object.values(DATEIEN).reduce(
  (summe, datei) => summe + readFileSync(path.join(FONT_DIR, datei)).length,
  0,
);
console.log(`\n${eintraege.length} Schriften, zusammen ${(gesamt / 1024 / 1024).toFixed(2)} MB im Bundle.`);

if (fehler > 0) {
  console.error(`\n${fehler} Schrift(en) nicht koran-tauglich bzw. Metrik falsch.`);
  process.exit(1);
}
