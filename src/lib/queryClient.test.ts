// Was in die AsyncStorage-Ablage des Query-Caches darf — und was nicht.
//
// Hintergrund: die Ablage ist auf Android EINE SQLite-Zeile. Ab ~2 MB wirft
// ihr Lesen SQLiteBlobTooBigException und der Persister verwirft den GESAMTEN
// abgelegten Cache; das Offline-Paket war damit bei jedem Start weg. Diese
// Prüfung hält beide Richtungen fest: was heraus MUSS (Doppelspeicherung,
// Fehlschläge) und was drin BLEIBEN muss (das eigentliche Offline-Paket).
import { istLokalOhneAblageVerfuegbar, sollInDieAblage } from './queryClient';

function erfolg(queryKey: readonly unknown[]) {
  return { queryKey, state: { status: 'success' } };
}

describe('istLokalOhneAblageVerfuegbar', () => {
  it('schlägt bei den Abfragen an, deren Inhalt schon als Datei/im Bundle liegt', () => {
    // Morphologie/Wurzeln (features/quran/morphologie.ts), Wort-für-Wort
    // (features/quran/wbw.ts) und die quran.com-Wortliste
    // (features/quran/wortliste.ts) schreiben ihren Inhalt ins
    // Dokumentverzeichnis, das Lexikon lädt aus dem JS-Bundle bzw. über
    // dieselbe Datei-Schicht.
    for (const key of [
      ['quran', 'morphologie', 2],
      ['quran', 'wurzeln'],
      ['quran', 'wbw', 'ur', 2],
      ['quran', 'wbw', 'meta'],
      ['quran', 'word-by-word', 2],
      ['lexikon', 'roots'],
      ['lexikon', 'lemmas'],
      ['lexikon', 'meta'],
      ['lexikon', 'erklaerungen', 'nomen'],
      ['lexikon', 'paradigmTabellenAlle'],
      ['lexikon', 'wortlistenUebersetzung', 'ur'],
    ]) {
      expect(istLokalOhneAblageVerfuegbar(key)).toBe(true);
    }
  });

  it('schlägt NICHT bei den Abfragen an, die ohne Ablage offline verloren wären', () => {
    for (const key of [
      ['quran', 'surah', 2, 1, 'de.aburida', 'ar.alafasy'],
      ['quran', 'translation2', 2, 'en.sahih'],
      ['quran', 'tafsir', 2, 'de.bubenheim'],
      ['quran', 'segments', 2, 7],
      ['quran', 'tajweed', 2],
      ['prayer', 'times', 5],
      ['podcast', 'index'],
      ['hadith', 'collection', 'bukhari', 'de'],
      ['lexika'], // Präfix-Verwechslung: nur exakt 'lexikon' zählt
      ['quran'], // unvollständiger Schlüssel darf nichts ausschließen
    ]) {
      expect(istLokalOhneAblageVerfuegbar(key)).toBe(false);
    }
  });
});

describe('sollInDieAblage', () => {
  it('lässt erfolgreiche Offline-Einträge durch', () => {
    expect(sollInDieAblage(erfolg(['quran', 'surah', 2, 1, 'de.aburida', 'ar.alafasy']))).toBe(true);
  });

  it('hält die doppelt gespeicherten Großdaten heraus, obwohl sie erfolgreich sind', () => {
    expect(sollInDieAblage(erfolg(['quran', 'morphologie', 2]))).toBe(false);
    expect(sollInDieAblage(erfolg(['quran', 'wbw', 'ur', 2]))).toBe(false);
    expect(sollInDieAblage(erfolg(['quran', 'word-by-word', 2]))).toBe(false);
    expect(sollInDieAblage(erfolg(['lexikon', 'lemmas']))).toBe(false);
  });

  it('hält Fehlschläge heraus — ein Timeout darf nicht wie ein Ergebnis überdauern', () => {
    expect(sollInDieAblage({ queryKey: ['quran', 'surah', 2], state: { status: 'error' } })).toBe(false);
    expect(sollInDieAblage({ queryKey: ['quran', 'surah', 2], state: { status: 'pending' } })).toBe(false);
  });
});
