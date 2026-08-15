import type { Timings } from './api';

export const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
export type Prayer = (typeof PRAYERS)[number];

/** Trifft `t` genau die verlangte Wanduhrzeit am verlangten Kalendertag? */
function trifftWanduhr(t: number, y: number, mo: number, day: number, h: number, m: number): boolean {
  const d = new Date(t);
  return (
    d.getFullYear() === y &&
    d.getMonth() === mo &&
    d.getDate() === day &&
    d.getHours() === h &&
    d.getMinutes() === m
  );
}

/**
 * Erster Zeitpunkt zwischen `lo` und `hi`, der bereits den Versatz von `hi`
 * trägt — also der Umstellungszeitpunkt selbst. Minutengenau, weil jede
 * bekannte Umstellung auf einer vollen Minute liegt; die Schleife läuft
 * höchstens über die Breite der Lücke (weltweit ≤ 2 h).
 */
function umstellungszeitpunkt(lo: number, hi: number): number {
  const ziel = new Date(hi).getTimezoneOffset();
  for (let t = lo; t < hi; t += 60_000) {
    if (new Date(t).getTimezoneOffset() === ziel) return t;
  }
  return hi;
}

/**
 * Parst "HH:MM" auf das Datum von `reference` (lokale Zeit).
 *
 * NICHT `setHours()` allein — daran hing ein belegter Fehler: an Tagen mit
 * Vorstellung der Uhr gibt es eine Wanduhr-Stunde, die nicht existiert (in
 * Europa 02:00–02:59). `setHours(2, 30)` liefert dort stillschweigend 03:30,
 * also eine STUNDE ZU SPÄT. Nachgemessen über alle 525.600 Minuten des Jahres
 * 2026: in Europe/Berlin, London, New York, Sydney und Chatham feuerten je
 * genau die 60 Minuten der Lücke eine Stunde zu spät. Betroffen ist jede
 * Erinnerung, deren Zeitpunkt hineinfällt — in hohen Breiten Fadschr und
 * Tahadschud, im Ramadan der Suhur-Wecker.
 *
 * Vorgehen: die Wanduhrzeit als Pseudo-UTC nehmen und mit JEDEM Zonenversatz
 * verrechnen, der an diesem Tag gilt (vor und nach einer möglichen
 * Umstellung). Von den Ergebnissen zählt nur, was die verlangte Wanduhrzeit
 * wirklich trifft:
 *  - genau eines trifft → eindeutige Zeit, der Normalfall,
 *  - beide treffen      → mehrdeutig (Rückstellung), das FRÜHERE Vorkommen
 *    gewinnt; das ist zugleich das bisherige Verhalten von setHours,
 *  - keines trifft      → Lücke, auf den Umstellungszeitpunkt ziehen statt
 *    eine volle Stunde zu überspringen.
 */
export function parseTimeOn(hhmm: string, reference: Date): Date {
  const parts = hhmm.split(':');
  const h = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);
  // Unbrauchbare Eingabe wie bisher an setHours durchreichen (Invalid Date) —
  // die Aufrufer prüfen ihre Zeiten bereits auf Vorhandensein.
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    const ungueltig = new Date(reference);
    ungueltig.setHours(h, m, 0, 0);
    return ungueltig;
  }

  const y = reference.getFullYear();
  const mo = reference.getMonth();
  const day = reference.getDate();
  const basis = Date.UTC(y, mo, day, h, m, 0, 0);

  // Die Zonenversätze, die um diesen Zeitpunkt herum überhaupt gelten können.
  // ±26 h und NICHT ±12 h: `basis` ist eine Pseudo-UTC-Marke, der echte
  // Zeitpunkt liegt um den Zonenversatz daneben — bei Chatham (+12:45/+13:45)
  // sind das über 13 h, ein 12-h-Fenster verfehlt die Umstellung dann ganz
  // (belegt: Chatham, 05.04.2026, 02:00 lief eine Stunde zu spät).
  const versaetze = new Set([
    new Date(basis - 26 * 3_600_000).getTimezoneOffset(),
    new Date(basis).getTimezoneOffset(),
    new Date(basis + 26 * 3_600_000).getTimezoneOffset(),
  ]);
  const kandidaten = [...versaetze].map((versatz) => basis + versatz * 60_000);
  const gueltig = kandidaten.filter((t) => trifftWanduhr(t, y, mo, day, h, m));
  if (gueltig.length > 0) return new Date(Math.min(...gueltig));
  return new Date(umstellungszeitpunkt(Math.min(...kandidaten), Math.max(...kandidaten)));
}

export interface NextPrayerResult {
  nextIdx: number;
  nextPrayer: Prayer;
  nextTs: Date;
  diffMs: number;
}

/**
 * Bestimmt das nächste Gebet ausgehend von `now`. Wenn alle heutigen Gebete
 * vorbei sind, ist das nächste Gebet Fajr von morgen.
 */
export function nextPrayer(today: Timings, tomorrow: Timings, now: Date): NextPrayerResult {
  let idx = -1;
  for (let i = 0; i < PRAYERS.length; i++) {
    const p = PRAYERS[i] as Prayer;
    if (parseTimeOn(today[p], now) > now) {
      idx = i;
      break;
    }
  }

  let nextTs: Date;
  let nextPrayerName: Prayer;
  if (idx >= 0) {
    nextPrayerName = PRAYERS[idx] as Prayer;
    nextTs = parseTimeOn(today[nextPrayerName], now);
  } else {
    nextPrayerName = 'Fajr';
    const tmr = new Date(now);
    tmr.setDate(tmr.getDate() + 1);
    nextTs = parseTimeOn(tomorrow.Fajr, tmr);
  }

  return {
    nextIdx: idx,
    nextPrayer: nextPrayerName,
    nextTs,
    diffMs: Math.max(0, nextTs.getTime() - now.getTime()),
  };
}

/**
 * Kurzformen der Zeiteinheiten für den Countdown (Audit 2026-07-28, T17).
 *
 * Vorher standen `h`/`m`/`s` fest im Code — auf Arabisch las sich das als
 * „متبقي 1h 55m", also lateinische Einheiten mitten im arabischen Satz. Die
 * TV-App hatte denselben Fehler (`apps/tv/src/lib/prayerTimes.ts`); beide
 * ziehen ihre Werte jetzt aus denselben Locale-Schlüsseln `time.*`, die in
 * beiden Apps wörtlich identisch sind (maschinell geprüft in
 * `countdown-units.test.ts` hier und in `apps/tv/src/lib/i18n.test.ts`).
 */
export interface CountdownUnits {
  hours: string;
  minutes: string;
  seconds: string;
}

/** Locale-Schlüssel der drei Einheiten — identisch in Handy- und TV-App. */
export const COUNTDOWN_UNIT_KEYS = {
  hours: 'time.hoursShort',
  minutes: 'time.minutesShort',
  seconds: 'time.secondsShort',
} as const;

/** Baut die Einheiten aus der aktiven Sprache (`t` aus `useTranslation`). */
export function countdownUnits(t: (key: string) => string): CountdownUnits {
  return {
    hours: t(COUNTDOWN_UNIT_KEYS.hours),
    minutes: t(COUNTDOWN_UNIT_KEYS.minutes),
    seconds: t(COUNTDOWN_UNIT_KEYS.seconds),
  };
}

/**
 * Formatiert eine Restzeit als „3h 05min 09s".
 *
 * `units` ist bewusst ein Pflichtargument: ein Standardwert `h/m/s` hätte die
 * Übersetzung an jeder vergessenen Aufrufstelle still wieder ausgehebelt —
 * genau so ist der Befund entstanden.
 *
 * Zahl und Einheit stehen ohne Trennzeichen zusammen, die Gruppen sind durch
 * ein Leerzeichen getrennt. Diese logische Reihenfolge (Zahl → Einheit) ist
 * auch für ar/fa/ur/ps die richtige: der Bidi-Algorithmus stellt die Gruppen in
 * einem rechtsläufigen Absatz von rechts nach links, sodass „٣س ٠٥د" gelesen
 * mit den Stunden beginnt. Die Einheiten sind Kurzformen aus je 1–3 Zeichen,
 * die in arabischer Schrift ohnehin isoliert stehen (Abkürzung) — es bleibt
 * kein Buchstabe fälschlich unverbunden.
 */
export function formatCountdown(diffMs: number, units: CountdownUnits): string {
  const hh = Math.floor(diffMs / 3600000);
  const mm = Math.floor((diffMs % 3600000) / 60000);
  const ss = Math.floor((diffMs % 60000) / 1000);
  return `${hh}${units.hours} ${String(mm).padStart(2, '0')}${units.minutes} ${String(ss).padStart(2, '0')}${units.seconds}`;
}

export type TimeFormat = '24h' | '12h';

/** Formatiert Stunde+Minute je nach Settings (24h vs. 12h mit AM/PM). */
export function formatClock(hours: number, minutes: number, format: TimeFormat): string {
  const mm = String(minutes).padStart(2, '0');
  if (format === '24h') {
    return `${String(hours).padStart(2, '0')}:${mm}`;
  }
  const period = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${h12}:${mm} ${period}`;
}

/** Formatiert einen "HH:MM"-String (Aladhan-Format) je nach Settings. */
export function formatHHMM(hhmm: string, format: TimeFormat): string {
  const [h, m] = hhmm.split(':').map(Number);
  return formatClock(h ?? 0, m ?? 0, format);
}
