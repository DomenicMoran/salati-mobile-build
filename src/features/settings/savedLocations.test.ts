import {
  addSavedLocation,
  findSavedLocation,
  isActiveSavedLocation,
  MAX_SAVED_LOCATIONS,
  removeSavedLocation,
} from './savedLocations';
import type { LocationSetting, SavedLocation } from './types';

const BERLIN: LocationSetting = { lat: 52.52, lon: 13.405, label: 'Berlin, Deutschland', city: 'Berlin', country: 'DE' };
const ISTANBUL: LocationSetting = { lat: 41.01, lon: 28.98, label: 'Istanbul, Türkei', city: 'Istanbul', country: 'TR' };

describe('addSavedLocation', () => {
  it('fügt einen neuen Ort mit id/Name an', () => {
    const result = addSavedLocation([], 'id-1', 'Zuhause', BERLIN);
    expect(result).toEqual([{ ...BERLIN, id: 'id-1', name: 'Zuhause' }]);
  });

  it('trimmt den Namen', () => {
    const result = addSavedLocation([], 'id-1', '  Arbeit  ', BERLIN);
    expect(result[0]?.name).toBe('Arbeit');
  });

  it('verwirft leere/nur-Leerzeichen-Namen (keine Änderung)', () => {
    expect(addSavedLocation([], 'id-1', '', BERLIN)).toEqual([]);
    expect(addSavedLocation([], 'id-1', '   ', BERLIN)).toEqual([]);
  });

  it('hängt an eine bestehende Liste an, ohne vorhandene Einträge zu verändern', () => {
    const existing: SavedLocation[] = [{ ...BERLIN, id: 'id-1', name: 'Zuhause' }];
    const result = addSavedLocation(existing, 'id-2', 'Arbeit', ISTANBUL);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(existing[0]);
    expect(result[1]).toEqual({ ...ISTANBUL, id: 'id-2', name: 'Arbeit' });
  });

  it('verwirft neue Einträge sobald MAX_SAVED_LOCATIONS erreicht ist', () => {
    const full: SavedLocation[] = Array.from({ length: MAX_SAVED_LOCATIONS }, (_, i) => ({
      ...BERLIN,
      id: `id-${i}`,
      name: `Ort ${i}`,
    }));
    const result = addSavedLocation(full, 'id-new', 'Zu viel', BERLIN);
    expect(result).toBe(full);
    expect(result).toHaveLength(MAX_SAVED_LOCATIONS);
  });
});

describe('removeSavedLocation', () => {
  const list: SavedLocation[] = [
    { ...BERLIN, id: 'id-1', name: 'Zuhause' },
    { ...ISTANBUL, id: 'id-2', name: 'Arbeit' },
  ];

  it('entfernt den passenden Eintrag per id', () => {
    expect(removeSavedLocation(list, 'id-1')).toEqual([list[1]]);
  });

  it('ist ein No-op, wenn die id nicht existiert', () => {
    expect(removeSavedLocation(list, 'unbekannt')).toEqual(list);
  });

  it('gibt ein leeres Array zurück, wenn der letzte Eintrag entfernt wird', () => {
    expect(removeSavedLocation([list[0]!], 'id-1')).toEqual([]);
  });
});

describe('findSavedLocation', () => {
  const list: SavedLocation[] = [
    { ...BERLIN, id: 'id-1', name: 'Zuhause' },
    { ...ISTANBUL, id: 'id-2', name: 'Arbeit' },
  ];

  it('findet einen Ort per id', () => {
    expect(findSavedLocation(list, 'id-2')).toEqual(list[1]);
  });

  it('gibt undefined zurück, wenn nichts passt', () => {
    expect(findSavedLocation(list, 'unbekannt')).toBeUndefined();
  });
});

describe('isActiveSavedLocation', () => {
  it('true, wenn Koordinaten mit dem aktiven Ort übereinstimmen', () => {
    const saved: SavedLocation = { ...BERLIN, id: 'id-1', name: 'Zuhause' };
    expect(isActiveSavedLocation(saved, BERLIN)).toBe(true);
  });

  it('false bei abweichenden Koordinaten', () => {
    const saved: SavedLocation = { ...BERLIN, id: 'id-1', name: 'Zuhause' };
    expect(isActiveSavedLocation(saved, ISTANBUL)).toBe(false);
  });
});
