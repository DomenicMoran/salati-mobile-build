import {
  DASHBOARD_CARD_IDS,
  DASHBOARD_LOCKED_CARDS,
  moveDashboardCard,
  normalizeDashboardCardOrder,
  toggleDashboardCardHidden,
  type DashboardCardId,
} from './dashboardCards';

// Der Start-Screen rendert genau, was hier herauskommt. Eine verlorene Karte
// bedeutet, dass die Gebetszeiten-Tabelle nach einem App-Update verschwindet;
// eine doppelte Karte doppelte React-Keys und eine doppelt gezeichnete Liste.

describe('normalizeDashboardCardOrder', () => {
  it('lässt eine vollständige Reihenfolge unverändert', () => {
    const order: DashboardCardId[] = ['prayerTable', 'hero', 'travelBanner', 'ramadanCard'];
    expect(normalizeDashboardCardOrder(order)).toEqual(order);
  });

  it('hängt eine neu hinzugekommene Karte hinten an (App-Update)', () => {
    expect(normalizeDashboardCardOrder(['prayerTable', 'hero'])).toEqual([
      'prayerTable',
      'hero',
      'ramadanCard',
      'travelBanner',
    ]);
  });

  it('verwirft unbekannte IDs aus einer neueren/älteren App-Version', () => {
    const stored = ['hero', 'gibtEsNichtMehr', 'prayerTable'] as unknown as DashboardCardId[];
    expect(normalizeDashboardCardOrder(stored)).toEqual([
      'hero',
      'prayerTable',
      'ramadanCard',
      'travelBanner',
    ]);
  });

  it('entfernt Duplikate und behält das erste Vorkommen', () => {
    const stored: DashboardCardId[] = ['hero', 'hero', 'prayerTable', 'hero'];
    const result = normalizeDashboardCardOrder(stored);
    expect(result.filter((c) => c === 'hero')).toHaveLength(1);
    expect(result[0]).toBe('hero');
  });

  it('liefert für eine leere Reihenfolge die Standardreihenfolge', () => {
    expect(normalizeDashboardCardOrder([])).toEqual(DASHBOARD_CARD_IDS);
  });

  it('enthält immer JEDE Karte genau einmal — egal welcher Speicherstand', () => {
    const inputs = [
      [],
      ['travelBanner'],
      ['x', 'y'],
      ['prayerTable', 'prayerTable'],
      DASHBOARD_CARD_IDS,
    ] as unknown as DashboardCardId[][];
    for (const input of inputs) {
      const result = normalizeDashboardCardOrder(input);
      expect([...result].sort()).toEqual([...DASHBOARD_CARD_IDS].sort());
    }
  });
});

describe('moveDashboardCard', () => {
  it('verschiebt nach oben und nach unten', () => {
    expect(moveDashboardCard(DASHBOARD_CARD_IDS, 'ramadanCard', 'up')).toEqual([
      'ramadanCard',
      'hero',
      'travelBanner',
      'prayerTable',
    ]);
    expect(moveDashboardCard(DASHBOARD_CARD_IDS, 'hero', 'down')).toEqual([
      'ramadanCard',
      'hero',
      'travelBanner',
      'prayerTable',
    ]);
  });

  it('lässt die Ränder unverändert', () => {
    expect(moveDashboardCard(DASHBOARD_CARD_IDS, 'hero', 'up')).toEqual(DASHBOARD_CARD_IDS);
    expect(moveDashboardCard(DASHBOARD_CARD_IDS, 'prayerTable', 'down')).toEqual(DASHBOARD_CARD_IDS);
  });

  it('ist ein No-op für eine nicht enthaltene Karte', () => {
    expect(moveDashboardCard(['hero', 'prayerTable'], 'ramadanCard', 'up')).toEqual(['hero', 'prayerTable']);
  });

  it('gibt immer eine neue Liste zurück (kein Mutieren des Eingabe-Arrays)', () => {
    const input: DashboardCardId[] = [...DASHBOARD_CARD_IDS];
    const result = moveDashboardCard(input, 'ramadanCard', 'up');
    expect(input).toEqual(DASHBOARD_CARD_IDS);
    expect(result).not.toBe(input);
  });

  it('verliert beim Verschieben nie eine Karte', () => {
    let order: DashboardCardId[] = [...DASHBOARD_CARD_IDS];
    for (const id of DASHBOARD_CARD_IDS) {
      order = moveDashboardCard(order, id, 'up');
      order = moveDashboardCard(order, id, 'down');
    }
    expect([...order].sort()).toEqual([...DASHBOARD_CARD_IDS].sort());
  });
});

describe('toggleDashboardCardHidden', () => {
  it('blendet optionale Karten aus und wieder ein', () => {
    expect(toggleDashboardCardHidden([], 'ramadanCard')).toEqual(['ramadanCard']);
    expect(toggleDashboardCardHidden(['ramadanCard'], 'ramadanCard')).toEqual([]);
  });

  it.each(DASHBOARD_LOCKED_CARDS)('lässt die Kernkarte %s nicht ausblenden', (id) => {
    expect(toggleDashboardCardHidden([], id)).toEqual([]);
    // ...und entfernt sie auch nicht aus einer (fehlerhaft) gespeicherten Liste,
    // ohne sie neu hinzuzufügen.
    expect(toggleDashboardCardHidden(['ramadanCard'], id)).toEqual(['ramadanCard']);
  });

  it('deckt hero und prayerTable als Kernkarten ab', () => {
    expect(DASHBOARD_LOCKED_CARDS).toEqual(['hero', 'prayerTable']);
  });

  it('mutiert die Eingabe nicht', () => {
    const hidden: DashboardCardId[] = ['ramadanCard'];
    toggleDashboardCardHidden(hidden, 'travelBanner');
    expect(hidden).toEqual(['ramadanCard']);
  });
});
