import { DEFAULT_FETCH_TIMEOUT_MS, fetchJson, fetchWithTimeout } from './fetchJson';
import { getErrorLog, clearErrorLog } from './errorLog';

const echterFetch = globalThis.fetch;

function antwort(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

beforeEach(async () => {
  jest.useRealTimers();
  await clearErrorLog();
});

afterAll(() => {
  globalThis.fetch = echterFetch;
});

describe('fetchWithTimeout — Signal', () => {
  it('reicht ein Abbruch-Signal an fetch durch', async () => {
    const spy = jest.fn(async (_url: string, _init?: RequestInit) => antwort({}));
    globalThis.fetch = spy as unknown as typeof fetch;
    await fetchWithTimeout('https://x.test');
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.signal?.aborted).toBe(false);
  });

  it('bricht nach timeoutMs ab und wirft einen erkennbaren Timeout-Fehler', async () => {
    globalThis.fetch = ((_u: string, init: RequestInit) =>
      new Promise((_res, rej) => {
        init.signal?.addEventListener('abort', () => rej(new Error('Aborted')));
      })) as unknown as typeof fetch;

    await expect(fetchWithTimeout('https://x.test', { timeoutMs: 20, errorPrefix: 'demo' })).rejects.toThrow(
      'demo_timeout_20ms',
    );
  });

  it('ein Timeout landet im lokalen Fehler-Log (Support-Bericht)', async () => {
    globalThis.fetch = ((_u: string, init: RequestInit) =>
      new Promise((_res, rej) => {
        init.signal?.addEventListener('abort', () => rej(new Error('Aborted')));
      })) as unknown as typeof fetch;

    await fetchWithTimeout('https://x.test/feed', { timeoutMs: 20, errorPrefix: 'feed' }).catch(() => undefined);
    const log = await getErrorLog();
    expect(log.some((e) => e.message.includes('feed_timeout') && e.context?.includes('https://x.test/feed'))).toBe(true);
  });

  it('ein Abbruch DURCH DEN AUFRUFER reicht den Originalfehler durch und loggt nicht', async () => {
    globalThis.fetch = ((_u: string, init: RequestInit) =>
      new Promise((_res, rej) => {
        init.signal?.addEventListener('abort', () => rej(new Error('caller aborted')));
      })) as unknown as typeof fetch;

    const ctrl = new AbortController();
    const p = fetchWithTimeout('https://x.test', { signal: ctrl.signal, errorPrefix: 'suche' });
    ctrl.abort();
    await expect(p).rejects.toThrow('caller aborted');
    expect(await getErrorLog()).toHaveLength(0);
  });

  it('ein bereits abgebrochenes Aufrufer-Signal startet gar nicht erst', async () => {
    globalThis.fetch = ((_u: string, init: RequestInit) =>
      new Promise((_res, rej) => {
        if (init.signal?.aborted) rej(new Error('schon abgebrochen'));
      })) as unknown as typeof fetch;
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(fetchWithTimeout('https://x.test', { signal: ctrl.signal })).rejects.toThrow();
  });

  it('prueft den HTTP-Status NICHT (404 ist fuer manche Aufrufer ein gueltiger Leerzustand)', async () => {
    globalThis.fetch = (async () => antwort({}, 404)) as unknown as typeof fetch;
    const r = await fetchWithTimeout('https://x.test');
    expect(r.status).toBe(404);
  });

  it('protokolliert echte Netzwerkfehler', async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    await expect(fetchWithTimeout('https://x.test', { errorPrefix: 'radios' })).rejects.toThrow(
      'Network request failed',
    );
    const log = await getErrorLog();
    expect(log[0]?.context).toContain('radios');
  });
});

describe('fetchJson', () => {
  it('liefert den geparsten Body bei 200', async () => {
    globalThis.fetch = (async () => antwort({ a: 1 })) as unknown as typeof fetch;
    await expect(fetchJson<{ a: number }>('https://x.test')).resolves.toEqual({ a: 1 });
  });

  it('wirft "<prefix>_<status>" bei HTTP-Fehlern (altes Fehlerformat bleibt erhalten)', async () => {
    globalThis.fetch = (async () => antwort({}, 503)) as unknown as typeof fetch;
    await expect(fetchJson('https://x.test', { errorPrefix: 'podcast_index' })).rejects.toThrow('podcast_index_503');
  });

  it('wirft "<prefix>_parse_error" bei kaputtem JSON', async () => {
    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    })) as unknown as typeof fetch;
    await expect(fetchJson('https://x.test', { errorPrefix: 'video_index' })).rejects.toThrow('video_index_parse_error');
  });

  it('reicht method/headers/body unveraendert an fetch weiter', async () => {
    const spy = jest.fn(async (_url: string, _init?: RequestInit) => antwort({}));
    globalThis.fetch = spy as unknown as typeof fetch;
    await fetchJson('https://x.test', { method: 'POST', headers: { 'X-Test': '1' }, body: 'abc' });
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'X-Test': '1' });
    expect(init.body).toBe('abc');
    // timeoutMs/errorPrefix duerfen NICHT als fetch-Optionen durchrutschen.
    expect(init).not.toHaveProperty('timeoutMs');
    expect(init).not.toHaveProperty('errorPrefix');
  });
});

describe('Default-Timeout', () => {
  it('ist gesetzt und liegt im sinnvollen Bereich', () => {
    expect(DEFAULT_FETCH_TIMEOUT_MS).toBeGreaterThanOrEqual(5_000);
    expect(DEFAULT_FETCH_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });
});
