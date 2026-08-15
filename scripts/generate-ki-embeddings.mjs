// Einmalig auszuführen, wenn sich ein Korpus der Salati KI ändert
// (public/rag/korpus-de.json bzw. build/ki-korpus/korpus-<lang>.json).
//
// Erzeugt vorberechnete, int8-quantisierte Satz-Embeddings für die
// Stufe-2-Semantiksuche (Cosine-Similarity, kombiniert mit dem bestehenden
// Keyword-/BM25-Retrieval in public/rag/suche.js — ersetzt es NICHT).
//
// Modell: Xenova/multilingual-e5-small (384-dim, ~118 MB int8-ONNX).
// Ausprobiert wurde zuerst das kleinere Xenova/all-MiniLM-L6-v2 (~23 MB) —
// das ist aber englisch-trainiert und lieferte auf dem überwiegend
// deutschen Korpus bei Stichproben irrelevante Top-Treffer (z. B. bei
// "Was tun bei Streit in der Ehe?" thematisch beliebige Verse statt Koran
// 4:35/4:128, die genau davon handeln). multilingual-e5-small liefert auf
// denselben Stichproben deutlich relevantere Treffer (0.83+ statt 0.4-0.5
// Cosine-Sim, inhaltlich passend) — Qualität wiegt hier schwerer als die
// zusätzlichen ~95 MB, siehe Trade-off-Dokumentation im Abschlussbericht.
// E5-Konvention: Passagen mit "passage: " prefixen, Queries mit "query: ".
//
// MEHRSPRACHIGKEIT: Seit es je App-Sprache einen eigenen Korpus gibt
// (scripts/build-ki-korpus.mjs), läuft dieses Skript je Sprache und schreibt
// embeddings-<lang>.bin + .meta.json. Dass multilingual-e5-small dafür taugt,
// ist keine Annahme: Es ist die E5-Portierung von Microsofts
// `intfloat/multilingual-e5-small`, initialisiert aus XLM-RoBERTa und auf
// dessen 100-Sprachen-Vokabular (250k SentencePiece-Token) trainiert. Alle 14
// App-Sprachen — de en tr ar es fr ru id ms bn ur fa ps sw — liegen in diesen
// 100 Sprachen; XLM-R deckt sie ausdrücklich ab (Conneau et al. 2020, Tab. 6:
// u. a. Paschtu, Suaheli, Bengalisch, Urdu, Malaiisch). Genau deshalb wurde es
// hier schon für den deutschen Korpus dem englisch-trainierten
// all-MiniLM-L6-v2 vorgezogen; für die anderen 13 Sprachen gilt derselbe
// Grund noch stärker. Nachgemessen wird es trotzdem je Sprache: siehe
// belegeSprachtauglichkeit() unten — echte Nutzerfragen in der Zielsprache,
// rein semantisch gesucht, mit dem Top-1-Treffer im Konsolen-Bericht.
//
// Ausführen: cd apps/mobile && node scripts/generate-ki-embeddings.mjs
//            node scripts/generate-ki-embeddings.mjs --sprachen=alle
//            node scripts/generate-ki-embeddings.mjs --sprachen=tr,ru
// Benötigt @huggingface/transformers als devDependency (bereits in package.json).
import { pipeline } from '@huggingface/transformers';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { SPRACHEN } from './lib/quran-editions.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const RAG_DIR = path.join(HIER, '..', 'public', 'rag');
// Nur die deutschen Embeddings gehören ins Repo/Bundle: allein die Web-Version
// (public/ki.html) nutzt Stufe 2, nativ läuft bisher reines BM25 (siehe
// Kopfkommentar in src/features/ki/retrieval.ts). Die übrigen 13 liegen darum
// neben ihren Korpora unter build/ und werden erst dann nach R2 geladen, wenn
// eine der beiden Seiten sie tatsächlich abruft — sie jetzt schon
// mitauszuliefern wären 35 MB ohne Nutzen.
const BUILD_DIR = path.join(HIER, '..', 'build', 'ki-korpus');
const MODELL = 'Xenova/multilingual-e5-small';
const DIM = 384;

const korpusPfad = (lang) => (lang === 'de' ? path.join(RAG_DIR, 'korpus-de.json') : path.join(BUILD_DIR, `korpus-${lang}.json`));
const zielDir = (lang) => (lang === 'de' ? RAG_DIR : BUILD_DIR);

async function main() {
  const arg = process.argv.find((a) => a.startsWith('--sprachen='));
  const wunsch = arg ? arg.slice('--sprachen='.length) : 'de';
  const ziele = wunsch === 'alle' ? SPRACHEN : wunsch.split(',').map((s) => s.trim()).filter(Boolean);

  const extractor = await pipeline('feature-extraction', MODELL, { dtype: 'q8' });
  for (const lang of ziele) {
    if (!existsSync(korpusPfad(lang))) {
      console.log(`${lang}: Korpus fehlt (${korpusPfad(lang)}) — erst node scripts/build-ki-korpus.mjs`);
      continue;
    }
    await eineSprache(extractor, lang);
  }
}

async function eineSprache(extractor, lang) {
  const korpus = JSON.parse(readFileSync(korpusPfad(lang), 'utf8'));
  const docs = korpus.docs;
  console.log(`\n[${lang}] ${docs.length.toLocaleString('de')} Dokumente, Modell ${MODELL} …`);
  mkdirSync(zielDir(lang), { recursive: true });

  const int8 = new Int8Array(docs.length * DIM);
  const BATCH = 64;
  const start = Date.now();
  for (let i = 0; i < docs.length; i += BATCH) {
    const batch = docs.slice(i, i + BATCH);
    // Gleicher Text wie im Retrieval-Index (src + t), s. baueIndex() in suche.js —
    // so trägt auch die Quellenangabe (z. B. Suren-/Kursname) zum Embedding bei.
    // "passage: "-Prefix ist E5-Konvention (asymmetrische Query/Passage-Embeddings).
    const texte = batch.map((d) => `passage: ${d.src ?? ''} ${d.t}`.trim());
    const out = await extractor(texte, { pooling: 'mean', normalize: true });
    const data = out.data; // Float32Array, [batch.length * DIM], bereits L2-normalisiert
    for (let b = 0; b < batch.length; b++) {
      for (let k = 0; k < DIM; k++) {
        const v = data[b * DIM + k];
        // int8-Quantisierung: normalisierte Werte liegen in [-1, 1] -> *127, gerundet.
        int8[(i + b) * DIM + k] = Math.max(-127, Math.min(127, Math.round(v * 127)));
      }
    }
    if ((i / BATCH) % 10 === 0) {
      const pct = Math.round(((i + batch.length) / docs.length) * 100);
      console.log(`  ${pct}% (${i + batch.length}/${docs.length}) …`);
    }
  }
  const sekunden = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`  Fertig in ${sekunden}s.`);

  await belegeSprachtauglichkeit(extractor, lang, docs, int8);

  const binPfad = path.join(zielDir(lang), `embeddings-${lang}.bin`);
  const metaPfad = path.join(zielDir(lang), `embeddings-${lang}.meta.json`);
  writeFileSync(binPfad, Buffer.from(int8.buffer));
  writeFileSync(
    metaPfad,
    JSON.stringify({
      v: 1,
      model: MODELL,
      sprache: lang,
      dim: DIM,
      quant: 'int8', // Wert = int8 / 127 (Embeddings sind unit-normalisiert -> Dot-Product == Cosine)
      count: docs.length,
      // Einfache Prüfsumme, damit sucheHybrid() erkennt, wenn der Korpus
      // geändert wurde, ohne dass die Embeddings neu generiert wurden
      // (Reihenfolge/Anzahl der Docs muss zu embeddings-<lang>.bin passen).
      letzteId: docs[docs.length - 1]?.id ?? null,
    }, null, 2),
  );
  console.log(`Geschrieben: ${binPfad} (${(int8.length).toLocaleString('de')} Bytes)`);
  console.log(`Geschrieben: ${metaPfad}`);
}

/**
 * BELEG, dass multilingual-e5-small in DIESER Sprache wirklich trennscharf ist
 * — statt sich auf das Wort „multilingual" im Modellnamen zu verlassen.
 *
 * Gemessen wird das, worauf es ankommt: Drei echte Nutzerfragen aus dem
 * Eval-Katalog (scripts/data/ki-eval-fragen.json) werden in DIESER Sprache als
 * Query eingebettet; gewinnt dabei rein semantisch (ohne Keyword-Suche) eines
 * der erwarteten Dokumente, beherrscht das Modell die Schrift und den
 * Wortschatz. Ein Modell, das eine Schrift nicht kennt, bildet alles auf fast
 * denselben Vektor ab und trifft hier nichts.
 */
async function belegeSprachtauglichkeit(extractor, lang, docs, int8) {
  const katalogPfad = path.join(HIER, 'data', 'ki-eval-fragen.json');
  if (!existsSync(katalogPfad)) return;
  const katalog = JSON.parse(readFileSync(katalogPfad, 'utf8')).fragen.filter((e) => e.f[lang]).slice(0, 3);
  if (!katalog.length) return;
  const out = await extractor(katalog.map((e) => `query: ${e.f[lang]}`), { pooling: 'mean', normalize: true });
  const berichte = [];
  for (let q = 0; q < katalog.length; q++) {
    let bestI = 0;
    let best = -2;
    for (let di = 0; di < docs.length; di++) {
      let s = 0;
      for (let k = 0; k < DIM; k++) s += (int8[di * DIM + k] / 127) * out.data[q * DIM + k];
      if (s > best) {
        best = s;
        bestI = di;
      }
    }
    const treffer = new RegExp(katalog[q].ids).test(docs[bestI].id);
    berichte.push(`${katalog[q].id}:${treffer ? 'ok' : docs[bestI].id} ${best.toFixed(2)}`);
  }
  console.log(`  Sprach-Beleg (reine Semantik, Top-1): ${berichte.join(' · ')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
