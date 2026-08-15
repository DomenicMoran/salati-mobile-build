import { fetchReelsIndex, REELS_INDEX_URL } from './data';

// Der Reels-Feed muss drei Zustände sauber trennen: "kommt bald" (Index noch
// nicht produziert), "echter Fehler + Wiederholen" und "Liste". Eine
// Verwechslung zeigt dem Nutzer entweder einen Fehler statt eines
// Leerzustands oder verschluckt einen echten Ausfall.

const realFetch = globalThis.fetch;

function mockResponse(status: number, body?: unknown, invalidJson = false): void {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: invalidJson ? () => Promise.reject(new SyntaxError('bad json')) : () => Promise.resolve(body),
  }) as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = realFetch;
  jest.restoreAllMocks();
});

describe('fetchReelsIndex — Zustände', () => {
  it('liefert bei 404 einen leeren, gültigen Feed ("kommt bald")', async () => {
    mockResponse(404);
    await expect(fetchReelsIndex()).resolves.toEqual({ reels: [] });
  });

  it('liefert bei 403 ebenfalls einen leeren Feed', async () => {
    mockResponse(403);
    await expect(fetchReelsIndex()).resolves.toEqual({ reels: [] });
  });

  it('wirft bei 500 — der Screen zeigt Fehler + Wiederholen', async () => {
    mockResponse(500);
    await expect(fetchReelsIndex()).rejects.toThrow('reels_index_500');
  });

  it('wirft bei Netzwerkfehler mit eigener Kennung', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch;
    await expect(fetchReelsIndex()).rejects.toThrow('reels_network_error');
  });

  it('wirft bei kaputtem JSON mit eigener Kennung', async () => {
    mockResponse(200, undefined, true);
    await expect(fetchReelsIndex()).rejects.toThrow('reels_parse_error');
  });

  it('fragt die dokumentierte Index-URL ab', async () => {
    mockResponse(200, { reels: [] });
    await fetchReelsIndex();
    expect(globalThis.fetch).toHaveBeenCalledWith(REELS_INDEX_URL, expect.objectContaining({ cache: 'no-cache' }));
  });
});

describe('fetchReelsIndex — Normalisierung', () => {
  it('sortiert nach Folge, dann nach Reel-Index', async () => {
    mockResponse(200, {
      reels: [
        { id: 'c', video_url: 'https://v/c', episode_no: 2, index: 1 },
        { id: 'b', video_url: 'https://v/b', episode_no: 1, index: 2 },
        { id: 'a', video_url: 'https://v/a', episode_no: 1, index: 1 },
      ],
    });
    const { reels } = await fetchReelsIndex();
    expect(reels.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('verwirft Einträge ohne abspielbare URL oder ohne ID', async () => {
    mockResponse(200, {
      reels: [
        { id: 'ok', video_url: 'https://v/ok' },
        { id: 'leer', video_url: '' },
        { id: 'fehlt' },
        { video_url: 'https://v/ohne-id' },
        null,
        'kein objekt',
      ],
    });
    const { reels } = await fetchReelsIndex();
    expect(reels.map((r) => r.id)).toEqual(['ok']);
  });

  it('füllt fehlende optionale Felder mit Defaults statt undefined durchzureichen', async () => {
    mockResponse(200, { reels: [{ id: 5, video_url: 'https://v/5' }] });
    const { reels } = await fetchReelsIndex();
    expect(reels[0]).toEqual({
      id: '5', // Zahl-ID wird zur stabilen String-ID (keyExtractor)
      episode_no: 0,
      series: '',
      series_title: '',
      index: 0,
      title: '',
      description: '',
      duration_sec: 0,
      video_url: 'https://v/5',
    });
  });

  it('behandelt ein fehlendes oder falsch typisiertes reels-Feld als leeren Feed', async () => {
    for (const body of [{}, { reels: null }, { reels: 'nope' }, []]) {
      mockResponse(200, body);
      await expect(fetchReelsIndex()).resolves.toEqual({ reels: [] });
    }
  });
});
