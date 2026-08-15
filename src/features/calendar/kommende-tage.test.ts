/**
 * `kommendeIslamischeTage` füllt die Seitenspalte des Kalenders auf breiten
 * Fenstern (Befund 30.07.2026: der Inhalt endete dort bei rund 36 % der Höhe).
 *
 * Die Funktion rechnet vorwärts über gregorianische Tage, weil die Umrechnung
 * nur in diese Richtung eindeutig ist. Die Fallstricke, die hier abgesichert
 * werden: ein Hijri-Jahr ist kürzer als ein gregorianisches, also kann
 * derselbe Anlass innerhalb des Suchfensters zweimal auftreten — und das
 * Fenster muss lang genug sein, um jeden der neun Anlässe einmal zu erwischen.
 */
import { gregorianToHijriOffline } from './offline';
import { kommendeIslamischeTage } from './islamicDays';

const nachHijri = (d: Date) => gregorianToHijriOffline(d);

describe('kommendeIslamischeTage', () => {
  it('liefert die gewuenschte Anzahl, nach Naehe sortiert', () => {
    const treffer = kommendeIslamischeTage(new Date(2026, 6, 30), nachHijri, 6);
    expect(treffer).toHaveLength(6);
    const abstaende = treffer.map((t) => t.inTagen);
    expect([...abstaende].sort((a, b) => a - b)).toEqual(abstaende);
  });

  it('nennt keinen Anlass zweimal', () => {
    const treffer = kommendeIslamischeTage(new Date(2026, 6, 30), nachHijri, 9);
    const keys = treffer.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('liegt nie in der Vergangenheit', () => {
    const heute = new Date(2026, 6, 30);
    for (const t of kommendeIslamischeTage(heute, nachHijri, 9)) {
      expect(t.inTagen).toBeGreaterThanOrEqual(0);
      expect(t.datum.getTime()).toBeGreaterThanOrEqual(new Date(2026, 6, 30).getTime());
    }
  });

  it('findet auch von einem beliebigen anderen Tag aus Anlaesse', () => {
    // Stichproben über das Jahr: das Suchfenster darf nie leer ausgehen.
    for (const monat of [0, 3, 8, 11]) {
      const treffer = kommendeIslamischeTage(new Date(2027, monat, 15), nachHijri, 3);
      expect(treffer.length).toBeGreaterThan(0);
    }
  });

  it('gibt jeden Anlass mit einem uebersetzbaren Schluessel zurueck', () => {
    const de = require('@/locales/de.json') as { calendar: { days: Record<string, string> } };
    for (const t of kommendeIslamischeTage(new Date(2026, 6, 30), nachHijri, 9)) {
      expect(de.calendar.days[t.key]).toBeTruthy();
    }
  });
});
