// Antwortsprache der Salati-KI.
//
// STAND 2026-07-28: Die KI antwortet im ZITAT-MODUS (features/ki/zitat.ts) —
// die Antwort besteht ausschließlich aus wörtlichen Passagen der gefundenen
// Quellen. Damit gibt es keine Übersetzung mehr und keine freie Formulierung:
// geantwortet wird IMMER in der Sprache des geladenen Korpus.
//
// WARUM: Am echten Gerätemodell (Qwen2.5-1.5B-Instruct Q4_K_M) wurden 14
// Sprachen × 12 Fragen = 168 Läufe in drei Durchgängen gemessen
// (docs/audit-2026-07-27/KI-SPRACHMESSUNG.md). Das Modell drehte Verneinungen um
// („Ja, Wein ist erlaubt"), änderte Zahlen („Dhuhr hat zwei Rakat", Quelle:
// vier), ließ Schritte aus (Wudu ohne Füßewaschen) und erfand Versnummern —
// **während die richtige Passage im Prompt stand**. Bestes Ergebnis nach zwei
// Reparaturrunden: 100 von 168. Prompt- und Retrieval-Korrekturen haben das
// nicht behoben; es ist die Grenze eines 1,5-B-Modells.
//
// Konsequenz (Betreiber-Entscheidung): Es wird nicht mehr formuliert, sondern
// zitiert. Die Nachmessung des Zitat-Modus über denselben Fragensatz ergab
// **0 erfundene Aussagen in allen 14 Sprachen**, programmatisch gegen die
// Quellen geprüft (docs/audit-2026-07-27/KI-ZITATMODUS.md). Damit entfällt:
//   · der Beta-Schalter „Antwort in meiner Sprache" (es wird nicht übersetzt),
//   · die Liste geprüfter Antwortsprachen (es gibt keine Modell-Sprachqualität
//     mehr, die geprüft werden müsste),
//   · die Warnung vor verfälschten Zahlen und Verneinungen (sachlich überholt).
// Der allgemeine KI-Kennzeichnungshinweis (ki.aiDisclosure, EU AI Act Art. 50)
// BLEIBT — die Antwort wird weiterhin maschinell ausgewählt.

/** Sprachname und Eigenbezeichnung — für Anzeige und Korpus-Auswahl. */
export interface KiSprache {
  /** Deutscher Name. */
  name: string;
  /** Eigenbezeichnung. */
  endonym: string;
}

export const KI_SPRACHEN: Record<string, KiSprache> = {
  de: { name: 'Deutsch', endonym: 'Deutsch' },
  en: { name: 'Englisch', endonym: 'English' },
  tr: { name: 'Türkisch', endonym: 'Türkçe' },
  ar: { name: 'Arabisch', endonym: 'العربية' },
  fr: { name: 'Französisch', endonym: 'Français' },
  es: { name: 'Spanisch', endonym: 'Español' },
  ru: { name: 'Russisch', endonym: 'Русский' },
  id: { name: 'Indonesisch', endonym: 'Bahasa Indonesia' },
  ms: { name: 'Malaiisch', endonym: 'Bahasa Melayu' },
  bn: { name: 'Bengalisch', endonym: 'বাংলা' },
  ur: { name: 'Urdu', endonym: 'اردو' },
  fa: { name: 'Persisch', endonym: 'فارسی' },
  ps: { name: 'Paschtu', endonym: 'پښتو' },
  sw: { name: 'Suaheli', endonym: 'Kiswahili' },
};

/** Sprache des gebündelten Standard-Korpus. Quellen fallen immer hierauf zurück. */
export const KORPUS_SPRACHE = 'de';

/**
 * Sprache der Antwort. Im Zitat-Modus ist das zwangsläufig die Sprache des
 * geladenen Korpus — zitiert werden kann nur, was im Korpus steht.
 *
 * @param korpusSprache Sprache der tatsächlich geladenen Quellen
 *                      (features/ki/korpus.ts → KorpusStand.sprache).
 */
export function antwortSprache(korpusSprache: string = KORPUS_SPRACHE): string {
  return KI_SPRACHEN[korpusSprache] ? korpusSprache : KORPUS_SPRACHE;
}

/**
 * Braucht diese App-Sprache einen Hinweis auf deutsche Quellen?
 *
 * @param korpusSprache Sprache der geladenen Quellen. Ist sie gleich der
 *                      App-Sprache, sind nur noch einzelne Dokumente deutsch
 *                      (die kuratierte Wissensschicht, solange sie nicht
 *                      übersetzt ist) — der Aufrufer entscheidet über
 *                      KorpusStand.deutsch, welcher Hinweistext passt.
 */
export function brauchtQuellenHinweis(locale: string, korpusSprache: string = KORPUS_SPRACHE): boolean {
  return locale !== korpusSprache;
}

/** Welche Zeilen stehen in der Hinweis-Karte über dem Chat? */
export interface SprachHinweise {
  /** Quellen liegen nicht in der App-Sprache vor — und damit auch die Zitate nicht. */
  quellenDeutsch: boolean;
  /** Quellen übersetzt, die kuratierte Wissensschicht noch teilweise deutsch. */
  teilweiseDeutsch: boolean;
  /** Steht überhaupt etwas in der Karte? */
  sichtbar: boolean;
}

/**
 * Entscheidet über die Hinweise im KI-Screen — bewusst hier und nicht im
 * Screen, damit die Bedingungen prüfbar sind (sprachen.test.ts).
 *
 * Seit dem Zitat-Modus gibt es nur noch Hinweise zur QUELLENLAGE. Die frühere
 * Qualitätswarnung („Zahlen und Verneinungen werden hier besonders oft
 * verfälscht") ist entfallen, weil sie sachlich nicht mehr zutrifft: es wird
 * nichts mehr formuliert, sondern wörtlich zitiert.
 *
 * @param locale            App-Sprache (settings.language)
 * @param korpusSprache     Sprache der geladenen Quellen (KorpusStand.sprache)
 * @param deutscheDokumente Anzahl noch deutscher Dokumente (KorpusStand.deutsch)
 */
export function sprachHinweise(locale: string, korpusSprache: string = KORPUS_SPRACHE, deutscheDokumente = 0): SprachHinweise {
  const quellenDeutsch = !!KI_SPRACHEN[locale] && brauchtQuellenHinweis(locale, korpusSprache);
  const teilweiseDeutsch = !quellenDeutsch && locale !== KORPUS_SPRACHE && deutscheDokumente > 0;
  return { quellenDeutsch, teilweiseDeutsch, sichtbar: quellenDeutsch || teilweiseDeutsch };
}
