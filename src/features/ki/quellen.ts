// Antippbare Quellen im KI-Chat: Aus einem Korpus-Dokument wird das Ziel in der
// App. Nachprüfbarkeit ist bei religiösen Inhalten das zentrale
// Vertrauensmerkmal — eine Quellenangabe, die man nicht aufschlagen kann, ist
// nur halb so viel wert.
//
// Woher die Route kommt:
//   · Koran (q:Sure:Vers) und Hadith (h-nawawi-NN) — aus der Doc-ID gerechnet.
//   · Kurs/Praxis/Dua — Feld `u`, gesetzt beim Korpus-Bau (build-ki-korpus.mjs);
//     aus der ID allein wäre es nicht eindeutig rückparsbar.
//   · Grundwissen (w-*) — kein Ziel in der App; der volle Text wird im KI-Screen
//     in einem Blatt angezeigt.
import { router } from 'expo-router';

import type { KorpusDoc } from './retrieval';

export type QuellenZiel =
  | { art: 'route'; oeffne: () => void }
  /** Kein eigener Screen — der Aufrufer zeigt den vollen Text an. */
  | { art: 'text' };

const KORAN = /^q:(\d+):(\d+)$/;
const HADITH = /^h-nawawi-0*(\d+)/;
const DUA = /^\/duas\/([^/]+)$/;
const GUIDE = /^\/guides\/([^/]+)$/;
const KURS = /^\/study\/([^/]+)\/([^/]+)$/;

/**
 * Ermittelt, was beim Antippen einer Quelle passieren soll. Gibt `null` zurück,
 * wenn das Dokument weder eine Route noch einen sinnvoll anzeigbaren Text hat.
 */
export function quellenZiel(doc: KorpusDoc): QuellenZiel {
  const koran = KORAN.exec(doc.id);
  if (koran) {
    const [, surah, ayah] = koran;
    return {
      art: 'route',
      oeffne: () => router.push({ pathname: '/quran/[surah]', params: { surah: surah!, ayah: ayah! } }),
    };
  }
  const hadith = HADITH.exec(doc.id);
  if (hadith) {
    const [, nummer] = hadith;
    return {
      art: 'route',
      oeffne: () =>
        router.push({ pathname: '/hadith/[collection]/[number]', params: { collection: 'nawawi', number: nummer! } }),
    };
  }
  if (doc.u) {
    const dua = DUA.exec(doc.u);
    if (dua) {
      const [, category] = dua;
      return { art: 'route', oeffne: () => router.push({ pathname: '/duas/[category]', params: { category: category! } }) };
    }
    const guide = GUIDE.exec(doc.u);
    if (guide) {
      const [, g] = guide;
      return { art: 'route', oeffne: () => router.push({ pathname: '/guides/[guide]', params: { guide: g! } }) };
    }
    const kurs = KURS.exec(doc.u);
    if (kurs) {
      const [, course, lesson] = kurs;
      return {
        art: 'route',
        oeffne: () => router.push({ pathname: '/study/[course]/[lesson]', params: { course: course!, lesson: lesson! } }),
      };
    }
  }
  return { art: 'text' };
}

/**
 * Quellen einer Antwort für die Anzeige: je Quellenangabe nur einmal, in der
 * Reihenfolge der Treffer (die beste Passage zuerst).
 */
export function eindeutigeQuellen(docs: KorpusDoc[]): KorpusDoc[] {
  const gesehen = new Set<string>();
  return docs.filter((d) => {
    if (gesehen.has(d.src)) return false;
    gesehen.add(d.src);
    return true;
  });
}
