// Beispielfragen für den leeren KI-Chat.
//
// Zwei Dinge sind hier getrennt:
//   · `labelKey` — der ANGEZEIGTE Text, in der App-Sprache übersetzt
//                  (src/locales/<lang>.json → ki.example1…6).
//   · `frage`    — der deutsche Wortlaut, der NUR noch dann abgeschickt wird,
//                  wenn tatsächlich der deutsche Korpus geladen ist.
//
// WARUM DIE UNTERSCHEIDUNG BLEIBT, ABER ANDERS ENTSCHIEDEN WIRD (2026-07-29):
// Bis hierher ging IMMER der deutsche Wortlaut raus. Begründet war das damit,
// dass „der Quellen-Korpus deutsch" sei — das stimmt seit features/ki/korpus.ts
// nicht mehr: je App-Sprache wird ein ÜBERSETZTER Korpus geladen (Deutsch
// gebündelt, 13 weitere von R2). Die Suche lief damit mit deutschen Wörtern
// gegen einen türkischen/arabischen Bestand und lieferte am Gerät belegt „Dazu
// finde ich in meinen lokalen Quellen keine Stelle" — genau der schlechteste
// erste Eindruck, den die alte Regel verhindern sollte, nur eben für JEDEN
// nicht-deutschen Nutzer beim ALLERERSTEN Antippen.
//
// Richtig ist: die Frage muss zur Sprache des GELADENEN Korpus passen, nicht
// zur Sprache des Bundles. Das entscheidet `abzuschickendeFrage()` anhand von
// KorpusStand.sprache. Der deutsche Wortlaut bleibt als Rückfall, weil der
// deutsche Korpus auch dann aktiv ist, wenn das Nachladen von R2 scheitert —
// dann wäre der übersetzte Anzeigetext die falsche Suchanfrage.
//
// Alle sechs Fragen sind — in allen 14 Sprachen mit ihrem ANZEIGETEXT — Teil
// des Prüfkatalogs in scripts/ki-retrieval-eval.mjs (`--beispielfragen`) und
// liefern dort nachweislich die erwarteten Quellen.
import { KORPUS_SPRACHE } from './sprachen';

export interface Beispielfrage {
  labelKey: string;
  frage: string;
}

export const BEISPIELFRAGEN: readonly Beispielfrage[] = [
  { labelKey: 'ki.example1', frage: 'Was sind die fünf Säulen des Islam?' },
  { labelKey: 'ki.example2', frage: 'Wie mache ich Wudu?' },
  { labelKey: 'ki.example3', frage: 'Was ist Ischa?' },
  { labelKey: 'ki.example4', frage: 'Was bricht das Fasten?' },
  { labelKey: 'ki.example5', frage: 'Wie viel Zakat muss ich zahlen?' },
  { labelKey: 'ki.example6', frage: 'Was sagt der Islam über Geduld?' },
];

/**
 * Welcher Wortlaut beim Antippen eines Vorschlags tatsächlich gesucht wird.
 *
 * @param beispiel      Der angetippte Vorschlag.
 * @param angezeigt     Sein übersetzter Anzeigetext (t(labelKey)).
 * @param korpusSprache Sprache der GELADENEN Quellen (KorpusStand.sprache) —
 *                      nicht die App-Sprache: solange der Korpus der App-
 *                      Sprache noch lädt oder gar nicht geladen werden konnte,
 *                      liegen deutsche Quellen vor und nur deutsche Wörter
 *                      finden darin etwas.
 */
export function abzuschickendeFrage(beispiel: Beispielfrage, angezeigt: string, korpusSprache: string): string {
  return korpusSprache === KORPUS_SPRACHE ? beispiel.frage : angezeigt;
}
