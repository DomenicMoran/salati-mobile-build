// Reine Baumaufbau-Logik für die Satzstruktur-Ansicht (Satzstruktur.tsx):
// verwandelt die flache syntax.head-Liste eines Verses (Dependenzgrammatik,
// siehe morphologieTypen.ts) in eine Eltern-Kind-Struktur für eine
// Einrückungsliste. Bewusst ohne React-Abhängigkeit — isoliert testbar wie
// wortAnalyseModel.ts, das dieselbe Datei für die Rollen-Anzeige (Fachbegriff
// + arabischer Terminus + Bezugswort) eines einzelnen Wortes wiederverwendet.
//
// Zwei Eigenheiten der echten Daten, gegen die diese Logik ausdrücklich
// gehärtet ist (siehe __fixtures__/morphologie-2-verse-1-5.json — Vers 2:2
// Wort 7 "لِّلْمُتَّقِينَ" head:7, Vers 2:1 Wort 1 "الٓمٓ" head:1, Vers 2:3
// Wort 6 "وَمِمَّا" head:6, u. a. — insgesamt 4 Selbstbezüge allein in diesen
// 5 Versen):
//
// 1. Ein Wort kann als eigenen Kopf sich selbst tragen (head === position).
//    Das ist KEIN Zyklus-Bug der Pipeline und NICHT auf die Relation "root"
//    beschränkt (siehe "gen"-Beispiel oben) — es ist die Art, wie die
//    Pipeline "kein auflösbarer Kopf im Vers" kodiert, gleichbedeutend mit
//    head === null. Wird hier identisch behandelt: das Wort wird
//    Wurzelknoten der Baumdarstellung, ohne Eltern-Zeile.
// 2. Grundsätzlich denkbar (auch wenn in den bekannten Fixtures nicht
//    belegt): ein Zyklus über mehrere Wörter (A→B, B→A oder länger).
//    baueSatzbaum() kappt die Kante am zuerst wiederentdeckten Knoten einer
//    Drei-Farben-Tiefensuche, damit JEDES Wort garantiert genau einmal im
//    Baum auftaucht (nichts verschwindet) und die Rekursion in jedem Fall
//    terminiert — unabhängig davon, wie die Kopf-Zeiger im Einzelfall
//    verdrahtet sind.
import type { MorphWord } from '../morphologieTypen';

export interface SatzKnoten {
  word: MorphWord;
  /** 0 = Wurzelknoten (kein Elternwort in dieser Baumdarstellung). */
  tiefe: number;
  kinder: SatzKnoten[];
}

/**
 * Kopf-Position eines Wortes, oder `null`, wenn es in DIESER Baumdarstellung
 * keinen (weiteren) auflösbaren Kopf hat: `syntax` fehlt, `head` ist `null`,
 * `head` zeigt auf die eigene Position (siehe Kopf-Kommentar Punkt 1), oder
 * `head` zeigt auf eine im Vers nicht vorhandene Position (defensiv — laut
 * Pipeline-Vertrag sollte das nicht vorkommen, aber nie eine Position
 * erfinden, die es nicht gibt).
 */
export function direkterKopf(word: MorphWord, byPos: ReadonlyMap<number, MorphWord>): number | null {
  const head = word.syntax?.head;
  if (head == null) return null;
  if (head === word.position) return null;
  if (!byPos.has(head)) return null;
  return head;
}

/**
 * Baut die Eltern-Kind-Struktur der Wörter eines Verses. Wurzelknoten sind
 * alle Wörter ohne auflösbaren Kopf (siehe {@link direkterKopf}) PLUS jedes
 * Wort, dessen Kopf-Kette einen Zyklus schließen würde (die Kante wird dort
 * gekappt, siehe Kopf-Kommentar Punkt 2) — dadurch erscheint jedes Wort genau
 * einmal, Geschwister in Lesereihenfolge (nach Position sortiert).
 */
export function baueSatzbaum(words: MorphWord[]): SatzKnoten[] {
  const byPos = new Map(words.map((w) => [w.position, w]));

  // Zyklus-Erkennung: klassische Drei-Farben-Tiefensuche über die Kopf-Kette.
  // Trifft die Rekursion auf einen Knoten, der im GERADE LAUFENDEN Pfad steckt
  // ('aktiv'), ist das ein Zyklus — die Kante DIESES Knotens zu seinem Kopf
  // wird gekappt (der Knoten wird stattdessen selbst Wurzel). Jeder Knoten
  // wechselt höchstens einmal unbesucht→aktiv→fertig, die Gesamtarbeit bleibt
  // linear in der Wortanzahl.
  const status = new Map<number, 'unbesucht' | 'aktiv' | 'fertig'>();
  const gekappt = new Set<number>();
  words.forEach((w) => status.set(w.position, 'unbesucht'));

  function besuche(pos: number): void {
    if (status.get(pos) === 'fertig') return;
    if (status.get(pos) === 'aktiv') {
      gekappt.add(pos);
      return;
    }
    status.set(pos, 'aktiv');
    const w = byPos.get(pos);
    const kopf = w ? direkterKopf(w, byPos) : null;
    if (kopf != null) besuche(kopf);
    status.set(pos, 'fertig');
  }
  words.forEach((w) => besuche(w.position));

  function elternPosition(word: MorphWord): number | null {
    if (gekappt.has(word.position)) return null;
    return direkterKopf(word, byPos);
  }

  const kinderVon = new Map<number, MorphWord[]>();
  const wurzeln: MorphWord[] = [];
  for (const w of words) {
    const eltern = elternPosition(w);
    if (eltern == null) {
      wurzeln.push(w);
    } else {
      const liste = kinderVon.get(eltern);
      if (liste) liste.push(w);
      else kinderVon.set(eltern, [w]);
    }
  }

  function knoten(w: MorphWord, tiefe: number): SatzKnoten {
    const kinder = (kinderVon.get(w.position) ?? []).slice().sort((a, b) => a.position - b.position);
    return { word: w, tiefe, kinder: kinder.map((k) => knoten(k, tiefe + 1)) };
  }

  return wurzeln
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((w) => knoten(w, 0));
}

export interface SatzZeile {
  word: MorphWord;
  tiefe: number;
}

/**
 * Flache, vorgeordnete (pre-order) Liste aus dem Baum — Lesereihenfolge
 * bleibt erhalten, weil Geschwister nach Position sortiert sind. Grundlage
 * für die Einrückungsliste: EIN flaches `.map()` beim Rendern statt
 * verschachtelter React-Baum-Rekursion — bleibt auch bei über 100 Wörtern
 * (Sure 2:282) performant und erzeugt keine tief verschachtelten nativen
 * Views (jede Zeile liegt auf derselben Verschachtelungsebene, nur mit
 * unterschiedlichem Einzug).
 */
export function abflachen(baum: SatzKnoten[]): SatzZeile[] {
  const zeilen: SatzZeile[] = [];
  function lauf(knoten: SatzKnoten[]) {
    for (const k of knoten) {
      zeilen.push({ word: k.word, tiefe: k.tiefe });
      lauf(k.kinder);
    }
  }
  lauf(baum);
  return zeilen;
}
