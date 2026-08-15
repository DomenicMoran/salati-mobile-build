// Kuratierter Pool für die "Vers/Hadith des Tages"-Erinnerung: bewusst NUR
// bekannte, häufig zitierte Koran-Verse (Ayat al-Kursi, die letzten 3 Suren,
// zentrale Geduld-/Dankbarkeits-/Vertrauens-Verse) und Hadithe aus der
// An-Nawawi-40-Sammlung (schon Teil der App, s. features/hadith/api.ts
// COLLECTIONS) — KEIN Zufalls-Pick über den gesamten Koran/alle Hadith-
// Sammlungen wie die einfachere "Ayah des Tages" in apps/device
// (SalatiDashboard.tsx), die auch selten gelesene, kontextlose Rechts-/
// Erzähl-Verse treffen könnte. Für eine tägliche Notification-Vorschau ohne
// Kontext (Tafsir, umliegende Verse) müssen die Inhalte für sich stehen
// können — deshalb die feste, kleine Auswahl.
//
// Nur Referenzen (surah:ayah bzw. Nawawi-Hadithnummer), KEIN Text hier:
// die eigentlichen Arabisch-/Übersetzungs-Texte kommen live aus der
// bestehenden API-Schicht (features/quran/api.ts / features/hadith/api.ts,
// s. content.ts) — der Auftrag verlangt ausdrücklich, vorhandene mehrsprachige
// App-Inhalte zu nutzen statt selbst neue Übersetzungen religiöser Texte zu
// erfinden.
export interface VerseRef {
  kind: 'verse';
  surah: number;
  ayah: number;
}

export interface HadithRef {
  kind: 'hadith';
  /** Nummer innerhalb der An-Nawawi-40-Sammlung (features/hadith/api.ts COLLECTIONS 'nawawi'). */
  number: number;
}

export type VerseOfDayRef = VerseRef | HadithRef;

export const VERSE_OF_DAY_POOL: VerseOfDayRef[] = [
  { kind: 'verse', surah: 2, ayah: 255 }, // Ayat al-Kursi
  { kind: 'verse', surah: 112, ayah: 1 }, // Al-Ikhlas
  { kind: 'verse', surah: 113, ayah: 1 }, // Al-Falaq
  { kind: 'verse', surah: 114, ayah: 1 }, // An-Nas
  { kind: 'verse', surah: 2, ayah: 153 }, // Geduld + Gebet
  { kind: 'verse', surah: 94, ayah: 5 }, // "Mit der Not kommt Erleichterung"
  { kind: 'verse', surah: 14, ayah: 7 }, // Dankbarkeit
  { kind: 'verse', surah: 65, ayah: 3 }, // Vertrauen auf Allah
  { kind: 'verse', surah: 3, ayah: 139 }, // "Verzage nicht, sei nicht traurig"
  { kind: 'verse', surah: 13, ayah: 28 }, // Ruhe im Gedenken Allahs
  { kind: 'hadith', number: 1 }, // "Taten [werden bewertet] nach den Absichten"
  { kind: 'hadith', number: 13 }, // Bruderliebe
  { kind: 'hadith', number: 15 }, // Gutes sagen oder schweigen
  { kind: 'hadith', number: 18 }, // Gottesfurcht + gute Taten
];

/**
 * Tag im Jahr, 1-basiert (1. Januar = 1). Rechnet ausschließlich mit den
 * Kalenderfeldern (Jahr/Monat/Tag) über `Date.UTC` statt mit `getTime()`-
 * Differenzen zweier lokaler `Date`-Objekte — Sommerzeit-Wechsel würden bei
 * lokalen Zeitstempeln (z. B. `date` kurz vor Mitternacht, `start` in einer
 * anderen DST-Phase) sonst zu einer ±1-Stunde-Verschiebung führen, die exakt
 * an der Tagesgrenze den falschen Tag liefern kann. Die Uhrzeit in `date`
 * spielt bewusst keine Rolle, nur das Kalenderdatum zählt.
 */
export function dayOfYear(date: Date): number {
  const utcDate = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const utcYearStart = Date.UTC(date.getFullYear(), 0, 1);
  return Math.floor((utcDate - utcYearStart) / 86400000) + 1;
}

/**
 * Wählt deterministisch EINEN Pool-Eintrag für `date` — Tag-des-Jahres
 * modulo Pool-Größe, damit derselbe Kalendertag bei jedem Aufruf (auch nach
 * App-Neustart) denselben Vers/Hadith liefert, aber im Jahresverlauf durch
 * den ganzen Pool rotiert.
 */
export function pickVerseOfDayRef(date: Date, pool: VerseOfDayRef[] = VERSE_OF_DAY_POOL): VerseOfDayRef {
  const idx = dayOfYear(date) % pool.length;
  return pool[idx];
}
