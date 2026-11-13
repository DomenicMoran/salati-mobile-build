import { splitPdfUrlAndStartPage } from './pdfUrl';

describe('splitPdfUrlAndStartPage', () => {
  it('trennt Hash-Seite von URL', () => {
    expect(splitPdfUrlAndStartPage('https://x.test/a.pdf#page=17')).toEqual({
      url: 'https://x.test/a.pdf',
      startPage: 17,
    });
  });

  it('lässt URL ohne Hash unverändert', () => {
    expect(splitPdfUrlAndStartPage('https://x.test/b.pdf')).toEqual({ url: 'https://x.test/b.pdf' });
  });
});
