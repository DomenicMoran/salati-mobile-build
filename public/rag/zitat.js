// Salati KI — Zitat-Modus (Web). 1:1 nach src/features/ki/zitat.ts portiert.
// Bei Änderungen BEIDE Dateien synchron halten (zitat.test.ts deckt die native
// Seite ab, ki.html nutzt diese hier).
//
// Die Antwort besteht ausschließlich aus WÖRTLICHEN Passagen der gefundenen
// Quellen. Kein Sprachmodell: gemessen am echten Gerätemodell erfand ein
// 1,5-B-Modell Verneinungen, Zahlen und Quellenangaben, auch wenn die richtige
// Passage im Prompt stand (docs/audit-2026-07-27/KI-SPRACHMESSUNG.md und
// KI-ZITATMODUS.md).
import { SYNONYME, tokens } from './suche.js';

/** Satzenden über alle 14 App-Sprachen (arab. Fragezeichen, Urdu-Punkt, Danda). */
const SATZENDE = new Set(['.', '!', '?', '…', '؟', '۔', '।']);
/** Reiner Aufzählungsmarker („3.", „۴.", „৫)") — wird mit dem Folgesatz verschmolzen. */
const NUR_MARKER = /^[\d٠-٩۰-۹০-৯]{1,3}[.)]$/u;

/** Zerlegt einen Text in Sätze/Aufzählungszeilen mit Zeichenoffsets. */
export function abschnitte(text) {
  const roh = [];
  let start = 0;
  let i = 0;
  const schiebe = (ende) => {
    const stueck = text.slice(start, ende);
    if (stueck.trim()) roh.push({ text: stueck.trim(), start, ende });
    let n = ende;
    while (n < text.length && /\s/u.test(text[n])) n++;
    start = n;
    i = n;
  };
  while (i < text.length) {
    const z = text[i];
    if (z === '\n') { schiebe(i); continue; }
    if (SATZENDE.has(z)) {
      let ende = i + 1;
      while (ende < text.length && SATZENDE.has(text[ende])) ende++;
      schiebe(ende);
      continue;
    }
    i++;
  }
  if (start < text.length && text.slice(start).trim()) roh.push({ text: text.slice(start).trim(), start, ende: text.length });
  const out = [];
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
 * Vergleichsform für die Belegprüfung: glättet NUR Groß-/Kleinschreibung,
 * Leerraum und Satzzeichen. Satzzeichen werden zu LEERRAUM, nicht gelöscht —
 * sonst würde „2,5" zu „25" und eine erfundene Zahl käme als belegt durch.
 */
export function normalisiereZitat(text) {
  const gefaltet = text.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}]/gu, ' ').replace(/\s+/gu, ' ').trim();
  return ` ${gefaltet} `;
}

/** Mindestwortzahl eines belegbaren Satzes — „Ja."/„Nein." sind Stellungnahmen, keine Zitate. */
const MIN_WOERTER = 2;

/** DIE ERZWINGUNG: behält nur Sätze, die wörtlich in einer Quelle stehen. */
export function pruefeAntwort(antwort, quellen) {
  const quellenNorm = quellen.map((q) => normalisiereZitat(q.t));
  const belegt = [];
  const unbelegt = [];
  const gesehen = new Set();
  for (const a of abschnitte(antwort)) {
    const norm = normalisiereZitat(a.text);
    const woerter = norm.trim() ? norm.trim().split(' ').length : 0;
    if (woerter < MIN_WOERTER) {
      if (woerter > 0) unbelegt.push(a.text);
      continue;
    }
    if (!quellenNorm.some((q) => q.includes(norm))) { unbelegt.push(a.text); continue; }
    if (gesehen.has(norm)) continue;
    gesehen.add(norm);
    belegt.push(a.text);
  }
  return { belegt, unbelegt };
}

// ---------- Programmatische Auswahl ----------

const HAUPT_BUDGET = 1000;
const ERGAENZUNG_BUDGET = 600;
const GESAMT_BUDGET = 1600;
const ERGAENZUNG_MIN_NEU = 0.5;
const MAX_BLOECKE = 3;
const HAUPT_MIN_EIGENSTAENDIG = 250;

function begriffsGruppen(frage) {
  const gruppen = [];
  const gesehen = new Set();
  for (const t of tokens(frage)) {
    if (gesehen.has(t)) continue;
    gesehen.add(t);
    gruppen.push([t, ...(SYNONYME.get(t) ?? [])]);
  }
  return gruppen;
}

function trifft(gruppe, tok) {
  return gruppe.some((w) => tok.some((x) => x === w || (w.length > 4 && x.length > 4 && x.startsWith(w.slice(0, 5)))));
}

/** Bewertungsgrundlage wie im BM25-Index: Quellenangabe + Suchbegriffe + Text. */
function volltext(d) {
  return `${d.src ?? ''} ${d.k ?? ''} ${d.t}`;
}

/** Titelzeile eines Dokuments: Quellenangabe + Suchbegriffe. */
function titeltext(d) {
  return `${d.src ?? ''} ${d.k ?? ''}`;
}

/**
 * Frage-Begriffe mit ihrem UNTERSCHEIDUNGSGEWICHT innerhalb der Treffer: ein
 * Wort, das in jeder gefundenen Passage steht, sagt nichts darüber aus, welche
 * die Frage beantwortet. Für die Titelzeile gilt ein eigenes Gewicht — „Gebet"
 * steht in jedem zweiten Titel, „Ischa" nur in einem.
 */
function gewichteteGruppen(frage, treffer) {
  const texte = treffer.map((d) => tokens(volltext(d)));
  const titel = treffer.map((d) => tokens(titeltext(d)));
  return begriffsGruppen(frage).map((woerter) => ({
    woerter,
    gewicht: 1 / Math.max(1, texte.filter((tok) => trifft(woerter, tok)).length),
    titelGewicht: 1 / Math.max(1, titel.filter((tok) => trifft(woerter, tok)).length),
  }));
}

function bewerte(text, gruppen) {
  const tok = tokens(text);
  let s = 0;
  for (const g of gruppen) if (trifft(g.woerter, tok)) s += g.gewicht;
  return s;
}

/** Titeltreffer zählen bei der Blockauswahl doppelt und mit eigenem Gewicht. */
const TITEL_GEWICHT = 2;

function auswahlwert(d, gruppen) {
  const tit = tokens(titeltext(d));
  let s = 0;
  for (const g of gruppen) if (trifft(g.woerter, tit)) s += g.titelGewicht;
  return TITEL_GEWICHT * s + bewerte(d.t, gruppen);
}

/** Nummerierte Anleitung? Die wird NIE gekürzt — ein Wudu ohne Füßewaschen ist ungültig. */
const AUFZAEHLUNG = /(?:^|[\s(])[\d٠-٩۰-۹০-৯]{1,2}[.)]\s/gu;
export function istAnleitung(text) {
  return new Set(text.match(AUFZAEHLUNG) ?? []).size >= 3;
}

function saeubere(ausschnitt) {
  return ausschnitt.replace(/^[\s)\]}»"'“”„,;:.·•–—-]+/u, '').trim();
}

/** Zusammenhängender Ausschnitt mit der besten Frage-Abdeckung (nie mit Löchern). */
export function besterAusschnitt(text, frage, budget) {
  if (text.length <= budget || istAnleitung(text)) return text;
  const teile = abschnitte(text);
  if (teile.length === 0) return text.slice(0, budget);
  const gruppen = begriffsGruppen(frage).map((woerter) => ({ woerter, gewicht: 1, titelGewicht: 1 }));
  const punkte = teile.map((a) => bewerte(a.text, gruppen));
  let beste = 0;
  for (let i = 1; i < punkte.length; i++) if (punkte[i] > punkte[beste]) beste = i;
  let links = beste;
  let rechts = beste;
  const laenge = () => teile[rechts].ende - teile[links].start;
  for (;;) {
    const kannLinks = links > 0;
    const kannRechts = rechts < teile.length - 1;
    if (!kannLinks && !kannRechts) break;
    const wertLinks = kannLinks ? punkte[links - 1] : -1;
    const wertRechts = kannRechts ? punkte[rechts + 1] : -1;
    const nachRechts = kannRechts && wertRechts >= wertLinks;
    const naechsteLaenge = nachRechts ? teile[rechts + 1].ende - teile[links].start : teile[rechts].ende - teile[links - 1].start;
    if (naechsteLaenge > budget) break;
    if (nachRechts) rechts++;
    else links--;
    if (laenge() >= budget) break;
  }
  return saeubere(text.slice(teile[links].start, teile[rechts].ende));
}

const STUECK = /-(\d+)$/;

/** Blöcke derselben Quellenangabe zusammenrücken und in Stückelungs-Reihenfolge bringen. */
function inQuellenReihenfolge(bloecke) {
  const gruppen = [];
  for (const b of bloecke) {
    const vorhanden = gruppen.find((g) => g[0].src === b.src);
    if (vorhanden) vorhanden.push(b);
    else gruppen.push([b]);
  }
  const nummer = (b) => Number(STUECK.exec(b.id)?.[1] ?? 0);
  return gruppen.flatMap((g) => [...g].sort((a, b) => nummer(a) - nummer(b)));
}

/** Deterministische, extraktive Auswahl: beste Passage wörtlich + passende Ergänzungen. */
export function waehleZitate(frage, treffer) {
  if (treffer.length === 0) return [];
  const gruppen = gewichteteGruppen(frage, treffer);
  const bloecke = [];
  const haupt = treffer[0];
  const hauptText = besterAusschnitt(haupt.t, frage, HAUPT_BUDGET);
  bloecke.push({ id: haupt.id, src: haupt.src, text: hauptText });
  // Steht schon in der QUELLENANGABE der Hauptquelle jeder Begriff der Frage,
  // bleibt es bei ihr — der wirksamste Filter gegen benachbarte Zusatzpassagen.
  const hauptTok = tokens(titeltext(haupt));
  const eigenstaendig = hauptText.length >= HAUPT_MIN_EIGENSTAENDIG;
  if (eigenstaendig && gruppen.length > 0 && gruppen.every((g) => trifft(g.woerter, hauptTok))) return bloecke;
  let verbraucht = hauptText.length;
  const bereits = new Set(tokens(hauptText));
  // Ergänzungen nach ihrem Auswahlwert, nicht nach Retrieval-Rang.
  const kandidaten = treffer
    .slice(1)
    .map((d, i) => ({ d, i, punkte: bewerte(volltext(d), gruppen), wert: auswahlwert(d, gruppen) }))
    .sort((a, b) => b.wert - a.wert || a.i - b.i);
  for (const { d, punkte } of kandidaten) {
    if (bloecke.length >= MAX_BLOECKE) break;
    if (verbraucht >= GESAMT_BUDGET) break;
    if (punkte <= 0) continue;
    const rest = Math.min(ERGAENZUNG_BUDGET, GESAMT_BUDGET - verbraucht);
    const text = besterAusschnitt(d.t, frage, rest);
    const tok = tokens(text);
    if (tok.length === 0) continue;
    if (tok.filter((w) => !bereits.has(w)).length / tok.length < ERGAENZUNG_MIN_NEU) continue;
    bloecke.push({ id: d.id, src: d.src, text });
    for (const w of tok) bereits.add(w);
    verbraucht += text.length;
  }
  return inQuellenReihenfolge(bloecke);
}

/** Zitatblöcke als Antworttext — je Abschnitt die Quellenangabe darunter. */
export function formatiereZitate(bloecke) {
  return bloecke.map((b) => `„${b.text}“\n— ${b.src}`).join('\n\n');
}

/**
 * Die Antwort im Zitat-Modus.
 * Ohne `rohantwort` (der ausgelieferte Weg): rein programmatische Auswahl.
 * Mit `rohantwort`: jeder Satz muss die Erzwingung passieren; bleibt nichts
 * übrig, wird auf die programmatische Auswahl zurückgefallen.
 */
export function zitatAntwort(frage, treffer, rohantwort) {
  const programm = waehleZitate(frage, treffer);
  if (rohantwort === undefined) {
    return { bloecke: programm, text: formatiereZitate(programm), weg: 'programm', verworfen: [] };
  }
  const { belegt, unbelegt } = pruefeAntwort(rohantwort, treffer);
  if (belegt.length === 0) {
    return { bloecke: programm, text: formatiereZitate(programm), weg: 'rueckfall', verworfen: unbelegt };
  }
  const bloecke = [];
  for (const satz of belegt) {
    const norm = normalisiereZitat(satz);
    const quelle = treffer.find((d) => normalisiereZitat(d.t).includes(norm)) ?? treffer[0];
    const letzter = bloecke[bloecke.length - 1];
    if (letzter && letzter.id === quelle.id) letzter.text = `${letzter.text}\n${satz}`;
    else bloecke.push({ id: quelle.id, src: quelle.src, text: satz });
  }
  return { bloecke, text: formatiereZitate(bloecke), weg: 'modell', verworfen: unbelegt };
}
