// Kuratierte, breit anerkannte islamische Kalendertage — bewusst als eigene,
// deterministische Hijri-Datums-Zuordnung statt der `hijri.holidays`-Strings
// der AlAdhan-API: die API-Liste ist nur Englisch und enthält überwiegend
// tradition-spezifische Urs-/Scheich-Gedenktage, die weder übersetzbar noch
// für eine neutrale Kern-Islam-App als "besondere Tage" geeignet sind.
// Rückgabe sind Locale-Key-Suffixe (calendar.days.*), 6-sprachig gepflegt.
const ISLAMIC_DAY_KEYS: Record<string, string> = {
  '1-1': 'newYear',
  '1-10': 'ashura',
  '3-12': 'mawlid',
  '7-27': 'miraj',
  '9-1': 'ramadanStart',
  '9-27': 'laylatAlQadr',
  '10-1': 'eidFitr',
  '12-9': 'arafah',
  '12-10': 'eidAdha',
};

export function islamicDayKeys(hijriMonth: number, hijriDay: number): string[] {
  const key = ISLAMIC_DAY_KEYS[`${hijriMonth}-${hijriDay}`];
  return key ? [key] : [];
}

export interface KommenderTag {
  /** Locale-Key-Suffix, s. `calendar.days.*`. */
  key: string;
  datum: Date;
  /** Volle Tage bis dahin, 0 = heute. */
  inTagen: number;
}

/**
 * Die nächsten kuratierten Tage ab heute, nach Nähe sortiert.
 *
 * Gerechnet wird VORWÄRTS über den gregorianischen Kalender statt rückwärts
 * über Hijri-Daten: die Umrechnung ist nur in eine Richtung eindeutig, und ein
 * Hijri-Jahr hat je nach Monat 29 oder 30 Tage. Ein Jahr Vorlauf reicht, um
 * jeden der neun Tage genau einmal zu treffen.
 *
 * Steht in der Seitenspalte des Kalenders auf breiten Fenstern: dort blieb
 * sonst Fläche frei, und „wann ist das nächste Mal Aschura" ist die Frage, die
 * ein Kalender beantworten soll.
 */
export function kommendeIslamischeTage(
  heute: Date,
  nachHijri: (d: Date) => { day: number; month: number },
  anzahl = 6,
): KommenderTag[] {
  const start = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate());
  const treffer: KommenderTag[] = [];
  const gesehen = new Set<string>();
  for (let i = 0; i < 380 && treffer.length < anzahl; i++) {
    const tag = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const h = nachHijri(tag);
    const key = ISLAMIC_DAY_KEYS[`${h.month}-${h.day}`];
    // Jeden Tag nur einmal: sonst stünde bei einem 355-Tage-Jahr derselbe
    // Anlass am Ende des Fensters ein zweites Mal.
    if (!key || gesehen.has(key)) continue;
    gesehen.add(key);
    treffer.push({ key, datum: tag, inTagen: i });
  }
  return treffer;
}
