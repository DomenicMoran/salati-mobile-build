import { SUPPORTED_LOCALES } from '@/lib/locale-detect';

import {
  BEST_TAFSIRS,
  BEST_TRANSLATIONS,
  RECOMMENDED_TRANSLATIONS,
  TAFSIR_DE_ATTRIBUTION,
  TAFSIR_DE_RASSOUL,
  expandTafsirBlocks,
  fetchSurahTafsir,
  editionDisplayName,
  normalizeArabicSearchQuery,
  parseAyahSajda,
  parseHighlightedText,
  parseMushafPage,
  parseSearchResponse,
  parseTajweedText,
  parseSegmentsResponse,
  parseWordByWordResponse,
  parseWordTajweedRules,
  segmentMatchesPulseColor,
  splitBasmala,
  stripTafsirHtml,
  toArabicDigits,
} from './api';

describe('editionDisplayName', () => {
  it('uses englishName when it is a real name', () => {
    expect(editionDisplayName({ identifier: 'de.bubenheim', englishName: 'A. S. F. Bubenheim and N. Elyas' })).toBe(
      'A. S. F. Bubenheim and N. Elyas',
    );
  });

  it('falls back to `name` when Al Quran Cloud reports englishName "Unknown" (id.indonesian)', () => {
    expect(
      editionDisplayName({ identifier: 'id.indonesian', englishName: 'Unknown', name: 'Bahasa Indonesia' }),
    ).toBe('Bahasa Indonesia');
  });

  it('falls back to the broken englishName if no `name` is available either', () => {
    expect(editionDisplayName({ identifier: 'xx.example', englishName: 'Unknown' })).toBe('Unknown');
  });

  it('appends "(Alt.)" for -2 suffixed identifiers, using the resolved name', () => {
    expect(editionDisplayName({ identifier: 'ar.alafasy-2', englishName: 'Mishary Rashid Alafasy' })).toBe(
      'Mishary Rashid Alafasy (Alt.)',
    );
    expect(
      editionDisplayName({ identifier: 'id.indonesian-2', englishName: 'Unknown', name: 'Bahasa Indonesia' }),
    ).toBe('Bahasa Indonesia (Alt.)');
  });
});

describe('stripTafsirHtml', () => {
  it('removes block tags and inserts paragraph breaks', () => {
    const html = '<h1>Title</h1><p>First paragraph.</p><p>Second paragraph.</p>';
    const result = stripTafsirHtml(html);
    expect(result).toContain('Title');
    expect(result).toContain('First paragraph.');
    expect(result).toContain('Second paragraph.');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });

  it('converts <br> into a line break', () => {
    expect(stripTafsirHtml('Line one<br>Line two')).toBe('Line one\nLine two');
  });

  it('decodes common HTML entities', () => {
    expect(stripTafsirHtml('Tom &amp; Jerry&#39;s &quot;house&quot;&nbsp;here')).toBe(
      'Tom & Jerry\'s "house" here',
    );
  });

  it('collapses more than two consecutive newlines', () => {
    const html = '<p>A</p><p>B</p><p>C</p>';
    const result = stripTafsirHtml(html);
    expect(result).not.toMatch(/\n{3,}/);
  });

  it('trims leading and trailing whitespace', () => {
    expect(stripTafsirHtml('  <p>content</p>  ')).toBe('content');
  });
});

describe('parseWordByWordResponse', () => {
  it('maps words to arabic/translation/transliteration and filters out end markers', () => {
    const response = {
      verses: [
        {
          words: [
            {
              char_type_name: 'word',
              text_uthmani: 'بِسْمِ',
              translation: { text: 'In (the) name' },
              transliteration: { text: 'bis\'mi' },
            },
            {
              char_type_name: 'word',
              text_uthmani: 'ٱللَّهِ',
              translation: { text: '(of) Allah' },
              transliteration: { text: 'l-lahi' },
            },
            {
              char_type_name: 'end',
              text_uthmani: '١',
              translation: { text: '(1)' },
              transliteration: { text: null },
            },
          ],
        },
      ],
    };
    const result = parseWordByWordResponse(response);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(2);
    expect(result[0][0]).toEqual({
      arabic: 'بِسْمِ',
      translation: 'In (the) name',
      transliteration: "bis'mi",
      audioUrl: null,
      tajweedRules: [],
    });
    expect(result[0][1].arabic).toBe('ٱللَّهِ');
  });

  it('builds the full CDN URL from the relative audio_url path', () => {
    const response = {
      verses: [
        {
          words: [
            {
              char_type_name: 'word',
              text_uthmani: 'بِسْمِ',
              translation: { text: 'In (the) name' },
              transliteration: { text: "bis'mi" },
              audio_url: 'wbw/001_001_001.mp3',
            },
          ],
        },
      ],
    };
    expect(parseWordByWordResponse(response)[0][0].audioUrl).toBe(
      'https://audio.qurancdn.com/wbw/001_001_001.mp3',
    );
  });

  it('leaves audioUrl null when the API provides no audio for a word', () => {
    const response = {
      verses: [
        {
          words: [
            {
              char_type_name: 'word',
              text_uthmani: 'كلمة',
              translation: { text: 'word' },
              transliteration: { text: null },
              audio_url: null,
            },
          ],
        },
      ],
    };
    expect(parseWordByWordResponse(response)[0][0].audioUrl).toBeNull();
  });

  it('falls back to empty transliteration when null', () => {
    const response = {
      verses: [
        {
          words: [
            {
              char_type_name: 'word',
              text_uthmani: 'كلمة',
              translation: { text: 'word' },
              transliteration: { text: null },
            },
          ],
        },
      ],
    };
    expect(parseWordByWordResponse(response)[0][0].transliteration).toBe('');
  });

  it('preserves verse order across multiple ayahs', () => {
    const response = {
      verses: [
        { words: [{ char_type_name: 'word', text_uthmani: 'a', translation: { text: 'A' }, transliteration: { text: 'a' } }] },
        { words: [{ char_type_name: 'word', text_uthmani: 'b', translation: { text: 'B' }, transliteration: { text: 'b' } }] },
      ],
    };
    const result = parseWordByWordResponse(response);
    expect(result[0][0].arabic).toBe('a');
    expect(result[1][0].arabic).toBe('b');
  });

  it('extracts distinct tajweed rule names from the word-level text_uthmani_tajweed field', () => {
    const response = {
      verses: [
        {
          words: [
            {
              char_type_name: 'word',
              text_uthmani: 'لَآ',
              text_uthmani_tajweed: 'ل<rule class=madda_obligatory_monfasel>َآ</rule>',
              translation: { text: '(there is) no' },
              transliteration: { text: 'lā' },
            },
          ],
        },
      ],
    };
    expect(parseWordByWordResponse(response)[0][0].tajweedRules).toEqual(['madda_obligatory_monfasel']);
  });

  it('returns an empty tajweedRules array when the word has no special rule', () => {
    const response = {
      verses: [
        {
          words: [
            {
              char_type_name: 'word',
              text_uthmani: 'لِلَّهِ',
              text_uthmani_tajweed: 'لِلَّهِ',
              translation: { text: '(be) to Allah' },
              transliteration: { text: 'lillahi' },
            },
          ],
        },
      ],
    };
    expect(parseWordByWordResponse(response)[0][0].tajweedRules).toEqual([]);
  });
});

describe('parseWordTajweedRules', () => {
  it('extracts a single rule name from a <rule class=X> tag', () => {
    expect(parseWordTajweedRules('ل<rule class=madda_normal>َآ</rule>')).toEqual(['madda_normal']);
  });

  it('deduplicates repeated rule tags, keeping first-occurrence order', () => {
    expect(
      parseWordTajweedRules('<rule class=ghunnah>نّ</rule>َ<rule class=ghunnah>نّ</rule>'),
    ).toEqual(['ghunnah']);
  });

  it('extracts multiple different rules in order of appearance', () => {
    expect(
      parseWordTajweedRules('<rule class=laam_shamsiyah>ل</rule>ِ<rule class=qalaqah>ط</rule>'),
    ).toEqual(['laam_shamsiyah', 'qalaqah']);
  });

  it('returns an empty array for plain text without rule tags', () => {
    expect(parseWordTajweedRules('لِلَّهِ')).toEqual([]);
  });

  it('returns an empty array for null/undefined input instead of throwing', () => {
    expect(parseWordTajweedRules(null)).toEqual([]);
    expect(parseWordTajweedRules(undefined)).toEqual([]);
  });
});

describe('parseTajweedText', () => {
  it('splits tagged and untagged text into segments with the right class', () => {
    const raw = 'بِسْمِ <tajweed class=ham_wasl>ٱ</tajweed>للَّهِ';
    const segments = parseTajweedText(raw);
    expect(segments).toEqual([
      { text: 'بِسْمِ ', className: null },
      { text: 'ٱ', className: 'ham_wasl' },
      { text: 'للَّهِ', className: null },
    ]);
  });

  it('removes the verse-end marker (span class=end) entirely, trimming the trailing space before it', () => {
    // The app already shows the ayah number in its own header badge; keeping
    // the digit inline too would duplicate it (unlike the plain, non-tajweed view).
    const raw = 'نَ <span class=end>٢</span>';
    const segments = parseTajweedText(raw);
    expect(segments).toEqual([{ text: 'نَ', className: null }]);
  });

  it('handles multiple consecutive tagged segments', () => {
    const raw = '<tajweed class=ghunnah>نّ</tajweed>َ <tajweed class=madda_obligatory>َا</tajweed>';
    const segments = parseTajweedText(raw);
    expect(segments.filter((s) => s.className)).toEqual([
      { text: 'نّ', className: 'ghunnah' },
      { text: 'َا', className: 'madda_obligatory' },
    ]);
  });

  it('returns a single plain segment when there are no tajweed tags at all', () => {
    expect(parseTajweedText('بِسْمِ اللَّهِ')).toEqual([{ text: 'بِسْمِ اللَّهِ', className: null }]);
  });

  it('reconstructs the original text when segments are concatenated', () => {
    const raw = 'أَ<tajweed class=ikhafa>نذ</tajweed>َرْتَهُمْ';
    const segments = parseTajweedText(raw);
    expect(segments.map((s) => s.text).join('')).toBe(raw.replace(/<[^>]+>/g, ''));
  });
});

describe('parseHighlightedText', () => {
  it('splits plain and <em>-marked segments', () => {
    expect(parseHighlightedText('So, observe <em>patience</em>, a good <em>patience</em>.')).toEqual([
      { text: 'So, observe ', bold: false },
      { text: 'patience', bold: true },
      { text: ', a good ', bold: false },
      { text: 'patience', bold: true },
      { text: '.', bold: false },
    ]);
  });

  it('returns a single plain segment when there is no highlight', () => {
    expect(parseHighlightedText('no markers here')).toEqual([{ text: 'no markers here', bold: false }]);
  });
});

describe('parseSearchResponse', () => {
  it('maps verse_key into surah/ayah numbers and picks the first translation', () => {
    const raw = {
      search: {
        query: 'patience',
        total_results: 195,
        current_page: 1,
        total_pages: 98,
        results: [
          {
            verse_key: '70:5',
            text: 'فَٱصْبِرْ صَبْرًا جَمِيلًا',
            translations: [
              { text: 'So, observe <em>patience</em>.', resource_id: 84, name: 'T. Usmani', language_name: 'english' },
            ],
          },
        ],
      },
    };
    const result = parseSearchResponse(raw);
    expect(result.totalResults).toBe(195);
    expect(result.totalPages).toBe(98);
    expect(result.results[0]).toEqual({
      verseKey: '70:5',
      surah: 70,
      ayah: 5,
      arabicText: 'فَٱصْبِرْ صَبْرًا جَمِيلًا',
      translationHtml: 'So, observe <em>patience</em>.',
      translationName: 'T. Usmani',
    });
  });

  it('sets translationHtml/translationName to null when no translation matched (e.g. Arabic search)', () => {
    const raw = {
      search: {
        query: 'الله',
        total_results: 2344,
        current_page: 1,
        total_pages: 782,
        results: [{ verse_key: '5:7', text: 'وَٱذْكُرُوا۟ نِعْمَةَ ٱللَّهِ', translations: [] }],
      },
    };
    const result = parseSearchResponse(raw);
    expect(result.results[0].translationHtml).toBeNull();
    expect(result.results[0].translationName).toBeNull();
  });
});

describe('parseSegmentsResponse', () => {
  it('mappt verse_key auf numberInSurah und baut absolute Audio-URLs', () => {
    const out = parseSegmentsResponse({
      audio_files: [
        { verse_key: '1:1', url: 'Alafasy/mp3/001001.mp3', segments: [[0, 1, 60, 610]] },
        { verse_key: '1:2', url: 'https://example.com/x.mp3', segments: [[0, 1, 80, 960]] },
      ],
    });
    expect(out[1].audioUrl).toBe('https://verses.quran.com/Alafasy/mp3/001001.mp3');
    expect(out[2].audioUrl).toBe('https://example.com/x.mp3');
    expect(out[1].segments).toEqual([[0, 1, 60, 610]]);
  });

  it('übersteht fehlende Segmente und kaputte Keys', () => {
    const out = parseSegmentsResponse({
      audio_files: [
        { verse_key: '1:3', url: 'a.mp3' },
        { verse_key: 'kaputt', url: 'b.mp3' },
      ],
    });
    expect(out[3].segments).toEqual([]);
    expect(Object.keys(out)).toHaveLength(1);
  });

  it('löst protokoll-relative URLs (Husari) auf https statt eines Dreifach-Slash-Pfads auf', () => {
    // quran.com liefert für Husari (recitation id 6) "//mirrors…"-URLs statt
    // eines relativen Pfads oder einer vollständigen https-URL — naives
    // Voranstellen von SEGMENTS_AUDIO_BASE ergab früher
    // "https://verses.quran.com//mirrors.quranicaudio.com/…" (404).
    const out = parseSegmentsResponse({
      audio_files: [
        {
          verse_key: '1:1',
          url: '//mirrors.quranicaudio.com/everyayah/Husary_64kbps/001001.mp3',
          segments: [[0, 1, 60, 610]],
        },
      ],
    });
    expect(out[1].audioUrl).toBe('https://mirrors.quranicaudio.com/everyayah/Husary_64kbps/001001.mp3');
  });
});

describe('segmentMatchesPulseColor', () => {
  it('matches when the class resolves to the same color as the pulsed legend entry', () => {
    // ghunnah und idgham_ghunnah teilen sich dieselbe Farbe in TAJWEED_COLORS.
    expect(segmentMatchesPulseColor('idgham_ghunnah', '#2E9E4F')).toBe(true);
    expect(segmentMatchesPulseColor('ghunnah', '#2E9E4F')).toBe(true);
  });

  it('does not match a different-colored rule family', () => {
    expect(segmentMatchesPulseColor('ikhafa', '#2E9E4F')).toBe(false);
  });

  it('returns false when nothing is currently pulsing', () => {
    expect(segmentMatchesPulseColor('ghunnah', null)).toBe(false);
  });

  it('returns false for plain, unclassified text segments', () => {
    expect(segmentMatchesPulseColor(null, '#2E9E4F')).toBe(false);
  });
});

describe('toArabicDigits', () => {
  it('wandelt westliche in arabisch-indische Ziffern', () => {
    expect(toArabicDigits(7)).toBe('٧');
    expect(toArabicDigits(286)).toBe('٢٨٦');
    expect(toArabicDigits(604)).toBe('٦٠٤');
  });
});

describe('parseMushafPage', () => {
  it('gruppiert Verse nach Suren und übernimmt den Juz', () => {
    const page = parseMushafPage(604, [
      { verse_key: '112:1', juz_number: 30, text_uthmani: 'قل هو الله أحد' },
      { verse_key: '112:2', juz_number: 30, text_uthmani: 'الله الصمد' },
      { verse_key: '113:1', juz_number: 30, text_uthmani: 'قل أعوذ برب الفلق' },
    ]);
    expect(page.page).toBe(604);
    expect(page.juz).toBe(30);
    expect(page.groups).toHaveLength(2);
    expect(page.groups[0]).toEqual({
      surah: 112,
      verses: [
        { ayah: 1, text: 'قل هو الله أحد', sajda: false },
        { ayah: 2, text: 'الله الصمد', sajda: false },
      ],
    });
    expect(page.groups[1].surah).toBe(113);
  });

  it('markiert Niederwerfungsverse (sajdah_number gesetzt)', () => {
    const page = parseMushafPage(415, [
      { verse_key: '32:15', juz_number: 21, sajdah_number: 9, text_uthmani: 'إنما يؤمن' },
      { verse_key: '32:16', juz_number: 21, sajdah_number: null, text_uthmani: 'تتجافى' },
    ]);
    expect(page.groups[0].verses[0].sajda).toBe(true);
    expect(page.groups[0].verses[1].sajda).toBe(false);
  });

  it('entfernt unsichtbare Steuerzeichen (IndoPak-Tofu-Boxen)', () => {
    const page = parseMushafPage(1, [
      { verse_key: '112:3', juz_number: 30, text_indopak: 'لَمۡ يَلِدۡ​ ‏⁩' },
    ]);
    expect(page.groups[0].verses[0].text).not.toMatch(/[​-‏⁦-⁩]/);
  });

  it('nimmt IndoPak-Text, wenn kein Uthmani-Feld vorhanden ist', () => {
    const page = parseMushafPage(1, [{ verse_key: '1:1', juz_number: 1, text_indopak: 'بسم الله' }]);
    expect(page.groups[0].verses[0].text).toBe('بسم الله');
  });

  it('überspringt kaputte Einträge statt zu crashen', () => {
    const page = parseMushafPage(1, [
      { verse_key: 'kaputt', juz_number: 1, text_uthmani: 'x' },
      { verse_key: '1:1', juz_number: 1, text_uthmani: 'بسم الله' },
    ]);
    expect(page.groups).toHaveLength(1);
  });
});

describe('parseMushafPage mit Wort-Daten', () => {
  it('übernimmt Wörter (ohne end-Marker) mit Übersetzung + Umschrift', () => {
    const page = parseMushafPage(1, [
      {
        verse_key: '1:1', juz_number: 1, text_uthmani: 'بسم الله',
        words: [
          { char_type_name: 'word', text_uthmani: 'بسم', translation: { text: 'In the name' }, transliteration: { text: 'bismi' } },
          { char_type_name: 'word', text_uthmani: 'الله', translation: { text: 'of Allah' }, transliteration: { text: 'llahi' } },
          { char_type_name: 'end', text_uthmani: '١', translation: { text: '(1)' }, transliteration: { text: null } },
        ],
      },
    ]);
    const verse = page.groups[0].verses[0];
    expect(verse.words).toHaveLength(2);
    expect(verse.words?.[0]).toEqual({
      arabic: 'بسم',
      translation: 'In the name',
      transliteration: 'bismi',
      tajweedRules: [],
    });
  });

  it('lässt words weg, wenn die API keine liefert', () => {
    const page = parseMushafPage(1, [{ verse_key: '1:1', juz_number: 1, text_uthmani: 'بسم الله' }]);
    expect('words' in page.groups[0].verses[0]).toBe(false);
  });

  it('extrahiert Tajwid-Regeln je Wort aus text_uthmani_tajweed', () => {
    const page = parseMushafPage(1, [
      {
        verse_key: '1:1',
        juz_number: 1,
        text_uthmani: 'بسم الله',
        words: [
          {
            char_type_name: 'word',
            text_uthmani: 'بسم',
            text_uthmani_tajweed: '<rule class=laam_shamsiyah>ب</rule>سم',
            translation: { text: 'In the name' },
            transliteration: { text: 'bismi' },
          },
        ],
      },
    ]);
    expect(page.groups[0].verses[0].words?.[0].tajweedRules).toEqual(['laam_shamsiyah']);
  });
});

describe('splitBasmala', () => {
  it('trennt die Basmala von Vers 1 ab (verifiziert gegen echte API-Antworten)', () => {
    const raw = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ';
    const result = splitBasmala(18, raw);
    expect(result.hasBasmala).toBe(true);
    expect(result.text).toBe('الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ');
  });

  it('Sure 1 (Al-Fatiha): Basmala IST Vers 1, wird nicht abgetrennt', () => {
    const raw = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
    expect(splitBasmala(1, raw)).toEqual({ hasBasmala: false, text: raw });
  });

  it('Sure 9 (At-Tawba): keine Basmala im Text, bleibt unangetastet', () => {
    const raw = 'بَرَآءَةٌ مِّنَ ٱللَّهِ وَرَسُولِهِ';
    expect(splitBasmala(9, raw)).toEqual({ hasBasmala: false, text: raw });
  });

  it('entfernt ein führendes BOM/ZWNBSP vor dem Prefix-Vergleich', () => {
    const raw = '﻿بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ الٓمٓ';
    const result = splitBasmala(2, raw);
    expect(result.hasBasmala).toBe(true);
    expect(result.text).toBe('الٓمٓ');
  });

  it('lässt den Text unangetastet, wenn kein Basmala-Prefix erkennbar ist', () => {
    const raw = 'وَٱلْعَصْرِ';
    expect(splitBasmala(103, raw)).toEqual({ hasBasmala: false, text: raw });
  });

  // Regression (Daten-Audit 2026-07-27): quran-uthmani schreibt in Sure 95
  // (at-Tin) und Sure 97 (al-Qadr) „بِّسْمِ" — mit einem zusätzlichen Shadda
  // (U+0651) auf dem ب, das in den übrigen 110 Suren fehlt. Der exakte
  // startsWith-Vergleich scheiterte dort still: die Basmala blieb im
  // arabischen Vers 1 kleben, während Übersetzung und Umschrift sie nicht
  // enthielten. Beide Rohtexte sind wörtlich aus der Live-API übernommen.
  it('Sure 95 (at-Tin): erkennt die Basmala trotz zusätzlichem Shadda auf dem ب', () => {
    const raw = 'بِّسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ وَٱلتِّينِ وَٱلزَّيْتُونِ';
    const result = splitBasmala(95, raw);
    expect(result.hasBasmala).toBe(true);
    expect(result.text).toBe('وَٱلتِّينِ وَٱلزَّيْتُونِ');
  });

  it('Sure 97 (al-Qadr): erkennt die Basmala trotz zusätzlichem Shadda auf dem ب', () => {
    const raw = 'بِّسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ إِنَّآ أَنزَلْنَٰهُ فِى لَيْلَةِ ٱلْقَدْرِ';
    const result = splitBasmala(97, raw);
    expect(result.hasBasmala).toBe(true);
    expect(result.text).toBe('إِنَّآ أَنزَلْنَٰهُ فِى لَيْلَةِ ٱلْقَدْرِ');
  });

  it('lässt kein Diakritikum der Basmala am Anfang des Verstextes zurück', () => {
    // Das Kasra von „ٱلرَّحِيمِ" gehört zur Basmala; bliebe es stehen, würde der
    // Vers mit einem freistehenden Kombinationszeichen beginnen.
    const raw = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ قُلْ هُوَ ٱللَّهُ أَحَدٌ';
    const result = splitBasmala(112, raw);
    expect(result.hasBasmala).toBe(true);
    expect(result.text).toBe('قُلْ هُوَ ٱللَّهُ أَحَدٌ');
    expect(/^[ً-ْٰ]/.test(result.text)).toBe(false);
  });

  it('löst nicht bei einem Vers aus, der nur ähnlich beginnt', () => {
    // 96:1 beginnt mit „ٱقْرَأْ بِٱسْمِ رَبِّكَ" — enthält „bismi", ist aber keine Basmala.
    const raw = 'ٱقْرَأْ بِٱسْمِ رَبِّكَ ٱلَّذِى خَلَقَ';
    expect(splitBasmala(96, raw)).toEqual({ hasBasmala: false, text: raw });
  });

  it('erkennt den Prefix auch bei abweichender Kombinationszeichen-Reihenfolge (NFC)', () => {
    // Regression: der erste Fix-Versuch scheiterte still, weil die Konstante
    // Shadda+Fatha in vertauschter Reihenfolge gegenüber der Live-API hatte.
    const swapped = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ'.normalize('NFD');
    const raw = swapped + ' ' + 'الٓمٓ';
    const result = splitBasmala(2, raw);
    expect(result.hasBasmala).toBe(true);
  });
});

describe('fetchSurahTafsir (quran.com-Ausgaben)', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fordert die ganze Sure an, nicht die 10er-Standardseite von quran.com', async () => {
    // Regression (Daten-Audit 2026-07-27): ohne `per_page` liefert
    // `tafsirs/:id/by_chapter` nur 10 Verse (Sure 2: 10 statt 286,
    // meta.total_pages 29). Der Tafsir war dadurch ab Vers 11 in jeder Sure
    // leer — für 13 der 14 App-Sprachen der Standard-Tafsir (BEST_TAFSIRS).
    const tafsirs = Array.from({ length: 286 }, (_, i) => ({
      verse_key: `2:${i + 1}`,
      text: `<p>Erläuterung ${i + 1}</p>`,
    }));
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ tafsirs }) });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchSurahTafsir(2, 'qc.169');

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/tafsirs/169/by_chapter/2');
    const perPage = Number(new URL(url).searchParams.get('per_page'));
    expect(perPage).toBeGreaterThanOrEqual(286);
    expect(result).toHaveLength(286);
    expect(result[285]).toBe('Erläuterung 286');
  });

  it('füllt Verse ohne eigenen Tafsir-Eintrag positionsgenau mit Leerstring', () => {
    // Viele Tafsire kommentieren Versblöcke: der Text hängt am ersten Vers des
    // Blocks. Die Lücken dürfen den Index NICHT verschieben, sonst stünde die
    // Erläuterung beim falschen Vers.
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tafsirs: [
          { verse_key: '18:1', text: '<p>Zu 1-3</p>' },
          { verse_key: '18:4', text: '<p>Zu 4</p>' },
        ],
      }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    return fetchSurahTafsir(18, 'qc.169').then((result) => {
      expect(result).toEqual(['Zu 1-3', '', '', 'Zu 4']);
    });
  });
});

describe('deutscher Tafsir (de.rassoul)', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('weitet Versbereiche auf jeden Vers des Bereichs auf', () => {
    // Das Original kommentiert Versgruppen ("2:8-9 - …"). Stünde der Text nur
    // am ersten Vers, sähe ein Leser, der bei 2:9 steht, gar nichts.
    expect(
      expandTafsirBlocks([
        { from: 1, to: 1, text: 'A' },
        { from: 2, to: 3, text: 'B' },
      ]),
    ).toEqual(['A', 'B', 'B']);
  });

  it('laesst Verse ohne Kommentar leer, ohne den Index zu verschieben', () => {
    // 242 der 6236 Verse haben im Werk keinen eigenen Abschnitt. Eine
    // Verschiebung wuerde die Erlaeuterung an den falschen Vers haengen.
    expect(
      expandTafsirBlocks([
        { from: 1, to: 1, text: 'A' },
        { from: 4, to: 4, text: 'D' },
      ]),
    ).toEqual(['A', '', '', 'D']);
  });

  it('vertraegt eine Sure ohne jeden Block', () => {
    expect(expandTafsirBlocks([])).toEqual([]);
  });

  it('holt die Sure aus unserer eigenen Auslieferung, nicht bei alquran.cloud', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sura: 112, blocks: [{ from: 1, to: 4, text: 'Zu 112' }] }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchSurahTafsir(112, TAFSIR_DE_RASSOUL);

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/tafsir/de-rassoul/112.json');
    expect(url).not.toContain('alquran.cloud');
    expect(result).toEqual(['Zu 112', 'Zu 112', 'Zu 112', 'Zu 112']);
  });

  it('meldet einen Fehler statt still leer zu bleiben', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;
    await expect(fetchSurahTafsir(1, TAFSIR_DE_RASSOUL)).rejects.toThrow('tafsir_de_404');
  });

  it('ist der Standard-Tafsir fuer Deutsch', () => {
    // Vorher zeigte die App deutschsprachigen Nutzern den ENGLISCHEN Ibn
    // Kathir, weil kein Anbieter einen deutschen Tafsir fuehrt.
    expect(BEST_TAFSIRS.de).toBe(TAFSIR_DE_RASSOUL);
  });

  it('fuehrt die Quellennennung mit - sie ist die einzige Auflage des Autors', () => {
    // Die Freigabe gilt nur "wenn dabei auf diese Quelle hingewiesen wird".
    // Der Eigenname darf deshalb weder entfallen noch uebersetzt werden.
    expect(TAFSIR_DE_ATTRIBUTION).toContain('Rassoul');
    expect(TAFSIR_DE_ATTRIBUTION).toContain('Islamische Bibliothek');
  });
});

describe('parseAyahSajda', () => {
  it('erkennt einen normalen Vers ohne Sajda (raw = false)', () => {
    expect(parseAyahSajda(false)).toEqual({ sajda: false, sajdaObligatory: false });
  });

  it('erkennt einen unbestimmten Vers ohne sajda-Feld (undefined)', () => {
    expect(parseAyahSajda(undefined)).toEqual({ sajda: false, sajdaObligatory: false });
  });

  it('erkennt einen empfohlenen (nicht verpflichtenden) Sajda-Vers, z. B. 7:206', () => {
    expect(parseAyahSajda({ id: 1, recommended: true, obligatory: false })).toEqual({
      sajda: true,
      sajdaObligatory: false,
    });
  });

  it('erkennt einen verpflichtenden Sajda-Vers, z. B. 32:15', () => {
    expect(parseAyahSajda({ id: 10, recommended: false, obligatory: true })).toEqual({
      sajda: true,
      sajdaObligatory: true,
    });
  });
});

describe('normalizeArabicSearchQuery', () => {
  it('entfernt Tashkeel/Harakat (الرَّحْمٰن → الرحمن)', () => {
    // الرَّحْمَٰن → الرحمن
    expect(normalizeArabicSearchQuery('الرَّحْمٰن')).toBe(
      'الرحمن',
    );
  });

  it('faltet Alif-Wasla ٱ auf ا (der Kern-Fix: ٱلعالمين findet sonst 0 Treffer)', () => {
    // ٱلعالمين → العالمين
    expect(normalizeArabicSearchQuery('ٱلعالمين')).toBe(
      'العالمين',
    );
  });

  it('faltet Hamza-auf-Alif أإآ auf ا', () => {
    // أنعمت → انعمت
    expect(normalizeArabicSearchQuery('أنعمت')).toBe('انعمت');
  });

  it('faltet Alif-Maqsura ى BEWUSST NICHT (das wuerde die Trefferzahl einbrechen lassen)', () => {
    // موسى bleibt موسى (ى = U+0649 unveraendert)
    expect(normalizeArabicSearchQuery('موسى')).toBe('موسى');
  });

  it('laesst Ta-Marbuta ة unveraendert (der Suchindex faltet das bereits selbst)', () => {
    // رحمة bleibt رحمة
    expect(normalizeArabicSearchQuery('رحمة')).toBe('رحمة');
  });

  it('entfernt Tatweel ـ und normalisiert Whitespace', () => {
    // الصــراط → الصراط, plus umschliessende Leerzeichen
    expect(normalizeArabicSearchQuery('  الصــراط  ')).toBe(
      'الصراط',
    );
  });

  it('behaelt arabisch-indische Ziffern (٠-٩) statt sie zu strippen', () => {
    // ٢٣ bleibt erhalten
    expect(normalizeArabicSearchQuery('٢٣')).toBe('٢٣');
  });
});

describe('deutsche Übersetzungs-Empfehlungen (Inhalts-Audit 2026-07-27)', () => {
  it('stellt alle vier deutschen Ausgaben von Al Quran Cloud oben zur Wahl', () => {
    // Live geprüft gegen /v1/edition?format=text&type=translation: mehr als
    // diese vier deutschen Übersetzungen führt die Quelle nicht. Fehlt eine,
    // versinkt sie im Picker zwischen 100+ fremdsprachigen Einträgen.
    for (const id of ['de.bubenheim', 'de.aburida', 'de.khoury', 'de.zaidan']) {
      expect(RECOMMENDED_TRANSLATIONS).toContain(id);
    }
  });

  it('lässt Bubenheim & Elyas die Standardwahl für Deutsch', () => {
    expect(BEST_TRANSLATIONS.de).toBe('de.bubenheim');
  });

  it('empfiehlt genau eine Ausgabe pro App-Sprache als Standard', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(BEST_TRANSLATIONS[locale]).toBeTruthy();
    }
  });
});
