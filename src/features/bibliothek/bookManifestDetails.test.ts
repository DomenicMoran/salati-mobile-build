import { resolveBibliothekBookDetails } from './bookManifestDetails';

describe('bookManifestDetails', () => {
  it('resolves salati lernwerk from manifest', () => {
    const d = resolveBibliothekBookDetails('salati-islam-lernwerk');
    expect(d).not.toBeNull();
    expect(d?.title).toContain('Lernwerk');
    expect(d?.lang).toBe('de');
    expect(d?.pages).toBe(829);
    expect(d?.license).toBe('salati-original');
  });

  it('picks translator from PD quran entry', () => {
    const d = resolveBibliothekBookDetails('quran-de-henning-1901');
    expect(d?.translator).toBe('Max Henning');
    expect(d?.belegUrl).toContain('archive.org');
  });
});
