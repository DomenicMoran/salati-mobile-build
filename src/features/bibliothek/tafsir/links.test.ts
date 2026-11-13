import { quranSurahDeepLinkForTafsir, tafsirBibliothekDeepLink, tafsirBibliothekPath } from './links';

describe('tafsirBibliothekPath', () => {
  it('baut Router-Pfad', () => {
    expect(tafsirBibliothekPath(2)).toBe('/bibliothek/tafsir/2');
    expect(tafsirBibliothekPath(2, 4)).toBe('/bibliothek/tafsir/2?block=4');
  });
});

describe('tafsirBibliothekDeepLink', () => {
  it('nutzt salatibox-Schema', () => {
    expect(tafsirBibliothekDeepLink(1)).toBe('salatibox://bibliothek/tafsir/1');
  });
});

describe('quranSurahDeepLinkForTafsir', () => {
  it('verlinkt Sure oder Vers', () => {
    expect(quranSurahDeepLinkForTafsir(3)).toBe('salatibox://quran/3');
    expect(quranSurahDeepLinkForTafsir(2, 255)).toBe('salatibox://quran/2?ayah=255');
  });
});
