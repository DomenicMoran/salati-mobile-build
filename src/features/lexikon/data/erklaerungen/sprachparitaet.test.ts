import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Sprachparität der Lehrtext-Erklärungen im Grammatik-Lexikon.
 *
 * Jede Sprachfassung (en-*.json, künftig weitere) muss strukturell und inhaltlich
 * mit der deutschen Referenzfassung (de-*.json) desselben Bereichs übereinstimmen:
 * gleiche Eintrags-Schlüssel, gleiche Koranstellen in gleicher Reihenfolge, gleiche
 * Anzahl Absätze/Merkmale/Lernhinweise (sonst geht beim Übersetzen still Information
 * verloren), byte-identisches Arabisch/Umschrift (Sprache ändert weder den arabischen
 * Fachbegriff noch seine wissenschaftliche Umschrift), und kein Feld darf leer oder
 * unübersetzt auf Deutsch stehen geblieben sein.
 *
 * Diese Datei findet alle vorhandenen Sprachdateien automatisch über den Dateinamen
 * (`<lang>-<bereich>.json`) — eine später hinzugefügte Sprache wird ohne Änderung an
 * diesem Test automatisch mitgeprüft, solange sie diesem Namensschema folgt.
 */

interface Beleg {
  sure: number;
  vers: number;
  wort: number;
  zeigt: string;
  warum: string;
}

interface Eintrag {
  titel: string;
  ar: string;
  umschrift: string;
  erklaerung: string[];
  erkennung: string[];
  belege: Beleg[];
  lernen: string[];
  tabellen: string[];
  siehe: string[];
}

interface ErklaerungenDatei {
  schema: number;
  lang: string;
  bereich: string;
  eintraege: Record<string, Eintrag>;
}

const VERZEICHNIS = __dirname;
// Sprachcode: 2-4 Kleinbuchstaben (de, en, künftig z. B. tr, ur ...).
const DATEINAME_MUSTER = /^([a-z]{2,4})-(nomen|verb|partikel-syntax)\.json$/;

interface DateiInfo {
  datei: string;
  lang: string;
  bereich: string;
}

const gefundeneDateien: DateiInfo[] = readdirSync(VERZEICHNIS)
  .filter((f) => DATEINAME_MUSTER.test(f))
  .map((datei) => {
    const match = DATEINAME_MUSTER.exec(datei)!;
    return { datei, lang: match[1], bereich: match[2] };
  });

const bereiche = Array.from(new Set(gefundeneDateien.map((d) => d.bereich))).sort();

function ladeDatei(datei: string): ErklaerungenDatei {
  return JSON.parse(readFileSync(join(VERZEICHNIS, datei), 'utf8')) as ErklaerungenDatei;
}

/** Klassische Mojibake-Muster (UTF-8 als Latin-1 gelesen) und Steuerzeichen. */
const MOJIBAKE = /Ã[¤¶¼]|â€[žœ“]|ï»¿/;
const CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1f]/;
/** "ß" kommt in keiner Zielsprache dieses Lexikons vor und ist deshalb fuer
 *  sich allein schon ein verlaessliches Signal fuer stehengebliebenen
 *  deutschen Text. ä/ö/ü sind dagegen KEIN eigenstaendiges Signal: Sie sind
 *  z. B. im Tuerkischen reguleare Buchstaben (mef'ûlün, müzekker, çoğul) —
 *  auf sie allein gestuetzt erzeugte die Erkennung frueher hunderte
 *  Fehlalarme in den tuerkischen Dateien.
 */
const SHARP_S = /ß/;
/** Deutsche Funktionswoerter als GANZE Woerter — stehen sie unveraendert (und
 *  exakt gleich wie im Deutschen) in einer Fremdsprachen-Datei, ist der Text
 *  nicht uebersetzt worden. Ansatz uebernommen aus
 *  src/lib/locales-quality.test.ts (dort GERMAN_MARKER).
 *
 *  WICHTIG — "des" wurde aus dieser Liste ENTFERNT: Es ist im Franzoesischen
 *  ein gewoehnliches, unvermeidbares Funktionswort (Teilungs-/Pluralartikel,
 *  z. B. "l'une des trois classes de mots"). Mit "des" in der Liste hat die
 *  Erkennung frueher gut 130 Stellen in den franzoesischen Dateien als
 *  angeblichen deutschen Rest gemeldet, obwohl der Text korrekt und
 *  idiomatisch war — ein Fehlalarm derselben Art wie das tuerkische ö/ü
 *  weiter oben, nur bei einem ganzen Wort statt bei Umlauten.
 *
 *  Statt jedes theoretisch denkbare Kollisionswort einzeln zu entfernen
 *  (Kandidaten mit lateinischer Schreibung: z. B. engl. "man"/"die"/"den" —
 *  in den 14 Zielsprachen dieses Lexikons aktuell kein einziges Mal als
 *  echtes Wort belegt, siehe _check_collisions.js-Lauf), erhoeht
 *  hatDeutscheSpuren unten die Trennschaerfe strukturell: Ein EINZELNES
 *  Markerwort reicht nicht mehr aus, es muessen mindestens ZWEI
 *  VERSCHIEDENE Markerwoerter im selben Feld vorkommen. Ein echter
 *  stehengebliebener deutscher Satz enthaelt so gut wie immer mehrere
 *  dieser Woerter gleichzeitig (Artikel + Verb, Praeposition + Pronomen
 *  usw.), eine korrekte fremdsprachige Formulierung mit einem zufaelligen
 *  Treffer so gut wie nie zwei. */
const GERMAN_MARKER_WORD_LIST = [
  'und', 'oder', 'der', 'die', 'das', 'den', 'dem', 'ein', 'eine', 'einen',
  'einer', 'nicht', 'mit', 'für', 'von', 'auf', 'bei', 'zum', 'zur', 'beim',
  'deine', 'deinen', 'wenn', 'wird', 'werden', 'kann', 'kannst', 'muss',
  'sind', 'ist', 'auch', 'noch', 'sich', 'dass', 'diese', 'dieser', 'dieses',
  'welche', 'welcher', 'welches', 'man', 'sehr', 'schon', 'beide', 'durch',
  'steht', 'zeigt', 'bedeutet',
];
const GERMAN_MARKER = new RegExp(`(^|\\s)(${GERMAN_MARKER_WORD_LIST.join('|')})(\\s|$)`, 'i');

/** Zaehlt, wie viele VERSCHIEDENE deutsche Funktionswoerter aus der Liste im
 *  Text vorkommen (Mehrfachtreffer desselben Worts zaehlen nur einmal). */
function zaehleVerschiedeneDeutscheMarker(text: string): number {
  let anzahl = 0;
  for (const wort of GERMAN_MARKER_WORD_LIST) {
    if (new RegExp(`(^|\\s)${wort}(\\s|$)`, 'i').test(text)) anzahl++;
  }
  return anzahl;
}

/** Enthaelt eindeutig deutsche Reste, unabhaengig vom Vergleichstext.
 *  Bewusst OHNE Umlaute als eigenstaendiges Kriterium (siehe SHARP_S oben) —
 *  "ß" allein zaehlt (starkes Einzelsignal, kommt in keiner Zielsprache vor),
 *  ein deutsches Funktionswort dagegen erst ab ZWEI verschiedenen Treffern
 *  im selben Feld (siehe Kommentar bei GERMAN_MARKER_WORD_LIST oben). */
function hatDeutscheSpuren(text: string): boolean {
  return SHARP_S.test(text) || zaehleVerschiedeneDeutscheMarker(text) >= 2;
}

/**
 * Inhaltlicher Qualitätsmangel, den die reine Struktur-/Kopie-Prüfung oben NICHT
 * findet: Lehrtexte, die mit dem DEUTSCHEN vergleichen ("im Deutschen gibt es
 * kein Neutrum", "anders als im Deutschen"), sind für deutschsprachige Lernende
 * sinnvoll, aber in einer Übersetzung unpassend — ein englisch-, türkisch- oder
 * arabischsprachiger Leser vergleicht nicht mit dem Deutschen. Der Vergleich ist
 * strukturell korrekt (gleiche Absatzzahl, kein "deutscher" Marker im Sinne von
 * hatDeutscheSpuren) und schlägt deshalb bei der Prüfung oben nicht an.
 *
 * Audit vom 2026-09-05: 27 Fundstellen im Deutschen identifiziert und in allen
 * 13 Fremdsprachen abgeglichen; 24 davon waren unpassend auf das Deutsche
 * stehen geblieben (ar: 17 - komplette Wortart-Vergleiche 1:1 mit "الألمانية"
 * übersetzt statt zielsprachengerecht angepasst; en/tr/fr/es/ru: je 1 im
 * genus-Eintrag; sw: 2 im verb-Eintrag) und wurden auf die Zielsprache
 * umgestellt (z. B. "as in German" → "as in English") oder verallgemeinert
 * (z. B. "كما في الألمانية" → "كما هو الحال في كثير من اللغات الأخرى"), analog
 * zur bereits vorhandenen Urdu-Lösung "anders als im Deutschen" → "anders als
 * in vielen anderen Sprachen". Diese Prüfung verhindert Rückfälle.
 *
 * Das Wort für "deutsch" ist in jeder Sprache anders - deshalb sprachspezifische
 * Marker statt eines einzigen Musters. Wortstämme (nicht exakte Wortformen),
 * damit gebeugte Formen (Genus, Kasus, Plural: "German"/"Germany"/"Germanic",
 * "allemand"/"allemande"/"Allemagne", "ألماني"/"الألمانية"/"ألمانيا" usw.)
 * mitgefunden werden. Lateinschrift-Sprachen zusätzlich mit Wortgrenze am
 * Anfang, damit keine zufällige Buchstabenfolge in einem unverwandten Wort
 * anschlägt; bei Suaheli bewusst OHNE Wortgrenze, weil "Jerumani" dort stets
 * als Suffix in einem zusammengeschriebenen Wort steht (Kijerumani, Ujerumani).
 */
const DEUTSCH_SPRACH_MARKER: Record<string, RegExp> = {
  en: /\bgerman/i,
  tr: /\balman/i,
  fr: /\ballema/i,
  es: /\balem[aá]n/i,
  ru: /немецк/i,
  id: /\bjerman/i,
  ms: /\bjerman/i,
  sw: /jerumani/i,
  fa: /آلمان/,
  ur: /جرمن/,
  ps: /جرمن/,
  bn: /জার্মান/,
  ar: /ألمان/,
};

/**
 * Dokumentierte Ausnahmeliste statt aufgeweichter Prüfung: Für den Fall, dass an
 * einer Stelle das Deutsche wirklich genannt werden MUSS (z. B. ein historischer
 * oder biografischer Bezug, der sich nicht verallgemeinern lässt), wird die
 * betroffene Stelle hier explizit und begründet eingetragen statt den Regex oben
 * abzuschwächen. Format: "<dateiname>::<eintrags-id>::<feldname[index]>".
 * Aktuell leer: Nach dem Audit vom 2026-09-05 ist jeder Treffer ein echter Fehler.
 */
const DEUTSCH_SPRACH_MARKER_AUSNAHMEN = new Set<string>([
  // Beispiel: 'en-nomen.json::ism::erklaerung[0]',
]);

/** Ist ein Feld 1:1 aus der deutschen Fassung uebernommen worden, obwohl es lang
 *  genug ist, um Fliesstext zu sein und deutsche Funktionswoerter enthaelt? */
function istUnuebersetzteKopie(fremd: string, de: string): boolean {
  return fremd === de && de.trim().length > 20 && GERMAN_MARKER.test(de);
}

describe('Sprachparität: gefundene Dateien', () => {
  it('findet mindestens eine deutsche Referenzdatei pro Bereich', () => {
    expect(bereiche.length).toBeGreaterThan(0);
    for (const bereich of bereiche) {
      const hatDe = gefundeneDateien.some((d) => d.bereich === bereich && d.lang === 'de');
      expect(hatDe).toBe(true);
    }
  });
});

for (const bereich of bereiche) {
  const deInfo = gefundeneDateien.find((d) => d.bereich === bereich && d.lang === 'de');
  if (!deInfo) continue; // bereits oben als Fehler erfasst

  const de = ladeDatei(deInfo.datei);
  const fremdsprachen = gefundeneDateien.filter((d) => d.bereich === bereich && d.lang !== 'de');

  for (const info of fremdsprachen) {
    describe(`${info.datei} — Parität gegen ${deInfo.datei}`, () => {
      const fremd = ladeDatei(info.datei);

      it('hat schema, lang und bereich korrekt gesetzt', () => {
        expect(fremd.schema).toBe(de.schema);
        expect(fremd.lang).toBe(info.lang);
        expect(fremd.bereich).toBe(de.bereich);
      });

      it('hat exakt dieselben Eintrags-Schlüssel wie die deutsche Fassung (keine fehlenden, keine zusätzlichen)', () => {
        expect(Object.keys(fremd.eintraege).sort()).toEqual(Object.keys(de.eintraege).sort());
      });

      for (const [id, deEintrag] of Object.entries(de.eintraege)) {
        const fremdEintrag = fremd.eintraege[id];

        describe(`Eintrag "${id}"`, () => {
          it('existiert in dieser Sprachfassung', () => {
            expect(fremdEintrag).toBeDefined();
          });
          if (!fremdEintrag) return;

          it('"ar" ist byte-identisch zur deutschen Fassung (NFC-normalisiert)', () => {
            expect(fremdEintrag.ar.normalize('NFC')).toBe(deEintrag.ar.normalize('NFC'));
          });

          it('"umschrift" ist byte-identisch zur deutschen Fassung (NFC-normalisiert)', () => {
            expect(fremdEintrag.umschrift.normalize('NFC')).toBe(deEintrag.umschrift.normalize('NFC'));
          });

          it('"tabellen" ist identisch zur deutschen Fassung (IDs, sprachunabhängig)', () => {
            expect(fremdEintrag.tabellen).toEqual(deEintrag.tabellen);
          });

          it('"siehe" ist identisch zur deutschen Fassung (IDs, sprachunabhängig)', () => {
            expect(fremdEintrag.siehe).toEqual(deEintrag.siehe);
          });

          it('hat dieselbe Anzahl erklaerung-Absätze wie die deutsche Fassung', () => {
            expect(fremdEintrag.erklaerung.length).toBe(deEintrag.erklaerung.length);
          });

          it('hat dieselbe Anzahl erkennung-Merkmale wie die deutsche Fassung', () => {
            expect(fremdEintrag.erkennung.length).toBe(deEintrag.erkennung.length);
          });

          it('hat dieselbe Anzahl lernen-Hinweise wie die deutsche Fassung', () => {
            expect(fremdEintrag.lernen.length).toBe(deEintrag.lernen.length);
          });

          it('hat dieselbe Anzahl Belege in gleicher Reihenfolge mit identischen sure/vers/wort', () => {
            expect(fremdEintrag.belege.length).toBe(deEintrag.belege.length);
            const laenge = Math.min(fremdEintrag.belege.length, deEintrag.belege.length);
            for (let i = 0; i < laenge; i++) {
              expect(fremdEintrag.belege[i].sure).toBe(deEintrag.belege[i].sure);
              expect(fremdEintrag.belege[i].vers).toBe(deEintrag.belege[i].vers);
              expect(fremdEintrag.belege[i].wort).toBe(deEintrag.belege[i].wort);
            }
          });

          it('kein Feld ist leer oder kaputt kodiert', () => {
            const alleTexte = [
              fremdEintrag.titel,
              ...fremdEintrag.erklaerung,
              ...fremdEintrag.erkennung,
              ...fremdEintrag.lernen,
              ...fremdEintrag.belege.map((b) => b.zeigt),
              ...fremdEintrag.belege.map((b) => b.warum),
            ];
            for (const text of alleTexte) {
              expect(text.trim().length).toBeGreaterThan(0);
              expect(text.includes('�')).toBe(false);
              expect(MOJIBAKE.test(text)).toBe(false);
              expect(CONTROL.test(text)).toBe(false);
            }
          });

          it('titel enthält keine deutschen Spuren (ß oder Funktionswort, unübersetzter Rest)', () => {
            expect(hatDeutscheSpuren(fremdEintrag.titel)).toBe(false);
          });

          it('erklaerung enthält keine deutschen Spuren (ß oder Funktionswort, unübersetzter Rest)', () => {
            const treffer = fremdEintrag.erklaerung.filter(hatDeutscheSpuren);
            expect(treffer).toEqual([]);
          });

          it('erkennung enthält keine deutschen Spuren (ß oder Funktionswort, unübersetzter Rest)', () => {
            const treffer = fremdEintrag.erkennung.filter(hatDeutscheSpuren);
            expect(treffer).toEqual([]);
          });

          it('lernen enthält keine deutschen Spuren (ß oder Funktionswort, unübersetzter Rest)', () => {
            const treffer = fremdEintrag.lernen.filter(hatDeutscheSpuren);
            expect(treffer).toEqual([]);
          });

          it('belege[].zeigt/warum enthalten keine deutschen Spuren (ß oder Funktionswort, unübersetzter Rest)', () => {
            for (const beleg of fremdEintrag.belege) {
              expect(hatDeutscheSpuren(beleg.zeigt)).toBe(false);
              expect(hatDeutscheSpuren(beleg.warum)).toBe(false);
            }
          });

          it('kein Absatz/Merkmal/Hinweis ist 1:1 unübersetzt aus dem Deutschen übernommen', () => {
            const laengeErklaerung = Math.min(fremdEintrag.erklaerung.length, deEintrag.erklaerung.length);
            for (let i = 0; i < laengeErklaerung; i++) {
              expect(istUnuebersetzteKopie(fremdEintrag.erklaerung[i], deEintrag.erklaerung[i])).toBe(false);
            }
            const laengeErkennung = Math.min(fremdEintrag.erkennung.length, deEintrag.erkennung.length);
            for (let i = 0; i < laengeErkennung; i++) {
              expect(istUnuebersetzteKopie(fremdEintrag.erkennung[i], deEintrag.erkennung[i])).toBe(false);
            }
            const laengeLernen = Math.min(fremdEintrag.lernen.length, deEintrag.lernen.length);
            for (let i = 0; i < laengeLernen; i++) {
              expect(istUnuebersetzteKopie(fremdEintrag.lernen[i], deEintrag.lernen[i])).toBe(false);
            }
            expect(istUnuebersetzteKopie(fremdEintrag.titel, deEintrag.titel)).toBe(false);
          });

          it('kein Beleg-Text (zeigt/warum) ist 1:1 unübersetzt aus dem Deutschen übernommen', () => {
            const laenge = Math.min(fremdEintrag.belege.length, deEintrag.belege.length);
            for (let i = 0; i < laenge; i++) {
              expect(istUnuebersetzteKopie(fremdEintrag.belege[i].zeigt, deEintrag.belege[i].zeigt)).toBe(false);
              expect(istUnuebersetzteKopie(fremdEintrag.belege[i].warum, deEintrag.belege[i].warum)).toBe(false);
            }
          });

          it('vergleicht nicht mit dem Deutschen als Fremdsprache (Vergleich muss zielsprachengerecht sein oder verallgemeinert werden)', () => {
            const marker = DEUTSCH_SPRACH_MARKER[info.lang];
            if (!marker) return; // Sprache ohne definierten Marker sollte hier nicht auftreten

            const felder: [string, string][] = [
              ['titel', fremdEintrag.titel],
              ...fremdEintrag.erklaerung.map((t, i): [string, string] => [`erklaerung[${i}]`, t]),
              ...fremdEintrag.erkennung.map((t, i): [string, string] => [`erkennung[${i}]`, t]),
              ...fremdEintrag.lernen.map((t, i): [string, string] => [`lernen[${i}]`, t]),
              ...fremdEintrag.belege.map((b, i): [string, string] => [`belege[${i}].zeigt`, b.zeigt]),
              ...fremdEintrag.belege.map((b, i): [string, string] => [`belege[${i}].warum`, b.warum]),
            ];

            const treffer = felder
              .filter(([feld]) => !DEUTSCH_SPRACH_MARKER_AUSNAHMEN.has(`${info.datei}::${id}::${feld}`))
              .filter(([, text]) => marker.test(text))
              .map(([feld]) => feld);

            expect(treffer).toEqual([]);
          });
        });
      }
    });
  }
}

/**
 * Test der Erkennungsfunktion selbst — nicht der Datendateien. Stellt sicher,
 * dass die Erkennung bei echtem, unuebersetztem deutschem Text weiterhin
 * anschlaegt, und dass sie bei regulaeren tuerkischen Woertern mit ö/ü (die
 * frueher die 349 Fehlalarme ausgeloest haben) still bleibt.
 */
describe('hatDeutscheSpuren (Erkennungsfunktion)', () => {
  it('schlägt bei einem stehengebliebenen deutschen Satz an', () => {
    const stehengebliebenerDeutscherSatz =
      'Der zweite Wurzelbuchstabe wird hier nicht getrennt, sondern verschmilzt mit dem dritten.';
    expect(hatDeutscheSpuren(stehengebliebenerDeutscherSatz)).toBe(true);
  });

  it('schlägt bei "ß" allein an (kommt in keiner Zielsprache dieses Lexikons vor)', () => {
    expect(hatDeutscheSpuren('Straße')).toBe(true);
    expect(hatDeutscheSpuren('außerdem')).toBe(true);
  });

  it('schlägt NICHT bei regulären türkischen Wörtern mit ö/ü an (kein Übersetzungsfehler)', () => {
    expect(hatDeutscheSpuren("mef'ûlün")).toBe(false);
    expect(hatDeutscheSpuren('müzekker')).toBe(false);
    expect(hatDeutscheSpuren('çoğul')).toBe(false);
    expect(hatDeutscheSpuren('İkiz harfli fiil (Muzâaf)')).toBe(false);
  });

  it('schlägt NICHT bei arabischer oder türkischer Fliesstext-Erklärung ohne deutsche Funktionswörter an', () => {
    const tuerkischerAbsatz =
      'Bu birleşme her yerde gerçekleşmez: Ünsüzle başlayan şahıs eklerinden önce iki harf ayrı kalır.';
    expect(hatDeutscheSpuren(tuerkischerAbsatz)).toBe(false);
  });

  it('schlägt NICHT bei einem echten französischen Satz mit "des" an (Teilungs-/Pluralartikel, kein deutscher Rest)', () => {
    const franzoesischerSatz =
      "Ism est l'une des trois classes de mots de l'arabe, à côté du verbe (fiʿl) et de la particule (harf).";
    expect(hatDeutscheSpuren(franzoesischerSatz)).toBe(false);
  });

  it('schlägt weiterhin an, wenn ein einzelnes Feld mehrere verschiedene deutsche Funktionswörter enthält (auch wenn "des" fehlt)', () => {
    const restSatzOhneDes =
      'Man erkennt dies daran, dass der Satz nicht vollständig übersetzt wurde und noch mit deutschen Wörtern durchsetzt ist.';
    expect(hatDeutscheSpuren(restSatzOhneDes)).toBe(true);
  });

  it('schlägt NICHT an, wenn nur EIN deutsches Funktionswort zufällig als Fremdwort vorkommt (Trennschärfe durch Zwei-Marker-Schwelle)', () => {
    // "man" ist ein gewöhnliches englisches Wort (Mensch/Mann) - hier als
    // einziger zufälliger Treffer aus der Markerliste in einem ansonsten
    // unauffälligen englischen Satz.
    expect(hatDeutscheSpuren('Every man learns this pattern eventually.')).toBe(false);
  });
});

/**
 * Test der sprachspezifischen Deutschland/Deutsch-Erkennung selbst - nicht der
 * Datendateien. Stellt sicher, dass jeder Sprachmarker bei einem echten
 * Deutschland-Vergleich in DIESER Sprache anschlägt (inkl. gebeugter Formen),
 * und bei gewöhnlichem Text derselben Sprache still bleibt.
 */
describe('DEUTSCH_SPRACH_MARKER (Erkennungsfunktion je Sprache)', () => {
  it('erkennt gebeugte Formen von "deutsch/Deutschland" in jeder Zielsprache', () => {
    const beispiele: Record<string, string> = {
      en: 'There is no neuter as in German.',
      tr: 'Almancadaki gibi bir nötr cins yoktur.',
      fr: "il n'existe pas de neutre comme en allemand, ni en Allemagne.",
      es: 'no existe un neutro como en alemán, ni en Alemania.',
      ru: 'среднего рода, как в немецком языке, не существует.',
      id: 'seperti dalam bahasa Jerman.',
      ms: 'seperti dalam bahasa Jerman.',
      sw: 'Tofauti na Kijerumani, hii ni tofauti.',
      fa: 'برخلاف زبان آلمانی.',
      ur: 'جرمن زبان کے برعکس۔',
      ps: 'د جرمني ژبې برعکس.',
      bn: 'জার্মান ভাষার বিপরীতে।',
      ar: 'خلافًا للألمانية أو الإنجليزية.',
    };
    for (const [lang, text] of Object.entries(beispiele)) {
      expect(DEUTSCH_SPRACH_MARKER[lang].test(text)).toBe(true);
    }
  });

  it('schlägt NICHT bei gewöhnlichem Text derselben Sprache an (kein Fehlalarm)', () => {
    const beispiele: Record<string, string> = {
      en: 'There is no neuter as in English.',
      tr: 'Türkçedeki gibi bir nötr cins yoktur.',
      fr: 'il existe un genre neutre comme en français.',
      es: 'existe un género neutro como en español.',
      ru: 'среднего рода, как в русском, не существует.',
      id: 'seperti dalam bahasa Indonesia.',
      ms: 'seperti dalam bahasa Melayu.',
      sw: 'Kwa hiyo neno moja tu la kitenzi tayari ni sentensi kamili.',
      fa: 'به زبان فارسی.',
      ur: 'اردو زبان میں۔',
      ps: 'په پښتو ژبه کې.',
      bn: 'বাংলা ভাষায়।',
      ar: 'كما هو الحال في كثير من اللغات الأخرى.',
    };
    for (const [lang, text] of Object.entries(beispiele)) {
      expect(DEUTSCH_SPRACH_MARKER[lang].test(text)).toBe(false);
    }
  });
});

/**
 * Regression: de-verb.json, Eintrag "mudaaf" (verdoppeltes Verb) widersprach
 * sich frueher selbst — erklaerung[1] behauptete, يَرْتَدِدْ (Sure 2, Vers 217,
 * Wort 39, Form VIII, majzum) bleibe im Apokopat "ungetrennt", waehrend
 * erkennung/belege/lernen desselben Eintrags korrekt sagen, dass die beiden
 * gleichen Radikale dort GETRENNT werden (Idgham wird im Jazm aufgeloest,
 * sonst traefen zwei Sukun aufeinander).
 *
 * Korpusbeleg (apps/mobile/.daten-cache/out/morphologie/v<N>/2.json — aktuelle
 * Schemaversion, siehe MORPHOLOGIE_SCHEMA_VERSION —, Vers 217,
 * position 39): Text "يَرْتَدِدْ", segments[0].raw =
 * "STEM|POS:V|IMPF|(VIII)|LEM:{rotad~a|ROOT:rdd|3MS|MOOD:JUS" — das Wortbild
 * zeigt die beiden د-Radikale mit Kasra/Sukun GETRENNT, kein Schadda wie bei
 * der verschmolzenen Form رَدَّ.
 */
describe('de-verb.json: Eintrag "mudaaf" ist in sich widerspruchsfrei (يَرْتَدِدْ bleibt getrennt)', () => {
  const deVerb = ladeDatei('de-verb.json');
  const mudaaf = deVerb.eintraege.mudaaf;

  it('existiert im deutschen Original', () => {
    expect(mudaaf).toBeDefined();
  });

  it('erklaerung beschreibt يَرْتَدِدْ als GETRENNT, nicht als "ungetrennt"', () => {
    const absatz = mudaaf.erklaerung.find((p) => p.includes('يَرْتَدِدْ'));
    expect(absatz).toBeDefined();
    expect(absatz).toMatch(/ausnahmsweise getrennt/);
    expect(absatz).not.toMatch(/ausnahmsweise ungetrennt/);
  });

  it('lernen fordert, يَرْتَدِدْ bewusst getrennt auszusprechen, nicht "ungetrennt"', () => {
    const hinweis = mudaaf.lernen.find((p) => p.includes('يَرْتَدِدْ'));
    expect(hinweis).toBeDefined();
    expect(hinweis).toMatch(/bewusst getrennt aus/);
    expect(hinweis).not.toMatch(/bewusst ungetrennt aus/);
  });

  it('erklaerung stimmt mit erkennung und belege ueberein (Korpusbeleg 2:217, Wort 39: يَرْتَدِدْ bleibt im Jazm getrennt)', () => {
    expect(mudaaf.erkennung.join(' ')).toMatch(/ausnahmsweise getrennt/);
    const beleg217 = mudaaf.belege.find((b) => b.sure === 2 && b.vers === 217 && b.wort === 39);
    expect(beleg217).toBeDefined();
    expect(beleg217!.zeigt).toContain('يَرْتَدِدْ');
    expect(beleg217!.zeigt).toContain('getrennt');
  });
});
