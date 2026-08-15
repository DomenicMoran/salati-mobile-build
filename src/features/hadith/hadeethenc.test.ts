import { SUPPORTED_LOCALES } from '@/lib/locale-detect';

import {
  HADEETHENC_ATTRIBUTION,
  childCategories,
  hadeethencLang,
  hadeethencTotalCount,
  isHadeethencLangAvailable,
  parseCategories,
  parseHadeeth,
  parseListPage,
  topLevelCategories,
} from './hadeethenc';

// Rohdaten 1:1 aus Live-Antworten der API übernommen (2026-07-27), damit die
// Tests am echten Format hängen und nicht an einer Wunschvorstellung davon.
const RAW_CATEGORIES = [
  { id: '1', title: 'Der Quran und Quranwissenschaften', hadeeths_count: '22', parent_id: null },
  { id: '3', title: "'Aqidah - die Glaubenslehre", hadeeths_count: '187', parent_id: null },
  { id: '10', title: 'Tafsir (die Erläuterung des Quran)', hadeeths_count: '9', parent_id: '1' },
  { id: '12', title: 'Die Vorzüge des Quran', hadeeths_count: '10', parent_id: '1' },
];

describe('Sprachabdeckung', () => {
  it('führt alle 14 App-Sprachen (live gegen /api/v1/languages geprüft)', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(isHadeethencLangAvailable(locale)).toBe(true);
      expect(hadeethencLang(locale)).toBe(locale);
    }
    expect(SUPPORTED_LOCALES).toHaveLength(14);
  });

  it('schließt genau die Lücke der bisherigen Hadith-Quelle (u. a. Deutsch)', () => {
    for (const locale of ['de', 'es', 'fa', 'ms', 'sw', 'ps'] as const) {
      expect(isHadeethencLangAvailable(locale)).toBe(true);
    }
  });
});

describe('parseCategories / Baumaufbau', () => {
  const cats = parseCategories(RAW_CATEGORIES);

  it('wandelt die String-Zähler der API in Zahlen', () => {
    expect(cats[0]).toEqual({
      id: '1',
      title: 'Der Quran und Quranwissenschaften',
      count: 22,
      parentId: null,
    });
  });

  it('macht aus einem kaputten Zähler 0 statt NaN', () => {
    const broken = parseCategories([{ id: '9', title: 'X', hadeeths_count: '', parent_id: null }]);
    expect(broken[0].count).toBe(0);
  });

  it('trennt Haupt- von Unterthemen', () => {
    expect(topLevelCategories(cats).map((c) => c.id)).toEqual(['1', '3']);
    expect(childCategories(cats, '1').map((c) => c.id)).toEqual(['10', '12']);
    expect(childCategories(cats, '3')).toEqual([]);
  });

  it('summiert die Gesamtzahl NUR über die Hauptthemen (Unterthemen sind darin enthalten)', () => {
    // 22 + 187 — würde man alle Kategorien summieren, käme 228 heraus und das
    // UI würde mehr Hadithe behaupten, als die Sprache wirklich hat.
    expect(hadeethencTotalCount(cats)).toBe(209);
  });
});

describe('parseListPage', () => {
  it('liest Einträge und Seitenzähler aus der Live-Antwortform', () => {
    const page = parseListPage({
      data: [
        { id: '66512', title: 'Der Islam wurde auf fünf (Säulen) gebaut' },
        { id: '66513', title: 'Wahrlich, die Schöpfung eines jeden von euch …' },
      ],
      meta: { current_page: '1', last_page: 63, total_items: 187 },
    });
    expect(page.items).toHaveLength(2);
    expect(page.items[0]).toEqual({ id: '66512', title: 'Der Islam wurde auf fünf (Säulen) gebaut' });
    expect(page).toMatchObject({ page: 1, lastPage: 63, total: 187 });
  });

  it('bleibt bei fehlenden Feldern auf einer gültigen leeren Seite', () => {
    const page = parseListPage({ data: [], meta: { current_page: '1', last_page: 1, total_items: 0 } });
    expect(page.items).toEqual([]);
    expect(page.lastPage).toBe(1);
  });
});

describe('parseHadeeth', () => {
  const RAW_DE = {
    id: '66512',
    title: '‚Der Islam wurde auf fünf (Säulen) gebaut',
    hadeeth: 'Von Abu ʿAbdir-Rahman … sagte: „Der Islam wurde auf fünf (Säulen) gebaut …"',
    hadeeth_ar: 'عَنْ أَبِي عَبْدِ الرَّحْمَنِ … «بُنِيَ الإِسْلَامُ عَلَى خَمْسٍ»',
    attribution: 'Muttafaqun alayh (Übereinstimmend bei al-Bukhari und Muslim verzeichnet)',
    grade: 'Authentischer Text',
    explanation: 'Der Prophet verglich den Islam mit einem soliden Gebäude …',
    hints: ['Die beiden Glaubensbekenntnisse gehören zusammen.\r', '', '  Grundlage der Religion.  '],
  };

  it('trennt Urtext und Übersetzung', () => {
    const h = parseHadeeth(RAW_DE, 'de');
    expect(h.arabic).toBe(RAW_DE.hadeeth_ar);
    expect(h.translation).toBe(RAW_DE.hadeeth);
    expect(h.grade).toBe('Authentischer Text');
    expect(h.attribution).toContain('al-Bukhari');
  });

  it('lässt die Übersetzung bei Arabisch leer, statt den Text doppelt zu zeigen', () => {
    const h = parseHadeeth({ ...RAW_DE, hadeeth: RAW_DE.hadeeth_ar }, 'ar');
    expect(h.arabic).toBe(RAW_DE.hadeeth_ar);
    expect(h.translation).toBe('');
  });

  it('erkennt auch ohne ar-Flag, wenn Übersetzung und Urtext identisch sind', () => {
    const h = parseHadeeth({ ...RAW_DE, hadeeth: RAW_DE.hadeeth_ar }, 'de');
    expect(h.translation).toBe('');
  });

  it('räumt Whitespace der Lehren auf und wirft leere Einträge raus', () => {
    const h = parseHadeeth(RAW_DE, 'de');
    expect(h.hints).toEqual([
      'Die beiden Glaubensbekenntnisse gehören zusammen.',
      'Grundlage der Religion.',
    ]);
  });

  it('verkraftet hints: null und fehlende optionale Felder', () => {
    const h = parseHadeeth({ id: '1', hadeeth_ar: 'نص', hints: null }, 'de');
    expect(h.hints).toEqual([]);
    expect(h.explanation).toBe('');
    expect(h.grade).toBe('');
    expect(h.title).toBe('');
  });

  it('fällt auf hadeeth zurück, wenn hadeeth_ar fehlt', () => {
    const h = parseHadeeth({ id: '1', hadeeth: 'Nur Übersetzung' }, 'de');
    expect(h.arabic).toBe('Nur Übersetzung');
  });
});

describe('Pflicht-Quellennennung', () => {
  it('ist der vom Anbieter geforderte Eigenname', () => {
    // Die Nutzungsbedingungen verlangen die Nennung von "HadeethEnc.com".
    // Eine Umbenennung/Lokalisierung wäre ein Lizenzverstoß.
    expect(HADEETHENC_ATTRIBUTION).toBe('HadeethEnc.com');
  });
});
