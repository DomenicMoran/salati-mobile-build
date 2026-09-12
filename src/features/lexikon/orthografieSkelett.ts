// Orthografie-Skelett für den Vergleich Handout-Drucksatz ↔ Qur'an-Korpus.
//
// WARUM EINE EIGENE DATEI (nicht arabicSearch.ts wiederverwenden): jene Datei
// normalisiert für die UI-Suche (ein Nutzer tippt ohne Vokalzeichen) und
// vereinheitlicht dafür bewusst NUR Alif-Hamza-Varianten, Alif maqsura und
// Ta marbuta. Für die Paradigmen-Gegenprobe (paradigmen-weitere.test.ts,
// paradigmen-bab-murakkab.test.ts) reicht das nicht: die Qur'an-Uthmani-
// Orthografie des Korpus weicht von der Druck-/Naskh-Orthografie der
// handout.pdf-Vorlage SYSTEMATISCH ab, u. a.
//   - bei der Madda (Korpus جَآءَ mit Madda-Zeichen U+0622, Handout جَاءَ mit
//     getrenntem Alif+Hamza),
//   - beim Dagger-Alif (Korpus جَٰدَلَ mit hochgestelltem Dagger-Alif U+0670,
//     Handout جَادَلَ mit vollem Alif — EMPIRISCH per Testlauf gegen
//     roots.json entdeckt: ein Skelettvergleich, der den Dagger-Alif wie
//     einen gewöhnlichen Harakat-Diakritikum ERSATZLOS STREICHT statt ihn
//     einem Alif gleichzusetzen, verkürzt das Konsonantenskelett um einen
//     Buchstaben und lässt dadurch reihenweise echte Korpustreffer wie
//     'جادل' als Ausnahme durchfallen, obwohl das Wort belegt ist),
//   - bei Hamza-Trägern auf Waw/Ya (ؤ/ئ), die je nach Schriftsatz
//     unterschiedlich gesetzt werden.
// Diese Datei bündelt GENAU DAS: ein aggressiveres Skelett, das beide
// Konventionen aufeinander abbildet, s. LUECKEN.md ("Korpus-Gegenprobe mit
// Normalisierung").
//
// Nicht verwenden für Rendering (Harakat bleiben dort bewusst erhalten, s.
// @/lib/arabicText.ts) oder für die Live-Suche (dafür bleibt arabicSearch.ts
// zuständig) — ausschließlich für Gegenproben, die zwei geschriebene Formen
// derselben Aussprache auf Übereinstimmung prüfen wollen.
//
// Bekannter Stolperstein (siehe FORTSETZEN-KORAN-LEXIKON.md): arabische
// Literale im Quelltext normalisieren unter Umständen anders als Korpusdaten
// (Kombinationszeichen-Reihenfolge) — deshalb immer zuerst `.normalize('NFC')`
// auf BEIDEN Seiten, bevor irgendein Zeichen entfernt/ersetzt wird.

/** Madda (آ, U+0622) UND Dagger-Alif (ٰ, U+0670) auf ein volles Alif
 *  abgebildet — beide stehen lautlich für denselben langen a-Laut wie ein
 *  gewöhnliches ا, werden aber je nach Orthografie (Druck vs. Uthmani-
 *  Korpus) unterschiedlich geschrieben. MUSS vor HARAKAT_UND_TATWEEL_RE
 *  laufen: deren Bereich reicht (wie in arabicSearch.ts/paradigmen*.test.ts
 *  üblich) bis einschließlich U+0670 und würde den Dagger-Alif sonst
 *  ersatzlos herausreißen statt ihn einem Alif gleichzusetzen. */
const MADDA_UND_DAGGER_ALIF_RE = /[آٰ]/g;

/** Alle Hamza-Träger (Hamza auf Alif U+0623/U+0625, Hamzat al-Wasl U+0671,
 *  Hamza auf Waw U+0624, Hamza auf Ya U+0626) sowie das freistehende Hamza
 *  selbst (U+0621) auf die Grundform Alif vereinheitlicht. Das ist bewusst
 *  aggressiver als arabicSearch.ts (dort bleiben ؤ/ئ als eigene Buchstaben
 *  stehen) — genau diese beiden Träger sind ein Hauptunterschied zwischen
 *  Korpus- und Druckorthografie bei sonst identischen Wörtern (z. B.
 *  تَسَاؤُلًا vs. تَسَائُلًا an derselben Stelle im selben Handout, siehe
 *  Tabelle 'sarf-familie-5-tasaaala' in paradigmen-weitere.json). */
const HAMZA_TRAEGER_RE = /[أإٱؤئء]/g;

/** Alif maqsura (ى, U+0649) → Ya (ي, U+064A). */
const ALIF_MAQSURA_RE = /ى/g;

/** Ta marbuta (ة, U+0629) → Ha (ه, U+0647). */
const TEH_MARBUTA_RE = /ة/g;

/** Harakat/Tanwin, Shadda, Sukun, Qur'an-Rezitationszeichen und Tatweel —
 *  alles, was die Aussprache nicht am Konsonantenskelett ändert. Derselbe
 *  Zeichenbereich wie in arabicSearch.ts/DIACRITICS_RANGES bzw. den
 *  normalisiereSkelett()-Kopien in paradigmen.test.ts und den
 *  paradigmen-bab-*.test.ts-Dateien (reicht bis einschließlich U+0670,
 *  daher MUSS MADDA_UND_DAGGER_ALIF_RE vorher laufen, siehe oben). */
const HARAKAT_UND_TATWEEL_RE = /[ؐ-ؚـً-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭ࣓-ࣣ࣡-ࣿ]/g;

/**
 * Reduziert eine arabische Wortform auf ihr Konsonanten-/Langvokal-Skelett
 * für den Vergleich ÜBER ZWEI ORTHOGRAFIEN HINWEG (Handout-Drucksatz vs.
 * Qur'an-Uthmani-Korpus). Reihenfolge ist wichtig: erst NFC, dann Madda/
 * Dagger-Alif auf Alif abbilden (bevor die Harakat-Klasse greift — deren
 * Bereich schlösse den Dagger-Alif sonst ein und würde ihn ersatzlos
 * streichen statt gleichsetzen), dann alle Hamza-Träger auf Alif, dann Alif
 * maqsura/Ta marbuta angleichen, zuletzt Harakat/Tatweel entfernen.
 *
 * Auf BEIDE Seiten eines Vergleichs anwenden.
 */
export function normalisiereOrthografieSkelett(text: string): string {
  if (!text) return '';
  let out = text.normalize('NFC');
  out = out.replace(MADDA_UND_DAGGER_ALIF_RE, 'ا');
  out = out.replace(HAMZA_TRAEGER_RE, 'ا');
  out = out.replace(ALIF_MAQSURA_RE, 'ي');
  out = out.replace(TEH_MARBUTA_RE, 'ه');
  out = out.replace(HARAKAT_UND_TATWEEL_RE, '');
  return out;
}

/**
 * true, wenn `form` (nach Skelett-Normalisierung) in einem der Korpus-
 * Skelette als Teilstring vorkommt. `korpusSkelette` sollte bereits mit
 * `normalisiereOrthografieSkelett` vorbereitet sein (einmal pro Wurzel, nicht
 * pro Zelle neu berechnen). `.includes` statt `===`, weil dieselbe Form im
 * Korpus gelegentlich mit einer angehängten Klitik auftaucht (z. B. als Teil
 * eines längeren Tokens) — siehe Verwendung in den Gegenproben-Testdateien.
 */
export function skelettImKorpusBelegt(form: string, korpusSkelette: readonly string[]): boolean {
  const skelett = normalisiereOrthografieSkelett(form);
  if (!skelett) return false;
  return korpusSkelette.some((s) => s.includes(skelett));
}
