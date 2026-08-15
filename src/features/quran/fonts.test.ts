import {
  ARABIC_FONT_FEATURES,
  DEFAULT_QURAN_FONT,
  INDOPAK_FALLBACK_FONT,
  QURAN_FONTS,
  quranFontForScript,
  adaptQuranText,
  arabicMetrics,
  ayahMarker,
  quranFontDef,
} from './fonts';

describe('QURAN_FONTS', () => {
  it('hat eindeutige Kennungen und Familiennamen', () => {
    const ids = QURAN_FONTS.map((f) => f.id);
    const families = QURAN_FONTS.map((f) => f.family);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(families).size).toBe(families.length);
  });

  it('enthält den Uthmani-Font des KFGQPC als Standard', () => {
    expect(DEFAULT_QURAN_FONT).toBe('kfgqpc');
    expect(quranFontDef(DEFAULT_QURAN_FONT).family).toBe('KFGQPCHafs');
  });

  it('nennt zu jeder Schrift eine Lizenz und einen Beschreibungs-Schlüssel', () => {
    for (const f of QURAN_FONTS) {
      expect(f.license).not.toBe('');
      expect(f.hintKey).toMatch(/^settings\.quranFont\.hint\./);
    }
  });

  it('fällt bei unbekannter oder fehlender Kennung auf die Standardschrift zurück', () => {
    // Wichtig für gespeicherte Einstellungen aus einer älteren App-Version,
    // in denen quranFont noch gar nicht existierte.
    expect(quranFontDef(undefined).id).toBe(DEFAULT_QURAN_FONT);
    expect(quranFontDef('gibt-es-nicht').id).toBe(DEFAULT_QURAN_FONT);
  });
});

describe('arabicMetrics', () => {
  it('lässt Schriftgrad und Zeilenhöhe der Standardschrift praktisch unverändert', () => {
    // KFGQPC ist die Referenz (sizeFactor 1) — der Reader-Standard 20/34 darf
    // sich durch die Umstellung nicht verschieben; nur die Zeilenhöhe wächst
    // auf die natürliche Zeilenbox der Schrift (20 × 1.758 = 36), damit die
    // hohen Koran-Zeichen nicht mehr oben abgeschnitten werden.
    const m = arabicMetrics('kfgqpc', 20, 34);
    expect(m.fontSize).toBe(20);
    expect(m.lineHeight).toBe(36);
  });

  it('gleicht die unterschiedliche Zeichenhöhe der Schriften aus', () => {
    // Amiri Quran und Scheherazade New zeichnen bei gleichem Grad größer als
    // der KFGQPC-Font (gemessene Alif-Höhe, s. fonts.ts) — der Ausgleich muss
    // den Grad also verkleinern, nie vergrößern.
    expect(arabicMetrics('amiri', 20, 34).fontSize).toBeLessThan(20);
    expect(arabicMetrics('scheherazade', 20, 34).fontSize).toBeLessThan(20);
    expect(arabicMetrics('noto', 20, 34).fontSize).toBeLessThanOrEqual(20);
  });

  it('gibt jeder Schrift mindestens ihre natürliche Zeilenbox', () => {
    for (const f of QURAN_FONTS) {
      const m = arabicMetrics(f.id, 24, 10);
      expect(m.lineHeight).toBeGreaterThanOrEqual(m.fontSize * f.lineBoxEm);
    }
  });

  it('unterschreitet die vorgegebene Zeilenhöhe nie', () => {
    for (const f of QURAN_FONTS) {
      expect(arabicMetrics(f.id, 16, 200).lineHeight).toBe(200);
    }
  });

  it('liefert ganzzahlige Werte (Subpixel-Grade führen zu unscharfem Text)', () => {
    for (const f of QURAN_FONTS) {
      const m = arabicMetrics(f.id, 26, 42);
      expect(Number.isInteger(m.fontSize)).toBe(true);
      expect(Number.isInteger(m.lineHeight)).toBe(true);
    }
  });
});

describe('ayahMarker', () => {
  it('überlässt dem KFGQPC-Font sein eigenes Vers-Ende-Ornament', () => {
    // Diese Schrift zieht die Ziffernfolge selbst zum verzierten Kreis zusammen.
    // Zusätzliche Ornament-Klammern ergäben einen Kreis IN Klammern — und weil
    // ihr U+FD3E/U+FD3F fehlen, holte Android dafür eine fremde Schrift.
    expect(ayahMarker(quranFontDef('kfgqpc'), '٧')).toBe('٧');
    expect(ayahMarker(quranFontDef('kfgqpc'), '٢٥٦')).toBe('٢٥٦');
  });

  it('setzt bei allen anderen Schriften die Ornament-Klammern', () => {
    for (const font of QURAN_FONTS.filter((f) => !f.digitsAreAyahOrnament)) {
      expect(ayahMarker(font, '٧')).toBe('﴿٧﴾');
    }
  });

  it('kennzeichnet genau eine Schrift als Ornament-Schrift', () => {
    // Sicherung gegen ein versehentlich gesetztes Flag: die Zuordnung wird von
    // scripts/pruefe-koran-fonts.mjs gegen die Font-Dateien gemessen.
    expect(QURAN_FONTS.filter((f) => f.digitsAreAyahOrnament).map((f) => f.id)).toEqual(['kfgqpc']);
  });
});

describe('adaptQuranText', () => {
  const kfgqpc = quranFontDef('kfgqpc');
  const amiri = quranFontDef('amiri-quran');

  it('schreibt die Wörter aus 2:5 und 2:6 exakt in die KFGQPC-Ausgabe um', () => {
    // Sollwerte Zeichen für Zeichen aus der offiziellen KFGQPC-Textausgabe
    // (hafsData_v18) übernommen — nicht selbst gebildet.
    expect(adaptQuranText('كَفَرُوا۟', kfgqpc)).toBe('كَفَرُواْ');
    expect(adaptQuranText('أُو۟لَـٰٓئِكَ', kfgqpc)).toBe('أُوْلَـٰٓئِكَ');
    expect(adaptQuranText('عَلَيْهِمْ', kfgqpc)).toBe('عَلَيۡهِمۡ');
  });

  it('bildet die beiden Einzelfälle des Korans ab (52:37 und 12:11)', () => {
    expect(adaptQuranText('ۣ', kfgqpc)).toBe('ۜ');
    expect(adaptQuranText('۫', kfgqpc)).toBe('۬');
  });

  it('trennt Sukūn und stummen Buchstaben — beide dürfen nicht verschmelzen', () => {
    // Die Reihenfolge der Ersetzungen entscheidet: liefe U+06DF über U+0652
    // weiter auf U+06E1, wäre der Unterschied des Madina-Drucks verloren.
    expect(adaptQuranText('ْ', kfgqpc)).toBe('ۡ');
    expect(adaptQuranText('۟', kfgqpc)).toBe('ْ');
    expect(adaptQuranText('ْ۟', kfgqpc)).toBe('ْۡ');
  });

  it('zeigt das Sukūn als Kreis, wenn der Nutzer das einstellt', () => {
    // Einstellung quranSukun: 'kreis' — U+0652 bleibt stehen (KFGQPC zeichnet
    // dafür den Kreis), U+06DF wird ebenfalls dazu. Beide sehen dann gleich aus;
    // genau das sagt der Hinweistext der Einstellung auch.
    expect(adaptQuranText('عَلَيْهِمْ', kfgqpc, 'kreis')).toBe('عَلَيْهِمْ');
    expect(adaptQuranText('كَفَرُوا۟', kfgqpc, 'kreis')).toBe('كَفَرُواْ');
  });

  it('bleibt ohne Angabe beim Madina-Druck', () => {
    // Der Standard darf sich nicht still aendern — sonst kippt das Schriftbild
    // bei allen Bestandsnutzern.
    expect(adaptQuranText('عَلَيْهِمْ', kfgqpc)).toBe(adaptQuranText('عَلَيْهِمْ', kfgqpc, 'madina'));
    expect(adaptQuranText('عَلَيْهِمْ', kfgqpc)).toBe('عَلَيۡهِمۡ');
  });

  it('lässt die Sukūn-Einstellung bei Unicode-Schriften wirkungslos', () => {
    for (const stil of ['madina', 'kreis'] as const) {
      expect(adaptQuranText('عَلَيْهِمْ', amiri, stil)).toBe('عَلَيْهِمْ');
    }
  });

  it('lässt jede Schrift mit Unicode-Kodierung unangetastet', () => {
    for (const font of QURAN_FONTS.filter((f) => f.textEncoding === 'unicode')) {
      expect(adaptQuranText('كَفَرُوا۟ عَلَيْهِمْ', font)).toBe('كَفَرُوا۟ عَلَيْهِمْ');
    }
    expect(adaptQuranText('كَفَرُوا۟', amiri)).toBe('كَفَرُوا۟');
  });

  it('verkraftet leere Eingaben und ist idempotent für Unicode-Schriften', () => {
    expect(adaptQuranText('', kfgqpc)).toBe('');
    const einmal = adaptQuranText('كَفَرُوا۟', amiri);
    expect(adaptQuranText(einmal, amiri)).toBe(einmal);
  });

  it('kennzeichnet genau eine Schrift mit KFGQPC-Kodierung', () => {
    expect(QURAN_FONTS.filter((f) => f.textEncoding === 'kfgqpc').map((f) => f.id)).toEqual(['kfgqpc']);
  });
});

describe('quranFontForScript', () => {
  it('lässt das Uthmani-Schriftbild immer bei der eingestellten Schrift', () => {
    for (const font of QURAN_FONTS) {
      expect(quranFontForScript(font.id, 'uthmani').id).toBe(font.id);
    }
  });

  it('weicht bei IndoPak nur aus, wenn die Schrift dessen Buchstaben nicht hat', () => {
    for (const font of QURAN_FONTS) {
      const gesetzt = quranFontForScript(font.id, 'indopak');
      if (font.canRenderIndoPak) expect(gesetzt.id).toBe(font.id);
      else expect(gesetzt.id).toBe(INDOPAK_FALLBACK_FONT);
    }
  });

  it('nennt als Ersatzschrift eine, die IndoPak wirklich setzen kann', () => {
    // Sonst tauschte man neun Platzhalter gegen neun andere.
    expect(quranFontDef(INDOPAK_FALLBACK_FONT).canRenderIndoPak).toBe(true);
  });

  it('kennt genau die zwei Schriften ohne indopakistanische Buchstaben', () => {
    // Gemessen von scripts/pruefe-koran-fonts.mjs gegen die Font-Dateien.
    expect(QURAN_FONTS.filter((f) => !f.canRenderIndoPak).map((f) => f.id)).toEqual(['kfgqpc', 'amiri-quran']);
  });
});

describe('ARABIC_FONT_FEATURES', () => {
  it('fordert auf Web genau die Merkmale an, die arabische Schrift braucht', () => {
    // Jest läuft mit Platform.OS === 'ios' (preset jest-expo) — dort ist das
    // Objekt bewusst leer, weil der Shaper diese Merkmale selbst aktiviert und
    // React Native dafür keine Style-Eigenschaft anbietet.
    expect(ARABIC_FONT_FEATURES).toEqual({});
  });
});
