import {
  DEFAULT_PRAY_ALONG_PREFS,
  FONT_SCALE,
  FONT_SIZE_OPTIONS,
  parsePrefs,
  type PrayAlongPrefs,
} from './prefs';

// parsePrefs liest Fremddaten (alter App-Stand, manipulierter Speicher). Ein
// durchgereichter Müllwert würde im Gebet-Mitbeten-Screen z. B. `fontSize`
// als Skalierungs-Index verwenden -> unlesbare Schrift mitten im Gebet.

describe('parsePrefs — Standardwerte', () => {
  it('liefert die Standardwerte für null', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PRAY_ALONG_PREFS);
  });

  it('liefert die Standardwerte für unlesbaren Inhalt', () => {
    expect(parsePrefs('{{{')).toEqual(DEFAULT_PRAY_ALONG_PREFS);
    expect(parsePrefs('')).toEqual(DEFAULT_PRAY_ALONG_PREFS);
    expect(parsePrefs('null')).toEqual(DEFAULT_PRAY_ALONG_PREFS);
  });

  it('zeigt standardmäßig Umschrift zuerst und Witr-Sure nur in den ersten zwei Rakaat', () => {
    // Beides sind religiös relevante Voreinstellungen (s. Kommentar in prefs.ts).
    expect(DEFAULT_PRAY_ALONG_PREFS.arabicFirst).toBe(false);
    expect(DEFAULT_PRAY_ALONG_PREFS.witrSurahInThird).toBe(false);
  });
});

describe('parsePrefs — gültige Eingaben', () => {
  it('übernimmt einen vollständigen Datensatz', () => {
    const stored: PrayAlongPrefs = {
      fontSize: 'xlarge',
      showTranslation: false,
      showArabic: false,
      showNotes: false,
      arabicFirst: true,
      witrSurahInThird: true,
    };
    expect(parsePrefs(JSON.stringify(stored))).toEqual(stored);
  });

  it('ergänzt fehlende Felder eines Teil-Objekts aus alten App-Ständen', () => {
    expect(parsePrefs(JSON.stringify({ fontSize: 'large' }))).toEqual({
      ...DEFAULT_PRAY_ALONG_PREFS,
      fontSize: 'large',
    });
  });

  it.each(FONT_SIZE_OPTIONS)('akzeptiert die Schriftgröße %s', (size) => {
    expect(parsePrefs(JSON.stringify({ fontSize: size })).fontSize).toBe(size);
  });
});

describe('parsePrefs — falsche Typen fallen einzeln auf den Standard zurück', () => {
  it('verwirft eine unbekannte Schriftgröße', () => {
    expect(parsePrefs(JSON.stringify({ fontSize: 'huge' })).fontSize).toBe(DEFAULT_PRAY_ALONG_PREFS.fontSize);
    expect(parsePrefs(JSON.stringify({ fontSize: 2 })).fontSize).toBe(DEFAULT_PRAY_ALONG_PREFS.fontSize);
  });

  it('verwirft Nicht-Booleans, behält aber die gültigen Nachbarfelder', () => {
    const parsed = parsePrefs(
      JSON.stringify({ showArabic: 'ja', showTranslation: 0, showNotes: false, arabicFirst: true }),
    );
    expect(parsed.showArabic).toBe(DEFAULT_PRAY_ALONG_PREFS.showArabic);
    expect(parsed.showTranslation).toBe(DEFAULT_PRAY_ALONG_PREFS.showTranslation);
    expect(parsed.showNotes).toBe(false);
    expect(parsed.arabicFirst).toBe(true);
  });

  it('verwirft ein JSON-Array', () => {
    expect(parsePrefs('[1,2,3]')).toEqual(DEFAULT_PRAY_ALONG_PREFS);
  });
});

describe('FONT_SCALE', () => {
  it('hat für jede Option einen Faktor, medium ist die Basis', () => {
    for (const size of FONT_SIZE_OPTIONS) expect(FONT_SCALE[size]).toBeGreaterThan(0);
    expect(FONT_SCALE.medium).toBe(1);
  });

  it('wächst streng monoton von small bis xlarge', () => {
    const scales = FONT_SIZE_OPTIONS.map((s) => FONT_SCALE[s]);
    for (let i = 1; i < scales.length; i++) expect(scales[i]).toBeGreaterThan(scales[i - 1]);
  });
});
