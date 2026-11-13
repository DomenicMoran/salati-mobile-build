import { buildBibliothekHighlightsMarkdown } from './exportBibliothekMarkdown';

describe('exportBibliothekMarkdown', () => {
  it('renders highlights with notes', () => {
    const md = buildBibliothekHighlightsMarkdown({
      bookTitle: 'Testbuch',
      bookId: 'lesen-lernen',
      exportedAt: '2026-11-11T12:00:00.000Z',
      highlights: [
        {
          id: 'h1',
          bookId: 'lesen-lernen',
          page: 2,
          text: 'Bismillah',
          note: 'Merken',
          createdAt: '2026-11-10T00:00:00.000Z',
        },
      ],
    });
    expect(md).toContain('# Testbuch');
    expect(md).toContain('## Seite 2');
    expect(md).toContain('> Bismillah');
    expect(md).toContain('**Notiz:** Merken');
  });
});
