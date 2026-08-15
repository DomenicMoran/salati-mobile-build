// Klassifikations-Datensatz für den Halal/Haram-Barcode-Scanner (Task #57).
//
// Alle Kategorien bilden allgemein bekannte, nicht schutzfähige Fakten der
// islamischen Ernährungslehre ab (Alkohol, Schwein, Gelatine-Herkunft,
// tierisches Lab, E120/E471/E920 etc. sind Lehrbuchwissen, keine Quelle
// wurde kopiert oder übersetzt — Formulierungen + Keyword-Listen sind
// eigenständig für diesen Scanner erstellt). Die Beschreibungstexte selbst
// liegen als eigene i18n-Keys unter "scanner.reasons.*" in den 6
// Sprachdateien (src/locales/*.json), damit sie durch dieselbe
// translate()-Pipeline laufen wie der Rest der App.
//
// WICHTIG: Dies ist bewusst eine Orientierungshilfe auf Basis von
// Keyword-Matching gegen öffentliche Zutatendaten (Open Food Facts) — keine
// zertifizierte Halal-Prüfung. Siehe Disclaimer im Scanner-Screen.

export type HalalStatus = 'halal' | 'haram' | 'mashbooh' | 'unknown';

export interface ClassificationCategory {
  /** Stabiler Key, referenziert scanner.reasons.<id> in den Locale-Dateien. */
  id: string;
  status: 'haram' | 'mashbooh';
  /**
   * Keywords als vollständige Wörter/Phrasen (kleingeschrieben, Zahlen und
   * Buchstaben, Leerzeichen als Wort-Trenner). Mehrwort-Phrasen werden als
   * zusammenhängende Token-Sequenz gematcht (siehe matcher.ts) — bewusst KEIN
   * reines Substring-Matching, sonst false positives wie "porcini" (Pilz)
   * gegen die Wurzel "porc" oder "label" gegen "lab". Deutsche
   * Komposita (z. B. "schweinegelatine") werden deshalb als eigene,
   * ausgeschriebene Keywords geführt statt als kurzer Wortstamm.
   */
  keywords: string[];
}

export const CLASSIFICATION_CATEGORIES: ClassificationCategory[] = [
  // --- Haram (eindeutig) ---------------------------------------------
  {
    id: 'alcohol',
    status: 'haram',
    keywords: [
      // generische Begriffe
      'alcohol',
      'alkohol',
      'ethanol',
      'ethylalkohol',
      'äthylalkohol',
      'etil alkol',
      'alkol',
      'alcool',
      'alcool ethylique',
      'alcool éthylique',
      'كحول',
      'ethyl alcohol',
      'grain alcohol',
      'spiritus',
      'spirit',
      'spirits',
      // alkoholische Getränke als Zutat/Trägerstoff
      'wine',
      'wein',
      'vin',
      'vino',
      'şarap',
      'beer',
      'bier',
      'biere',
      'bière',
      'cerveza',
      'rum',
      'rhum',
      'ron',
      'whisky',
      'whiskey',
      'vodka',
      'gin',
      'brandy',
      'cognac',
      'liqueur',
      'likör',
      'licor',
      'sherry',
      'port wine',
      'portwein',
      'sake',
      'kirschwasser',
      'rum aroma',
      'weinbrand',
    ],
  },
  {
    id: 'pork',
    status: 'haram',
    keywords: [
      'pork',
      'porc',
      'porco',
      'cerdo',
      'domuz',
      'domuz eti',
      'schwein',
      'schweine',
      'schweinefleisch',
      'schweineschmalz',
      'schweinespeck',
      'schweinefett',
      'schweinegelatine',
      'schweinelab',
      'schweinelabferment',
      'schweineenzym',
      'schweinehack',
      'swine',
      'hog',
      'pig',
      'piglet',
      'lard',
      'schmalz',
      'saindoux',
      'manteca de cerdo',
      'domuz yağı',
      'speck',
      'bacon',
      'schinken',
      'ham',
      'jambon',
      'jamón',
      'jamon',
      'prosciutto',
      'pork gelatin',
      'pork gelatine',
      'gélatine de porc',
      'gelatine de porc',
      'gelatina de cerdo',
      'domuz jelatini',
      'pork rennet',
      'pork enzyme',
      'porcine enzyme',
      'porcine gelatin',
      'porcine',
      'présure de porc',
      'presure de porc',
      'cuajo de cerdo',
      'domuz peynir mayası',
      'خنزير',
      'لحم خنزير',
    ],
  },

  // --- Mashbooh (fraglich, quellenabhängig) ---------------------------
  {
    id: 'gelatinUnknownOrigin',
    status: 'mashbooh',
    keywords: [
      'gelatin',
      'gelatine',
      'gélatine',
      'jelatin',
      'gelatina',
      'جيلاتين',
      // Wenn zusätzlich "schwein"/"pork"/etc. im Text steht, gewinnt die
      // haram-Kategorie 'pork' ohnehin (siehe matcher.ts Prioritätslogik) —
      // dieser Eintrag deckt daher nur Gelatine OHNE Ursprungsangabe ab.
    ],
  },
  {
    id: 'animalRennetUnknown',
    status: 'mashbooh',
    keywords: [
      'rennet',
      'animal rennet',
      'presure',
      'présure',
      'presure animale',
      'labferment',
      'kälberlab',
      'kalbslab',
      'tierisches lab',
      'lab (tierisch)',
      'cuajo animal',
      'cuajo',
      'peynir mayası',
      'hayvansal peynir mayası',
      'منفحة',
    ],
  },
  {
    id: 'carmine',
    status: 'mashbooh',
    keywords: [
      'carmine',
      'karmin',
      'cochineal',
      'cochenille',
      'e120',
      'e 120',
      'kırmız böceği',
      'koşenil',
      'قرمز',
    ],
  },
  {
    id: 'lCysteine',
    status: 'mashbooh',
    keywords: [
      'l-cysteine',
      'l-cystein',
      'lcysteine',
      'l cystein',
      'l cysteine',
      'cysteine',
      'cystein',
      'cystéine',
      'cisteína',
      'cisteina',
      'e920',
      'e 920',
      'l-sistein',
      'سيستئين',
    ],
  },
  {
    id: 'monoDiglycerides',
    status: 'mashbooh',
    keywords: [
      'mono- and diglycerides',
      'mono and diglycerides',
      'mono- und diglyceride',
      'mono und diglyceride',
      'monoglyceride',
      'diglyceride',
      'mono- et diglycerides',
      'mono et diglycerides',
      'mono y diglicéridos',
      'mono y digliceridos',
      'mono ve digliseritler',
      'e471',
      'e 471',
    ],
  },
  {
    id: 'vanillaExtractAlcohol',
    status: 'mashbooh',
    keywords: [
      'vanilla extract',
      'vanilleextrakt',
      'vanille-extrakt',
      'extrait de vanille',
      'extracto de vainilla',
      'vanilya özütü',
      'vanilya ekstresi',
      'خلاصة الفانيليا',
    ],
  },
];

/**
 * Erkennt einen ausdrücklichen "halal-zertifiziert"-Hinweis im Zutatentext.
 * Trifft dieser Marker zu (und keine Haram-Kategorie), gilt das Produkt als
 * halal, auch wenn eine der Mashbooh-Kategorien ebenfalls anschlägt — die
 * Zertifizierung beantwortet genau den Zweifel, den Mashbooh sonst offen lässt.
 */
export const HALAL_CERTIFIED_KEYWORDS: string[] = [
  'halal certified',
  'halal-certified',
  'halal zertifiziert',
  'halal-zertifiziert',
  'certifié halal',
  'certifie halal',
  'certificado halal',
  'helal sertifikalı',
  'helal sertifikali',
  'معتمد حلال',
  'حلال معتمد',
];
