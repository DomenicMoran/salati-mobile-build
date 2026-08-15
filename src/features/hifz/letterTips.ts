// Makhradsch-Kurztipps (Artikulationsort) für häufig verwechselte Buchstaben —
// die "Lehrer-Ebene" des Rezitations-Checks: erkennt der Wort-Abgleich eine
// Buchstaben-Ersetzung (z. B. ح statt خ), zeigt die UI den Tipp zum
// ZIEL-Buchstaben. Bewusst als Hinweis formuliert ("klang wie"), nie als
// Urteil — die Abweichung kann auch ein Hörfehler des Modells sein.
// Locale-Keys: hifz.letterTips.<key> (6-sprachig in den locales-Dateien).

const LETTER_TIP_KEYS: Record<string, string> = {
  ق: 'qaf',
  ك: 'kaf',
  ح: 'hha',
  خ: 'kha',
  ه: 'ha',
  ع: 'ain',
  ء: 'hamza',
  ذ: 'dhal',
  ز: 'zay',
  ظ: 'zza',
  س: 'sin',
  ص: 'sad',
  ت: 'ta',
  ط: 'tta',
  د: 'dal',
  ض: 'dad',
  غ: 'ghain',
};

/** Locale-Key-Suffix für den Tipp zum Ziel-Buchstaben — null, wenn keiner existiert. */
export function letterTipKey(targetChar: string): string | null {
  return LETTER_TIP_KEYS[targetChar] ?? null;
}
