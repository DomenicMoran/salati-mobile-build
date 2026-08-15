/**
 * Regressionstest zum Produktfehler vom 2026-07-29: Die Vorschlags-Chips des
 * leeren KI-Chats schickten IMMER den deutschen Wortlaut ab, obwohl seit
 * korpus.ts je App-Sprache ein ÜBERSETZTER Korpus geladen wird. In en/tr/ar
 * lieferte der allererste Klick deshalb am Gerät „Dazu finde ich in meinen
 * lokalen Quellen keine Stelle".
 */
import { abzuschickendeFrage, BEISPIELFRAGEN } from './beispielfragen';
import { KI_SPRACHEN, KORPUS_SPRACHE } from './sprachen';
import type { Locale } from '@/lib/locale-detect';
import { ensureLocale, translate } from '@/lib/translate';

const ERSTE = BEISPIELFRAGEN[0]!;

describe('abzuschickendeFrage', () => {
  it('schickt bei geladenem deutschem Korpus den deutschen Wortlaut', () => {
    // Gilt auch für einen türkischen Nutzer, dessen Korpus-Download scheiterte:
    // dann liegen deutsche Quellen vor und nur deutsche Wörter finden darin etwas.
    expect(abzuschickendeFrage(ERSTE, 'İslamın beş şartı nedir?', KORPUS_SPRACHE)).toBe(ERSTE.frage);
  });

  it('schickt bei übersetztem Korpus den angezeigten Text', () => {
    const angezeigt = 'İslamın beş şartı nedir?';
    expect(abzuschickendeFrage(ERSTE, angezeigt, 'tr')).toBe(angezeigt);
    expect(abzuschickendeFrage(ERSTE, 'ما هي أركان الإسلام الخمسة؟', 'ar')).toBe('ما هي أركان الإسلام الخمسة؟');
  });

  it('hat für jede Beispielfrage in jeder KI-Sprache einen eigenen Anzeigetext', async () => {
    // Ohne Übersetzung fiele t() auf die en/de-Kette zurück — der Nutzer
    // schickte dann wieder eine fremdsprachige Frage in seinen Korpus.
    const deutsch = BEISPIELFRAGEN.map((b) => translate('de', b.labelKey));
    for (const sprache of Object.keys(KI_SPRACHEN) as Locale[]) {
      await ensureLocale(sprache);
      BEISPIELFRAGEN.forEach((b, i) => {
        const text = translate(sprache, b.labelKey);
        expect(text).not.toBe(b.labelKey);
        expect(text.trim().length).toBeGreaterThan(0);
        if (sprache !== 'de') expect(text).not.toBe(deutsch[i]);
      });
    }
  });
});
