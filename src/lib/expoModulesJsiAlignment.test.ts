import fs from 'node:fs';
import path from 'node:path';

const MIN_JSI = '57.0.6';

function parseLockVersion(text: string): string | null {
  const key = text.match(/^\s+expo-modules-jsi@([\d.]+):/m);
  if (!key) return null;
  const block = text.slice(text.indexOf(key[0]));
  const depLine = block.match(/^\s+expo-modules-jsi:\s+([\d.]+)/m);
  return depLine?.[1] ?? key[1];
}

function cmp(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

describe('expo-modules-jsi lock alignment (DYLD runIsolated)', () => {
  it('pnpm-lock resolved JSI >= 57.0.6', () => {
    const lockPath = path.resolve(__dirname, '../../../../pnpm-lock.yaml');
    const text = fs.readFileSync(lockPath, 'utf8');
    const resolved = parseLockVersion(text);
    expect(resolved).not.toBeNull();
    expect(cmp(resolved!, MIN_JSI)).toBeGreaterThanOrEqual(0);
  });
});