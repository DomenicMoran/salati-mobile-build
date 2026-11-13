import { formatBibliothekQuoteShare } from './formatBibliothekQuote';

describe('formatBibliothekQuote', () => {
  it('includes work, page, translator and license', () => {
    const text = formatBibliothekQuoteShare({
      quote: 'Im Namen Allahs',
      page: 12,
      book: {
        title: 'Der Koran — Henning',
        translator: 'Max Henning',
        license: 'LicenseRef-public-domain-eu-us',
        belegUrl: 'https://archive.org/details/derkoran00henn',
      },
    });
    expect(text).toContain('"Im Namen Allahs"');
    expect(text).toContain('S. 12');
    expect(text).toContain('Max Henning');
    expect(text).toContain('archive.org');
  });
});
