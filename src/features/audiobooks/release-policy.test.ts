import { booksForLocale, chaptersForTrack, chaptersForLocale, isAudiobookReleaseAllowed, languagesForTrack, type AudiobookChapter } from './data';
import releasePolicy from './release-policy.json';

function kapitel(track: string, lang: string): AudiobookChapter {
  return { track, lang, chapter_no: 1, title: 'Draft', audio_url: 'https://example.test/a.mp3' };
}

describe('audiobook release quarantine', () => {
  const blocked = releasePolicy.blockedPflichtwissenLocales;
  if (blocked.length === 0) {
    it('allows Pflichtwissen when the policy blocks no locale', () => {
      expect(isAudiobookReleaseAllowed(kapitel('pflichtwissen', 'bn'))).toBe(true);
    });
  } else {
    it.each(blocked.flatMap((lang) => [lang, `${lang}-XX`]))('blocks Pflichtwissen rows listed in the policy for %s', (lang) => {
      const entry = kapitel('pflichtwissen', lang);
      expect(isAudiobookReleaseAllowed(entry)).toBe(false);
      expect(chaptersForLocale([entry], lang)).toEqual([]);
    });
  }

  it('does not silently block other tracks or released Pflichtwissen editions', () => {
    expect(isAudiobookReleaseAllowed(kapitel('grammatik-hoerbuch', 'en'))).toBe(true);
    expect(isAudiobookReleaseAllowed(kapitel('pflichtwissen', 'de'))).toBe(true);
    if (!releasePolicy.blockedPflichtwissenLocales.includes('ar')) {
      expect(isAudiobookReleaseAllowed(kapitel('pflichtwissen', 'ar'))).toBe(true);
    }
  });

  it('lists only released languages for a track', () => {
    const entries: AudiobookChapter[] = [
      kapitel('pflichtwissen', 'de'),
      kapitel('pflichtwissen', 'bn'),
      { ...kapitel('pflichtwissen', 'en'), chapter_no: 2 },
    ];
    const expected = ['bn', 'de', 'en'].filter((lang) => !releasePolicy.blockedPflichtwissenLocales.includes(lang));
    expect(languagesForTrack(entries, 'pflichtwissen')).toEqual(expected);
  });
});

const grammarBlocked = releasePolicy.blockedGrammarLocales;
const grammarLabels = ['ps', 'ps-AF', 'ar', 'ar-SA', 'ar_SA'] as const;

if (grammarBlocked.length === 0) {
  it.each(grammarLabels)('allows grammar entries labelled %s', (lang) => {
    const entry = kapitel('grammatik-hoerbuch', lang);
    expect(isAudiobookReleaseAllowed(entry)).toBe(true);
    expect(chaptersForLocale([entry], lang)).toEqual([entry]);
  });

  it.each(['ps', 'ar'] as const)('keeps cached %s grammar PDFs and chapter selections', (lang) => {
    const entry: AudiobookChapter = { ...kapitel('grammatik-hoerbuch', lang), book_pdf_url: 'https://example.test/book.pdf' };
    expect(booksForLocale([entry], lang, { 'grammatik-hoerbuch': 'grammar' })).toEqual([{
      track: 'grammatik-hoerbuch',
      trackLabelKey: 'grammar',
      title: entry.title,
      pdf_url: entry.book_pdf_url,
    }]);
    expect(chaptersForTrack([entry], 'grammatik-hoerbuch', lang)).toEqual([entry]);
  });
} else {
  it.each(grammarLabels)('blocks rejected grammar entries labelled %s even from a stale cache', (lang) => {
    const entry = kapitel('grammatik-hoerbuch', lang);
    expect(isAudiobookReleaseAllowed(entry)).toBe(false);
    expect(chaptersForLocale([entry], lang)).toEqual([]);
  });

  it.each(['ps', 'ar'] as const)('also hides cached %s grammar PDFs and chapter deep-link selections', (lang) => {
    const entry: AudiobookChapter = { ...kapitel('grammatik-hoerbuch', lang), book_pdf_url: 'https://example.test/book.pdf' };
    expect(booksForLocale([entry], lang, { 'grammatik-hoerbuch': 'grammar' })).toEqual([]);
    expect(chaptersForTrack([entry], 'grammatik-hoerbuch', lang)).toEqual([]);
  });
}
