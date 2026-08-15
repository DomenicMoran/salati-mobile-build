// Zentrale Deep-Link-URL-Konstruktion für "Vers/Hadith als Bild teilen"
// (share-card.tsx): hält das exakte Schema (`salatibox://…`, s. `scheme` in
// app.config.ts) an einer Stelle statt in jedem Screen erneut zusammenzubauen.
// Die Pfadstruktur folgt 1:1 dem file-based Routing von Expo Router:
// src/app/(tabs)/quran/[surah].tsx -> /quran/[surah] (die Route-Group
// "(tabs)" taucht in der URL nicht auf, Klammer-Ordner sind rein organisatorisch)
// und src/app/hadith/[collection]/[number].tsx -> /hadith/[collection]/[number].
const SCHEME = 'salatibox';

/**
 * z. B. `salatibox://quran/2?ayah=255` — der Quran-Reader-Screen liest den
 * `ayah`-Query-Param bereits (s. [surah].tsx, "Direkter Einstieg bei
 * ?ayah=") und scrollt beim Öffnen automatisch zum Vers.
 */
export function quranAyahDeepLink(surah: number, ayah: number): string {
  return `${SCHEME}://quran/${surah}?ayah=${ayah}`;
}

/** z. B. `salatibox://hadith/nawawi/1` — Collection+Nummer identifizieren
 * bereits genau einen Hadith, kein zusätzlicher Query-Param nötig. */
export function hadithDeepLink(collection: string, number: number): string {
  return `${SCHEME}://hadith/${collection}/${number}`;
}

/**
 * z. B. `salatibox://hadith/topics/5/3135` — Hadith aus der thematisch
 * geordneten HadeethEnc-Enzyklopädie. Die Kategorie steht im Pfad, weil die
 * Detailroute unter ihr liegt (src/app/hadith/topics/[category]/[id].tsx) und
 * der Empfänger so mit „Zurück" im passenden Thema landet.
 */
export function hadeethencDeepLink(categoryId: string, id: string): string {
  return `${SCHEME}://hadith/topics/${categoryId}/${id}`;
}

/** z. B. `salatibox://study/aqida` — für die Kurs-Abschluss-Teilen-Karte
 * (share-card.tsx, ShareCardContent kind 'course-complete'): springt beim
 * Empfänger direkt zur Kursübersicht, s. app/study/[course]/index.tsx. */
export function studyCourseDeepLink(courseId: string): string {
  return `${SCHEME}://study/${courseId}`;
}
