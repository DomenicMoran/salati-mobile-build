/**
 * @jest-environment node
 */
/**
 * Live-Prüfung der eigenen Tafsir-Auslieferung — greift ECHT ins Netz und
 * läuft darum nur mit `LIVE_API=1 npx jest tafsir-de.live` (sonst
 * übersprungen; ein netzabhängiger Test in der normalen Suite wäre eine
 * Flake-Quelle).
 *
 * Zweck: der deutsche Tafsir kommt nicht von einer fremden API, sondern aus
 * unserem eigenen R2 (scripts/build-tafsir-de.py -> upload-tafsir-de-r2.mjs).
 * Genau deshalb kann er still kaputtgehen: ein unvollständiger Upload, ein
 * geänderter Präfix oder eine fehlende CORS-Freigabe fällt in Mocks nie auf.
 * Geprüft wird, dass alle 114 Suren ausgeliefert werden und der Text
 * tatsächlich deutscher Fließtext ist.
 *
 * Zuletzt grün: 2026-07-28 (114/114 Suren).
 */
import { TAFSIR_DE_RASSOUL, fetchSurahTafsir } from './api';

const live = process.env.LIVE_API === '1' ? describe : describe.skip;
const TIMEOUT = 180_000;

interface IncomingMessageLike {
  statusCode?: number;
  setEncoding(enc: string): void;
  on(event: string, cb: (chunk: string) => void): void;
}
interface HttpsLike {
  get(url: string, cb: (res: IncomingMessageLike) => void): { on(e: string, cb: (err: Error) => void): void };
}
const https = jest.requireActual<HttpsLike>('node:https');

/**
 * jest-expo installiert React Natives `whatwg-fetch`-Polyfill, das über
 * XMLHttpRequest läuft — unter Jest gibt es keinen echten XHR-Transport. Für
 * den Live-Test wird `fetch` darum durch eine minimale, auf `node:https`
 * gestützte Fassung ersetzt; der geprüfte Code-Pfad bleibt der echte.
 */
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

live('deutscher Tafsir wird ausgeliefert', () => {
  it(
    'liefert alle 114 Suren mit Text',
    async () => {
      for (let sura = 1; sura <= 114; sura++) {
        const texte = await fetchSurahTafsir(sura, TAFSIR_DE_RASSOUL);
        expect(texte.length).toBeGreaterThan(0);
        expect(texte.filter((t) => t.trim() !== '').length).toBeGreaterThan(0);
      }
    },
    TIMEOUT,
  );

  it(
    'liefert deutschen Fließtext, keine Platzhalter und keinen arabischen Text',
    async () => {
      const fatiha = await fetchSurahTafsir(1, TAFSIR_DE_RASSOUL);
      expect(fatiha[0]).toContain('Basmala');
      // Der Kommentar ist deutsch; arabische Wörter kommen nur als Zitat vor,
      // der Block darf also nicht ÜBERWIEGEND arabisch sein.
      const arabisch = (fatiha[0].match(/[؀-ۿ]/g) ?? []).length;
      expect(arabisch).toBeLessThan(fatiha[0].length / 4);
      expect(fatiha[0].length).toBeGreaterThan(200);
    },
    TIMEOUT,
  );

  it(
    'haengt den Kommentar einer Versgruppe an jeden Vers der Gruppe',
    async () => {
      // 112:1-4 ist im Original EIN Block über die ganze Sura.
      const ikhlas = await fetchSurahTafsir(112, TAFSIR_DE_RASSOUL);
      expect(ikhlas).toHaveLength(4);
      expect(ikhlas[3]).toBe(ikhlas[0]);
      expect(ikhlas[0].trim()).not.toBe('');
    },
    TIMEOUT,
  );
});
