import {
  bibliothekReaderDeepLink,
  hadeethencDeepLink,
  hadithDeepLink,
  quranAyahDeepLink,
  quranSurahDeepLink,
  tafsirBibliothekDeepLink,
} from './deepLinks';

describe('quranAyahDeepLink', () => {
  it('builds a salatibox:// link with surah and ayah', () => {
    expect(quranAyahDeepLink(2, 255)).toBe('salatibox://quran/2?ayah=255');
  });
});

describe('hadithDeepLink', () => {
  it('builds a salatibox:// link with collection and number', () => {
    expect(hadithDeepLink('nawawi', 1)).toBe('salatibox://hadith/nawawi/1');
  });
});

describe('tafsirBibliothekDeepLink', () => {
  it('builds bibliothek tafsir path', () => {
    expect(tafsirBibliothekDeepLink(2, 1)).toBe('salatibox://bibliothek/tafsir/2?block=1');
  });
});

describe('bibliothekReaderDeepLink', () => {
  it('builds reader path fuer All-in-One QA', () => {
    expect(bibliothekReaderDeepLink('salati-islam-lernwerk')).toBe(
      'salatibox://bibliothek/reader/salati-islam-lernwerk',
    );
  });

  it('normalisiert Legacy salati-lernbuch', () => {
    expect(bibliothekReaderDeepLink('salati-lernbuch')).toBe(
      'salatibox://bibliothek/reader/salati-islam-lernwerk',
    );
  });
});

describe('quranSurahDeepLink', () => {
  it('builds surah-only link', () => {
    expect(quranSurahDeepLink(4)).toBe('salatibox://quran/4');
  });
});

describe('hadeethencDeepLink', () => {
  it('builds a salatibox:// link matching the topics route', () => {
    // Muss 1:1 zu src/app/hadith/topics/[category]/[id].tsx passen — sonst
    // landet der Empfänger auf einer leeren Seite.
    expect(hadeethencDeepLink('5', '3135')).toBe('salatibox://hadith/topics/5/3135');
  });
});
