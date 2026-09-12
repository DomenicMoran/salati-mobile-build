import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Regressionsschutz fuer den Fund vom 05.09.2026: scripts/release-notes.mjs
 * hat frueher fuer jede Store-Sprache OHNE eigenen Changelog-Text (tr, ar,
 * es-ES, es-MX, fr-FR) den ENGLISCHEN Text unter der fremden Sprachkennung
 * abgelegt (z. B. "tr-TR": "<englischer Text>"). Store-Eintraege
 * ueberspringen unbekannte Locales beim Einreichen, weshalb sich das nie
 * ausgewirkt hat — faellt aber sofort auf, sobald eine dieser Sprachen im
 * Store-Eintrag angelegt wird (tuerkische/arabische Nutzer saehen dann
 * englische Versionshinweise unter ihrer eigenen Sprachkennung). Das Skript
 * ist inzwischen so geaendert, dass es fuer eine Sprache ohne eigenen Text
 * gar keinen Eintrag mehr erzeugt (Apple/Google fallen dann auf die
 * Standardsprache zurueck) — dieser Test soll verhindern, dass die alte
 * Falle (oder eine handgepflegte Datei mit demselben Fehler) zurueckkehrt.
 *
 * Geprueft werden ALLE Store-Textdateien in store/ — auch die der laengst
 * eingereichten frueheren Versionen. Diese Archive liefern nichts mehr aus,
 * aber sie sind die Dokumentation vergangener Auslieferungen: stuende dort
 * weiter englischer Text unter "tr-TR"/"ar"/"es-ES"/"fr-FR", fuehrte jeder
 * spaetere Blick ins Archiv in die Irre ("wir hatten doch tuerkische
 * Versionshinweise"). Am 06.09.2026 wurden die 15 betroffenen Archivdateien
 * (release-notes/whatsnew 1.32.0-1.35.0, 1.44.0, 1.49.0, 1.49.1, 1.50.0)
 * entsprechend bereinigt: die falsch beschrifteten Kopien des englischen
 * Texts sind entfernt, die echten Handuebersetzungen anderer Fassungen
 * (z. B. release-notes-1.45.0 bis 1.47.0, whatsnew-1.49.1, alle
 * play-notes-*) blieben unangetastet.
 *
 * Erkennungsmethode uebernommen aus dem bereits vorhandenen, geschaerften
 * Muster in src/lib/locales-quality.test.ts (GERMAN_MARKER) und
 * src/features/lexikon/data/erklaerungen/sprachparitaet.test.ts
 * (hatDeutscheSpuren/DEUTSCH_SPRACH_MARKER): Fuer Sprachen mit eigener,
 * klar unterscheidbarer Schrift (Arabisch/Persisch/Urdu/Paschtu, Kyrillisch,
 * Bengali) zaehlt das voellige Fehlen dieser Schrift als starkes
 * Einzelsignal. Fuer lateinschriftliche Zielsprachen zaehlt NICHT ein
 * einzelnes englisches Wort (zu viele legitime Kollisionen — siehe die
 * dokumentierte "des"-Falle im Franzoesischen in sprachparitaet.test.ts),
 * sondern erst das gleichzeitige Auftreten von MINDESTENS ZWEI
 * verschiedenen englischen Funktionswoertern im selben Feld.
 */

const ROOT = join(__dirname, '..', '..');
const STORE_DIR = join(ROOT, 'store');

function aktuelleVersion(): string {
  const config = readFileSync(join(ROOT, 'app.config.ts'), 'utf8');
  const v = /^const VERSION = '([^']+)'/m.exec(config)?.[1];
  if (!v) throw new Error('VERSION nicht in app.config.ts gefunden');
  return v;
}

function ladeStoreDatei(name: string): Record<string, string> | null {
  const pfad = join(STORE_DIR, name);
  if (!existsSync(pfad)) return null;
  return JSON.parse(readFileSync(pfad, 'utf8')) as Record<string, string>;
}

/** Sprachcode -> Zweibuchstaben-Sprache, wie sie in den Store-Dateien
 *  (release-notes-*.json, whatsnew-*.json, play-notes-*.json) tatsaechlich
 *  als Schluessel vorkommen. */
const LOCALE_LANG: Record<string, string> = {
  'de-DE': 'de',
  de: 'de',
  'en-US': 'en',
  'en-GB': 'en',
  en: 'en',
  'tr-TR': 'tr',
  tr: 'tr',
  'ar-SA': 'ar',
  ar: 'ar',
  'es-ES': 'es',
  'es-MX': 'es',
  es: 'es',
  'fr-FR': 'fr',
  fr: 'fr',
  'bn-BD': 'bn',
  bn: 'bn',
  fa: 'fa',
  id: 'id',
  ms: 'ms',
  'ru-RU': 'ru',
  ru: 'ru',
  sw: 'sw',
  'ur-PK': 'ur',
  ur: 'ur',
  ps: 'ps',
};

/** Sprachen mit eigener, von lateinischer Schrift klar unterscheidbarer
 *  Schrift: Fehlt diese Schrift in einem hinreichend langen Text komplett,
 *  steht dort mit hoher Sicherheit die falsche Sprache (z. B. englischer
 *  Fallback-Text unter "ar"). */
const SCRIPT_CHECK: Record<string, RegExp> = {
  ar: /[؀-ۿ]/,
  fa: /[؀-ۿ]/,
  ur: /[؀-ۿ]/,
  ps: /[؀-ۿ]/,
  ru: /[Ѐ-ӿ]/,
  bn: /[ঀ-৿]/,
};

/** Englische Funktionswoerter fuer die Zwei-Marker-Erkennung in
 *  lateinschriftlichen Zielsprachen (tr, es, fr, id, ms, sw). Bewusst OHNE
 *  kurze/mehrdeutige Woerter wie "is"/"in"/"an"/"man" — dieselbe Lehre wie
 *  bei "des" im Franzoesischen (sprachparitaet.test.ts): ein einzelnes,
 *  in der Zielsprache zufaellig ebenfalls vorkommendes Wort darf nicht
 *  ausreichen.
 */
const ENGLISH_MARKER_WORDS = [
  'the', 'and', 'with', 'from', 'this', 'that', 'are', 'you', 'your',
  'will', 'when', 'now', 'also', 'not', 'have', 'has', 'was', 'were',
  'their', 'they', 'instead', 'plus', 'about',
];

/** Zaehlt, wie viele VERSCHIEDENE englische Funktionswoerter aus der Liste
 *  im Text vorkommen (Mehrfachtreffer desselben Worts zaehlen nur einmal). */
function zaehleEnglischeMarker(text: string): number {
  let anzahl = 0;
  for (const wort of ENGLISH_MARKER_WORDS) {
    if (new RegExp(`(^|[^a-zA-Z])${wort}([^a-zA-Z]|$)`, 'i').test(text)) anzahl++;
  }
  return anzahl;
}

/** Prueft ein Feld einer Nicht-Deutsch/Nicht-Englisch-Sprache auf eine
 *  offensichtlich falsche Sprache. Gibt bei einem Befund eine Begruendung
 *  zurueck, sonst null.
 *
 *  Beide Kriterien laufen IMMER, nicht nur je nach Sprachtyp: Der Fund vom
 *  05.09.2026 enthielt im "ar"-Feld englischen Fliesstext, der als
 *  Beispiel ein einzelnes arabisches Wort in Anfuehrungszeichen zitierte
 *  ("in Arabic „الفاتحة" instead of „The Opening"") — der reine
 *  Schrift-Test allein haette das faelschlich als "enthaelt arabische
 *  Schrift, also OK" durchgehen lassen. Der Marker-Test faengt genau diesen
 *  Fall zusaetzlich ab. */
function falscheSprache(lang: string, text: string): string | null {
  if (text.trim().length < 20) return null; // zu kurz fuer ein verlaessliches Urteil

  const skript = SCRIPT_CHECK[lang];
  if (skript && !skript.test(text)) {
    return `enthaelt kein einziges Zeichen der fuer "${lang}" erwarteten Schrift`;
  }
  if (zaehleEnglischeMarker(text) >= 2) {
    return 'enthaelt mindestens zwei englische Funktionswoerter (vermutlich unuebersetzter englischer Text)';
  }
  return null;
}

const version = aktuelleVersion();

/** Alle Store-Textdateien, aktuelle Version wie Archiv. Die aktuelle Version
 *  wird zusaetzlich explizit erwartet, damit ein Tippfehler im Dateinamen
 *  nicht als "nichts zu pruefen" durchgeht. */
const GEPRUEFTE_DATEIEN = readdirSync(STORE_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort();

describe('Store-Texte (alle Fassungen): Sprachkennung passt zum Text', () => {
  it(`enthaelt die Dateien der aktuellen Version ${version}`, () => {
    expect(GEPRUEFTE_DATEIEN).toContain(`whatsnew-${version}.json`);
    expect(GEPRUEFTE_DATEIEN).toContain(`play-notes-${version}.json`);
  });

  for (const datei of GEPRUEFTE_DATEIEN) {
    const inhalt = ladeStoreDatei(datei);
    if (!inhalt) {
      it.skip(`${datei} existiert nicht`, () => {});
      continue;
    }

    for (const [locale, text] of Object.entries(inhalt)) {
      const lang = LOCALE_LANG[locale];
      if (!lang) {
        it(`${datei}: Sprachcode "${locale}" ist bekannt (LOCALE_LANG ergaenzen)`, () => {
          expect(lang).toBeDefined();
        });
        continue;
      }
      if (lang === 'de' || lang === 'en') continue; // Referenzsprachen, nichts zu pruefen

      it(`${datei}: "${locale}" ist tatsaechlich ${lang}, nicht Englisch/falsche Schrift`, () => {
        expect(falscheSprache(lang, text)).toBeNull();
      });
    }
  }
});

/**
 * Test der Erkennungsfunktion selbst — nicht der Datendateien. Stellt sicher,
 * dass die Erkennung bei genau dem Fehler anschlaegt, der am 05.09.2026
 * gefunden wurde (englischer Text unter fremder Sprachkennung), und bei
 * echten Uebersetzungen sowie zu kurzen Feldern still bleibt.
 */
describe('falscheSprache (Erkennungsfunktion)', () => {
  const englischerText =
    'The lexicon is now complete and this update also fixes a display issue when you open the compass.';

  it('schlaegt an, wenn englischer Text unter einer lateinschriftlichen Fremdsprachen-Kennung steht (z. B. "tr")', () => {
    expect(falscheSprache('tr', englischerText)).not.toBeNull();
  });

  it('schlaegt an, wenn englischer Text unter einer Schrift-Sprachen-Kennung steht (z. B. "ar", keine arabische Schrift)', () => {
    expect(falscheSprache('ar', englischerText)).not.toBeNull();
  });

  it('schlaegt an, wenn englischer Text unter "ar" steht, der EIN einzelnes arabisches Wort zitiert (echter Fund vom 05.09.2026 — reiner Schrift-Test allein haette das uebersehen)', () => {
    const englischMitArabischemZitat =
      'The names of all 114 Quran surahs now appear in their own language — in Arabic “الفاتحة” instead of “The Opening”, and this is now fixed for every language.';
    expect(falscheSprache('ar', englischMitArabischemZitat)).not.toBeNull();
  });

  it('schlaegt NICHT an bei einer echten tuerkischen Uebersetzung', () => {
    const tuerkisch =
      'Sözlük artık tam: 150 form tablosu, 494 girişli 17 kelime listesi ve belagat için 18 karşılaştırma tablosu.';
    expect(falscheSprache('tr', tuerkisch)).toBeNull();
  });

  it('schlaegt NICHT an bei einer echten arabischen Uebersetzung', () => {
    const arabisch =
      'المعجم مكتمل الآن: 150 جدول تصريف، 17 قائمة كلمات بها 494 مدخلاً، و18 جدول مقارنة بلاغية.';
    expect(falscheSprache('ar', arabisch)).toBeNull();
  });

  it('schlaegt NICHT an bei einer echten franzoesischen Uebersetzung (Franzoesisch nutzt "des" haeufig, kein Fehlalarm)', () => {
    const franzoesisch =
      "Le lexique est désormais complet : 150 tableaux de formes, 17 listes de mots avec 494 entrées et 18 tableaux comparatifs de rhétorique, le tout en 14 langues.";
    expect(falscheSprache('fr', franzoesisch)).toBeNull();
  });

  it('schlaegt NICHT an, wenn nur EIN englisches Funktionswort zufaellig vorkommt (Trennschaerfe durch Zwei-Marker-Schwelle)', () => {
    const einWortTreffer = 'Yeni Sözlük artık tam ve now çalışıyor, tüm dillerde.';
    expect(zaehleEnglischeMarker(einWortTreffer)).toBeLessThan(2);
    expect(falscheSprache('tr', einWortTreffer)).toBeNull();
  });

  it('ignoriert sehr kurze Felder (kein verlaessliches Urteil moeglich)', () => {
    expect(falscheSprache('tr', 'OK')).toBeNull();
    expect(falscheSprache('ar', 'Neu')).toBeNull();
  });
});
