// Aufbereitung arabischer (v. a. koranischer) Texte VOR dem Rendern.
//
// Hintergrund — woher der gestrichelte Kreis kommt:
// Die Text-Engine (HarfBuzz auf Android/iOS/Web) setzt U+25CC DOTTED CIRCLE
// automatisch davor, wenn ein Shaping-Lauf mit einem Kombinationszeichen
// BEGINNT, also mit einem Zeichen ohne Basisbuchstaben. Das ist kein Fehler
// der Schriftart und passiert deshalb auch mit dem Uthmani-Font des KFGQPC.
//
// Genau das produziert der Uthmani-Text von quran.com: die Waqf-/Pausen-
// zeichen stehen dort als EIGENE, durch Leerzeichen getrennte Token im Vers.
// Live geprüft am 2026-07-31 gegen
// `api.quran.com/api/v4/quran/verses/uthmani?chapter_number=2`:
//
//   2:2 → "… لَا رَيْبَ ۛ فِيهِ ۛ هُدًى …"   (2× ۛ U+06DB allein)
//   2:5 → "… مِّن رَّبِّهِمْ ۖ وَأُو۟لَـٰٓئِكَ …" (ۖ U+06D6 allein)
//
// Solange der ganze Vers in EINEM <Text> steht, ist das harmlos — das Zeichen
// hängt sich an das Leerzeichen davor. Sobald der Vers aber pro Wort in
// eigene <Text>-Läufe zerlegt wird (Wort-Sync-Markierung im Reader, Mushaf-
// Fallback, Hifz-Lückentest), wird aus dem Waqf-Zeichen ein eigener Lauf, der
// mit einem Kombinationszeichen anfängt → "◌ۛ".
//
// Nebenbefund derselben Ursache: quran.com zählt "رَيْبَ ۛ" als EIN Wort
// (`char_type_name: "word"`, Waqf-Zeichen angehängt). Ein naives
// `split(/\s+/)` liefert dagegen ein Token mehr, wodurch die Wort-Zeitstempel
// der Rezitation ab dieser Stelle um eine Position verrutschten.
//
// `splitArabicWords()` behebt beides in einem: Zeichen-Token werden an das
// vorangehende Wort angehängt, statt einen eigenen Lauf zu bilden.

/**
 * Arabische Kombinationszeichen (Unicode-Kategorie Mn), die in koranischem
 * Text vorkommen — Harakat/Tanwin, Hamza-Aufsätze, Alif khanjariyya,
 * Waqf-/Rezitationszeichen, Arabic-Extended-A.
 *
 * BEWUSST NICHT enthalten, weil es KEINE Kombinationszeichen sind und ohne
 * Basisbuchstaben stehen dürfen:
 *   U+06DD (Sure-/Vers-Ende-Zeichen, Cf), U+06DE (So),
 *   U+06E5/U+06E6 (kleines Waw/Ya, Lm — eigenständige Modifikatoren),
 *   U+06E9 (Sajda-Zeichen, So).
 * Sie hier aufzunehmen würde sie fälschlich als „verwaist" behandeln.
 */
const ARABIC_MARK_RANGES =
  '\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06DC\\u06DF-\\u06E4\\u06E7\\u06E8\\u06EA-\\u06ED\\u08D3-\\u08E1\\u08E3-\\u08FF';
/** Zusätzlich die generischen Kombinationszeichen (Latein-Diakritika) — nur
 *  als Sicherheitsnetz für gemischte Texte. */
const GENERIC_MARK_RANGES = '\\u0300-\\u036F';
const MARK_CLASS = `[${ARABIC_MARK_RANGES}${GENERIC_MARK_RANGES}]`;

const LEADING_MARK_RE = new RegExp(`^${MARK_CLASS}`);
const MARK_ONLY_RE = new RegExp(`^${MARK_CLASS}+$`);
const ORPHAN_AFTER_SPACE_RE = new RegExp(`(^|\\s)(${MARK_CLASS}+)`, 'g');

/** Gestrichelter Hilfskreis, den die Text-Engine bei basislosen Zeichen setzt. */
export const DOTTED_CIRCLE = '◌';
/** Geschütztes Leerzeichen — unsichtbarer Basisträger für ein sonst verwaistes Zeichen. */
export const NBSP = String.fromCharCode(0x00a0);
/** Tatweel/Kashida — der klassische sichtbare Träger, auf dem Lehrbücher ein
 *  einzelnes Vokalzeichen zeigen (z. B. „ـَ" für Fatha). */
export const TATWEEL = 'ـ';

/**
 * Unsichtbare Steuerzeichen, die die Formung stören oder Wort-Splits
 * verfälschen: ZWSP, LRM/RLM, ALM, Bidi-Embedding/Isolate, BOM.
 * ZWJ (U+200D) und ZWNJ (U+200C) sind bewusst NICHT dabei — die setzt das
 * Lern-Modul absichtlich, um Positionsformen zu erzwingen
 * (features/learn/letters.ts).
 */
const INVISIBLE_CONTROLS_RE = new RegExp('[\u200B\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069\uFEFF]', 'g');
const DOTTED_CIRCLE_RE = new RegExp('\u25CC', 'g');

/**
 * Zeichen der Private Use Area. Der IndoPak-Text von quran.com adressiert damit
 * Glyphen der IndoPak-Hausschrift direkt (U+E003\u2013U+E022, am 2026-07-31 1.383
 * Vorkommen im Gesamttext). Ein Codepoint der PUA hat ausserhalb genau dieser
 * Schrift KEINE Bedeutung: keine der acht geb\u00FCndelten Schriften kennt ihn, und
 * eine System-Fallback-Schrift kann ihn auch nicht kennen \u2014 \u00FCbrig bliebe ein
 * Tofu-K\u00E4stchen. Deshalb fliegen sie raus statt sichtbar zu scheitern.
 */
const PRIVATE_USE_RE = new RegExp('[\uE000-\uF8FF]', 'g');

/**
 * Typografische Leerzeichen (En/Em/Viertelgeviert \u2026), die der IndoPak-Text zur
 * Feinausrichtung setzt. Dem KFGQPC-Font und beiden Noto-Schriften fehlen
 * U+2002/U+2003 \u2014 Android bricht den Textlauf dort auf und holt das Leerzeichen
 * aus einer fremden Schrift, was Wortabst\u00E4nde sichtbar verspringen l\u00E4sst. Ein
 * normales Leerzeichen tut hier dasselbe und kann jede Schrift.
 */
const TYPOGRAPHIC_SPACES_RE = new RegExp('[\u2000-\u200A\u205F\u3000]', 'g');

/**
 * Arabische Pr\u00E4sentationsformen (Formen-B, U+FE70\u2013U+FEFC): fertig geformte
 * Anfangs-/Mittel-/End-/Einzelformen aus der Zeit vor OpenType. Heute macht das
 * der Shaper selbst; im Text sind sie ein Datenartefakt \u2014 der IndoPak-Text f\u00FChrt
 * genau ein solches Zeichen (U+FE8E, Alif in Endform, in 21:104).
 *
 * Vier der acht Schriften haben daf\u00FCr keinen Glyphen, weil eine moderne Schrift
 * diesen Block nicht mehr belegen muss. `.normalize('NFKC')` l\u00F6st jede dieser
 * Formen in ihren Grundbuchstaben auf \u2014 genau das, was der Shaper danach ohnehin
 * wieder korrekt formt.
 *
 * BEWUSST NUR dieser Block, nicht Formen-A (U+FB50\u2013U+FDFF): dort steht u. a. die
 * Basmala-Ligatur U+FDFD, die NFKC in den kompletten Satz \u201E\u0628\u0633\u0645 \u0627\u0644\u0644\u0647 \u2026" aufl\u00F6sen
 * w\u00FCrde \u2014 aus einem Zeichen w\u00FCrden vier W\u00F6rter.
 */
const PRESENTATION_FORMS_RE = new RegExp('[\uFE70-\uFEFC]', 'g');

/** `String.prototype.normalize` ist in Hermes vorhanden, aber nicht in jeder
 *  JS-Umgebung garantiert (ältere Hermes-Builds, manche Test-Runner). */
const CAN_NORMALIZE = typeof (String.prototype as { normalize?: unknown }).normalize === 'function';

export interface NormalizeOptions {
  /**
   * Unicode-Normalform. NFC (Default) fügt Basisbuchstabe + Kombinationszeichen
   * zusammen, wo eine kanonische Komposition existiert, und sortiert die
   * übrigen Zeichen in die kanonische Reihenfolge — genau das, was der Shaper
   * für korrekte Harakat-Positionierung braucht.
   *
   * NFKC ist für Koran-Text FALSCH und deshalb nicht der Default: es ersetzt
   * die arabischen Präsentationsformen und würde u. a. das Sure-Ende-Zeichen
   * und Ligaturen inhaltlich verändern.
   */
  form?: 'NFC' | 'NFKC';
  /** Trägerzeichen für ein sonst verwaistes Zeichen am Textanfang
   *  (`NBSP` = unsichtbar wie im Mushaf, `TATWEEL` = sichtbarer Lehrbuch-Strich). */
  carrier?: string;
  /** false = mehrfache Leerzeichen bleiben stehen (Default: true, zusammenfassen). */
  collapseWhitespace?: boolean;
}

/**
 * Bereitet arabischen Text fürs Rendern auf — für ALLE Schriftarten, auch die
 * klassische Uthmani-Schrift:
 *
 * 1. Unicode-Normalisierung (NFC): Basisbuchstabe + Kombinationszeichen werden
 *    kanonisch zusammengeführt bzw. kanonisch sortiert.
 * 2. Bereits im Text stehende U+25CC entfernen (entstehen beim Kopieren aus
 *    gerendertem Text oder aus fremden Datenquellen).
 * 3. Unsichtbare Bidi-/Zero-Width-Steuerzeichen entfernen, die die Formung
 *    stören (ZWJ/ZWNJ bleiben — s. o.), dazu PUA-Codepoints und typografische
 *    Sonder-Leerzeichen, die keine der gebündelten Schriften darstellen kann.
 * 4. Verwaiste Kombinationszeichen bekommen einen unsichtbaren Basisträger,
 *    damit die Engine keinen Hilfskreis mehr setzen muss.
 */
export function normalizeArabicText(text: string, options: NormalizeOptions = {}): string {
  if (!text) return '';
  const { form = 'NFC', carrier = NBSP, collapseWhitespace = true } = options;
  let out = CAN_NORMALIZE ? text.normalize(form) : text;
  out = out.replace(DOTTED_CIRCLE_RE, '').replace(INVISIBLE_CONTROLS_RE, '').replace(PRIVATE_USE_RE, '');
  // Vor dem Zusammenfassen: sonst bliebe ein En-Space als eigenes „Wort" stehen
  // und `splitArabicWords` zählte an dieser Stelle ein Token zu viel.
  out = out.replace(TYPOGRAPHIC_SPACES_RE, ' ');
  if (CAN_NORMALIZE) out = out.replace(PRESENTATION_FORMS_RE, (ch) => ch.normalize('NFKC'));
  if (collapseWhitespace) out = out.replace(/[ \t]{2,}/g, ' ').trim();
  // Der Träger kommt ZULETZT — er ist selbst ein Leerzeichen (NBSP) und würde
  // von `trim()` sonst gleich wieder entfernt. Ebenso erst nach dem Entfernen
  // des Hilfskreises, dessen Zeichen danach ohne Basis dasteht.
  out = out.replace(ORPHAN_AFTER_SPACE_RE, (_m, before: string, marks: string) =>
    // Nur am absoluten Textanfang ist ein Träger nötig; nach einem Leerzeichen
    // dient dieses selbst als Basis (so stehen Waqf-Zeichen auch im Mushaf).
    before === '' ? carrier + marks : before + marks,
  );
  return out;
}

/** true, wenn der Text mit einem Kombinationszeichen beginnt und die Engine
 *  deshalb einen gestrichelten Kreis davorsetzen würde. */
export function startsWithCombiningMark(text: string): boolean {
  return text.length > 0 && LEADING_MARK_RE.test(text);
}

/** true, wenn das Token AUSSCHLIESSLICH aus Kombinationszeichen besteht
 *  (typisch: ein allein stehendes Waqf-Zeichen des Uthmani-Textes). */
export function isCombiningMarkOnly(token: string): boolean {
  return token.length > 0 && MARK_ONLY_RE.test(token);
}

/**
 * Minimal-Absicherung für einen einzelnen Text-Lauf: setzt einen unsichtbaren
 * Basisträger davor, wenn der Lauf mit einem Kombinationszeichen beginnt.
 * Für Fälle, in denen der Text aus fremder Quelle kommt und nicht komplett
 * normalisiert werden soll.
 */
export function withMarkCarrier(text: string, carrier: string = NBSP): string {
  return startsWithCombiningMark(text) ? carrier + text : text;
}

/**
 * Zerlegt einen Vers in Wörter — so, dass KEIN Wort mit einem
 * Kombinationszeichen beginnt.
 *
 * Allein stehende Waqf-/Rezitationszeichen werden an das vorangehende Wort
 * angehängt (mit dem Leerzeichen dazwischen, damit sie wie im Mushaf über der
 * Lücke stehen). Das entspricht zugleich der Wortzählung von quran.com, deren
 * Wort-Zeitstempel den Reader steuern.
 */
export function splitArabicWords(text: string): string[] {
  const out: string[] = [];
  for (const token of text.split(/\s+/)) {
    if (token === '') continue;
    if (isCombiningMarkOnly(token)) {
      if (out.length > 0) out[out.length - 1] += ' ' + token;
      else out.push(NBSP + token);
      continue;
    }
    out.push(withMarkCarrier(token));
  }
  return out;
}

/**
 * Zerlegt Text in Grapheme-Cluster „Basiszeichen + alle zugehörigen
 * Kombinationszeichen". Grundlage für jede buchstabenweise Anzeige — ein
 * naives `Array.from()` würde jedes Vokalzeichen zu einem eigenen Element
 * machen und damit genau die basislosen Läufe erzeugen, die den Hilfskreis
 * auslösen.
 */
export function arabicClusters(text: string): string[] {
  const clusters: string[] = [];
  for (const ch of Array.from(text)) {
    if (clusters.length > 0 && LEADING_MARK_RE.test(ch)) {
      clusters[clusters.length - 1] += ch;
    } else {
      clusters.push(ch);
    }
  }
  return clusters;
}
