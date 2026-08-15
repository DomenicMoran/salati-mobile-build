import {
  DEFAULT_METHOD_ID,
  METHODS,
  METHOD_REGION_ORDER,
  PRAYER_METHODS,
  methodById,
  methodName,
  methodParamsLabel,
  methodShortName,
} from './methods';

const LABELS = {
  fajr: 'Fadschr',
  isha: 'Ischa',
  minutesAfterMaghrib: '{n} Min. nach Maghrib',
  degree: '°',
  decimal: ',',
};

describe('Behörden-Katalog', () => {
  it('vergibt jede Aladhan-ID nur einmal', () => {
    const ids = PRAYER_METHODS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ordnet kein Land zwei Behörden zu', () => {
    // Ein doppelt vergebenes Land hieße: der Vorschlag hinge an der
    // Reihenfolge des Katalogs statt an einer Entscheidung.
    const gesehen = new Map<string, string>();
    const doppelt: string[] = [];
    for (const m of PRAYER_METHODS) {
      for (const land of m.countries) {
        const vorher = gesehen.get(land);
        if (vorher) doppelt.push(`${land}: ${vorher} und ${m.shortName}`);
        else gesehen.set(land, m.shortName);
      }
    }
    expect(doppelt).toEqual([]);
  });

  it('benutzt nur gültige ISO-3166-alpha-2-Codes', () => {
    const ungueltig = PRAYER_METHODS.flatMap((m) => m.countries.filter((c) => !/^[A-Z]{2}$/.test(c)));
    expect(ungueltig).toEqual([]);
  });

  it('gibt zu jeder Methode eine Quelle an', () => {
    const ohneQuelle = PRAYER_METHODS.filter((m) => !m.source.startsWith('https://'));
    expect(ohneQuelle).toEqual([]);
  });

  it('hält jede Region der Reihenfolge-Liste für gültig', () => {
    const unbekannt = PRAYER_METHODS.filter((m) => !METHOD_REGION_ORDER.includes(m.region));
    expect(unbekannt).toEqual([]);
  });

  it('bleibt bei plausiblen Winkeln', () => {
    // Fadschr zwischen 12° (UOIF) und 20° (Südostasien); Ischa als Winkel
    // ebenso, als Intervall zwischen 60 und 120 Minuten. Ein Tippfehler wie
    // 180 statt 18 fiele hier auf.
    for (const m of PRAYER_METHODS) {
      expect(m.fajrAngle).toBeGreaterThanOrEqual(12);
      expect(m.fajrAngle).toBeLessThanOrEqual(20);
      if (m.isha.kind === 'angle') {
        expect(m.isha.angle).toBeGreaterThanOrEqual(12);
        expect(m.isha.angle).toBeLessThanOrEqual(20);
      } else {
        expect(m.isha.minutes).toBeGreaterThanOrEqual(60);
        expect(m.isha.minutes).toBeLessThanOrEqual(120);
      }
    }
  });

  it('kennt die Voreinstellung', () => {
    expect(methodById(DEFAULT_METHOD_ID)?.shortName).toBe('Diyanet');
  });

  it('stellt die Voreinstellung an den Anfang der Liste', () => {
    // Der Picker zeigt die Reihenfolge des Katalogs; die Voreinstellung soll
    // ohne Scrollen sichtbar sein.
    expect(PRAYER_METHODS[0]?.id).toBe(DEFAULT_METHOD_ID);
  });

  it('deckt die 13 bisher angebotenen Methoden weiterhin ab', () => {
    // Bestandsschutz: Installationen mit einer dieser gespeicherten IDs dürfen
    // nach dem Update nicht auf eine andere Methode fallen.
    for (const id of [1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14, 15]) {
      expect(methodById(id)).toBeDefined();
    }
  });

  it('beschriftet unbekannte IDs erkennbar statt leer', () => {
    expect(methodName(999)).toBe('#999');
    expect(methodShortName(999)).toBe('#999');
  });

  it('schreibt die Parameterzeile für Winkel und Intervall', () => {
    const diyanet = methodById(13)!;
    expect(methodParamsLabel(diyanet, LABELS)).toBe('Fadschr 18° · Ischa 17°');
    const ummAlQura = methodById(4)!;
    expect(methodParamsLabel(ummAlQura, LABELS)).toBe('Fadschr 18,5° · Ischa 90 Min. nach Maghrib');
  });

  it('behält die alte { id, name }-Form für ältere Call-Sites', () => {
    expect(METHODS.every((m) => typeof m.id === 'number' && typeof m.name === 'string')).toBe(true);
    expect(METHODS.length).toBe(PRAYER_METHODS.length);
  });
});
