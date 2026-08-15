import {
  crossSurahCompletionLeg,
  crossSurahLegEndIndex,
  loopStartLeg,
  nextCrossSurahLeg,
  type CrossSurahTarget,
} from './crossSurahQueue';

// Al-Fatiha (1) Vers 1 bis Al-Baqara (2) Vers 286 — das Beispiel aus dem
// User-Wunsch, ohne Loop.
const fatihaToBaqara: CrossSurahTarget = { startSurah: 1, startAyah: 1, endSurah: 2, endAyah: 286, loop: false };

describe('nextCrossSurahLeg', () => {
  it('geht zur nächsten Sure ab Vers 1, solange das Ziel noch nicht erreicht ist', () => {
    expect(nextCrossSurahLeg(fatihaToBaqara, 1)).toEqual({ surah: 2, playFrom: 1 });
  });

  it('gibt null zurück, sobald die Zielsure bereits fertig ist', () => {
    expect(nextCrossSurahLeg(fatihaToBaqara, 2)).toBeNull();
  });

  it('überspringt keine Suren, auch wenn der Bereich mehrere umfasst', () => {
    const target: CrossSurahTarget = { startSurah: 1, startAyah: 1, endSurah: 5, endAyah: 1, loop: false };
    expect(nextCrossSurahLeg(target, 3)).toEqual({ surah: 4, playFrom: 1 });
  });
});

describe('loopStartLeg', () => {
  it('springt zurück zur Start-Sure und zum Start-Vers', () => {
    expect(loopStartLeg(fatihaToBaqara)).toEqual({ surah: 1, playFrom: 1 });
  });

  it('funktioniert auch, wenn der Start-Vers nicht 1 ist', () => {
    const target: CrossSurahTarget = { startSurah: 18, startAyah: 5, endSurah: 19, endAyah: 10, loop: true };
    expect(loopStartLeg(target)).toEqual({ surah: 18, playFrom: 5 });
  });
});

describe('crossSurahCompletionLeg', () => {
  it('geht ohne Loop zur nächsten Sure weiter, wenn das Ziel noch nicht erreicht ist', () => {
    expect(crossSurahCompletionLeg(fatihaToBaqara, 1)).toEqual({ surah: 2, playFrom: 1 });
  });

  it('stoppt (null), wenn das Ziel erreicht ist und kein Loop aktiv ist', () => {
    expect(crossSurahCompletionLeg(fatihaToBaqara, 2)).toBeNull();
  });

  it('springt bei aktivem Loop zurück zum Anfang, wenn das Ziel erreicht ist', () => {
    const target: CrossSurahTarget = { ...fatihaToBaqara, loop: true };
    expect(crossSurahCompletionLeg(target, 2)).toEqual({ surah: 1, playFrom: 1 });
  });

  it('loopt weiter Richtung Ziel-Sure, statt vorzeitig neu zu starten', () => {
    const target: CrossSurahTarget = { ...fatihaToBaqara, loop: true };
    expect(crossSurahCompletionLeg(target, 1)).toEqual({ surah: 2, playFrom: 1 });
  });
});

describe('crossSurahLegEndIndex', () => {
  it('spielt bis zum Sure-Ende, wenn diese Sure noch nicht die Zielsure ist', () => {
    expect(crossSurahLegEndIndex(fatihaToBaqara, 1, 0, 6)).toBe(6);
  });

  it('spielt nur bis zum Ziel-Vers, wenn diese Sure die Zielsure ist', () => {
    // Al-Baqara Vers 286 = Index 285.
    expect(crossSurahLegEndIndex(fatihaToBaqara, 2, 0, 285)).toBe(285);
  });

  it('spielt die ganze Sure, wenn kein Cross-Sure-Ziel aktiv ist', () => {
    expect(crossSurahLegEndIndex(null, 2, 0, 285)).toBe(285);
  });

  it('geht nie vor den Start-Index, auch bei widersprüchlichem Ziel-Vers', () => {
    const target: CrossSurahTarget = { startSurah: 2, startAyah: 200, endSurah: 2, endAyah: 5, loop: false };
    expect(crossSurahLegEndIndex(target, 2, 199, 285)).toBe(199);
  });
});
