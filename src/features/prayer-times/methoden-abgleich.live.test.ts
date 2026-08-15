/**
 * @jest-environment node
 */
/**
 * Live-Abgleich JEDER Behörden-Methode aus features/settings/methods.ts gegen
 * api.aladhan.com. Greift echt ins Netz und läuft darum nur mit
 * `LIVE_API=1 npx jest methoden-abgleich.live` (ein netzabhängiger Test in der
 * normalen Suite wäre eine Flake-Quelle).
 *
 * ZWECK: Der Katalog behauptet für jede Behörde bestimmte Winkel. Diese
 * Behauptung ist überprüfbar — und genau das passiert hier: die lokale
 * Rechnung (calc.ts, adhan-js) muss für dieselbe Methoden-ID auf dieselbe
 * Minute kommen wie die API, die die Parameter von der Behörde übernimmt.
 * Weicht eine Methode ab, ist entweder ein Winkel im Katalog falsch oder
 * Aladhan hat seine Parameter geändert. Beides will man wissen, bevor es ein
 * Nutzer meldet.
 *
 * ZEITZONE: adhan-js rechnet über JS-Date immer in der Zeitzone des GERÄTS.
 * Deshalb bekommt Aladhan `timezonestring` mit der Gerätezone — die Geometrie
 * (Koordinaten) bleibt die der Stadt, nur die Wanduhr ist dieselbe. Ohne das
 * verglichen man Zeitzonen-Offsets statt Winkel.
 */
import { PRAYER_METHODS } from '@/features/settings/methods';
import { NO_PRAYER_TIME_OFFSETS } from '@/features/settings/types';

import { fmtDateAladhan, onlyHHMM } from './api';
import { aladhanLatitudeAdjustment, computeTimings } from './calc';

const live = process.env.LIVE_API === '1' ? describe : describe.skip;
const TIMEOUT = 180_000;

/**
 * jest-expo installiert React Natives `whatwg-fetch`-Polyfill, das über
 * XMLHttpRequest läuft — unter Jest gibt es keinen echten XHR-Transport, jede
 * Anfrage endet als Response mit `status: undefined`. Wie in
 * features/hadith/hadeethenc.live.test.ts wird `fetch` darum für den Live-Test
 * durch eine minimale, auf `node:https` gestützte Fassung ersetzt.
 */
interface IncomingMessageLike {
  statusCode?: number;
  setEncoding(enc: string): void;
  on(event: string, cb: (chunk: string) => void): void;
}
interface HttpsLike {
  get(url: string, cb: (res: IncomingMessageLike) => void): { on(e: string, cb: (err: Error) => void): void };
}
const https = jest.requireActual<HttpsLike>('node:https');

function nodeFetch(url: string): Promise<Response> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          const status = res.statusCode ?? 0;
          resolve({ ok: status >= 200 && status < 300, status, json: async () => JSON.parse(body) } as Response);
        });
      })
      .on('error', reject);
  });
}

beforeAll(() => {
  (globalThis as { fetch: unknown }).fetch = (url: string) => nodeFetch(url);
});

const GERAETE_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const ORTE = [
  { name: 'Berlin', lat: 52.52, lon: 13.405 },
  { name: 'Istanbul', lat: 41.0082, lon: 28.9784 },
  { name: 'Kairo', lat: 30.0444, lon: 31.2357 },
  { name: 'Mekka', lat: 21.3891, lon: 39.8579 },
  { name: 'Jakarta', lat: -6.2088, lon: 106.8456 },
];

// Vier Termine über das Jahr: Sonnenwenden und Tagundnachtgleichen sind die
// Extremfälle, an denen sich Winkel- und Nachtanteil-Regeln am stärksten
// auseinanderentwickeln.
const TAGE = [
  new Date(2026, 2, 20),
  new Date(2026, 5, 21),
  new Date(2026, 8, 22),
  new Date(2026, 11, 21),
];

const GEBETE = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

/**
 * Erlaubte Abweichung in Minuten. Normalfall 3 — darunter liegen das Runden
 * und die dokumentierte Asr-Abweichung (andere Deklinations-Epoche, s.
 * computeTimings).
 *
 * EINE dokumentierte Ausnahme: Methode 15 (Moonsighting Committee) legt keinen
 * festen Winkel fest, sondern eine jahreszeitlich korrigierte Kurve. adhan-js
 * und Aladhan implementieren diese Kurve unterschiedlich; in Äquatornähe
 * (Kairo, Mekka, Jakarta) laufen Fadschr und Ischa dadurch bis zu 9 Minuten
 * auseinander, in Berlin und Istanbul gar nicht. Das ist keine Nachlässigkeit
 * dieser App, sondern ein Unterschied zwischen zwei Umsetzungen derselben
 * Veröffentlichung — und er trifft nur den Offline-Fall, weil online ohnehin
 * Aladhan antwortet. Wer die Methode nutzt und beides vergleicht, soll die
 * Zahl kennen, statt sie für einen Fehler zu halten.
 */
function toleranz(methodId: number, gebet: string): number {
  if (methodId === 15 && (gebet === 'Fajr' || gebet === 'Isha')) return 10;
  return 3;
}

/** Abstand zweier "HH:MM" in Minuten, zyklisch über Mitternacht. */
function minutenAbstand(a: string, b: string): number {
  const [ah = '0', am = '0'] = a.split(':');
  const [bh = '0', bm = '0'] = b.split(':');
  const diff = (Number(ah) * 60 + Number(am)) - (Number(bh) * 60 + Number(bm));
  const wrapped = ((diff % 1440) + 1440) % 1440;
  return Math.min(wrapped, 1440 - wrapped);
}

live('Behörden-Methoden stimmen mit api.aladhan.com überein', () => {
  for (const methode of PRAYER_METHODS) {
    for (const ort of ORTE) {
      it(
        `${methode.shortName} (ID ${methode.id}) — ${ort.name}`,
        async () => {
          const abweichungen: string[] = [];
          for (const tag of TAGE) {
            const opts = {
              method: methode.id,
              school: 0 as const,
              highLatitude: 'auto' as const,
              offsets: NO_PRAYER_TIME_OFFSETS,
            };
            const url =
              `https://api.aladhan.com/v1/timings/${fmtDateAladhan(tag)}` +
              `?latitude=${ort.lat}&longitude=${ort.lon}` +
              `&method=${methode.id}&school=0` +
              `&latitudeAdjustmentMethod=${aladhanLatitudeAdjustment('auto', ort.lat)}` +
              `&timezonestring=${encodeURIComponent(GERAETE_ZONE)}`;
            const antwort = await fetch(url);
            expect(antwort.ok).toBe(true);
            const json = (await antwort.json()) as { data?: { timings?: Record<string, string> } };
            const api = json.data?.timings;
            expect(api).toBeTruthy();

            const lokal = computeTimings(ort.lat, ort.lon, tag, opts);
            for (const gebet of GEBETE) {
              const diff = minutenAbstand(lokal[gebet], onlyHHMM(api?.[gebet]));
              if (diff > toleranz(methode.id, gebet)) {
                abweichungen.push(
                  `${fmtDateAladhan(tag)} ${gebet}: lokal ${lokal[gebet]} vs. API ${onlyHHMM(api?.[gebet])} (${diff} min)`,
                );
              }
            }
            // Aladhan bittet um Zurückhaltung — kein Sturm auf die API.
            await new Promise((r) => setTimeout(r, 250));
          }
          expect(abweichungen).toEqual([]);
        },
        TIMEOUT,
      );
    }
  }
});
