// Gemeinsamer Netzwerk-Helfer: fetch MIT Timeout.
//
// Warum: React Natives fetch() kennt von sich aus KEIN Timeout. Ein haengender
// TCP-Connect (Captive-Portal im Hotel/Cafe, stiller Paketverlust im Mobilfunk)
// laesst das Promise unbegrenzt offen — der Screen bleibt dauerhaft im
// Ladezustand, statt in einen Fehlerzustand mit "Erneut versuchen" zu kippen.
//
// Jeder Netzwerk-Fehlschlag landet ausserdem im lokalen Fehler-Ringpuffer
// (lib/errorLog.ts), damit der Support-Fehlerbericht im Settings-Screen bei
// einem echten Problem nicht leer ist.
import { logError } from '@/lib/errorLog';

/** Default-Timeout. Grosszuegig gewaehlt: Overpass (Moschee-Suche) und die
 * Aladhan-Monatskalender brauchen im Mobilfunk regelmaessig >5 s, echte
 * Haenger dauern dagegen Minuten. Pro Aufruf ueber `timeoutMs` anpassbar. */
export const DEFAULT_FETCH_TIMEOUT_MS = 12_000;

export interface FetchOptions extends Omit<RequestInit, 'signal'> {
  /** Abbruch nach so vielen Millisekunden (Default: {@link DEFAULT_FETCH_TIMEOUT_MS}). */
  timeoutMs?: number;
  /** Zusaetzliches Abbruch-Signal des Aufrufers (z. B. Tastatur-Eingabe verworfen). */
  signal?: AbortSignal | null;
  /** Praefix fuer Fehlermeldung und Fehler-Log, z. B. `'podcast_index'`. */
  errorPrefix?: string;
}

interface CombinedSignal {
  signal: AbortSignal;
  cleanup: () => void;
  /** true, wenn der Abbruch vom Timeout kam (nicht vom Aufrufer). */
  timedOut: () => boolean;
}

/**
 * Verbindet den Timeout mit einem optionalen Aufrufer-Signal zu EINEM Signal.
 * Nutzt `AbortSignal.timeout()`, wo vorhanden, sonst `AbortController` +
 * `setTimeout` — Hermes/React Native liefert je nach Version nur die
 * abort-controller-Polyfill ohne die statische `timeout()`-Fabrik.
 */
function combineSignals(timeoutMs: number, external?: AbortSignal | null): CombinedSignal {
  const controller = new AbortController();
  const cleanups: (() => void)[] = [];
  let fromTimeout = false;

  const abort = (byTimeout: boolean): void => {
    if (controller.signal.aborted) return;
    fromTimeout = byTimeout;
    controller.abort();
  };

  const withTimeout = AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal };
  if (typeof withTimeout.timeout === 'function') {
    const timeoutSignal = withTimeout.timeout(timeoutMs);
    const onTimeout = (): void => abort(true);
    timeoutSignal.addEventListener('abort', onTimeout);
    cleanups.push(() => timeoutSignal.removeEventListener('abort', onTimeout));
  } else {
    const id = setTimeout(() => abort(true), timeoutMs);
    cleanups.push(() => clearTimeout(id));
  }

  if (external) {
    if (external.aborted) abort(false);
    else {
      const onExternal = (): void => abort(false);
      external.addEventListener('abort', onExternal);
      cleanups.push(() => external.removeEventListener('abort', onExternal));
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => cleanups.forEach((c) => c()),
    timedOut: () => fromTimeout,
  };
}

/**
 * `fetch()` mit Timeout. Prueft den HTTP-Status NICHT — der Aufrufer entscheidet,
 * was ein Fehler ist (Open Food Facts und der Reels-Index behandeln 404/403
 * bewusst als gueltigen Leer-Zustand).
 */
export async function fetchWithTimeout(url: string, options: FetchOptions = {}): Promise<Response> {
  const { timeoutMs = DEFAULT_FETCH_TIMEOUT_MS, signal: external, errorPrefix, ...init } = options;
  const combined = combineSignals(timeoutMs, external);
  try {
    return await fetch(url, { ...init, signal: combined.signal });
  } catch (err) {
    // Ein vom Aufrufer selbst ausgeloester Abbruch ist kein Fehler und gehoert
    // nicht in den Fehlerbericht — nur Timeouts und echte Netzwerkfehler.
    if (external?.aborted) throw err;
    const prefix = errorPrefix ?? 'fetch';
    const error = combined.timedOut() ? new Error(`${prefix}_timeout_${timeoutMs}ms`) : err;
    void logError(error, `${prefix} ${url}`);
    throw error;
  } finally {
    combined.cleanup();
  }
}

/**
 * `fetch()` mit Timeout + Statuspruefung + JSON-Parsing.
 * Wirft `Error('<errorPrefix>_<status>')` bei HTTP-Fehlern — dasselbe
 * Fehlerformat, das die Aufrufer vorher von Hand erzeugt haben.
 */
export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const prefix = options.errorPrefix ?? 'fetch';
  const r = await fetchWithTimeout(url, options);
  if (!r.ok) {
    const error = new Error(`${prefix}_${r.status}`);
    void logError(error, `${prefix} ${url}`);
    throw error;
  }
  try {
    return (await r.json()) as T;
  } catch (err) {
    void logError(err, `${prefix} parse ${url}`);
    throw new Error(`${prefix}_parse_error`);
  }
}
