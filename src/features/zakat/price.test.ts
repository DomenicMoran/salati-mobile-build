import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ZakatCurrency } from './calc';
import {
  fetchLiveGoldPricePerGram,
  getGoldPricePerGram,
  readCachedGoldPrice,
} from './price';

const TROY_OUNCE_GRAMS = 31.1034768;

function mockFetchOnce(responses: Record<string, unknown>) {
  globalThis.fetch = jest.fn((url: string) => {
    for (const [match, body] of Object.entries(responses)) {
      if (url.includes(match)) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
      }
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve(null) } as Response);
  }) as unknown as typeof fetch;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe('fetchLiveGoldPricePerGram', () => {
  it('rechnet USD/oz über den EZB-Kurs in Zielwährung/Gramm um (EUR)', async () => {
    mockFetchOnce({
      'gold-api.com': { price: 2000 },
      'frankfurter.dev': { rates: { EUR: 0.9 } },
    });
    const result = await fetchLiveGoldPricePerGram('EUR');
    expect(result).toBeCloseTo((2000 / TROY_OUNCE_GRAMS) * 0.9);
  });

  it('braucht für USD keinen zweiten (FX-)Aufruf - Kurs ist per Definition 1', async () => {
    mockFetchOnce({ 'gold-api.com': { price: 2000 } });
    const result = await fetchLiveGoldPricePerGram('USD');
    expect(result).toBeCloseTo(2000 / TROY_OUNCE_GRAMS);
    // Nur der Gold-Call, kein FX-Call nötig für USD.
    expect((globalThis.fetch as jest.Mock).mock.calls).toHaveLength(1);
    expect((globalThis.fetch as jest.Mock).mock.calls[0][0]).toContain('gold-api.com');
  });

  it.each<ZakatCurrency>(['GBP', 'TRY', 'IDR', 'MYR'])(
    'funktioniert für alle unterstützten Nicht-EUR/USD-Währungen (%s)',
    async (currency) => {
      mockFetchOnce({
        'gold-api.com': { price: 4000 },
        'frankfurter.dev': { rates: { [currency]: 5 } },
      });
      const result = await fetchLiveGoldPricePerGram(currency);
      expect(result).toBeCloseTo((4000 / TROY_OUNCE_GRAMS) * 5);
    },
  );

  it('liefert null, wenn der Gold-Call fehlschlägt', async () => {
    mockFetchOnce({ 'frankfurter.dev': { rates: { EUR: 0.9 } } });
    const result = await fetchLiveGoldPricePerGram('EUR');
    expect(result).toBeNull();
  });

  it('liefert null, wenn der FX-Call fehlschlägt', async () => {
    mockFetchOnce({ 'gold-api.com': { price: 2000 } });
    const result = await fetchLiveGoldPricePerGram('EUR');
    expect(result).toBeNull();
  });

  it('liefert null, wenn fetch wirft (offline)', async () => {
    globalThis.fetch = jest.fn(() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;
    const result = await fetchLiveGoldPricePerGram('EUR');
    expect(result).toBeNull();
  });

  it('liefert null bei einem nicht-positiven/ungültigen Kurs', async () => {
    mockFetchOnce({
      'gold-api.com': { price: 2000 },
      'frankfurter.dev': { rates: { EUR: -1 } },
    });
    expect(await fetchLiveGoldPricePerGram('EUR')).toBeNull();
  });
});

describe('getGoldPricePerGram (priceMissing-Fix + Cache-Fallback, Audit 2026-07-20, jetzt je Währung)', () => {
  it('gibt bei Erfolg den Live-Preis zurück und cacht ihn unter der Währung', async () => {
    mockFetchOnce({
      'gold-api.com': { price: 2000 },
      'frankfurter.dev': { rates: { GBP: 0.8 } },
    });
    const result = await getGoldPricePerGram('GBP');
    expect(result?.currency).toBe('GBP');
    expect(result?.pricePerGram).toBeCloseTo((2000 / TROY_OUNCE_GRAMS) * 0.8);

    const cached = await readCachedGoldPrice('GBP');
    expect(cached?.pricePerGram).toBeCloseTo(result!.pricePerGram);
  });

  it('fällt bei einem Live-Fehler auf den zuletzt gecachten Preis DERSELBEN Währung zurück', async () => {
    // Erst ein erfolgreicher Live-Fetch für USD, der gecacht wird ...
    mockFetchOnce({ 'gold-api.com': { price: 3000 } });
    const live = await getGoldPricePerGram('USD');
    expect(live).not.toBeNull();

    // ... dann schlägt der nächste Live-Versuch fehl - Fallback auf den Cache.
    globalThis.fetch = jest.fn(() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;
    const fallback = await getGoldPricePerGram('USD');
    expect(fallback?.pricePerGram).toBeCloseTo(live!.pricePerGram);
    expect(fallback?.currency).toBe('USD');
  });

  it('liefert null, wenn für diese Währung NIE ein Live-Preis erfolgreich war (kein Cache)', async () => {
    globalThis.fetch = jest.fn(() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;
    const result = await getGoldPricePerGram('TRY');
    expect(result).toBeNull();
  });

  it('ein gecachter Preis in EINER Währung darf NIE als Preis für eine ANDERE Währung erscheinen', async () => {
    // EUR erfolgreich cachen ...
    mockFetchOnce({
      'gold-api.com': { price: 2000 },
      'frankfurter.dev': { rates: { EUR: 0.9 } },
    });
    await getGoldPricePerGram('EUR');

    // ... USD war noch nie online -> muss trotz des EUR-Caches null bleiben
    // (keine Regression: kein versehentliches Cross-Currency-Leck über einen
    // gemeinsamen Cache-Key).
    globalThis.fetch = jest.fn(() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;
    const usdResult = await getGoldPricePerGram('USD');
    expect(usdResult).toBeNull();
  });

  it('migriert das alte EUR-only-Cache-Format ({ eurPerGram }) verlustfrei', async () => {
    // Legacy-Schlüssel/Format aus der Zeit vor der Mehrwährungs-Erweiterung
    // (siehe price.ts Kommentar zu cacheKey()) - Nutzer mit altem Cache
    // dürfen ihren Preis beim Update nicht verlieren.
    await AsyncStorage.setItem(
      'salatibox:zakat-gold-price-eur',
      JSON.stringify({ eurPerGram: 123.45, fetchedAt: 1_700_000_000_000 }),
    );
    const cached = await readCachedGoldPrice('EUR');
    expect(cached).toEqual({ pricePerGram: 123.45, fetchedAt: 1_700_000_000_000, currency: 'EUR' });
  });

  it('readCachedGoldPrice liefert null bei leerem/korruptem Cache', async () => {
    expect(await readCachedGoldPrice('EUR')).toBeNull();
    await AsyncStorage.setItem('salatibox:zakat-gold-price-eur', 'not json');
    expect(await readCachedGoldPrice('EUR')).toBeNull();
  });
});
