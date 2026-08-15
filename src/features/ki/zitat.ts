// Zitat-Modus der Salati-KI — die Antwort besteht ausschliesslich aus
// WÖRTLICHEN Passagen der gefundenen Quellen.
//
// WARUM (Messung, docs/audit-2026-07-27/KI-SPRACHMESSUNG.md, 168 Läufe am
// echten Gerätemodell Qwen2.5-1.5B-Instruct Q4_K_M):
// Das Modell dreht Verneinungen um („Oui, il est permis d'apprécier de faibles
// quantités d'alcool"), ändert Zahlen („Dhuhr hat zwei Rakat", Quelle: vier) und
// lässt Schritte aus (Wudu ohne Füßewaschen) — auch dann, wenn die richtige
// Passage als HAUPTQUELLE im Prompt steht. Nach drei Reparaturrunden 100 von 168
// bestandenen Antworten. Das ist die Grenze eines 1,5-B-Modells, kein
// Prompt-Problem.
//
// Konsequenz: Formuliert wird gar nicht mehr. Es wird ausgewählt und zitiert.
// Zwei Teile:
//   1. `waehleZitate()` — deterministische, extraktive Auswahl aus den Treffern.
//      Kein Modell, kein Download, nicht manipulierbar.
//   2. `pruefeAntwort()` — die Erzwingung. Zerlegt einen beliebigen Antworttext
//      in Sätze und verwirft jeden, der nicht (normalisiert) wörtlich in einer
//      der mitgelieferten Quellen steht. Sie ist auch dann das letzte Wort, wenn
//      ein Sprachmodell die Auswahl trifft.
//
// Die Normalisierung glättet NUR Leerraum und Satzzeichen. Wörter, Ziffern und
// Verneinungen bleiben unangetastet — sonst würde die Prüfung genau das
// durchlassen, was sie verhindern soll. Satzzeichen werden zu LEERRAUM (nicht
// gelöscht), damit „2,5" nicht zu „25" verschmilzt und dadurch eine erfundene
// Zahl als belegt gälte.
import { SYNONYME, tokens, type KorpusDoc } from './retrieval';

/** Ein wörtlich zitierter Abschnitt mit seiner Quellenangabe. */
export interface ZitatBlock {
  /** Doc-ID der Quelle (Deep-Link/Nachschlagen, siehe features/ki/quellen.ts). */
  id: string;
  /** Quellenangabe, wie sie unter dem Zitat steht. */
  src: string;
  /** Wörtlicher Auszug aus `KorpusDoc.t` — zeichengleich, nur an Satzgrenzen beschnitten. */
  text: string;
}

/** Ein Abschnitt (Satz oder Aufzählungszeile) mit seiner Lage im Quellentext. */
export interface Abschnitt {
  text: string;
  /** Zeichenindex des ersten Zeichens in der Quelle. */
  start: number;
  /** Zeichenindex hinter dem letzten Zeichen in der Quelle. */
  ende: number;
}

/**
 * Satzenden über alle 14 App-Sprachen: lateinisch/kyrillisch `.!?`, das
 * arabische Fragezeichen `؟`, der Urdu-Punkt `۔` und das bengalische Danda `।`.
 * Der Doppelpunkt fehlt bewusst — er leitet im Korpus Aufzählungen ein und
 * gehört zum folgenden Text.
 */
const SATZENDE = new Set(['.', '!', '?', '…', '؟', '۔', '।']);

/**
 * Reiner Aufzählungsmarker („3.", "۴.", "৫)"). Er entsteht beim Trennen an
 * Satzenden als eigener Abschnitt und wird mit dem folgenden verschmolzen —
 * sonst zerfiele jede Schrittanleitung in sinnlose Nummern-Fragmente.
 * Enthält die arabisch-indischen (٠-٩), ostarabischen (۰-۹) und bengalischen
 * (০-৯) Ziffern, weil die übersetzten Korpora sie tatsächlich verwenden.
 */
const NUR_MARKER = /^[\d٠-٩۰-۹০-৯]{1,3}[.)]$/u;

/**
 * Zerlegt einen Text in Sätze bzw. Aufzählungszeilen — mit Zeichenoffsets,
 * damit ein Auszug später ZEICHENGLEICH aus dem Original geschnitten werden
 * kann statt aus zusammengefügten Teilstücken.
 */
export function abschnitte(text: string): Abschnitt[] {
  const roh: Abschnitt[] = [];
  let start = 0;
  let i = 0;
  const schiebe = (ende: number): void => {
    const stueck = text.slice(start, ende);
    if (stueck.trim()) roh.push({ text: stueck.trim(), start, ende });
    let n = ende;
    while (n < text.length && /\s/u.test(text[n]!)) n++;
    start = n;
    i = n;
  };
  while (i < text.length) {
    const z = text[i]!;
    if (z === '\n') {
      schiebe(i);
      continue;
    }
    if (SATZENDE.has(z)) {
      let ende = i + 1;
      while (ende < text.length && SATZENDE.has(text[ende]!)) ende++;
      schiebe(ende);
      continue;
    }
    i++;
  }
  if (start < text.length && text.slice(start).trim()) {
    roh.push({ text: text.slice(start).trim(), start, ende: text.length });
  }
  // Aufzählungsmarker an den folgenden Abschnitt hängen.
  const out: Abschnitt[] = [];
  for (const a of roh) {
    const letzter = out[out.length - 1];
    if (letzter && NUR_MARKER.test(letzter.text)) {
      out[out.length - 1] = { text: `${letzter.text} ${a.text}`, start: letzter.start, ende: a.ende };
      continue;
    }
    out.push(a);
  }
  return out;
}

/**
 * Vergleichsform für die Belegprüfung.
 *
 * Erlaubt: Groß-/Kleinschreibung, Leerraum, Satzzeichen und Symbole glätten,
 * NFKC (arabische Präsentationsformen auf ihre Grundform).
 * NICHT erlaubt: Wörter, Ziffern, Verneinungen oder diakritische Zeichen
 * verändern — genau daran hängt der Unterschied zwischen „erlaubt" und
 * „nicht erlaubt", zwischen „vier" und „zwei".
 *
 * Satzzeichen werden durch LEERRAUM ersetzt statt gelöscht: sonst würde „2,5"
 * zu „25" und eine erfundene Zahl käme als belegt durch.
 *
 * Rückgabe ist mit je einem Leerzeichen umschlossen, damit ein Teilstring-
 * Vergleich automatisch an Wortgrenzen prüft („vier" trifft nicht in „viert").
 */
export function normalisiereZitat(text: string): string {
  const gefaltet = text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  return ` ${gefaltet} `;
}

/**
 * Mindestzahl an Wörtern, die ein Satz haben muss, um überhaupt geprüft zu
 * werden. Ein Ein-Wort-Satz trägt keine belegbare Aussage — aber genau die
 * gefährlichen Stellungnahmen sind Ein-Wort-Sätze („Ja.", „Oui.", „بله"), und
 * das Wort steht irgendwo im Quellentext fast immer. Deshalb fliegen sie raus.
 */
const MIN_WOERTER = 2;

/** Ergebnis der Erzwingung. */
export interface Pruefergebnis {
  /** Sätze, die wörtlich in einer Quelle stehen — in der Reihenfolge der Antwort. */
  belegt: string[];
  /** Sätze, die verworfen wurden (für Messung, Tests und Protokoll). */
  unbelegt: string[];
}

/**
 * DIE ERZWINGUNG. Zerlegt eine beliebige Antwort in Sätze und behält nur die,
 * die normalisiert wörtlich in einer der mitgelieferten Quellen vorkommen.
 *
 * Geprüft wird gegen den VOLLEN Text der Quellendokumente (`KorpusDoc.t`), nicht
 * gegen eine gekürzte Prompt-Fassung: der Nutzer bekommt im KI-Screen genau
 * diesen vollen Text zu sehen, wenn er die Quelle antippt — was dort steht, ist
 * belegt und nachprüfbar.
 */
export function pruefeAntwort(antwort: string, quellen: readonly Pick<KorpusDoc, 't'>[]): Pruefergebnis {
  const quellenNorm = quellen.map((q) => normalisiereZitat(q.t));
  const belegt: string[] = [];
  const unbelegt: string[] = [];
  const gesehen = new Set<string>();
  for (const a of abschnitte(antwort)) {
    const norm = normalisiereZitat(a.text);
    const woerter = norm.trim() ? norm.trim().split(' ').length : 0;
    if (woerter < MIN_WOERTER) {
      if (woerter > 0) unbelegt.push(a.text);
      continue;
    }
    if (!quellenNorm.some((q) => q.includes(norm))) {
      unbelegt.push(a.text);
      continue;
    }
    // Wiederholungsschleifen des Modells sind belegt, aber unlesbar — je Satz
    // reicht ein Vorkommen.
    if (gesehen.has(norm)) continue;
    gesehen.add(norm);
    belegt.push(a.text);
  }
  return { belegt, unbelegt };
}

// ---------- Programmatische Auswahl (ohne Modell) ----------

/**
 * Zeichenbudget des Hauptzitats. Die Korpus-Dokumente sind beim Bau auf ~900
 * Zeichen gestückelt (scripts/build-ki-korpus.mjs), das Hauptzitat ist damit im
 * Normalfall die VOLLSTÄNDIGE Passage — entscheidend für Schrittanleitungen, bei
 * denen jede Kürzung einen Schritt kosten kann.
 */
const HAUPT_BUDGET = 1000;
/** Zeichenbudget je Ergänzungszitat. */
const ERGAENZUNG_BUDGET = 600;
/** Zeichenbudget aller Zitate zusammen. */
const GESAMT_BUDGET = 1600;
/**
 * Anteil neuer Inhaltswörter, den eine Ergänzung mitbringen muss. Der Korpus
 * schneidet lange Texte in überlappende Stücke, und zu „Wie mache ich Wudu?"
 * liefert das Retrieval regelmäßig dieselbe Schrittfolge dreimal in leicht
 * anderer Formulierung. Reine Wortgleichheit erkennt das nicht (die Sätze sind
 * paraphrasiert), der Anteil neuer Begriffe schon.
 *
 * 0.5 statt 0.35 (gemessen 2026-07-28 über alle 168 Fragen): kürzt die Antwort
 * im Schnitt um 56 Zeichen, ohne eine einzige Ziel-Passage zu verlieren. Bei
 * 0.65 fallen zwei heraus — dort ist die Grenze.
 */
const ERGAENZUNG_MIN_NEU = 0.5;
/** Höchstzahl der Zitatblöcke. Mehr liest niemand, und jeder weitere verwässert. */
const MAX_BLOECKE = 3;
/**
 * Ab welcher Länge eine Hauptquelle als eigenständige Antwort gilt. Darunter ist
 * sie fast immer ein Folgestück einer Stückelung („Wer sie zu spät gibt, gibt
 * sie als gewöhnliche Spende …") und braucht Ergänzungen.
 */
const HAUPT_MIN_EIGENSTAENDIG = 250;

/** Frage-Begriffe als Gruppen (Begriff + seine Synonyme), auf Stamm-Ebene. */
function begriffsGruppen(frage: string): string[][] {
  const gruppen: string[][] = [];
  const gesehen = new Set<string>();
  for (const t of tokens(frage)) {
    if (gesehen.has(t)) continue;
    gesehen.add(t);
    gruppen.push([t, ...(SYNONYME.get(t) ?? [])]);
  }
  return gruppen;
}

/** Trifft ein Begriff (oder eines seiner Synonyme) die Tokens eines Abschnitts? */
function trifft(gruppe: readonly string[], tok: readonly string[]): boolean {
  return gruppe.some((w) => tok.some((x) => x === w || (w.length > 4 && x.length > 4 && x.startsWith(w.slice(0, 5)))));
}

/** Ein Frage-Begriff mit seinen Unterscheidungsgewichten. */
interface Gruppe {
  woerter: string[];
  /** Gewicht über die vollen Dokumente. */
  gewicht: number;
  /** Gewicht allein über die Titelzeilen. */
  titelGewicht: number;
}

/** Titelzeile eines Dokuments: Quellenangabe + Suchbegriffe. */
function titeltext(d: KorpusDoc): string {
  return `${d.src ?? ''} ${d.k ?? ''}`;
}

/**
 * Bewertungsgrundlage eines Dokuments: Quellenangabe + Suchbegriffe + Text —
 * dieselbe Zusammenstellung, mit der auch der BM25-Index gebaut wird
 * (retrieval.ts → baueIndex). Ohne die Titelzeile fiele z. B. „Bittgebet" bei
 * „Salati-Wissen: Bittgebet vor und nach dem Essen" unter den Tisch.
 */
function volltext(d: KorpusDoc): string {
  return `${d.src ?? ''} ${d.k ?? ''} ${d.t}`;
}

/**
 * Frage-Begriffe mit ihrem UNTERSCHEIDUNGSGEWICHT innerhalb der Treffer.
 *
 * Ein Begriff, der in JEDER gefundenen Passage steht, sagt nichts darüber aus,
 * welche davon die Frage beantwortet — „Ramadan" und „Fasten" stehen bei „Was
 * bricht das Fasten im Ramadan?" in allen dreien. Entscheidend ist das Wort, das
 * nur eine einzige Passage hat („bricht"). Ohne diese Gewichtung gewann die
 * thematisch benachbarte Passage über die generischen Wörter und die Passage mit
 * der Antwort fiel heraus — gemessen in id, ms und tr.
 */
function gewichteteGruppen(frage: string, treffer: readonly KorpusDoc[]): Gruppe[] {
  const texte = treffer.map((d) => tokens(volltext(d)));
  const titel = treffer.map((d) => tokens(titeltext(d)));
  return begriffsGruppen(frage).map((woerter) => ({
    woerter,
    gewicht: 1 / Math.max(1, texte.filter((tok) => trifft(woerter, tok)).length),
    // Eigenes Gewicht für die Titelzeile: „Gebet" steht in jedem zweiten Titel,
    // „Ischa" nur in einem. Ohne diese Trennung entschied bei „Wann beginnt die
    // Zeit des Ischa-Gebets?" das generische „Gebet" im Titel des Witr-Guides
    // gegen das themengenaue „Ischa" (gemessen sw, fa).
    titelGewicht: 1 / Math.max(1, titel.filter((tok) => trifft(woerter, tok)).length),
  }));
}

/** Summe der Unterscheidungsgewichte aller Frage-Begriffe in diesem Text. */
function bewerte(text: string, gruppen: readonly Gruppe[]): number {
  const tok = tokens(text);
  let s = 0;
  for (const g of gruppen) if (trifft(g.woerter, tok)) s += g.gewicht;
  return s;
}

/**
 * Gewicht des Titels bei der Auswahl der Zitatblöcke.
 *
 * Das Dokument, das eine Frage wirklich beantwortet, trägt deren Begriffe fast
 * immer schon in der Quellenangabe („Was das Fasten bricht", „Ce qui rompt le
 * jeûne", „مفطّرات الصيام"). Der Rumpftext dagegen enthält sie auch in jedem
 * thematisch benachbarten Eintrag. Gemessen an den 168 Fragen: ohne diese
 * Gewichtung verdrängte die allgemeine Ramadan-Passage die Passage mit der
 * Antwort in acht Sprachen.
 */
const TITEL_GEWICHT = 2;

/** Auswahlwert eines Dokuments: Titeltreffer zählen doppelt und mit eigenem Gewicht. */
function auswahlwert(d: KorpusDoc, gruppen: readonly Gruppe[]): number {
  const tit = tokens(titeltext(d));
  let s = 0;
  for (const g of gruppen) if (trifft(g.woerter, tit)) s += g.titelGewicht;
  return TITEL_GEWICHT * s + bewerte(d.t, gruppen);
}

/**
 * Wählt aus einem Quellentext den zusammenhängenden Ausschnitt mit der besten
 * Frage-Abdeckung. ZUSAMMENHÄNGEND ist die entscheidende Eigenschaft: eine
 * Anleitung darf keine Löcher bekommen, deshalb wird nie „Satz 2 und Satz 7"
 * ausgewählt, sondern immer ein durchgehender Block in Quellen-Reihenfolge.
 */
/**
 * Ist der Text eine nummerierte Anleitung? Dann darf er NICHT gekürzt werden:
 * ein Wudu ohne Füßewaschen ist ungültig, und genau dieser Fehler ist dem
 * Sprachmodell in der Messung mehrfach unterlaufen. Lieber ein längeres Zitat
 * als eine unvollständige Anleitung.
 */
const AUFZAEHLUNG = /(?:^|[\s(])[\d٠-٩۰-۹০-৯]{1,2}[.)]\s/gu;
export function istAnleitung(text: string): boolean {
  return new Set(text.match(AUFZAEHLUNG) ?? []).size >= 3;
}

export function besterAusschnitt(text: string, frage: string, budget: number): string {
  if (text.length <= budget || istAnleitung(text)) return text;
  const teile = abschnitte(text);
  if (teile.length === 0) return text.slice(0, budget);
  // Innerhalb EINES Dokuments zählt jeder Frage-Begriff gleich viel — das
  // Unterscheidungsgewicht (gewichteteGruppen) trennt Dokumente voneinander,
  // nicht Sätze desselben Textes.
  const gruppen: Gruppe[] = begriffsGruppen(frage).map((woerter) => ({ woerter, gewicht: 1, titelGewicht: 1 }));
  const punkte = teile.map((a) => bewerte(a.text, gruppen));
  let beste = 0;
  for (let i = 1; i < punkte.length; i++) if (punkte[i]! > punkte[beste]!) beste = i;
  let links = beste;
  let rechts = beste;
  const laenge = (): number => teile[rechts]!.ende - teile[links]!.start;
  // Gierig zum jeweils stärkeren Nachbarn ausdehnen, solange das Budget trägt.
  for (;;) {
    const kannLinks = links > 0;
    const kannRechts = rechts < teile.length - 1;
    if (!kannLinks && !kannRechts) break;
    const wertLinks = kannLinks ? punkte[links - 1]! : -1;
    const wertRechts = kannRechts ? punkte[rechts + 1]! : -1;
    // Bei Gleichstand nach RECHTS: die Quellen-Reihenfolge bleibt so eher intakt
    // (Schritt 1 vor Schritt 2), und Erklärungen folgen ihrem Stichwort.
    const nachRechts = kannRechts && wertRechts >= wertLinks;
    const naechsteLaenge = nachRechts ? teile[rechts + 1]!.ende - teile[links]!.start : teile[rechts]!.ende - teile[links - 1]!.start;
    if (naechsteLaenge > budget) break;
    if (nachRechts) rechts++;
    else links--;
    if (laenge() >= budget) break;
  }
  return saeubere(text.slice(teile[links]!.start, teile[rechts]!.ende));
}

/**
 * Verwaiste Satzzeichen am Anfang eines Ausschnitts entfernen — etwa die
 * schließende Klammer, wenn der Schnitt hinter einem Punkt INNERHALB einer
 * Klammer lag („… (Sunnah.) 8. Ohren streichen …"). Es wird nur abgeschnitten,
 * nie etwas eingefügt oder ersetzt: der Rest bleibt wörtlich.
 */
function saeubere(ausschnitt: string): string {
  return ausschnitt.replace(/^[\s)\]}»"'“”„,;:.·•–—-]+/u, '').trim();
}

/**
 * Deterministische, extraktive Antwort: die beste Passage wörtlich, dazu
 * höchstens zwei Ergänzungen, die dieselbe Frage wirklich treffen.
 *
 * Kein Sprachmodell im Spiel: die Antwort ist damit reproduzierbar, sofort
 * verfügbar (kein 1,1-GB-Download), in der Sprache des Korpus und per
 * Konstruktion nicht erfindbar.
 */
export function waehleZitate(frage: string, treffer: readonly KorpusDoc[]): ZitatBlock[] {
  if (treffer.length === 0) return [];
  const gruppen = gewichteteGruppen(frage, treffer);
  const bloecke: ZitatBlock[] = [];
  // Die Hauptquelle bleibt der erste Retrieval-Treffer. Sie stattdessen nach
  // dem Unterscheidungsgewicht zu wählen wurde gemessen und VERWORFEN: über
  // alle 168 Fragen fiel die Trefferquote von 150 auf 125. Das Gewicht zählt
  // nur, OB ein Begriff im Dokument vorkommt — ohne Häufigkeit, Seltenheit und
  // Dokumentlänge, die das BM25-Retrieval berücksichtigt. Als Reihenfolge unter
  // gleichrangigen Ergänzungen taugt es, als Ersatz für das Retrieval nicht.
  const haupt = treffer[0]!;
  const hauptText = besterAusschnitt(haupt.t, frage, HAUPT_BUDGET);
  bloecke.push({ id: haupt.id, src: haupt.src, text: hauptText });
  // Steht schon in der QUELLENANGABE der Hauptquelle jeder Begriff der Frage,
  // bleibt es bei ihr. Das ist der wirksamste Filter gegen thematisch
  // benachbarte Zusatzpassagen: bei „Wer ist Allah?" hängten sonst die
  // Alltagsformeln und Tawakkul mit dran, bei „Und bei Frauen?" die
  // Mehrehe-Texte.
  // Warum die Quellenangabe und nicht der ganze Text: ein Dokument, das die
  // Frageworte nur irgendwo im Fließtext hat, ist nicht ihr Thema. „¿Quién es
  // Alá?" traf so die Reise-Dua (sie enthält „quien" und „Allah") und der
  // Eintrag „Quién es Allah" auf Platz 2 fiel weg.
  // Und warum die reine ANWESENHEIT statt der gewichteten Summe: die Gewichte
  // hängen von der Zahl der Treffer ab, diese Frage darf das nicht.
  // Die Längenbedingung schützt davor, ein kurzes Folgestück einer Stückelung
  // für eine vollständige Antwort zu halten (gemessen bei „Wie viel Zakat?").
  const hauptTok = tokens(titeltext(haupt));
  const eigenstaendig = hauptText.length >= HAUPT_MIN_EIGENSTAENDIG;
  if (eigenstaendig && gruppen.length > 0 && gruppen.every((g) => trifft(g.woerter, hauptTok))) return bloecke;
  let verbraucht = hauptText.length;
  const bereits = new Set(tokens(hauptText));
  // Ergänzungen nach ihrem Unterscheidungswert, nicht nach Retrieval-Rang: sonst
  // verbraucht die thematisch benachbarte Passage auf Platz 2 den Platz, den die
  // eigentliche Antwort auf Platz 3 gebraucht hätte (gemessen tr, „Was bricht
  // das Fasten?" — „Schawwal" verdrängte „Was das Fasten bricht").
  const kandidaten = treffer
    .slice(1)
    .map((d, i) => ({ d, i, punkte: bewerte(volltext(d), gruppen), wert: auswahlwert(d, gruppen) }))
    .sort((a, b) => b.wert - a.wert || a.i - b.i);
  for (const { d, punkte } of kandidaten) {
    if (bloecke.length >= MAX_BLOECKE) break;
    if (verbraucht >= GESAMT_BUDGET) break;
    // Ein einziger Frage-Begriff genügt. Die frühere Schwelle („mindestens so
    // gut wie die Hauptquelle") warf in sieben Fällen genau das Dokument weg,
    // das die Frage beantwortet — es stand auf Platz 2 oder 3, während die
    // Hauptquelle über generische Wörter des Themenfelds vorne lag (tr „Was
    // bricht das Fasten?", fr „Wie viel Zakat?", ms/fa Tayammum, fa Rückfrage,
    // fa/sw Ischa). Gegen Rauschen wirken die Regel oben (Quellenangabe deckt
    // die Frage schon ab) und die Regel unten (neuer Inhalt nötig).
    if (punkte <= 0) continue;
    const rest = Math.min(ERGAENZUNG_BUDGET, GESAMT_BUDGET - verbraucht);
    const text = besterAusschnitt(d.t, frage, rest);
    const tok = tokens(text);
    if (tok.length === 0) continue;
    const neu = tok.filter((w) => !bereits.has(w));
    if (neu.length / tok.length < ERGAENZUNG_MIN_NEU) continue;
    bloecke.push({ id: d.id, src: d.src, text });
    for (const w of tok) bereits.add(w);
    verbraucht += text.length;
  }
  return inQuellenReihenfolge(bloecke);
}

/** Nummer eines Korpus-Stücks: „w-zakat-al-fitr" → 0, „w-zakat-al-fitr-1" → 1. */
const STUECK = /-(\d+)$/;

/**
 * Blöcke derselben Quellenangabe zusammenrücken und in Stückelungs-Reihenfolge
 * bringen. Ohne das stand bei „Wie viel Zakat muss man zahlen?" die Fortsetzung
 * eines Textes über seinem Anfang — beides korrekt zitiert, aber verkehrt herum
 * zu lesen.
 */
function inQuellenReihenfolge(bloecke: readonly ZitatBlock[]): ZitatBlock[] {
  const gruppen: ZitatBlock[][] = [];
  for (const b of bloecke) {
    const vorhanden = gruppen.find((g) => g[0]!.src === b.src);
    if (vorhanden) vorhanden.push(b);
    else gruppen.push([b]);
  }
  const nummer = (b: ZitatBlock): number => Number(STUECK.exec(b.id)?.[1] ?? 0);
  return gruppen.flatMap((g) => [...g].sort((a, b) => nummer(a) - nummer(b)));
}

/** Zitatblöcke als Antworttext — je Abschnitt die Quellenangabe darunter. */
export function formatiereZitate(bloecke: readonly ZitatBlock[]): string {
  return bloecke.map((b) => `„${b.text}“\n— ${b.src}`).join('\n\n');
}

/** Wie die angezeigte Antwort zustande kam. */
export type Auswahlweg =
  /** Ein Sprachmodell hat die Sätze ausgewählt, die Erzwingung hat sie bestätigt. */
  | 'modell'
  /** Deterministische Auswahl aus den Treffern (der Normalfall). */
  | 'programm'
  /** Vom Modell blieb nichts Belegtes übrig — die beste Quelle wörtlich. */
  | 'rueckfall';

export interface ZitatAntwort {
  bloecke: ZitatBlock[];
  text: string;
  weg: Auswahlweg;
  /** Sätze einer Modellantwort, die die Erzwingung verworfen hat. */
  verworfen: string[];
}

/**
 * Die Antwort im Zitat-Modus.
 *
 * Ohne `rohantwort` (der ausgelieferte Weg): rein programmatische Auswahl.
 * Mit `rohantwort` (Modell als Auswahlhilfe): jeder Satz des Modells muss die
 * Erzwingung passieren; bleibt nichts übrig, wird auf die programmatische
 * Auswahl zurückgefallen — der Nutzer bekommt IMMER etwas Belegtes, nie eine
 * leere und nie eine erfundene Antwort.
 */
export function zitatAntwort(frage: string, treffer: readonly KorpusDoc[], rohantwort?: string): ZitatAntwort {
  const programm = waehleZitate(frage, treffer);
  if (rohantwort === undefined) {
    return { bloecke: programm, text: formatiereZitate(programm), weg: 'programm', verworfen: [] };
  }
  const { belegt, unbelegt } = pruefeAntwort(rohantwort, treffer);
  if (belegt.length === 0) {
    return { bloecke: programm, text: formatiereZitate(programm), weg: 'rueckfall', verworfen: unbelegt };
  }
  // Jeden belegten Satz seiner Quelle zuordnen und benachbarte Sätze derselben
  // Quelle zu einem Block zusammenfassen — sonst stünde unter jedem Satz eine
  // eigene Quellenzeile.
  const bloecke: ZitatBlock[] = [];
  for (const satz of belegt) {
    const norm = normalisiereZitat(satz);
    const quelle = treffer.find((d) => normalisiereZitat(d.t).includes(norm)) ?? treffer[0]!;
    const letzter = bloecke[bloecke.length - 1];
    if (letzter && letzter.id === quelle.id) letzter.text = `${letzter.text}\n${satz}`;
    else bloecke.push({ id: quelle.id, src: quelle.src, text: satz });
  }
  return { bloecke, text: formatiereZitate(bloecke), weg: 'modell', verworfen: unbelegt };
}
