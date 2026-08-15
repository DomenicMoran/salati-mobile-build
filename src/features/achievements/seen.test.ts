import AsyncStorage from '@react-native-async-storage/async-storage';

import { ACHIEVEMENTS_SEEN_KEY, loadSeenBadges, markBadgesSeen, parseSeenBadges } from './seen';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('parseSeenBadges', () => {
  it('liest eine gespeicherte Liste', () => {
    expect([...parseSeenBadges('["a","b"]')]).toEqual(['a', 'b']);
  });

  it('liefert eine leere Menge für null/kaputt/falschen Typ', () => {
    expect(parseSeenBadges(null).size).toBe(0);
    expect(parseSeenBadges('{{{').size).toBe(0);
    expect(parseSeenBadges('{"a":1}').size).toBe(0);
    expect(parseSeenBadges('"a"').size).toBe(0);
  });

  it('filtert Nicht-Strings heraus, statt sie als IDs zu übernehmen', () => {
    expect([...parseSeenBadges('["a",1,null,{"id":"b"},"c"]')]).toEqual(['a', 'c']);
  });

  it('entfernt Duplikate', () => {
    expect(parseSeenBadges('["a","a","b"]').size).toBe(2);
  });
});

describe('markBadgesSeen', () => {
  it('speichert neu gesehene Abzeichen', async () => {
    await markBadgesSeen(['first-lesson']);
    expect([...(await loadSeenBadges())]).toEqual(['first-lesson']);
  });

  it('ergänzt bestehende, ohne alte zu verlieren (kein Überschreiben)', async () => {
    await markBadgesSeen(['a', 'b']);
    await markBadgesSeen(['c']);
    expect([...(await loadSeenBadges())].sort()).toEqual(['a', 'b', 'c']);
  });

  it('ist idempotent — dasselbe Abzeichen erscheint nur einmal', async () => {
    await markBadgesSeen(['a']);
    await markBadgesSeen(['a']);
    expect(JSON.parse((await AsyncStorage.getItem(ACHIEVEMENTS_SEEN_KEY))!)).toEqual(['a']);
  });

  it('ändert bei leerer Liste nichts am Bestand', async () => {
    await markBadgesSeen(['a']);
    await markBadgesSeen([]);
    expect([...(await loadSeenBadges())]).toEqual(['a']);
  });

  it('rettet den Bestand nicht, wenn er kaputt war — startet aber sauber neu', async () => {
    await AsyncStorage.setItem(ACHIEVEMENTS_SEEN_KEY, 'kaputt');
    await markBadgesSeen(['a']);
    expect([...(await loadSeenBadges())]).toEqual(['a']);
  });
});
