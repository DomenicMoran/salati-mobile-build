// Vergleich "gesprochene Rezitation vs. Ayah-Text" für den Hifz-Trainer.
// Reine Funktionen — testbar ohne Speech-API.

// Harakat/Tanwin (064B–0652), Hamza-Aufsätze (0653–0655), Alif khanjariyya
// (0670), Koran-Annotationszeichen (06D6–06ED), Tatweel (0640)
const DIACRITICS = /[ً-ْٓ-ٰٕۖ-ۭـ]/g;

/**
 * Normalisiert arabischen Text für den Vergleich: Harakat/Tatweel entfernen,
 * Alif-/Hamza-Varianten und Ta-Marbuta/Ya-Varianten vereinheitlichen,
 * alles Nicht-Arabische raus.
 */
export function normalizeArabic(text: string): string {
  return text
    .replace(DIACRITICS, '')
    // Persische/Urdu-Buchstabenformen, die die mehrsprachige ASR statt der
    // arabischen ausgibt, ZUERST auf Arabisch mappen — sonst würde die
    // [^ء-ي]-Bereinigung unten sie zu Leerzeichen machen und Wörter zerreißen.
    .replace(/ک/g, 'ك') // Persisch kaf → ك
    .replace(/[یۍ]/g, 'ي') // Persisch/Urdu ye → ي
    .replace(/ے/g, 'ي') // Urdu ye barree → ي
    .replace(/ھ/g, 'ه') // Urdu heh doachashmee → ه
    .replace(/گ/g, 'ك') // gaf (kein arab. Äquivalent) → ك
    .replace(/[أإآٱ]/g, 'ا') // أ إ آ ٱ → ا
    .replace(/ؤ/g, 'و') // ؤ → و
    .replace(/ئ/g, 'ي') // ئ → ي
    .replace(/ء/g, '') // ء entfernen
    .replace(/ة/g, 'ه') // ة → ه
    .replace(/ى/g, 'ي') // ى → ي
    .replace(/[^ء-ي\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Dice-Koeffizient über Wörter — robust gegen kleine ASR-Fehler. */
export function similarity(spoken: string, target: string): number {
  const a = normalizeArabic(spoken).split(' ').filter(Boolean);
  const b = normalizeArabic(target).split(' ').filter(Boolean);
  if (a.length === 0 || b.length === 0) return 0;

  const counts = new Map<string, number>();
  for (const w of a) counts.set(w, (counts.get(w) ?? 0) + 1);
  let overlap = 0;
  for (const w of b) {
    const c = counts.get(w) ?? 0;
    if (c > 0) {
      overlap++;
      counts.set(w, c - 1);
    }
  }
  return (2 * overlap) / (a.length + b.length);
}

/** Klassische Levenshtein-Distanz (Einfügen/Löschen/Ersetzen je 1). */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/**
 * Distanz-Schwelle, unter der ein Wort als "fast richtig" gilt. Bewusst
 * großzügig (len/2), weil die ASR bei langsamem Anfänger-Lesen und
 * Madd-Dehnungen leicht 1–2 Buchstaben daneben liegt — der Nutzer soll für
 * korrekt Rezitiertes nicht bestraft werden (User-Report: "zu streng, nie
 * 100%").
 *
 * FEEDBACK-EHRLICHKEIT (2026-07-22): die frühere Mindestschwelle von 2 ab
 * Wortlänge 3 war zu locker — ein 3-Buchstaben-Wort durfte in ZWEI von drei
 * Buchstaben abweichen und galt trotzdem als „fast richtig". Bei arabischen
 * Drei-Radikalen-Wurzeln ist das faktisch ein ANDERES Wort (z. B. قال↔مات,
 * Distanz 2) → falsch-positives „near", das die Note schönt und einen Vers
 * fälschlich als gekonnt abhaken kann. Jetzt: max(1, len/2). Damit bleibt die
 * Toleranz für Wörter ab Länge 4 unverändert (len 4→2, 5→2, 6→3, …) und für
 * längere Wörter großzügig, aber ein 3-Buchstaben-Wort braucht mindestens zwei
 * korrekte Radikale (Distanz ≤ 1) — ein echter Buchstabendreher (خلق↔حلق) zählt
 * weiter als near, zwei nicht.
 */
function nearThreshold(len: number): number {
  return Math.max(1, Math.floor(len / 2));
}

// Arabische Proklitika, die die ASR gern anhängt oder verschluckt: der Artikel
// ال sowie die angehängten Partikel و (und), ف (dann), ب (mit), ك (wie),
// ل (für). Fällt so ein Präfix beim Erkennen weg oder kommt eins dazu
// ("وقال" ↔ "قال", "الرحيم" ↔ "رحيم"), soll das Wort trotzdem als „fast
// richtig" zählen, nicht als Fehler.
function stripProclitics(w: string): string {
  let s = w;
  if (s.startsWith('ال') && s.length > 3) s = s.slice(2);
  else if (s.length > 2 && 'وفبكل'.includes(s[0])) s = s.slice(1);
  return s;
}

/**
 * Wort-Ähnlichkeit für das Alignment: 'exact' (normalisiert identisch),
 * 'near' (kleine Abweichung — Editier-Distanz unter der Schwelle ODER nur ein
 * an-/abgehängtes Proklitikon wie Artikel/Konjunktion) oder 'no'. Beide Wörter
 * werden als BEREITS normalisiert erwartet (normalizeArabic). Reine Funktion,
 * damit Fenster-Matching (reciteProgress.ts) und Tests sie teilen können.
 */
export function wordsSimilar(a: string, b: string): 'exact' | 'near' | 'no' {
  if (a === '' || b === '') return 'no';
  if (a === b) return 'exact';
  // Schwelle am kürzeren Wort — sonst würde ein langes erwartetes Wort ein
  // stark verkürztes Erkanntes fälschlich als „fast" durchwinken.
  if (levenshtein(a, b) <= nearThreshold(Math.min(a.length, b.length))) return 'near';
  // Proklitikon-Toleranz: nach Abziehen eines angehängten Artikels/Partikels
  // gleich → „fast richtig", auch wenn die reine Editier-Distanz die Schwelle reißt.
  const sa = stripProclitics(a);
  const sb = stripProclitics(b);
  if (sa.length >= 2 && sb.length >= 2 && (sa === sb || sa === b || sb === a)) return 'near';
  return 'no';
}

export type WordStatus = 'hit' | 'near' | 'miss';

export interface WordAlignment {
  /** Original-Wort des Zieltexts (mit Harakat, für die Anzeige) */
  word: string;
  /** Wurde das Wort in der Aufnahme (normalisiert) exakt wiedererkannt? */
  matched: boolean;
  /** hit = exakt, near = fast richtig (kleine Abweichung), miss = fehlt */
  status: WordStatus;
  /** Bei near: wie das Wort (normalisiert) tatsächlich klang — innerhalb der near-Schwelle. */
  nearSpoken?: string;
  /**
   * Bei near/miss: das nächstgelegene noch unverbrauchte gesprochene Wort —
   * anders als nearSpoken OHNE Schwellenwert-Filter, rein für die Anzeige
   * ("erkannt: ...") gedacht. Beeinflusst NICHT Status oder Score (die
   * near/miss-Einstufung bleibt exakt wie zuvor). Bei miss ist das also ein
   * unsicherer "am ehesten gehört"-Hinweis, kein Urteil — kann fehlen, wenn
   * keine gesprochenen Wörter mehr übrig sind (z. B. Wort komplett ausgelassen).
   */
  closestSpoken?: string;
}

/**
 * Richtet die erkannten Wörter per LCS an den Ziel-Wörtern aus — Ergebnis
 * ist pro Ziel-Wort ein Treffer-Status. Damit kann die UI ZEIGEN, welches
 * Wort gefehlt hat/falsch war, statt nur eine Gesamtnote zu geben.
 * Reihenfolge zählt: ein richtiges Wort an falscher Stelle zählt nur dort,
 * wo es die längste gemeinsame Sequenz stützt.
 */
export function alignWords(spoken: string, target: string): WordAlignment[] {
  const spokenNorm = normalizeArabic(spoken).split(' ').filter(Boolean);
  const targetRaw = target.split(/\s+/).filter(Boolean);
  const targetNorm = targetRaw.map((w) => normalizeArabic(w));

  const n = targetNorm.length;
  const m = spokenNorm.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        targetNorm[i] !== '' && targetNorm[i] === spokenNorm[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const matched = new Array<boolean>(n).fill(false);
  const usedSpoken = new Array<boolean>(m).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (targetNorm[i] !== '' && targetNorm[i] === spokenNorm[j]) {
      matched[i] = true;
      usedSpoken[j] = true;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }

  // "Fast richtig"-Stufe für Anfänger ("Vorschüler"-Lesen, User-Direktive):
  // nicht exakt getroffene Ziel-Wörter gegen unverbrauchte gesprochene Wörter
  // per Editier-Distanz prüfen — kleine Abweichungen (auch ASR-Unsicherheit
  // bei langsamem Lesen) zählen als near statt hartem miss.
  const nearSpokenFor = new Array<string | undefined>(n).fill(undefined);
  // Bewusst getrennt von nearSpokenFor: "am nächsten liegendes übrig
  // gebliebenes Wort" auch WENN es die near-Schwelle reißt — reine
  // Anzeige-Hilfe für die UI ("erkannt: ..."), verändert usedSpoken/Status
  // nicht (kein Verbrauch bei Über-Schwelle-Kandidaten, damit die bestehende
  // near/miss-Logik + alle Scores exakt gleich bleiben).
  const closestSpokenFor = new Array<string | undefined>(n).fill(undefined);
  for (let k = 0; k < n; k++) {
    if (matched[k] || targetNorm[k] === '') continue;
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let s = 0; s < m; s++) {
      if (usedSpoken[s]) continue;
      const d = levenshtein(targetNorm[k], spokenNorm[s]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = s;
      }
    }
    if (bestIdx >= 0) {
      closestSpokenFor[k] = spokenNorm[bestIdx];
      // „fast richtig", wenn die Editier-Distanz unter der Schwelle liegt ODER
      // sich die Wörter nur um ein an-/abgehängtes Proklitikon (Artikel/Partikel)
      // unterscheiden — wordsSimilar kapselt beide Fälle (s. dort).
      if (
        bestDist <= nearThreshold(targetNorm[k].length) ||
        wordsSimilar(targetNorm[k], spokenNorm[bestIdx]) === 'near'
      ) {
        usedSpoken[bestIdx] = true;
        nearSpokenFor[k] = spokenNorm[bestIdx];
      }
    }
  }

  // Reine Zeichen ohne arabischen Kern (z. B. Vers-Ornamente) nicht anmarkern.
  return targetRaw.map((w, k) => {
    if (targetNorm[k] === '') return { word: w, matched: true, status: 'hit' as const };
    if (matched[k]) return { word: w, matched: true, status: 'hit' as const };
    if (nearSpokenFor[k] !== undefined)
      return {
        word: w,
        matched: false,
        status: 'near' as const,
        nearSpoken: nearSpokenFor[k],
        closestSpoken: nearSpokenFor[k],
      };
    return { word: w, matched: false, status: 'miss' as const, closestSpoken: closestSpokenFor[k] };
  });
}

/**
 * Bewertung mit Teilpunkten: exakte Treffer voll, "fast richtig" halb —
 * ein Anfänger, der jedes Wort ungefähr richtig liest, bekommt "gut"
 * statt "nochmal versuchen".
 */
export function alignmentScore(spoken: string, target: string): number {
  const words = alignWords(spoken, target);
  const scorable = words.filter((w) => normalizeArabic(w.word) !== '');
  if (scorable.length === 0) return 0;
  // "fast richtig" zählt hoch (0.8 statt 0.5): ein Anfänger, der jedes Wort
  // erkennbar richtig liest, soll klar "gut/exzellent" bekommen, nicht knapp
  // durchfallen (User-Report: "zu streng").
  const points = scorable.reduce(
    (sum, w) => sum + (w.status === 'hit' ? 1 : w.status === 'near' ? 0.8 : 0),
    0,
  );
  return points / scorable.length;
}

/**
 * Erste abweichende Buchstaben-Paarung zwischen gesprochenem und Ziel-Wort
 * (nur bei gleicher Länge = reine Ersetzung — sonst null, um nichts zu
 * raten). Grundlage für Makhradsch-Tipps ("klang wie ح statt خ").
 */
export function firstSubstitution(
  spoken: string,
  target: string,
): { spoken: string; target: string } | null {
  if (spoken.length !== target.length) return null;
  for (let i = 0; i < target.length; i++) {
    if (spoken[i] !== target[i]) return { spoken: spoken[i], target: target[i] };
  }
  return null;
}

/**
 * Beste Übereinstimmung aus mehreren ASR-Alternativen — bewertet mit der
 * anfängerfreundlichen Teilpunkte-Metrik (alignmentScore).
 */
export function bestTranscript(alternatives: string[], target: string): { transcript: string; score: number } {
  let best = { transcript: '', score: 0 };
  for (const t of alternatives) {
    const s = alignmentScore(t, target);
    if (s > best.score) best = { transcript: t, score: s };
  }
  return best;
}

export type RecitationGrade = 'excellent' | 'good' | 'retry';

// Schwellen bewusst mild (User-Report "zu streng, nie 100%"): wer den Vers
// erkennbar korrekt rezitiert, erreicht zuverlässig "excellent", ohne dass die
// ASR jedes Wort perfekt treffen muss. Falsches Rezitieren (viele miss) fällt
// weiter unter "retry".
export function gradeFromSimilarity(s: number): RecitationGrade {
  if (s >= 0.72) return 'excellent';
  if (s >= 0.45) return 'good';
  return 'retry';
}
