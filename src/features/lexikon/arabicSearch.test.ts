/**
 * normalizeForSearch/searchMatches — diakritika-unempfindlicher Suchvergleich
 * für das Lexikon (Wurzeln, Lemmata, Konkordanz). Getestet gegen echte
 * Koran-Schreibweisen (mit vollen Harakat/Wasla, wie im Uthmani-Text) im
 * Vergleich zu einer Eingabe ohne Vokalzeichen, wie ein Nutzer sie tippen
 * würde.
 */
import { normalizeForSearch, searchMatches } from './arabicSearch';

describe('normalizeForSearch', () => {
  it('entfernt Harakat/Tanwin/Sukun/Shadda', () => {
    // بِسْمِ (mit Kasra, Sukun) vs. بسم (ohne jedes Vokalzeichen)
    expect(normalizeForSearch('بِسْمِ')).toBe(normalizeForSearch('بسم'));
    // اللَّه (mit Shadda + Fatha) vs. الله (ohne Vokalzeichen)
    expect(normalizeForSearch('اللَّه')).toBe(normalizeForSearch('الله'));
  });

  it('vereinheitlicht Alif-Varianten (أ إ آ ٱ) auf ا', () => {
    // ٱللَّه (Alif-Wasla, wie im Uthmani-Text von quran.com) vs. الله
    expect(normalizeForSearch('ٱللَّه')).toBe(normalizeForSearch('الله'));
    expect(normalizeForSearch('أحمد')).toBe(normalizeForSearch('احمد'));
    expect(normalizeForSearch('إبراهيم')).toBe(normalizeForSearch('ابراهيم'));
    expect(normalizeForSearch('آدم')).toBe(normalizeForSearch('ادم'));
  });

  it('vereinheitlicht Alif maqsura (ى) und Ya (ي)', () => {
    expect(normalizeForSearch('موسى')).toBe(normalizeForSearch('موسي'));
  });

  it('vereinheitlicht Ta marbuta (ة) und Ha (ه)', () => {
    expect(normalizeForSearch('رحمة')).toBe(normalizeForSearch('رحمه'));
  });

  it('normalisiert nach NFC, bevor Zeichen verglichen werden', () => {
    // Zusammengesetztes Hamza-Alif (U+0623) vs. zerlegtes Alif + Hamza
    // (U+0627 U+0654) — beide müssen nach NFC + Alif-Vereinheitlichung gleich
    // normalisieren, sonst würde ein Encoding-Unterschied allein den
    // Suchtreffer verhindern (der Grammatik-Korrektur-Stolperstein aus
    // FORTSETZEN-KORAN-LEXIKON.md, hier auf die Suche übertragen).
    const composed = 'أحمد';
    const decomposed = 'أحمد';
    expect(normalizeForSearch(composed)).toBe(normalizeForSearch(decomposed));
  });

  it('ist von Groß-/Kleinschreibung bei lateinischen Nebentreffern unabhängig', () => {
    expect(normalizeForSearch('Kitab')).toBe(normalizeForSearch('kitab'));
  });

  it('fasst mehrfachen Leerraum zusammen und trimmt', () => {
    expect(normalizeForSearch('  الله   الرحمن  ')).toBe('الله الرحمن');
  });

  it('verkraftet leere Eingaben', () => {
    expect(normalizeForSearch('')).toBe('');
  });
});

describe('searchMatches', () => {
  it('findet einen normalisierten Teiltreffer', () => {
    // Vollständig vokalisierter Korantext (Basmala) enthält "ٱللَّه";
    // Suchtext ohne jedes Vokalzeichen muss trotzdem treffen.
    expect(searchMatches('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', 'الله')).toBe(true);
  });

  it('liefert false bei leerer Suchanfrage statt alles zu matchen', () => {
    expect(searchMatches('بِسْمِ ٱللَّهِ', '')).toBe(false);
    expect(searchMatches('بِسْمِ ٱللَّهِ', '   ')).toBe(false);
  });

  it('liefert false, wenn der normalisierte Text nicht vorkommt', () => {
    expect(searchMatches('بِسْمِ ٱللَّهِ', 'موسى')).toBe(false);
  });
});
