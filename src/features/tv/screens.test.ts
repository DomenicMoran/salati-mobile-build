/**
 * Auseinanderlaufen von Handy-Fernbedienung und TV-App (Audit 2026-07-28, T14).
 *
 * Der eigentliche Befund war nicht „vier Eintraege fehlen", sondern dass die
 * Screen-Liste an zwei Orten unabhaengig gepflegt wurde: die TV-App kannte elf
 * Bildschirme, die Fernbedienung sechs — und nichts wurde rot. Dieser Test
 * liest `apps/tv/src/lib/nav.ts` direkt und faellt beim naechsten neuen
 * TV-Bildschirm ohne Gegenstueck hier aus.
 */
import fs from 'fs';
import path from 'path';

import { SUPPORTED_LOCALES } from '@/lib/locale-detect';
import { TV_SHORTCUTS, tvShortcutsFor } from './screens';

const NAV_TS = path.join(__dirname, '..', '..', '..', '..', 'tv', 'src', 'lib', 'nav.ts');

/** Die `SCREENS`-Literale aus der TV-App — bewusst als Quelltext gelesen, weil
 *  `apps/tv` ausserhalb des pnpm-Workspace liegt und nicht importierbar ist. */
function tvScreens(): string[] {
  const src = fs.readFileSync(NAV_TS, 'utf8');
  const block = /export const SCREENS = \[([\s\S]*?)\] as const;/.exec(src);
  if (!block) throw new Error(`SCREENS-Liste in ${NAV_TS} nicht gefunden`);
  return [...block[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
}

describe('Sprungziele der TV-Fernbedienung', () => {
  it('deckt jeden Bildschirm der TV-App ab, in derselben Reihenfolge', () => {
    expect(TV_SHORTCUTS.map((s) => s.screen)).toEqual(tvScreens());
  });

  it('hat je Bildschirm einen Locale-Schluessel und ein Symbol', () => {
    for (const s of TV_SHORTCUTS) {
      expect(s.labelKey).toMatch(/^tvRemote\.[a-z]+$/i);
      expect(s.icon.length).toBeGreaterThan(0);
    }
  });

  it('uebersetzt jeden Schluessel in allen 14 Sprachen', () => {
    // Zieht die Locale-Dateien direkt: ein neuer Eintrag ohne Uebersetzung
    // faellt sonst erst als deutscher Text in arabischer Oberflaeche auf.
    for (const locale of SUPPORTED_LOCALES) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- dynamischer Pfad
      const dict = require(`@/locales/${locale}.json`) as { tvRemote: Record<string, string> };
      for (const s of TV_SHORTCUTS) {
        const key = s.labelKey!.split('.')[1];
        expect(typeof dict.tvRemote[key]).toBe('string');
        expect(dict.tvRemote[key].trim()).not.toBe('');
      }
    }
  });

  it('verwendet dieselben Beschriftungen wie die TV-Kacheln', () => {
    // `home` hat am Fernseher keine eigene Kachel (es IST der Hub) und bleibt
    // deshalb aussen vor; alle anderen muessen woertlich uebereinstimmen,
    // sonst heisst derselbe Bildschirm auf Handy und TV anders.
    const tvLocales = path.join(__dirname, '..', '..', '..', '..', 'tv', 'src', 'locales');
    for (const locale of SUPPORTED_LOCALES) {
      const tv = JSON.parse(fs.readFileSync(path.join(tvLocales, `${locale}.json`), 'utf8')) as {
        home: Record<string, string>;
      };
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- dynamischer Pfad
      const mobile = require(`@/locales/${locale}.json`) as { tvRemote: Record<string, string> };
      for (const s of TV_SHORTCUTS) {
        if (s.screen === 'home') continue;
        expect([locale, s.screen, mobile.tvRemote[s.screen]]).toEqual([
          locale,
          s.screen,
          tv.home[s.screen],
        ]);
      }
    }
  });
});

describe('tvShortcutsFor', () => {
  it('nimmt den vollen Katalog, wenn der Fernseher nichts meldet', () => {
    expect(tvShortcutsFor(null)).toEqual(TV_SHORTCUTS);
    expect(tvShortcutsFor([])).toEqual(TV_SHORTCUTS);
  });

  it('folgt der gemeldeten Liste, auch wenn sie kuerzer ist', () => {
    const out = tvShortcutsFor(['settings', 'clock']);
    expect(out.map((s) => s.screen)).toEqual(['settings', 'clock']);
    expect(out[0].labelKey).toBe('tvRemote.settings');
  });

  it('bietet einen unbekannten Bildschirm trotzdem an', () => {
    // Neuerer Fernseher, aelteres Handy: unbeschriftet erreichbar ist besser
    // als gar nicht erreichbar — genau das war der Befund.
    const out = tvShortcutsFor(['clock', 'hifz']);
    expect(out.map((s) => s.screen)).toEqual(['clock', 'hifz']);
    expect(out[1].labelKey).toBeNull();
    expect(out[1].icon.length).toBeGreaterThan(0);
  });
});
