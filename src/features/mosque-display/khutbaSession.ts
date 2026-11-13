import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'salatibox:khutba-sessions-v1';
const MAX_SESSIONS = 40;

export type KhutbaSessionLine = { ts: number; text: string };

export type KhutbaSession = {
  id: string;
  startedAt: number;
  endedAt: number | null;
  lines: KhutbaSessionLine[];
};

let cache: KhutbaSession[] | null = null;

async function load(): Promise<KhutbaSession[]> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as KhutbaSession[]) : [];
  } catch {
    cache = [];
  }
  return cache!;
}

async function save(sessions: KhutbaSession[]) {
  cache = sessions.slice(0, MAX_SESSIONS);
  await AsyncStorage.setItem(KEY, JSON.stringify(cache));
}

export async function listKhutbaSessions(): Promise<KhutbaSession[]> {
  return load();
}

export async function startKhutbaSession(): Promise<KhutbaSession> {
  const sessions = await load();
  const s: KhutbaSession = {
    id: `${Date.now()}`,
    startedAt: Date.now(),
    endedAt: null,
    lines: [],
  };
  await save([s, ...sessions]);
  return s;
}

export async function appendKhutbaLine(sessionId: string, text: string): Promise<void> {
  const sessions = await load();
  const s = sessions.find((x) => x.id === sessionId);
  if (!s) return;
  s.lines.push({ ts: Date.now(), text });
  await save(sessions);
}

export async function endKhutbaSession(sessionId: string): Promise<void> {
  const sessions = await load();
  const s = sessions.find((x) => x.id === sessionId);
  if (!s) return;
  s.endedAt = Date.now();
  await save(sessions);
}

export function searchSessions(sessions: KhutbaSession[], q: string): KhutbaSession[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return sessions;
  return sessions.filter((s) => s.lines.some((l) => l.text.toLowerCase().includes(needle)));
}

export function sessionExportText(s: KhutbaSession): string {
  const head = `# Khutba ${new Date(s.startedAt).toISOString()}\n\n`;
  return head + s.lines.map((l) => `[${new Date(l.ts).toLocaleTimeString()}] ${l.text}`).join('\n');
}
