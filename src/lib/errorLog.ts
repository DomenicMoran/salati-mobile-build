// Lokaler Fehler-Log (Ideen-Backlog: bewusst KEIN Sentry o.ae. — die App
// verspricht "kein Tracking", ein externer Telemetrie-Dienst wuerde das
// brechen). Stattdessen: Ring-Buffer der letzten Fehler nur auf dem Geraet,
// als Text kopierbar fuer Support-Mails an uns (Settings-Screen).
import AsyncStorage from '@react-native-async-storage/async-storage';

const ERROR_LOG_KEY = 'salatibox:error-log';
const MAX_ENTRIES = 20;

export interface ErrorLogEntry {
  message: string;
  stack?: string;
  context?: string;
  timestamp: number;
}

let buffer: ErrorLogEntry[] = [];
let loaded = false;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(ERROR_LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    buffer = Array.isArray(parsed) ? parsed : [];
  } catch {
    buffer = [];
  }
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(ERROR_LOG_KEY, JSON.stringify(buffer));
  } catch {
    // Speichern fehlgeschlagen — Log bleibt zumindest fuer diese Session im Speicher.
  }
}

export async function logError(error: unknown, context?: string): Promise<void> {
  await ensureLoaded();
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  buffer = [...buffer, { message, stack, context, timestamp: Date.now() }].slice(-MAX_ENTRIES);
  await persist();
}

export async function getErrorLog(): Promise<ErrorLogEntry[]> {
  await ensureLoaded();
  return buffer;
}

export async function clearErrorLog(): Promise<void> {
  buffer = [];
  loaded = true;
  await persist();
}

export function formatErrorReport(entries: ErrorLogEntry[]): string {
  if (entries.length === 0) return 'Salati Fehlerbericht: keine Fehler protokolliert.';
  const lines = entries.map((e) => {
    const date = new Date(e.timestamp).toISOString();
    const ctx = e.context ? ` (${e.context})` : '';
    const stack = e.stack ? `\n${e.stack}` : '';
    return `[${date}]${ctx} ${e.message}${stack}`;
  });
  return `Salati Fehlerbericht (${entries.length} Eintraege)\n\n${lines.join('\n\n')}`;
}

interface ErrorUtilsLike {
  getGlobalHandler(): (error: Error, isFatal?: boolean) => void;
  setGlobalHandler(handler: (error: Error, isFatal?: boolean) => void): void;
}

let installed = false;

/** Fängt unbehandelte JS-Fehler ab (React Native ErrorUtils — auf Web nicht
 * vorhanden, dort greift nur der ErrorBoundary für Render-Fehler). Ruft den
 * vorherigen Handler weiterhin auf — verändert das Absturzverhalten nicht,
 * protokolliert nur zusätzlich. */
export function installGlobalErrorHandler(): void {
  if (installed) return;
  installed = true;
  const g = globalThis as unknown as { ErrorUtils?: ErrorUtilsLike };
  if (!g.ErrorUtils) return;
  const prevHandler = g.ErrorUtils.getGlobalHandler();
  g.ErrorUtils.setGlobalHandler((error, isFatal) => {
    logError(error, isFatal ? 'fatal' : 'error');
    prevHandler(error, isFatal);
  });
}
