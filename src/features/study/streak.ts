// Tages-Lernserie ("Streak") über ALLE Kurse hinweg (12 study/-Kurse +
// Koran-lesen-lernen) — das Duolingo-Signaturmerkmal, das dem eigenen
// Design-Zielbild "Babbel/Duolingo für den Islam" bisher fehlte (nur der
// Gebets-Tracker hatte eine Serie, das Lernen keine). Reine, testbare
// Funktion: nimmt Zeitstempel bestandener Lektionen, zählt aufeinander-
// folgende Kalendertage rückwärts ab heute.

function toLocalDateKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * @param passedTimestamps `completedAt`-Werte aller BESTANDENEN Lektionen
 *   (Aufrufer filtert nach `score/total >= PASS_RATIO`).
 * @param now Für Tests injizierbar, Default = aktueller Zeitpunkt.
 * @returns Anzahl aufeinanderfolgender Tage mit mindestens einer bestandenen
 *   Lektion. Serie bleibt "aktiv" (zeigt den Stand von gestern), solange
 *   heute noch nicht abgelaufen ist — bricht erst ab, wenn ein ganzer Tag
 *   ausgelassen wurde.
 */
export function computeLearningStreak(passedTimestamps: number[], now: Date = new Date()): number {
  if (passedTimestamps.length === 0) return 0;

  const activeDays = new Set(passedTimestamps.map(toLocalDateKey));

  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  const todayKey = toLocalDateKey(cursor.getTime());

  if (!activeDays.has(todayKey)) {
    // Heute noch nichts gelernt — Serie bleibt bestehen, solange gestern
    // aktiv war (Duolingo-Verhalten: erst nach einem VERPASSTEN Tag reißt
    // sie), zählt dann aber ab gestern statt ab heute.
    cursor.setDate(cursor.getDate() - 1);
    if (!activeDays.has(toLocalDateKey(cursor.getTime()))) return 0;
  }

  let streak = 0;
  while (activeDays.has(toLocalDateKey(cursor.getTime()))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
