import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Timings } from './api';
import type { PrayerCalcOptions } from './calc';
import { readTimingsCache, writeTimingsCache } from './storage';

// Der Offline-Cache ist die Quelle der Gebetszeiten ohne Netz. Ein
// Schlüssel, der NICHT alle rechenrelevanten Parameter enthält, liefert nach
// einer Einstellungsänderung offline weiter die ALTEN Zeiten — der Nutzer
// betet dann nach falschen Zeiten. Deshalb prüft diese Suite jede einzelne
// Option auf Schlüssel-Trennung.

const TIMINGS: Timings = {
  Fajr: '03:12',
  Sunrise: '05:10',
  Dhuhr: '13:20',
  Asr: '17:25',
  Maghrib: '21:22',
  Isha: '23:05',
};

const BASE: PrayerCalcOptions = {
  method: 3,
  school: 0,
  highLatitude: 'auto',
  offsets: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
};

const LAT = 52.52;
const LON = 13.405;

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('writeTimingsCache / readTimingsCache', () => {
  it('liest zurück, was geschrieben wurde, inkl. Hijri-Datum', async () => {
    const hijri = { day: '13', month: { number: '1', en: 'Muharram' }, year: '1448' };
    await writeTimingsCache(LAT, LON, BASE, { today: TIMINGS, tomorrow: TIMINGS, hijri });
    const cached = await readTimingsCache(LAT, LON, BASE);
    expect(cached?.today).toEqual(TIMINGS);
    expect(cached?.hijri).toEqual(hijri);
  });

  it('setzt savedAt auf den Schreibzeitpunkt', async () => {
    const before = Date.now();
    await writeTimingsCache(LAT, LON, BASE, { today: TIMINGS, tomorrow: TIMINGS });
    const cached = await readTimingsCache(LAT, LON, BASE);
    expect(cached!.savedAt).toBeGreaterThanOrEqual(before);
    expect(cached!.savedAt).toBeLessThanOrEqual(Date.now());
  });

  it('liefert null, wenn nichts gespeichert ist', async () => {
    expect(await readTimingsCache(LAT, LON, BASE)).toBeNull();
  });

  it('liefert null statt zu werfen, wenn der Eintrag kaputt ist', async () => {
    await writeTimingsCache(LAT, LON, BASE, { today: TIMINGS, tomorrow: TIMINGS });
    const key = (await AsyncStorage.getAllKeys()).find((k) => k.startsWith('salatibox:timings:'))!;
    await AsyncStorage.setItem(key, '{ kaputt');
    expect(await readTimingsCache(LAT, LON, BASE)).toBeNull();
  });
});

describe('Cache-Schlüssel trennt alle rechenrelevanten Parameter', () => {
  const variants: [string, PrayerCalcOptions][] = [
    ['Berechnungsmethode', { ...BASE, method: 13 }],
    ['Rechtsschule (Asr)', { ...BASE, school: 1 }],
    ['Hochbreiten-Regel', { ...BASE, highLatitude: 'twilightAngle' }],
    ['Fadschr-Korrektur', { ...BASE, offsets: { ...BASE.offsets, fajr: -3 } }],
    ['Sonnenaufgang-Korrektur', { ...BASE, offsets: { ...BASE.offsets, sunrise: 2 } }],
    ['Dhuhr-Korrektur', { ...BASE, offsets: { ...BASE.offsets, dhuhr: 1 } }],
    ['Asr-Korrektur', { ...BASE, offsets: { ...BASE.offsets, asr: 1 } }],
    ['Maghrib-Korrektur', { ...BASE, offsets: { ...BASE.offsets, maghrib: 4 } }],
    ['Ischa-Korrektur', { ...BASE, offsets: { ...BASE.offsets, isha: 5 } }],
  ];

  it.each(variants)('geänderte %s liefert keinen Treffer aus dem alten Cache', async (_label, changed) => {
    await writeTimingsCache(LAT, LON, BASE, { today: TIMINGS, tomorrow: TIMINGS });
    expect(await readTimingsCache(LAT, LON, changed)).toBeNull();
    // ...und der alte Stand bleibt für die alte Einstellung erhalten.
    expect(await readTimingsCache(LAT, LON, BASE)).not.toBeNull();
  });

  it('trennt verschiedene Orte', async () => {
    await writeTimingsCache(LAT, LON, BASE, { today: TIMINGS, tomorrow: TIMINGS });
    expect(await readTimingsCache(48.14, 11.58, BASE)).toBeNull();
  });

  it('rundet den Ort auf 3 Nachkommastellen — Meter-Bewegungen erzeugen keinen neuen Eintrag', async () => {
    await writeTimingsCache(LAT, LON, BASE, { today: TIMINGS, tomorrow: TIMINGS });
    expect(await readTimingsCache(LAT + 0.0001, LON - 0.0001, BASE)).not.toBeNull();
    expect(await AsyncStorage.getAllKeys()).toHaveLength(1);
  });

  it('trennt Nord/Süd und Ost/West trotz gleichem Betrag', async () => {
    await writeTimingsCache(LAT, LON, BASE, { today: TIMINGS, tomorrow: TIMINGS });
    expect(await readTimingsCache(-LAT, LON, BASE)).toBeNull();
    expect(await readTimingsCache(LAT, -LON, BASE)).toBeNull();
  });
});
