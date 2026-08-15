// Vollständige Koran-Übersetzungen von api.alquran.cloud holen und AUSSERHALB
// des Repos zwischenspeichern.
//
// Warum ausserhalb: 14 Ausgaben à 6.236 Verse sind zusammen rund 40 MB Rohdaten.
// Sie werden nur beim Korpus-Bau gebraucht (scripts/build-ki-korpus.mjs) und
// haben weder im Git-Verlauf noch im App-Bundle etwas verloren. Die fertigen
// Korpora sind mit ~1-2 MB je Sprache das einzige Auslieferungsartefakt.
//
// Es sind VERÖFFENTLICHTE Übersetzungen (Bubenheim, Diyanet, Kuliev …), keine
// Maschinenübersetzung — genau darum geht es: das 1,5-B-Gerätemodell muss dann
// nur noch nah am Wortlaut der Quelle bleiben, statt selbst zu übersetzen
// (Messprotokoll dazu im Kopf von src/features/ki/sprachen.ts).
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Übersetzungs-Ausgabe je App-Sprache.
 *
 * Deckungsgleich mit BEST_TRANSLATIONS in src/features/quran/api.ts — mit EINER
 * bewussten Abweichung: dort steht für Malaiisch `qcom.39` (quran.com), weil die
 * App-Leseansicht Al Quran Cloud damals nicht mit Basmeih fand. Al Quran Cloud
 * führt dieselbe Übersetzung inzwischen als `ms.basmeih` (Abdullah Muhammad
 * Basmeih — identischer Übersetzer), sodass der Korpus-Bau ohne zweite API
 * auskommt.
 */
export const KORAN_AUSGABEN = {
  de: 'de.bubenheim',
  en: 'en.sahih',
  tr: 'tr.diyanet',
  ar: 'ar.muyassar', // at-Tafsir al-Muyassar: leicht verständliches Arabisch statt Übersetzung
  es: 'es.garcia',
  fr: 'fr.hamidullah',
  ru: 'ru.kuliev',
  id: 'id.indonesian',
  ms: 'ms.basmeih',
  bn: 'bn.bengali',
  ur: 'ur.jalandhry',
  fa: 'fa.fooladvand',
  ps: 'ps.abdulwali',
  sw: 'sw.barwani',
};

export const SPRACHEN = Object.keys(KORAN_AUSGABEN);

/** Cache-Verzeichnis (überschreibbar per SALATI_KI_CACHE). Liegt NIE im Repo. */
export function cacheVerzeichnis() {
  return process.env.SALATI_KI_CACHE || path.join(os.homedir(), '.cache', 'salati-ki-korpus');
}

const BASIS = 'https://api.alquran.cloud/v1/quran';

async function holeMitWiederholung(url, versuche = 4) {
  let letzterFehler;
  for (let i = 0; i < versuche; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'salati-korpus-build' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      letzterFehler = e;
      // Al Quran Cloud drosselt bei 14 Volldownloads hintereinander gelegentlich.
      await new Promise((res) => setTimeout(res, 2000 * (i + 1)));
    }
  }
  throw letzterFehler;
}

/**
 * Liefert `Map<"sure:vers", Text>` einer Ausgabe. Lädt einmalig und legt die
 * Rohdaten im Cache ab; danach rein lokal.
 */
export async function ladeAusgabe(edition) {
  const dir = cacheVerzeichnis();
  mkdirSync(dir, { recursive: true });
  const datei = path.join(dir, `${edition}.json`);
  let roh;
  if (existsSync(datei)) {
    roh = JSON.parse(readFileSync(datei, 'utf8'));
  } else {
    const j = await holeMitWiederholung(`${BASIS}/${edition}`);
    const verse = {};
    for (const sure of j.data?.surahs ?? []) {
      for (const ayah of sure.ayahs ?? []) verse[`${sure.number}:${ayah.numberInSurah}`] = ayah.text;
    }
    if (Object.keys(verse).length < 6000) throw new Error(`${edition}: nur ${Object.keys(verse).length} Verse erhalten`);
    roh = { edition, verse };
    writeFileSync(datei, JSON.stringify(roh));
  }
  return new Map(Object.entries(roh.verse));
}
