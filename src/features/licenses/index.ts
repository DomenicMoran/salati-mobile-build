// Beigelegte Lizenz-Volltexte.
//
// Warum Volltexte statt Links: Salati gibt fremde Werke selbst weiter — das
// Sprachmodell (Qwen2.5-1.5B-Instruct) und das Spracherkennungsmodell
// (tarteel-ai/whisper-base-ar-quran) über den eigenen R2-Speicher, die
// KFGQPC-Hafs-Schrift, die drei Adhan-Aufnahmen und die Software-Bibliotheken
// im App-Bundle. Apache-2.0 §4(a) verlangt, dass JEDER Empfänger eine Kopie der
// Lizenz bekommt; MIT/BSD/ISC verlangen Urheberrechtsvermerk UND Lizenztext;
// CC BY 3.0 §4(a) und CC BY-SA 4.0 §3(a)(1) verlangen, dass jede Kopie den
// Lizenztext oder seine URI mitführt. Ein Link erfüllt das nicht zuverlässig
// (Offline-App, tote URLs).
//
// Quelle der Wahrheit sind die Dateien in public/licenses/*.txt (landen beim
// Web-Export unter https://www.salati.pro/licenses/<id>.txt). texts.json ist
// die byte-gleiche Kopie fürs App-Bundle, erzeugt von
// scripts/build-license-texts.mjs und per texts.test.ts gegen die .txt-Dateien
// abgesichert.
//
// Die Texte bleiben im englischen Original und werden NICHT übersetzt — eine
// Übersetzung ist nicht die Lizenz.
import TEXTS from './texts.json';

/** Basis-URL der Volltexte auf der Webseite (identisch mit public/licenses/). */
export const LICENSE_TEXT_BASE_URL = 'https://www.salati.pro/licenses';

/**
 * Reihenfolge = Anzeigereihenfolge auf der Lizenzseite: erst die Lizenzen der
 * Werke, die wir selbst weitergeben, dann die der mitgelieferten Bibliotheken,
 * zuletzt die Sammlung aller Urheberrechtsvermerke.
 */
export const LICENSE_TEXT_IDS = [
  'apache-2.0',
  'mit',
  'cc0-1.0',
  'cc-by-3.0',
  'cc-by-sa-4.0',
  'kfgqpc-hafs-font-eula',
  'ofl-1.1',
  'ib-rassoul-tafsir',
  'odbl-1.0',
  'bsd-2-clause',
  'bsd-3-clause',
  'isc',
  '0bsd',
  'notice',
] as const;

export type LicenseTextId = (typeof LICENSE_TEXT_IDS)[number];

/**
 * Anzeigename je Volltext. Eigennamen bzw. amtliche Lizenzbezeichnungen —
 * bewusst nicht übersetzt (wie die Werk- und Anbieternamen auf der
 * Lizenzseite). Die einzige übersetzte Zeile daneben ist "Gilt für: …".
 */
export const LICENSE_TEXT_TITLES: Record<LicenseTextId, string> = {
  'apache-2.0': 'Apache License, Version 2.0',
  mit: 'MIT License',
  'cc0-1.0': 'CC0 1.0 Universal (Public Domain Dedication)',
  'cc-by-3.0': 'Creative Commons Attribution 3.0 Unported',
  'cc-by-sa-4.0': 'Creative Commons Attribution-ShareAlike 4.0 International',
  'kfgqpc-hafs-font-eula': 'KFGQPC HAFS — End-User License Agreement',
  'ofl-1.1': 'SIL Open Font License, Version 1.1',
  'ib-rassoul-tafsir': "Tafsīr Al-Qur'ān Al-Karīm — Freigabeerklärung des Autors",
  'odbl-1.0': 'ODC Open Database License (ODbL) 1.0',
  'bsd-2-clause': 'BSD 2-Clause License',
  'bsd-3-clause': 'BSD 3-Clause License',
  isc: 'ISC License',
  '0bsd': 'BSD Zero Clause License',
  notice: 'NOTICE',
};

/**
 * Werke, für die der jeweilige Text die Pflicht erfüllt. Eigennamen, deshalb
 * unübersetzt; die Beschriftung davor kommt aus `lizenzen.appliesTo`.
 */
export const LICENSE_TEXT_WORKS: Record<LicenseTextId, string> = {
  'apache-2.0': 'Qwen2.5-1.5B-Instruct, tarteel-ai/whisper-base-ar-quran, Folly, fbjni, OpenCL-Headers, libc++',
  mit: 'React, React Native, Expo, Ionicons, llama.cpp, whisper.cpp, ggml, Hermes, Fresco, adhan, zod, TanStack Query …',
  'cc0-1.0': 'Adhan-Aufnahme „Beautiful adhan" (Adam-synagda)',
  'cc-by-3.0': 'Adhan-Aufnahme „Eid al-Fitr Fajr azan at Malmö Mosque" (Islamic Center Malmö)',
  'cc-by-sa-4.0': 'Adhan-Aufnahme „Azan" (Andrewler)',
  'kfgqpc-hafs-font-eula': 'KFGQPC HAFS Uthmanic Script',
  'ofl-1.1': 'Amiri, Amiri Quran, Scheherazade New, Lateef, Harmattan, Noto Naskh Arabic, Noto Sans Arabic',
  'ib-rassoul-tafsir': "Tafsīr Al-Qur'ān Al-Karīm (Abu-r-Ridā Muhammad Ibn Ahmad Ibn Rassoul, IB Verlag Islamische Bibliothek)",
  'odbl-1.0': 'OpenStreetMap, Open Food Facts',
  'bsd-2-clause': 'fontfaceobserver, webidl-conversions, css-select, dav1d',
  'bsd-3-clause': 'ieee754, hyphenate-style-name, hoist-non-react-statics, glog, libwebp, Zstandard, libjpeg-turbo',
  isc: 'AnyAscii, @ungap/structured-clone, picocolors',
  '0bsd': 'tslib',
  notice: 'Alle Urheberrechtsvermerke / all copyright notices',
};

/** Volltext im englischen Original, unverändert. */
export function licenseText(id: LicenseTextId): string {
  return (TEXTS as Record<string, string>)[id];
}

/** Adresse desselben Textes auf der Webseite. */
export function licenseTextUrl(id: LicenseTextId): `https://${string}` {
  const datei = id === 'notice' ? 'NOTICE.txt' : `${id}.txt`;
  return `${LICENSE_TEXT_BASE_URL}/${datei}`;
}
