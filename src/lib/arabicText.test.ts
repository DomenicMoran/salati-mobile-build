import {
  arabicClusters,
  isCombiningMarkOnly,
  normalizeArabicText,
  splitArabicWords,
  startsWithCombiningMark,
  DOTTED_CIRCLE,
  NBSP,
  TATWEEL,
} from './arabicText';

// Echte Textstellen aus dem Uthmani-Bestand von quran.com (live abgerufen am
// 2026-07-31): in 2:2 stehen ZWEI Waqf-Zeichen U+06DB als eigene, durch
// Leerzeichen getrennte Token, in 2:5 ein U+06D6. Genau diese Token lösten
// beim wortweisen Rendern den gestrichelten Kreis aus.
const AYAH_2_2 = 'ذَٰلِكَ ٱلْكِتَٰبُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى لِّلْمُتَّقِينَ';
const AYAH_2_5 = 'أُو۟لَٰٓئِكَ عَلَىٰ هُدًى مِّن رَّبِّهِمْ ۖ وَأُو۟لَٰٓئِكَ هُمُ ٱلْمُفْلِحُونَ';

describe('splitArabicWords', () => {
  it('hängt allein stehende Waqf-Zeichen an das vorherige Wort statt sie zu isolieren', () => {
    const words = splitArabicWords(AYAH_2_2);
    expect(words).toEqual([
      'ذَٰلِكَ',
      'ٱلْكِتَٰبُ',
      'لَا',
      'رَيْبَ ۛ',
      'فِيهِ ۛ',
      'هُدًى',
      'لِّلْمُتَّقِينَ',
    ]);
  });

  it('erzeugt kein Wort, das mit einem Kombinationszeichen beginnt', () => {
    for (const verse of [AYAH_2_2, AYAH_2_5]) {
      for (const w of splitArabicWords(verse)) {
        expect(startsWithCombiningMark(w)).toBe(false);
      }
    }
  });

  it('zählt Wörter wie quran.com — Grundlage der Wort-Zeitstempel', () => {
    // quran.com liefert für 2:2 sieben Wörter (Waqf-Zeichen angehängt), das
    // naive split(/\s+/) lieferte neun und verschob damit die Markierung.
    expect(splitArabicWords(AYAH_2_2)).toHaveLength(7);
    expect(AYAH_2_2.split(/\s+/)).toHaveLength(9);
    expect(splitArabicWords(AYAH_2_5)).toHaveLength(8);
  });

  it('gibt einem Zeichen am Textanfang einen unsichtbaren Träger', () => {
    const words = splitArabicWords('ۛ فِيهِ');
    expect(words[0]).toBe(NBSP + 'ۛ');
    expect(startsWithCombiningMark(words[0])).toBe(false);
  });

  it('lässt gewöhnliche Verse unverändert', () => {
    expect(splitArabicWords('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ')).toEqual([
      'بِسْمِ',
      'ٱللَّهِ',
      'ٱلرَّحْمَٰنِ',
      'ٱلرَّحِيمِ',
    ]);
  });

  it('verkraftet leere Eingaben und Mehrfach-Leerzeichen', () => {
    expect(splitArabicWords('')).toEqual([]);
    expect(splitArabicWords('   ')).toEqual([]);
    expect(splitArabicWords('لَا   رَيْبَ')).toEqual(['لَا', 'رَيْبَ']);
  });
});

describe('normalizeArabicText', () => {
  it('entfernt einen bereits im Text stehenden gestrichelten Kreis', () => {
    expect(normalizeArabicText(`${DOTTED_CIRCLE}ْ`, { carrier: TATWEEL })).toBe(`${TATWEEL}ْ`);
    expect(normalizeArabicText(`بِسْمِ ${DOTTED_CIRCLE}ٱللَّهِ`)).toBe('بِسْمِ ٱللَّهِ');
  });

  it('normalisiert nach NFC (zusammengesetzte und zerlegte Form werden gleich)', () => {
    // U+0623 (Alif mit Hamza) vs. U+0627 U+0654 (Alif + kombinierendes Hamza)
    const composed = 'أ';
    const decomposed = 'أ';
    expect(normalizeArabicText(decomposed)).toBe(composed);
    expect(normalizeArabicText(composed)).toBe(composed);
  });

  it('entfernt unsichtbare Bidi-/Zero-Width-Steuerzeichen', () => {
    const withControls = '‏بِسْمِ​ ٱللَّهِ‎';
    expect(normalizeArabicText(withControls)).toBe('بِسْمِ ٱللَّهِ');
  });

  it('lässt ZWJ/ZWNJ stehen — die setzt das Lern-Modul absichtlich', () => {
    const isolated = 'ك‌ت‌ب';
    expect(normalizeArabicText(isolated)).toBe(isolated);
    expect(normalizeArabicText('ب‍')).toBe('ب‍');
  });

  it('setzt einen Träger vor ein verwaistes Zeichen am Textanfang', () => {
    expect(normalizeArabicText('ًا')).toBe(NBSP + 'ًا');
    expect(normalizeArabicText('ُ', { carrier: TATWEEL })).toBe(TATWEEL + 'ُ');
  });

  it('lässt Zeichen nach einem Leerzeichen unangetastet — dort trägt das Leerzeichen', () => {
    // Im durchgehenden Vers ist das Waqf-Zeichen unkritisch; nur der
    // Textanfang braucht einen Träger.
    expect(normalizeArabicText('رَيْبَ ۛ فِيهِ')).toBe('رَيْبَ ۛ فِيهِ');
  });

  it('lässt Uthmani-Sonderzeichen ohne Basis in Ruhe (Sure-Ende, kleines Waw, Sajda)', () => {
    // U+06DD/U+06E5/U+06E9 sind KEINE Kombinationszeichen und brauchen keinen Träger.
    for (const ch of ['۝', 'ۥ', '۩', '۞']) {
      expect(normalizeArabicText(ch)).toBe(ch);
    }
  });

  it('entfernt PUA-Codepoints des IndoPak-Textes', () => {
    // quran.com adressiert im IndoPak-Text Glyphen der IndoPak-Hausschrift
    // direkt (U+E003–U+E022). Keine der acht gebündelten Schriften kennt diese
    // Codepoints — sichtbar bliebe nur ein Tofu-Kästchen.
    expect(normalizeArabicText('عَلَيْهِمْ وَلَا')).toBe('عَلَيْهِمْ وَلَا');
    expect(normalizeArabicText('')).toBe('');
  });

  it('macht typografische Sonder-Leerzeichen zu normalen Leerzeichen', () => {
    // U+2002/U+2003 fehlen dem KFGQPC-Font und beiden Noto-Schriften.
    expect(normalizeArabicText('لَا رَيْبَ فِيهِ')).toBe('لَا رَيْبَ فِيهِ');
  });

  it('löst arabische Präsentationsformen in Grundbuchstaben auf', () => {
    // U+FE8E (Alif in Endform) steht einmal im IndoPak-Text; vier der acht
    // Schriften haben dafür keinen Glyphen, weil moderne Schriften diesen
    // Block nicht mehr belegen. Der Shaper formt den Grundbuchstaben ohnehin.
    expect(normalizeArabicText('ﺎ')).toBe('ا');
    expect(normalizeArabicText('ﻻ')).toBe('لا');
  });

  it('lässt die Basmala-Ligatur stehen (Formen-A wird NICHT aufgelöst)', () => {
    // NFKC würde U+FDFD in vier Wörter auflösen — aus einem Zeichen würde Text.
    expect(normalizeArabicText('﷽')).toBe('﷽');
  });

  it('lässt den NBSP-Träger unangetastet', () => {
    // NBSP ist selbst ein Sonder-Leerzeichen, aber genau das Trägerzeichen —
    // es darf der Leerzeichen-Vereinheitlichung nicht zum Opfer fallen.
    expect(normalizeArabicText('ً')).toBe(NBSP + 'ً');
  });

  it('fasst Mehrfach-Leerzeichen zusammen und trimmt', () => {
    expect(normalizeArabicText('  لَا   رَيْبَ  ')).toBe('لَا رَيْبَ');
  });

  it('ist idempotent', () => {
    const once = normalizeArabicText(AYAH_2_2);
    expect(normalizeArabicText(once)).toBe(once);
  });

  it('verkraftet leere Eingaben', () => {
    expect(normalizeArabicText('')).toBe('');
  });
});

describe('isCombiningMarkOnly', () => {
  it('erkennt allein stehende Waqf-/Vokalzeichen', () => {
    expect(isCombiningMarkOnly('ۛ')).toBe(true);
    expect(isCombiningMarkOnly('ۖ')).toBe(true);
    expect(isCombiningMarkOnly('ً')).toBe(true);
    expect(isCombiningMarkOnly('ٰ')).toBe(true);
  });

  it('erkennt Buchstaben und gemischte Token nicht als Zeichen-Token', () => {
    expect(isCombiningMarkOnly('ب')).toBe(false);
    expect(isCombiningMarkOnly('بَ')).toBe(false);
    expect(isCombiningMarkOnly('')).toBe(false);
    // Sure-Ende-Zeichen und kleines Waw sind eigenständig, kein Mn.
    expect(isCombiningMarkOnly('۝')).toBe(false);
    expect(isCombiningMarkOnly('ۥ')).toBe(false);
  });
});

describe('arabicClusters', () => {
  it('hält Vokalzeichen beim Basisbuchstaben', () => {
    expect(arabicClusters('كِتَابٌ')).toEqual(['كِ', 'تَ', 'ا', 'بٌ']);
  });

  it('sammelt mehrere Zeichen an einem Basisbuchstaben (Shadda + Fatha)', () => {
    expect(arabicClusters('رَّ')).toEqual(['رَّ']);
    expect(arabicClusters('ٱلرَّحْمَٰنِ')).toEqual(['ٱ', 'ل', 'رَّ', 'حْ', 'مَٰ', 'نِ']);
  });

  it('erzeugt nie ein Cluster, das mit einem Kombinationszeichen beginnt', () => {
    for (const c of arabicClusters(AYAH_2_2)) {
      expect(startsWithCombiningMark(c)).toBe(false);
    }
  });

  it('verkraftet ein führendes Zeichen ohne Basis', () => {
    expect(arabicClusters('ًب')).toEqual(['ً', 'ب']);
  });
});
