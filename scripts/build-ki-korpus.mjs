// Baut die Quellen-Korpora der Salati-KI: public/rag/korpus-de.json (im Bundle)
// und build/ki-korpus/korpus-<lang>.json für die übrigen 13 App-Sprachen.
//
// Hintergrund 1 (2026-07-27, Retrieval): Der Korpus bestand zu 94 % aus
// EINZELNEN Koran-Versen. Auf Grundfragen wie „Was ist Ischa?", „Wie mache ich
// Wudu?", „Wer ist der letzte Prophet?" fand die KI deshalb entweder gar nichts
// oder nur thematisch entfernte Verse. Lösung: dieselben bereits geprüften
// App-Inhalte, die der Nutzer im Studium sieht, kommen vollständig in den
// KI-Korpus — plus eine kuratierte Wissensschicht für die Grundlagen.
//
// Hintergrund 2 (2026-07-27, Mehrsprachigkeit): Am echten Gerätemodell
// (Qwen2.5-1.5B-Instruct Q4_K_M) wurde gemessen, dass es aus DEUTSCHEN Quellen
// nicht zuverlässig in andere Sprachen antworten kann — es erfindet und
// verfälscht (vollständiges Protokoll im Kopf von src/features/ki/sprachen.ts:
// „bis zu den Handgelenken" -> „up to the elbow", „fünfzehn tägliche Gebete"
// auf Russisch, Wortsalat auf bn/ur/fa/ps). Ein besserer Prompt hilft dagegen
// nicht. Was hilft: QUELLEN IN DER ZIELSPRACHE. Dann muss das Modell nur noch
// nah am Wortlaut bleiben, statt zu übersetzen. Genau das baut dieses Skript.
//
// Quellen je Sprache (alle bereits in der App bzw. veröffentlichte Ausgaben):
//   q:*            Koran-Übersetzung   — api.alquran.cloud, Ausgabe je Sprache
//                                        (scripts/lib/quran-editions.mjs)
//   d:*            geprüfte Duas       — src/features/duas/data/duas.json
//   h-nawawi-*     40 Hadithe Nawawis  — src/features/study/data/nawawi40.json
//   k-<kurs>-*     Kurstexte           — src/features/study/data/*.json
//   g-<guide>-*    Praxis-Guides       — src/features/guides/guides.json
//   w-*            kuratiertes Wissen  — src/features/ki/wissen-*.json (de) bzw.
//                                        wissen-<lang>.json (Übersetzung)
//
// Fehlt eine Quelle in einer Sprache, fällt NUR dieses Dokument auf Deutsch
// zurück und bekommt das Feld `fb: 1`. Die App zählt diese Dokumente und kann
// ehrlich anzeigen, dass Teile der Quellen deutsch sind, statt so zu tun, als
// sei alles übersetzt. Der Dateikopf trägt die Gesamtzahl (`fallback`).
//
// Deutsch bleibt die Referenz: Der bestehende korpus-de.json definiert Bestand
// und Reihenfolge der Koran-/Dua-/Hadith-Dokumente (q:, d:, h-nawawi-). Alle
// Sprachen bekommen exakt DIESE IDs — dadurch sind Trefferlisten sprachüber-
// greifend vergleichbar (scripts/ki-retrieval-eval.mjs prüft gegen Doc-IDs).
//
// Ausführen: cd apps/mobile && node scripts/build-ki-korpus.mjs           (alle)
//            node scripts/build-ki-korpus.mjs --sprachen=de,tr            (Auswahl)
// Danach IMMER: node scripts/generate-ki-embeddings.mjs
//               node scripts/upload-ki-korpus-r2.mjs   (13 Nicht-de-Korpora)
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { KORAN_AUSGABEN, ladeAusgabe, SPRACHEN } from './lib/quran-editions.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MOBILE = path.join(HIER, '..');
const KI_DIR = path.join(MOBILE, 'src', 'features', 'ki');
const KORPUS_DE = path.join(MOBILE, 'public', 'rag', 'korpus-de.json');
// Nicht-deutsche Korpora landen NICHT in public/ (das wird beim Web-Export
// komplett mitkopiert und läge sonst zusätzlich im App-Bundle). Sie gehen nach
// Cloudflare R2 und werden von der App bei Bedarf geladen — siehe
// scripts/upload-ki-korpus-r2.mjs und src/features/ki/korpus.ts.
const AUSGABE_DIR = path.join(MOBILE, 'build', 'ki-korpus');
const lies = (p) => JSON.parse(readFileSync(p, 'utf8'));

// Kurse mit Fließtext (kind: "story"). Vokabel-Kurse (madinah/amau/dialects)
// bleiben draußen: reine Wortlisten helfen der KI nicht beim Antworten.
// Zweiter Eintrag = deutsches Label, dritter = sprachneutrales Label für die
// übrigen 13 Sprachen (die Kursnamen sind arabische Fachbegriffe; der konkrete
// Lektionstitel steht ohnehin in der Zielsprache dahinter).
const KURSE = [
  ['aqida', 'Aqida', 'Aqida'],
  ['tajwid', 'Tadschwied', 'Tajwid'],
  ['nawawi40', '40 Nawawi', '40 Nawawi'],
  ['seerah', 'Seerah', 'Seerah'],
  ['prophets', 'Propheten', 'Anbiya'],
  ['sahaba', 'Sahaba', 'Sahaba'],
  ['akhlaq', 'Akhlaq', 'Akhlaq'],
  ['nikah', 'Nikah', 'Nikah'],
  ['grammar', 'Grammatik', 'Nahw'],
];

// Quellen-Etiketten je Sprache. Sie stehen im `src`-Feld, das dem Nutzer als
// Quellenangabe angezeigt UND mitindexiert wird — deshalb in der Zielsprache.
// Die zugehörigen Füllwörter sind in retrieval.ts (TITEL_FUELLWORT) hinterlegt,
// damit sie den Titel-Bonus nicht verwässern.
const ETIKETTEN = {
  de: { koran: 'Koran', kurs: 'Salati-Kurs', praxis: 'Salati-Praxis', wissen: 'Salati-Wissen' },
  en: { koran: 'Quran', kurs: 'Salati course', praxis: 'Salati guide', wissen: 'Salati knowledge' },
  tr: { koran: "Kur'an", kurs: 'Salati dersi', praxis: 'Salati rehberi', wissen: 'Salati bilgi' },
  ar: { koran: 'القرآن', kurs: 'درس سلاتي', praxis: 'دليل سلاتي', wissen: 'معرفة سلاتي' },
  es: { koran: 'Corán', kurs: 'Curso Salati', praxis: 'Guía Salati', wissen: 'Saber Salati' },
  fr: { koran: 'Coran', kurs: 'Cours Salati', praxis: 'Guide Salati', wissen: 'Savoir Salati' },
  ru: { koran: 'Коран', kurs: 'Курс Salati', praxis: 'Практика Salati', wissen: 'Знание Salati' },
  id: { koran: "Al-Qur'an", kurs: 'Kursus Salati', praxis: 'Panduan Salati', wissen: 'Pengetahuan Salati' },
  ms: { koran: 'Al-Quran', kurs: 'Kursus Salati', praxis: 'Panduan Salati', wissen: 'Pengetahuan Salati' },
  bn: { koran: 'কুরআন', kurs: 'সালাতি কোর্স', praxis: 'সালাতি নির্দেশিকা', wissen: 'সালাতি জ্ঞান' },
  ur: { koran: 'قرآن', kurs: 'سلاتی کورس', praxis: 'سلاتی رہنما', wissen: 'سلاتی معلومات' },
  fa: { koran: 'قرآن', kurs: 'دورهٔ سلاتی', praxis: 'راهنمای سلاتی', wissen: 'دانش سلاتی' },
  ps: { koran: 'قرآن', kurs: 'د سلاتي کورس', praxis: 'د سلاتي لارښود', wissen: 'د سلاتي پوهه' },
  sw: { koran: 'Quran', kurs: 'Kozi ya Salati', praxis: 'Mwongozo wa Salati', wissen: 'Maarifa ya Salati' },
};

// Lange Abschnitte werden an Satzgrenzen gestückelt: BM25 bevorzugt sonst
// systematisch lange Dokumente, und das LLM bekommt zu viel Ballast pro Treffer.
const MAX = 900;
function stuecke(text) {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= MAX) return [t];
  // Satzendezeichen inkl. arabischem/persischem/urdu Punkt (۔ ؟ ।) — ohne sie
  // fänden die Skripte ohne lateinischen Punkt keine Satzgrenze und der Text
  // bliebe als EIN Riesenblock stehen.
  const saetze = t.match(/[^.!?…۔؟।]+[.!?…۔؟।]*\s*/g) ?? [t];
  const out = [];
  let akt = '';
  for (const s of saetze) {
    if (akt && (akt + s).length > MAX) {
      out.push(akt.trim());
      akt = '';
    }
    akt += s;
  }
  if (akt.trim()) out.push(akt.trim());
  return out;
}

// ---------- gemeinsam genutzte Quelldaten (einmal lesen) ----------
const basis = lies(KORPUS_DE);
const duas = lies(path.join(MOBILE, 'src', 'features', 'duas', 'data', 'duas.json')).duas;
const duaNachId = new Map(duas.map((d) => [d.id, d]));
const duaKategorie = new Map(duas.map((d) => [d.id, d.category]));
const guides = lies(path.join(MOBILE, 'src', 'features', 'guides', 'guides.json')).guides;
const kursDaten = new Map(KURSE.map(([datei]) => [datei, lies(path.join(MOBILE, 'src', 'features', 'study', 'data', `${datei}.json`))]));
const nawawiNachNummer = new Map(
  (kursDaten.get('nawawi40').lessons ?? []).map((l) => [Number(String(l.id).replace(/^\D+/, '')), l]),
);

// Deutsche Wissensdateien: alles, was NICHT `wissen-<app-sprache>.json` heißt
// (wissen-de.json gehört dazu, wissen-tr.json wäre eine Übersetzungsdatei).
const SPRACH_DATEI = new RegExp(`^wissen-(${SPRACHEN.filter((s) => s !== 'de').join('|')})\\.json$`);
const wissenDateienDe = readdirSync(KI_DIR)
  .filter((f) => /^wissen-.*\.json$/.test(f) && !SPRACH_DATEI.test(f))
  .sort();
const wissenDe = wissenDateienDe.flatMap((f) => lies(path.join(KI_DIR, f)).eintraege ?? []);

/**
 * Übersetzte Wissenseinträge einer Sprache: entweder als eine Datei
 * `wissen-<lang>.json` oder als Verzeichnis `wissen-<lang>/*.json` (mehrere
 * Übersetzer arbeiten parallel). Gleiche `id`s wie die deutschen Einträge.
 */
function ladeWissenUebersetzung(lang) {
  const treffer = new Map();
  const datei = path.join(KI_DIR, `wissen-${lang}.json`);
  const dateien = [];
  if (existsSync(datei)) dateien.push(datei);
  const ordner = path.join(KI_DIR, `wissen-${lang}`);
  if (existsSync(ordner) && statSync(ordner).isDirectory()) {
    for (const f of readdirSync(ordner).filter((f) => f.endsWith('.json')).sort()) dateien.push(path.join(ordner, f));
  }
  for (const f of dateien) for (const e of lies(f).eintraege ?? []) treffer.set(e.id, e);
  return treffer;
}

/** Text in `lang`, sonst deutsch. Gibt [text, istDeutscherFallback] zurück. */
function text(feld, lang) {
  const ziel = feld?.[lang];
  if (typeof ziel === 'string' && ziel.trim()) return [ziel, false];
  return [feld?.de ?? '', lang !== 'de'];
}

// ---------- Korpus einer Sprache ----------
async function baueKorpus(lang) {
  const E = ETIKETTEN[lang];
  const koranVerse = await ladeAusgabe(KORAN_AUSGABEN[lang]);
  const wissenUebersetzt = lang === 'de' ? new Map() : ladeWissenUebersetzung(lang);

  const docs = [];
  const gesehen = new Set();
  let fallback = 0;
  // `u` = App-Route des Dokuments (Feld für antippbare Quellen im KI-Chat).
  // Nur dort gesetzt, wo die Route NICHT aus der Doc-ID ableitbar ist: Koran
  // (q:S:A) und Hadith (h-nawawi-NN) rechnet die App selbst aus.
  function push(id, src, t, k, mindestlaenge = 25, u, deutsch = false) {
    const text = String(t ?? '').replace(/\s+/g, ' ').trim();
    if (text.length < mindestlaenge) return;
    if (gesehen.has(id)) throw new Error(`Doppelte Doc-ID: ${id}`);
    gesehen.add(id);
    const doc = { id, src, t: text };
    if (k) doc.k = k;
    if (u) doc.u = u;
    if (deutsch) {
      doc.fb = 1;
      fallback++;
    }
    docs.push(doc);
  }

  // ---------- 1. Koran, Duas, Hadithe (Bestand und Reihenfolge aus korpus-de) ----------
  let uebernommen = 0;
  for (const d of basis.docs) {
    // Ohne Mindestlänge: sehr kurze Verse sind trotzdem vollwertige Belege
    // („Alif-Lam-Mim", 112:2) und wurden von einer pauschalen 25-Zeichen-Grenze
    // fälschlich aus dem Korpus geworfen.
    if (d.id.startsWith('q:')) {
      const [, sure, vers] = d.id.split(':');
      // Surenname steht in der deutschen Quellenangabe („Koran 2:1 (Al-Baqara)")
      // — er ist die transliterierte arabische Bezeichnung und damit sprach-
      // neutral; ein zweiter API-Aufruf nur für Namen wäre Verschwendung.
      const name = /\(([^)]*)\)\s*$/.exec(d.src)?.[1] ?? '';
      const uebersetzt = koranVerse.get(`${sure}:${vers}`);
      const src = `${E.koran} ${sure}:${vers}${name ? ` (${name})` : ''}`;
      push(d.id, lang === 'de' ? d.src : src, uebersetzt ?? d.t, d.k, 0, undefined, lang !== 'de' && !uebersetzt);
      uebernommen++;
    } else if (d.id.startsWith('d:')) {
      const dua = duaNachId.get(d.id.slice(2));
      const [t, deutsch] = lang === 'de' ? [d.t, false] : text(dua?.translations, lang);
      const kategorie = duaKategorie.get(d.id.slice(2));
      push(d.id, d.src, t || d.t, d.k, 0, kategorie ? `/duas/${kategorie}` : undefined, deutsch);
      uebernommen++;
    } else if (d.id.startsWith('h-nawawi')) {
      const nummer = Number(d.id.replace(/^\D+/, ''));
      const lektion = nawawiNachNummer.get(nummer);
      const [t, deutsch] = lang === 'de' ? [d.t, false] : text(lektion?.story?.[0]?.text, lang);
      // `src` bleibt die Belegkette („an-Nawawī Nr. 4 — Sahih al-Bukhari 3208"):
      // eine Hadith-Quellenangabe ist in jeder Sprache dieselbe.
      push(d.id, d.src, t || d.t, d.k, 0, undefined, deutsch);
      uebernommen++;
    }
  }

  // ---------- 1b. Duas, die der Vorgänger-Korpus nicht kannte ----------
  // Die Schleife oben läuft über `basis.docs`, also über den ZULETZT gebauten
  // Korpus. Duas, die dort nie enthalten waren, konnten dadurch nie hinzukommen:
  // gemessen 2026-07-28 lagen nur 47 der 106 geprüften Duas im Korpus — in allen
  // 14 Sprachen. Die fehlenden 59 werden hier direkt aus duas.json ergänzt.
  let duaNachtrag = 0;
  for (const d of duas) {
    if (gesehen.has(`d:${d.id}`)) continue;
    const [uebersetzung, deutsch] = lang === 'de' ? [d.translations?.de, false] : text(d.translations, lang);
    if (!uebersetzung) continue;
    // Quellenangabe wie bei den bereits vorhandenen Dua-Dokumenten: die
    // Umschrift, gekappt — sie ist in jeder Sprache dieselbe.
    push(
      `d:${d.id}`,
      `Dua: ${String(d.transliteration ?? '').slice(0, 60)}`,
      uebersetzung,
      // KEIN Keyword-Feld: die 47 bereits vorhandenen Dua-Dokumente haben auch
      // keines. Die Umschrift mitzuindexieren klingt naheliegend, streut aber
      // die arabischen Funktionswörter der Bittgebete („'ala", „min", „bi") als
      // seltene und dadurch hoch gewichtete Tokens in den Index. Gemessen
      // 2026-07-28: die spanische Frage „Quién es Alá" fiel damit ganz aus den
      // Treffern, weil `ala` dort auch das getippte Wort ist.
      undefined,
      0,
      d.category ? `/duas/${d.category}` : undefined,
      deutsch,
    );
    duaNachtrag++;
  }

  // ---------- 2. Kurstexte ----------
  let kursDocs = 0;
  for (const [datei, labelDe, labelNeutral] of KURSE) {
    const label = lang === 'de' ? labelDe : labelNeutral;
    for (const lektion of kursDaten.get(datei).lessons ?? []) {
      const [titel] = text(lektion.title, lang);
      const abschnitte = Array.isArray(lektion.story) ? lektion.story : [];
      abschnitte.forEach((abschnitt, i) => {
        const [roh, deutsch] = text(abschnitt.text, lang);
        if (!roh) return;
        const [abschnittTitel] = text(abschnitt.title, lang);
        stuecke(roh).forEach((teil, j2) => {
          const id = `k-${datei}-${lektion.id}-${i}${j2 ? `-${j2}` : ''}`;
          // Abschnitts-Überschrift als Keyword mitindexieren (nicht im Antworttext),
          // damit z. B. „Idgham" auch trifft, wenn es nur in der Überschrift steht.
          push(id, `${E.kurs} ${label}: ${titel || lektion.id}`, teil, abschnittTitel || undefined, 25, `/study/${datei}/${lektion.id}`, deutsch);
          kursDocs++;
        });
      });
    }
  }

  // ---------- 3. Praxis-Guides ----------
  let guideDocs = 0;
  for (const g of guides) {
    const [titel] = text(g.title, lang);
    const src = `${E.praxis}: ${titel || g.id}`;
    // Ein zusammenhängender Übersichts-Text pro Guide (Intro + alle Schritte als
    // nummerierte Liste). Genau DAS braucht die KI bei „Wie mache ich Wudu?" —
    // ein Treffer, der die vollständige Antwort enthält, statt elf Bruchstücke.
    let deutsch = false;
    const schritte = (g.steps ?? [])
      .map((s, i) => {
        const [st] = text(s.title, lang);
        const [tx, tDeutsch] = text(s.text, lang);
        if (tDeutsch) deutsch = true;
        const ar = s.translit ? ` (${s.translit})` : '';
        return `${i + 1}. ${st}${ar}: ${tx}`;
      })
      .join(' ');
    const [intro, introDeutsch] = text(g.intro, lang);
    if (introDeutsch) deutsch = true;
    stuecke(`${intro} ${schritte}`).forEach((teil, j) => {
      push(`g-${g.id}${j ? `-${j}` : ''}`, src, teil, g.id, 25, `/guides/${g.id}`, deutsch);
      guideDocs++;
    });
  }

  // ---------- 4. Kuratiertes Grundwissen ----------
  let wissenDocs = 0;
  let wissenDeutsch = 0;
  for (const e of wissenDe) {
    const u = wissenUebersetzt.get(e.id);
    const hatUebersetzung = lang !== 'de' && typeof u?.text === 'string' && u.text.trim().length > 0;
    const deutsch = lang !== 'de' && !hatUebersetzung;
    if (deutsch) wissenDeutsch++;
    const titel = (hatUebersetzung && String(u.titel ?? '').trim()) || e.titel;
    // Die Belege stehen im KEYWORD-Feld, NICHT im Antworttext.
    //
    // Grund (lokal mit dem echten Modell reproduziert, 2026-07-27): Als die Zeile
    // „Belege: Koran 2:275 · Koran 2:278" Teil des Textes war, bekam das Modell
    // bei gestückelten Einträgen eine nackte Stellenliste ohne Verstext geliefert
    // — und dichtete die Verstexte dazu. Als Keyword bleiben die Belege
    // durchsuchbar, landen aber nie im Prompt.
    const schluessel = [...((hatUebersetzung && u.tags) || e.tags || []), ...(e.belege ?? [])].join(' ');
    stuecke(hatUebersetzung ? u.text : e.text).forEach((teil, j) => {
      push(`w-${e.id}${j ? `-${j}` : ''}`, `${E.wissen}: ${titel}`, teil, schluessel, 25, undefined, deutsch);
      wissenDocs++;
    });
  }

  return {
    docs,
    fallback,
    zahlen: { uebernommen: uebernommen + duaNachtrag, kursDocs, guideDocs, wissenDocs, wissenDeutsch, wissenEintraege: wissenDe.length },
  };
}

// ---------- Ausführung ----------
const arg = process.argv.find((a) => a.startsWith('--sprachen='));
const ziele = arg ? arg.slice('--sprachen='.length).split(',').map((s) => s.trim()).filter(Boolean) : SPRACHEN;
const unbekannt = ziele.filter((l) => !SPRACHEN.includes(l));
if (unbekannt.length) {
  console.error(`Unbekannte Sprache(n): ${unbekannt.join(', ')} — bekannt: ${SPRACHEN.join(', ')}`);
  process.exit(1);
}

mkdirSync(AUSGABE_DIR, { recursive: true });
console.log(`Wissensdateien (de): ${wissenDateienDe.join(', ')}`);
const fehlendesWissen = [];
const bericht = [];
// Inhaltsstempel dieses Laufs, identisch in ALLEN 14 Dateien. `v` ist eine
// Format-, keine Inhaltsversion (fest 2) und taugt deshalb nicht dazu, einen
// veralteten Cache zu erkennen. Die App vergleicht den Stempel ihres
// gebündelten deutschen Korpus mit dem der zwischengespeicherten Sprachdatei
// (features/ki/korpus.ts) — beide entstehen hier im selben Durchlauf. Ohne das
// behielt ein Gerät seinen einmal geladenen Korpus dauerhaft und bekam keine
// Korrektur mehr (gemessen 2026-07-28: `ausCacheLesen` prüfte gar nichts).
const STAND = new Date().toISOString();
for (const lang of ziele) {
  const { docs, fallback, zahlen } = await baueKorpus(lang);
  const ziel = lang === 'de' ? KORPUS_DE : path.join(AUSGABE_DIR, `korpus-${lang}.json`);
  writeFileSync(ziel, JSON.stringify({ v: 2, stand: STAND, lang, fallback, docs }));
  const bytes = statSync(ziel).size;
  if (lang !== 'de' && zahlen.wissenDeutsch > 0) fehlendesWissen.push(`${lang} (${zahlen.wissenDeutsch}/${zahlen.wissenEintraege})`);
  bericht.push({ lang, docs: docs.length, fallback, kb: Math.round(bytes / 1024) });
  console.log(
    `${lang}: ${docs.length} Dokumente (Koran/Dua/Hadith ${zahlen.uebernommen}, Kurse ${zahlen.kursDocs}, ` +
      `Guides ${zahlen.guideDocs}, Wissen ${zahlen.wissenDocs}) · deutscher Rest ${fallback} · ${Math.round(bytes / 1024)} KB -> ${path.relative(MOBILE, ziel)}`,
  );
}

console.log('\n=== Übersicht ===');
for (const b of bericht) console.log(`${b.lang.padEnd(3)} ${String(b.docs).padStart(5)} Docs · ${String(b.fallback).padStart(5)} deutsch · ${String(b.kb).padStart(5)} KB`);
if (fehlendesWissen.length) {
  console.log(`\nWissensschicht noch NICHT übersetzt (Datei src/features/ki/wissen-<lang>.json fehlt oder unvollständig):\n  ${fehlendesWissen.join(', ')}`);
}
console.log('\nNICHT VERGESSEN: node scripts/generate-ki-embeddings.mjs');
console.log('                 node scripts/upload-ki-korpus-r2.mjs');
