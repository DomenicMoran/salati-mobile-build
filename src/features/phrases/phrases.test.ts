import { SUPPORTED_LOCALES } from '@/lib/locale-detect';

import { PHRASE_GROUPS, phraseGroupById, resolveText } from './index';

// Die Inhalte werden nicht wie die Locale-Dateien gegen ein Schema geprüft —
// diese Suite hält fest, worauf sich der Screen (app/phrases.tsx) verlässt.

describe('PHRASE_GROUPS', () => {
  it('hat eindeutige Gruppen- und Eintrags-Kennungen', () => {
    const groupIds = PHRASE_GROUPS.map((g) => g.id);
    expect(new Set(groupIds).size).toBe(groupIds.length);
    for (const group of PHRASE_GROUPS) {
      const ids = group.items.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('enthält die Freitagspredigt-Gruppe mit dem Ablauf der Khutba', () => {
    const jumuah = phraseGroupById('jumuah');
    expect(jumuah).toBeDefined();
    // Khutbat al-Hajah (Eröffnung) und der Hinweis aufs Schweigen während der
    // Predigt sind der Kern dieser Gruppe.
    const ids = jumuah!.items.map((i) => i.id);
    expect(ids).toContain('khutbat-al-hajah');
    expect(ids).toContain('silence');
  });

  it('liefert Bedeutung, Anlass und Antwort in ALLEN 14 App-Sprachen', () => {
    // Feldgenau statt über `resolveText`: der Auflöser liefert immer einen
    // Wert (Englisch-Rückfall) und würde eine Lücke damit verdecken — genau
    // der Fehler, den der Inhalts-Audit 2026-07-27 in den anderen Datendateien
    // gefunden hat (s. features/content-i18n.test.ts).
    const luecken: string[] = [];
    for (const locale of SUPPORTED_LOCALES) {
      for (const group of PHRASE_GROUPS) {
        if (!group.title[locale]?.trim()) luecken.push(`${group.id}.title.${locale}`);
        if (!group.intro[locale]?.trim()) luecken.push(`${group.id}.intro.${locale}`);
        for (const item of group.items) {
          if (!item.meaning[locale]?.trim()) luecken.push(`${item.id}.meaning.${locale}`);
          if (!item.when[locale]?.trim()) luecken.push(`${item.id}.when.${locale}`);
          if (item.reply && !item.reply.meaning[locale]?.trim()) {
            luecken.push(`${item.id}.reply.meaning.${locale}`);
          }
        }
      }
    }
    expect(luecken).toEqual([]);
  });

  it('hat zu jeder Antwort auch arabischen Wortlaut und Umschrift', () => {
    for (const group of PHRASE_GROUPS) {
      for (const item of group.items) {
        if (!item.reply) continue;
        expect(item.reply.arabic).not.toBe('');
        expect(item.reply.translit).not.toBe('');
      }
    }
  });

  it('hat zu jedem arabischen Wortlaut eine Umschrift (und umgekehrt)', () => {
    for (const group of PHRASE_GROUPS) {
      for (const item of group.items) {
        expect(item.arabic === '').toBe(item.translit === '');
      }
    }
  });

  it('enthält keinen gestrichelten Hilfskreis im arabischen Text', () => {
    // Ein U+25CC im Datenbestand käme aus kopiertem, bereits gerendertem Text —
    // lib/arabicText.ts entfernt ihn zwar beim Rendern, aber die Quelle soll
    // von vornherein sauber sein.
    for (const group of PHRASE_GROUPS) {
      for (const item of group.items) {
        expect(item.arabic).not.toContain('◌');
        expect(item.reply?.arabic ?? '').not.toContain('◌');
      }
    }
  });

  it('resolveText fällt für jede App-Sprache auf einen echten Text zurück', () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const group of PHRASE_GROUPS) {
        expect(resolveText(group.title, locale)).not.toBe('');
        for (const item of group.items) {
          expect(resolveText(item.meaning, locale)).not.toBe('');
        }
      }
    }
  });
});
