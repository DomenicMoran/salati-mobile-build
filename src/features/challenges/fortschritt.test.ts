import type { TrackerData } from '@/features/tracker/store';

import {
  LEERER_ZAEHLSTAND,
  berechneFortschritt,
  hifzVerseGesamt,
  laengsteKette,
  sichereErreichte,
  tageMitGebet,
  tageVollstaendig,
  wertFuerQuelle,
  type Zaehlstand,
} from './fortschritt';
import { HERAUSFORDERUNGEN, type Herausforderung } from './katalog';
import { parseStand, zaehle, merkeErreicht } from './store';

const VOLL = { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true };

function h(id: string): Herausforderung {
  const treffer = HERAUSFORDERUNGEN.find((x) => x.id === id);
  if (!treffer) throw new Error(`unbekannt: ${id}`);
  return treffer;
}

describe('laengsteKette', () => {
  it('zaehlt zusammenhaengende Tage', () => {
    expect(laengsteKette(['2026-08-01', '2026-08-02', '2026-08-03'])).toBe(3);
  });

  it('bricht bei einer Luecke ab und nimmt die laengste Kette', () => {
    expect(laengsteKette(['2026-08-01', '2026-08-02', '2026-08-05', '2026-08-06', '2026-08-07'])).toBe(3);
  });

  it('ist unabhaengig von der Reihenfolge und ignoriert Doppel', () => {
    expect(laengsteKette(['2026-08-03', '2026-08-01', '2026-08-02', '2026-08-02'])).toBe(3);
  });

  it('kommt ueber Monats- und Jahresgrenzen', () => {
    expect(laengsteKette(['2026-12-31', '2027-01-01', '2027-01-02'])).toBe(3);
  });

  it('ueberspringt unbrauchbare Eintraege statt zu werfen', () => {
    expect(laengsteKette(['kaputt', '2026-08-01', '2026-08-02'])).toBe(2);
  });

  it('ist 0 fuer eine leere Liste', () => {
    expect(laengsteKette([])).toBe(0);
  });
});

describe('Gebets-Tracker als Quelle', () => {
  const daten: TrackerData = {
    '2026-08-01': { ...VOLL },
    '2026-08-02': { fajr: true, dhuhr: true },
    '2026-08-03': { ...VOLL },
    // Befreiter Tag: zaehlt nicht als vollstaendig.
    '2026-08-04': { exempt: true },
  };

  it('zaehlt Tage mit allen fuenf Gebeten', () => {
    expect(tageVollstaendig(daten)).toBe(2);
  });

  it('zaehlt Tage je einzelnem Gebet', () => {
    expect(tageMitGebet(daten, 'fajr')).toBe(3);
    expect(tageMitGebet(daten, 'isha')).toBe(2);
    expect(tageMitGebet(daten, 'asr')).toBe(2);
  });
});

describe('hifzVerseGesamt', () => {
  it('zaehlt nur als gelernt markierte Verse ueber alle Suren', () => {
    expect(
      hifzVerseGesamt({
        1: { 1: 'known', 2: 'known', 3: 'learning' },
        114: { 1: 'known' },
      }),
    ).toBe(3);
  });

  it('ist 0 ohne Fortschritt', () => {
    expect(hifzVerseGesamt({})).toBe(0);
  });
});

describe('wertFuerQuelle', () => {
  const z: Zaehlstand = {
    ...LEERER_ZAEHLSTAND,
    gebetTageVollstaendig: 12,
    gebetSerie: 4,
    gebetTageJeGebet: { fajr: 9, dhuhr: 8, asr: 7, maghrib: 6, isha: 5 },
    quranLesetage: 21,
    hifzVerse: 33,
  };

  it('liefert je Quelle den passenden Rohwert', () => {
    expect(wertFuerQuelle('gebet-tage-vollstaendig', z)).toBe(12);
    expect(wertFuerQuelle('gebet-serie', z)).toBe(4);
    expect(wertFuerQuelle('gebet-fajr-tage', z)).toBe(9);
    expect(wertFuerQuelle('gebet-isha-tage', z)).toBe(5);
    expect(wertFuerQuelle('quran-lesetage', z)).toBe(21);
    expect(wertFuerQuelle('hifz-verse', z)).toBe(33);
  });

  it('liefert fuer selbst gezaehlte Ziele 0 (die kommen aus dem Stand)', () => {
    expect(wertFuerQuelle('manuell', z)).toBe(0);
  });
});

describe('berechneFortschritt', () => {
  const z: Zaehlstand = { ...LEERER_ZAEHLSTAND, gebetTageVollstaendig: 7 };

  it('deckelt den Wert auf das Ziel und rechnet den Anteil', () => {
    const [stufe1] = berechneFortschritt(z, {}, [h('gebet-vollstaendig-1')]);
    expect(stufe1!.wert).toBe(3);
    expect(stufe1!.anteil).toBe(1);
    expect(stufe1!.erreicht).toBe(true);
  });

  it('meldet ein noch nicht erreichtes Ziel anteilig', () => {
    const [stufe3] = berechneFortschritt(z, {}, [h('gebet-vollstaendig-3')]);
    expect(stufe3!.wert).toBe(7);
    expect(stufe3!.herausforderung.ziel).toBe(30);
    expect(stufe3!.erreicht).toBe(false);
    expect(stufe3!.anteil).toBeCloseTo(7 / 30);
  });

  it('nimmt bei selbst gezaehlten Zielen den Zaehler aus dem Stand', () => {
    // Am Zielwert der Vorlage entlang gezaehlt statt mit einer festen Zahl:
    // sonst faellt der Test um, sobald sich eine Stufe aendert (genau das ist
    // beim Anheben der Stufe-1-Ziele passiert).
    const ziel = h('charakter-sadaqa-1');
    let stand = {};
    for (let i = 0; i < ziel.ziel - 1; i++) stand = zaehle(stand, ziel.id, 1);
    const [fastGeschafft] = berechneFortschritt(LEERER_ZAEHLSTAND, stand, [ziel]);
    expect(fastGeschafft!.erreicht).toBe(false);

    stand = zaehle(stand, ziel.id, 1);
    const [geschafft] = berechneFortschritt(LEERER_ZAEHLSTAND, stand, [ziel]);
    expect(geschafft!.erreicht).toBe(true);
    expect(geschafft!.wert).toBe(ziel.ziel);
  });

  it('haelt ein einmal erreichtes Ziel erreicht, auch wenn die Serie reisst', () => {
    const stand = merkeErreicht({}, 'gebet-serie-2', 1_700_000_000_000);
    const [f] = berechneFortschritt(LEERER_ZAEHLSTAND, stand, [h('gebet-serie-2')]);
    expect(f!.erreicht).toBe(true);
    expect(f!.wert).toBe(0); // der Fortschrittsbalken zeigt trotzdem die Wahrheit
  });
});

describe('sichereErreichte', () => {
  it('merkt nur neu Erreichtes und nur einmal', async () => {
    const z: Zaehlstand = { ...LEERER_ZAEHLSTAND, gebetTageVollstaendig: 3 };
    const erste = berechneFortschritt(z, {}, [h('gebet-vollstaendig-1')]);
    const lauf1 = await sichereErreichte(erste, {}, 1000);
    expect(lauf1.neu).toEqual(['gebet-vollstaendig-1']);
    expect(lauf1.stand['gebet-vollstaendig-1']?.erreichtAm).toBe(1000);

    const zweite = berechneFortschritt(z, lauf1.stand, [h('gebet-vollstaendig-1')]);
    const lauf2 = await sichereErreichte(zweite, lauf1.stand, 2000);
    expect(lauf2.neu).toEqual([]);
    expect(lauf2.stand['gebet-vollstaendig-1']?.erreichtAm).toBe(1000);
  });
});

describe('Stand: lesen und schreiben', () => {
  it('verwirft unbrauchbare Werte statt zu werfen', () => {
    expect(parseStand(null)).toEqual({});
    expect(parseStand('kein json')).toEqual({});
    expect(parseStand('[]')).toEqual({});
    expect(parseStand('{"a":{"zaehler":-3}}')).toEqual({});
    expect(parseStand('{"a":{"zaehler":"viel"}}')).toEqual({});
    expect(parseStand('{"a":{"zaehler":2.7}}')).toEqual({ a: { zaehler: 2 } });
  });

  it('zaehlt nie unter null', () => {
    expect(zaehle({}, 'x', -1)).toEqual({});
    const eins = zaehle({}, 'x', 1);
    expect(zaehle(eins, 'x', -1)).toEqual({ x: { zaehler: 0 } });
  });

  it('gibt bei unveraendertem Ergebnis dasselbe Objekt zurueck', () => {
    const stand = {};
    expect(zaehle(stand, 'x', 0)).toBe(stand);
    const erreicht = merkeErreicht({}, 'y', 5);
    expect(merkeErreicht(erreicht, 'y', 99)).toBe(erreicht);
  });
});
