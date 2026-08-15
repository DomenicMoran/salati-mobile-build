/**
 * @jest-environment node
 */
/**
 * Live-Vertragsprüfung gegen hadeethenc.com — greift ECHT ins Netz und läuft
 * darum nur mit `LIVE_API=1 npx jest hadeethenc.live` (sonst übersprungen, ein
 * netzabhängiger Test in der normalen Suite wäre eine Flake-Quelle).
 *
 * Zweck: die Annahmen, auf denen features/hadith/hadeethenc.ts steht, sind
 * Aussagen über eine FREMDE API — Feldnamen, Sprachcodes, Paginierung und das
 * 404-Verhalten bei nicht übersetzten Hadithen. Genau die brechen still, wenn
 * der Anbieter etwas ändert; Mocks würden das nie bemerken.
 *
 * Zuletzt grün: 2026-07-27 (alle 14 App-Sprachen).
 */
import { SUPPORTED_LOCALES } from '@/lib/locale-detect';

import {
  fetchHadeethencCategories,
  fetchHadeethencHadith,
  fetchHadeethencPage,
  hadeethencTotalCount,
  topLevelCategories,
} from './hadeethenc';

const live = process.env.LIVE_API === '1' ? describe : describe.skip;
const TIMEOUT = 120_000;

/**
 * jest-expo installiert React Natives `whatwg-fetch`-Polyfill, das über
 * XMLHttpRequest läuft — unter Jest gibt es keinen echten XHR-Transport, jede
 * Anfrage endet als Response mit `status: undefined`. Für den Live-Test wird
 * `fetch` darum durch eine minimale, auf `node:https` gestützte Fassung
 * ersetzt. Getestet wird weiterhin der echte Code-Pfad (fetchJson ->
 * hadeethenc.ts), nur der Transport darunter ist ein echter statt eines toten.
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
          resolve({
            ok: status >= 200 && status < 300,
            status,
            json: async () => JSON.parse(body),
          } as Response);
        });
      })
      .on('error', reject);
  });
}

beforeAll(() => {
  (globalThis as { fetch: unknown }).fetch = (url: string) => nodeFetch(url);
});

live('hadeethenc.com liefert echte Daten', () => {
  it(
    'führt jede der 14 App-Sprachen mit einem eigenen Themenbaum',
    async () => {
      for (const locale of SUPPORTED_LOCALES) {
        const cats = await fetchHadeethencCategories(locale);
        const top = topLevelCategories(cats);
        expect(top.length).toBeGreaterThanOrEqual(7);
        expect(hadeethencTotalCount(cats)).toBeGreaterThan(100);
        for (const c of top) expect(c.title.trim()).not.toBe('');
      }
    },
    TIMEOUT,
  );

  it(
    'liefert deutsche Hadithe mit Urtext, Übersetzung, Graduierung und Quelle',
    async () => {
      const page = await fetchHadeethencPage('de', '3', 1);
      expect(page.items.length).toBeGreaterThan(0);
      expect(page.lastPage).toBeGreaterThan(1);

      const hadith = await fetchHadeethencHadith('de', page.items[0].id);
      expect(hadith.arabic).toMatch(/[؀-ۿ]/);
      // Der deutsche Text darf NICHT bloß der arabische sein — genau das war
      // die Lücke, die diese Quelle schließt.
      expect(hadith.translation.trim()).not.toBe('');
      expect(hadith.translation).not.toBe(hadith.arabic);
      expect(hadith.grade.trim()).not.toBe('');
      expect(hadith.attribution.trim()).not.toBe('');
    },
    TIMEOUT,
  );

  it(
    'gibt bei Arabisch keinen doppelten Text aus',
    async () => {
      const page = await fetchHadeethencPage('ar', '3', 1);
      const hadith = await fetchHadeethencHadith('ar', page.items[0].id);
      expect(hadith.arabic).toMatch(/[؀-ۿ]/);
      expect(hadith.translation).toBe('');
    },
    TIMEOUT,
  );

  it(
    'wirft einen sauberen Fehler statt still zu einer anderen Sprache zu wechseln',
    async () => {
      // 3097 existiert auf Arabisch, aber nicht auf Deutsch (HTTP 404, leerer
      // Body). Ohne klaren Fehler stünde im UI ein leerer Hadith.
      await expect(fetchHadeethencHadith('de', '3097')).rejects.toThrow(/hadeethenc_hadeeth_404/);
    },
    TIMEOUT,
  );
});
