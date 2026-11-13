import shippedBooksManifest from './shipped-books.manifest.json';
import { effectiveBelegUrl, validateShippedBooksManifest } from './validateShippedBooksManifest';

describe('shipped-books.manifest.json', () => {
  it('validiert Phase-C-Intake-Gates', () => {
    const errors = validateShippedBooksManifest(shippedBooksManifest);
    expect(errors).toEqual([]);
  });

  it('lehnt sichtbares Werk ohne Lizenznachweis ab', () => {
    const broken = {
      ...shippedBooksManifest,
      items: [
        ...(shippedBooksManifest.items as object[]),
        {
          id: 'visible-without-beleg',
          title: 'Broken',
          license: 'salati-original',
          licenseStatus: 'cleared',
          rightsHolder: 'Test',
          category: 'Aqida',
          sourceUrl: 'podcast/handouts/aqida.pdf',
          reviewer: 'test',
          reviewedAt: '2026-11-10',
          islamicNota: 'test',
          pdf_url: 'https://example.com/x.pdf',
        },
      ],
    };
    const errors = validateShippedBooksManifest(broken);
    expect(errors.some((e) => e.includes('visible-without-beleg') && e.includes('beleg_url'))).toBe(true);
  });

  it('liefert beleg_url aus Lizenzdatei-Pfad in sourceUrl', () => {
    const beleg = effectiveBelegUrl({
      sourceUrl: 'apps/mobile/public/licenses/pd-pickthall-koran-1930.txt',
    });
    expect(beleg).toContain('licenses/');
  });
});
