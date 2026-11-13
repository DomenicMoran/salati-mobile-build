import * as downloads from '@/features/handouts/downloads';

import { resolveBibliothekPdfUrl } from './bibliothekPdfOffline';

jest.mock('@/features/handouts/downloads', () => ({
  isHandoutDownloaded: jest.fn(),
  localHandoutUri: jest.fn((id: string) => `file:///handouts/${id}.pdf`),
}));

describe('resolveBibliothekPdfUrl', () => {
  const remote = 'https://cdn.example/salati-islam-lernwerk.pdf';

  it('nutzt Remote ohne Download', async () => {
    jest.mocked(downloads.isHandoutDownloaded).mockResolvedValue(false);
    await expect(resolveBibliothekPdfUrl('salati-islam-lernwerk', remote)).resolves.toBe(remote);
  });

  it('nutzt lokale Datei wenn vorhanden', async () => {
    jest.mocked(downloads.isHandoutDownloaded).mockResolvedValue(true);
    await expect(resolveBibliothekPdfUrl('salati-islam-lernwerk', remote)).resolves.toBe(
      'file:///handouts/salati-islam-lernwerk.pdf',
    );
  });
});
