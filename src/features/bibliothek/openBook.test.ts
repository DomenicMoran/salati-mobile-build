/* eslint-disable import/first -- jest mocks must precede SUT import */
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('react-native', () => ({
  Linking: { openURL: jest.fn(() => Promise.resolve()) },
  Platform: { OS: 'ios' },
}));

import { router } from 'expo-router';
import { Linking } from 'react-native';

import {
  openBibliothekHandout,
  openBibliothekPdf,
  openBibliothekPdfWithFallback,
  openBibliothekReader,
  openTafsirBook,
  openTafsirSurah,
} from './openBook';

const mockPush = router.push as jest.Mock;

describe('openBibliothekHandout', () => {
  beforeEach(() => mockPush.mockClear());

  it('navigiert zum Handout-Viewer', () => {
    openBibliothekHandout({ id: 'wudu-guide' });
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/handouts/[id]',
      params: { id: 'wudu-guide' },
    });
  });

  it('ignoriert leere id', () => {
    openBibliothekHandout({ id: '  ' });
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('openBibliothekPdf', () => {
  beforeEach(() => mockPush.mockClear());

  it('nutzt remote-PDF-Route statt Browser', () => {
    openBibliothekPdf({ pdfUrl: 'https://example.test/a.pdf', title: 'Buch' });
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/handouts/remote',
        params: { url: 'https://example.test/a.pdf', title: 'Buch' },
      }),
    );
  });

  it('reicht optionale Startseite weiter', () => {
    openBibliothekPdf({ pdfUrl: 'https://example.test/a.pdf', title: 'Buch', page: 42 });
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ page: '42' }),
      }),
    );
  });

  it('reicht bookId fuer Fortschritt weiter', () => {
    openBibliothekPdf({
      pdfUrl: 'https://example.test/a.pdf',
      title: 'Buch',
      bookId: 'salati-islam-lernwerk',
    });
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ bookId: 'salati-islam-lernwerk' }),
      }),
    );
  });
});

describe('openBibliothekReader', () => {
  beforeEach(() => mockPush.mockClear());

  it('navigiert zur Reader-Shell', () => {
    openBibliothekReader({ bookId: 'salati-islam-lernwerk' });
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/bibliothek/reader/[bookId]',
        params: { bookId: 'salati-islam-lernwerk' },
      }),
    );
  });

  it('leitet Legacy salati-lernbuch auf Lernwerk um', () => {
    openBibliothekReader({ bookId: 'salati-lernbuch' });
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        params: { bookId: 'salati-islam-lernwerk' },
      }),
    );
  });
});

describe('openBibliothekPdfWithFallback', () => {
  beforeEach(() => {
    mockPush.mockClear();
    (Linking.openURL as jest.Mock).mockClear();
  });

  it('forceBrowser oeffnet Linking', () => {
    openBibliothekPdfWithFallback(
      { pdfUrl: 'https://example.test/a.pdf', title: 'Buch' },
      { forceBrowser: true },
    );
    expect(Linking.openURL).toHaveBeenCalledWith('https://example.test/a.pdf');
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('openTafsirBook', () => {
  beforeEach(() => mockPush.mockClear());

  it('navigiert zur Tafsir-TOC', () => {
    openTafsirBook();
    expect(mockPush).toHaveBeenCalledWith('/bibliothek/tafsir');
  });
});

describe('openTafsirSurah', () => {
  beforeEach(() => mockPush.mockClear());

  it('navigiert mit Sure und Block', () => {
    openTafsirSurah(2, 3);
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/bibliothek/tafsir/[surah]',
        params: { surah: '2', block: '3' },
      }),
    );
  });

  it('lehnt ungueltige Sure ab', () => {
    openTafsirSurah(0);
    openTafsirSurah(200);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
