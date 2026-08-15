import {
  alignmentScore,
  alignWords,
  firstSubstitution,
  levenshtein,
  bestTranscript,
  gradeFromSimilarity,
  normalizeArabic,
  similarity,
  wordsSimilar,
} from './similarity';

describe('alignWords', () => {
  const target = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';

  it('markiert alle Wörter als getroffen bei perfekter Rezitation', () => {
    const words = alignWords('بسم الله الرحمن الرحيم', target);
    expect(words).toHaveLength(4);
    expect(words.every((w) => w.matched)).toBe(true);
    expect(words[0].word).toBe('بِسْمِ'); // Original mit Harakat für die Anzeige
  });

  it('markiert genau das ausgelassene Wort', () => {
    const words = alignWords('بسم الله الرحيم', target);
    expect(words.map((w) => w.matched)).toEqual([true, true, false, true]);
  });

  it('Reihenfolge zählt — vertauschte Wörter treffen nur die längste Sequenz', () => {
    const words = alignWords('الرحيم الرحمن', target);
    const hits = words.filter((w) => w.matched).length;
    expect(hits).toBe(1);
  });

  it('leere Aufnahme trifft nichts', () => {
    expect(alignWords('', target).every((w) => !w.matched)).toBe(true);
  });
});

describe('bestTranscript', () => {
  it('wählt die Alternative mit der höchsten Ähnlichkeit', () => {
    const target = 'قل هو الله أحد';
    const best = bestTranscript(['كل هو الله', 'قل هو الله احد', 'قل هو'], target);
    expect(best.transcript).toBe('قل هو الله احد');
    expect(best.score).toBe(1);
  });

  it('liefert Score 0 bei leerer Liste', () => {
    expect(bestTranscript([], 'بسم الله').score).toBe(0);
  });
});

describe('normalizeArabic', () => {
  it('entfernt Harakat und Tatweel', () => {
    expect(normalizeArabic('بِسْمِ اللَّهِ')).toBe('بسم الله');
  });

  it('vereinheitlicht Alif- und Ya-Varianten', () => {
    expect(normalizeArabic('أحد')).toBe('احد');
    expect(normalizeArabic('إلى')).toBe('الي');
    expect(normalizeArabic('رحمة')).toBe('رحمه');
  });

  it('wirft Nicht-Arabisches raus', () => {
    expect(normalizeArabic('abc بسم 123')).toBe('بسم');
  });
});

describe('similarity', () => {
  const fatiha1 = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';

  it('identischer Text (ohne Harakat gesprochen) ergibt 1', () => {
    expect(similarity('بسم الله الرحمن الرحيم', fatiha1)).toBe(1);
  });

  it('teilweise korrekt liegt zwischen 0 und 1', () => {
    const s = similarity('بسم الله', fatiha1);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
  });

  it('komplett falscher Text (kein gemeinsames Wort) ergibt 0', () => {
    expect(similarity('لم يلد ولم يولد', fatiha1)).toBe(0);
  });

  it('gemeinsames Einzelwort ergibt geringen Wert, nicht 0', () => {
    const s = similarity('قل هو الله احد', fatiha1);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(0.5);
  });

  it('leere Eingabe ergibt 0', () => {
    expect(similarity('', fatiha1)).toBe(0);
  });
});

describe('gradeFromSimilarity', () => {
  it('bewertet nach Schwellen', () => {
    expect(gradeFromSimilarity(0.9)).toBe('excellent');
    expect(gradeFromSimilarity(0.7)).toBe('good');
    expect(gradeFromSimilarity(0.3)).toBe('retry');
  });
});

describe('Anfänger-Toleranz (near-miss)', () => {
  it('levenshtein zählt Ersetzungen/Einfügungen', () => {
    expect(levenshtein('خلق', 'حلق')).toBe(1);
    expect(levenshtein('بسم', 'بسم')).toBe(0);
    expect(levenshtein('', 'ابc')).toBe(3);
  });

  it('fast richtiges Wort wird als near erkannt (nicht miss)', () => {
    // حلق statt خلق (ح statt خ) — typischer Anfängerfehler
    const words = alignWords('من شر ما حلق', 'مِن شَرِّ مَا خَلَقَ');
    expect(words.map((w) => w.status)).toEqual(['hit', 'hit', 'hit', 'near']);
    expect(words[3].nearSpoken).toBe('حلق');
  });

  it('alignmentScore gibt Teilpunkte für near', () => {
    // near zählt 0.8 (anfängerfreundlich): 3 hit + 1 near = 3.8/4 = 0.95
    expect(alignmentScore('من شر ما حلق', 'مِن شَرِّ مَا خَلَقَ')).toBeCloseTo(0.95, 3);
    expect(alignmentScore('من شر ما خلق', 'مِن شَرِّ مَا خَلَقَ')).toBe(1);
  });

  it('firstSubstitution findet den abweichenden Buchstaben', () => {
    expect(firstSubstitution('حلق', 'خلق')).toEqual({ spoken: 'ح', target: 'خ' });
    expect(firstSubstitution('خلق', 'خلق')).toBeNull();
    expect(firstSubstitution('خل', 'خلق')).toBeNull(); // andere Länge: nichts raten
  });
});

describe('closestSpoken (Anzeige: "erkannt vs. erwartet" auch bei miss)', () => {
  const target = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';

  it('near-Wort: closestSpoken == nearSpoken', () => {
    const words = alignWords('من شر ما حلق', 'مِن شَرِّ مَا خَلَقَ');
    expect(words[3].status).toBe('near');
    expect(words[3].closestSpoken).toBe(words[3].nearSpoken);
    expect(words[3].closestSpoken).toBe('حلق');
  });

  it('miss ohne übrig gebliebenes gesprochenes Wort: closestSpoken bleibt undefined', () => {
    // "الرحمن" fehlt komplett, alle gesprochenen Wörter sind anderweitig verbraucht
    const words = alignWords('بسم الله الرحيم', target);
    expect(words[2].status).toBe('miss');
    expect(words[2].closestSpoken).toBeUndefined();
  });

  it('miss mit zu weit entferntem übrig gebliebenen Wort: closestSpoken als unsicherer Kandidat, kein nearSpoken', () => {
    // "بيت" ist zu verschieden von "خلق" für near, bleibt aber als Anzeige-Kandidat übrig
    const words = alignWords('من شر ما بيت', 'مِن شَرِّ مَا خَلَقَ');
    expect(words[3].status).toBe('miss');
    expect(words[3].nearSpoken).toBeUndefined();
    expect(words[3].closestSpoken).toBe('بيت');
  });
});

describe('wordsSimilar (Wort-Ähnlichkeit fürs Alignment)', () => {
  it('identische Wörter = exact', () => {
    expect(wordsSimilar('قال', 'قال')).toBe('exact');
  });

  it('kleiner Buchstabendreher = near (خلق↔حلق)', () => {
    expect(wordsSimilar('خلق', 'حلق')).toBe('near');
  });

  it('angehängter Artikel ال = near (رحيم↔الرحيم)', () => {
    expect(wordsSimilar('الرحيم', 'رحيم')).toBe('near');
    expect(wordsSimilar('رحيم', 'الرحيم')).toBe('near');
  });

  it('angehängte Konjunktion و/ف = near (قال↔وقال)', () => {
    expect(wordsSimilar('وقال', 'قال')).toBe('near');
    expect(wordsSimilar('فقال', 'قال')).toBe('near');
  });

  it('völlig andere Wörter = no', () => {
    expect(wordsSimilar('بسم', 'نور')).toBe('no');
  });

  it('EHRLICHKEIT: 3-Buchstaben-Wort mit 2 abweichenden Radikalen ist KEIN near (قال↔مات)', () => {
    // Distanz 2 bei Länge 3 = anderes Wort → darf nicht als „fast richtig" die
    // Note schönen. Früher (Mindestschwelle 2 ab Länge 3) fälschlich near.
    expect(levenshtein('قال', 'مات')).toBe(2);
    expect(wordsSimilar('قال', 'مات')).toBe('no');
  });

  it('echter Buchstabendreher (1 Abweichung) bei 3-Buchstaben-Wort bleibt near (قال↔قام)', () => {
    expect(levenshtein('قال', 'قام')).toBe(1);
    expect(wordsSimilar('قال', 'قام')).toBe('near');
  });

  it('längere Wörter behalten die großzügige Toleranz (unverändert)', () => {
    // Länge 6, Distanz 2 (الرحمن↔الرحيم, letzte zwei Buchstaben) → weiter near
    // (Schwelle floor(6/2)=3). Zeigt: der Ehrlichkeits-Fix verschärft nur Länge 3.
    expect(levenshtein('الرحمن', 'الرحيم')).toBe(2);
    expect(wordsSimilar('الرحمن', 'الرحيم')).toBe('near');
  });

  it('leere Eingabe = no', () => {
    expect(wordsSimilar('', 'قال')).toBe('no');
    expect(wordsSimilar('قال', '')).toBe('no');
  });
});
