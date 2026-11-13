/** Deterministischer Vers/Hadith-Index aus Kalendertag (lokale JSON-Daten). */
export function wisdomIndexForDate(date: Date, poolSize: number): number {
  if (poolSize <= 0) return 0;
  const key = date.getFullYear() * 400 + date.getMonth() * 31 + date.getDate();
  return Math.abs(key) % poolSize;
}
