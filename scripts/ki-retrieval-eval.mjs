// Bewertet die Retrieval-Qualität der Salati-KI offline (ohne Gerät, ohne LLM).
//
// Warum: die KI antwortet nur so gut wie die Passagen, die sie bekommt. Wenn
// hier "0 Treffer" oder thematisch falsche Passagen stehen, kann kein Modell
// eine gute Antwort geben ("Dazu finde ich in meinen lokalen Quellen keine
// Stelle" — genau das Symptom vom 2026-07-27).
//
// Drei Betriebsarten:
//   1) DEUTSCH, ausführlich (Standard) — 103 Fragen, Erwartung als TEXTMUSTER
//      auf den Trefferpassagen. Das ist die inhaltliche Referenzmessung.
//   2) MEHRSPRACHIG (--sprachen=…) — Fragenkatalog aus scripts/data/
//      ki-eval-fragen.json, Erwartung als Muster auf der DOC-ID. Möglich ist
//      das, weil alle 14 Korpora dieselben Doc-IDs tragen (build-ki-korpus.mjs
//      leitet sie aus derselben deutschen Referenz ab). Gemessen wird damit:
//      Findet die Zielsprache dieselben Quellen wie Deutsch? Ein Textmuster je
//      Sprache zu pflegen wäre 14-mal dieselbe Arbeit mit 14-mal dem Risiko,
//      dass die Messung an der Formulierung scheitert statt am Retrieval.
//   3) BEISPIELFRAGEN (--beispielfragen) — die sechs Vorschlags-Chips des
//      leeren KI-Chats, und zwar mit dem TEXT AUS src/locales/<lang>.json, den
//      der Screen seit 2026-07-29 auch tatsächlich abschickt (Begründung in
//      src/features/ki/beispielfragen.ts). Das ist der erste Klick jedes neuen
//      Nutzers — vorher wurde er nur auf Deutsch geprüft, während am Gerät in
//      en/tr/ar „keine Stelle" herauskam.
//
// Ausführen: cd apps/mobile && node scripts/ki-retrieval-eval.mjs
//            node scripts/ki-retrieval-eval.mjs --voll        (alle Treffer-Texte)
//            node scripts/ki-retrieval-eval.mjs --sprachen=alle
//            node scripts/ki-retrieval-eval.mjs --sprachen=tr,ru
//            node scripts/ki-retrieval-eval.mjs --beispielfragen
//            node scripts/ki-retrieval-eval.mjs --beispielfragen=en,tr,ar
//
// Node >= 22 (lädt die TypeScript-Quelle direkt, kein Build-Schritt).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { baueIndex, suche } from '../src/features/ki/retrieval.ts';
import { SPRACHEN } from './lib/quran-editions.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const korpusPfad = (lang) =>
  lang === 'de'
    ? path.join(HIER, '..', 'public', 'rag', 'korpus-de.json')
    : path.join(HIER, '..', 'build', 'ki-korpus', `korpus-${lang}.json`);
const korpus = JSON.parse(readFileSync(korpusPfad('de'), 'utf8'));

// Fragenkatalog: die 7 Fragen aus dem Nutzer-Screenshot (2026-07-27) + die
// typischen Erstnutzer-Fragen einer Islam-App. `erwartet` = Regex, die in der
// Quellenangabe ODER im Text mindestens EINES der Top-Treffer vorkommen muss.
const FRAGEN = [
  // --- aus dem Screenshot (alle waren "keine Stelle" oder inhaltlich falsch) ---
  { f: 'Wer ist Allah', erwartet: /tauhid|allah|einzig|schoepfer|Ichlas|112/i },
  { f: 'Was sind die fünf Säulen', erwartet: /s(ä|ae)ul|schahada|zakat|hadsch/i },
  { f: 'Was ist isha', erwartet: /ischa|isha|nachtgebet/i },
  { f: 'Was ist magrib', erwartet: /maghrib|abendgebet/i },
  { f: 'Wie oft muss man beten', erwartet: /f(ü|ue)nf|t(ä|ae)glich|gebetszeit/i },
  { f: 'Wie mache ich wudu', erwartet: /wudu|waschung/i },
  { f: 'Wer ist der letzte Prophet', erwartet: /siegel der propheten|muhammad|33:40/i },
  // --- Gebet ---
  { f: 'Wann ist Fadschr', erwartet: /fadschr|morgengebet/i },
  { f: 'Wie viele Rakat hat das Mittagsgebet', erwartet: /rakat|dhuhr|mittagsgebet/i },
  { f: 'Was sage ich im Gebet beim Verbeugen', erwartet: /ruku|verbeug|subhaana/i },
  { f: 'Was ist der Adhan', erwartet: /adhan|gebetsruf/i },
  { f: 'Was ist das Freitagsgebet', erwartet: /dschumua|freitag/i },
  { f: 'Was macht das Gebet ungültig', erwartet: /gebet/i },
  { f: 'Wie bete ich auf Reisen', erwartet: /reise|kuerz|qasr/i },
  { f: 'Was ist die Qibla', erwartet: /qibla|kaaba|gebetsrichtung/i },
  { f: 'Wann darf man Gebete nachholen', erwartet: /nachhol|qada|gebet/i },
  { f: 'Was ist Witr', erwartet: /witr|nachtgebet/i },
  // --- Reinheit ---
  { f: 'Was bricht die Gebetswaschung', erwartet: /wudu|waschung/i },
  { f: 'Was ist Ghusl', erwartet: /ghusl|ganzkoerper/i },
  { f: 'Was ist Tayammum', erwartet: /tayammum|erde|sand/i },
  // --- Glaube ---
  { f: 'Was sind die sechs Glaubensgrundlagen', erwartet: /iman|glaubens(grundlage|artikel)|engel|vorherbestimmung/i },
  { f: 'Was bedeutet Tauhid', erwartet: /tauhid|einheit|einzig/i },
  { f: 'Was ist Schirk', erwartet: /schirk|beigesell/i },
  { f: 'Wer waren die Propheten', erwartet: /prophet|gesandt/i },
  { f: 'Was passiert nach dem Tod', erwartet: /tod|jenseit|auferstehung|grab/i },
  { f: 'Was ist das Paradies', erwartet: /paradies|dschanna|garten/i },
  { f: 'Wie heißen die Engel', erwartet: /engel|dschibril/i },
  { f: 'Was ist die Schahada', erwartet: /schahada|glaubensbekenntnis|zeugnis/i },
  // --- Säulen / Praxis ---
  { f: 'Wie viel Zakat muss ich zahlen', erwartet: /zakat|2,5|almosen/i },
  { f: 'Wann muss ich fasten', erwartet: /ramadan|fasten/i },
  { f: 'Was bricht das Fasten', erwartet: /fasten|essen|trinken/i },
  { f: 'Was ist Hadsch', erwartet: /hadsch|pilger|mekka/i },
  { f: 'Was ist Sadaqa', erwartet: /sadaqa|spende|almosen/i },
  // --- Koran / Lesen ---
  { f: 'Wie viele Suren hat der Koran', erwartet: /114|sure/i },
  { f: 'Was ist die Fatiha', erwartet: /faatiha|fatiha|er(ö|oe)ffn/i },
  { f: 'Was ist Tadschwied', erwartet: /tadschwied|tajwid|rezitat|aussprache/i },
  { f: 'Was sind Sonnen- und Mondbuchstaben', erwartet: /sonnenbuchstab|mondbuchstab/i },
  { f: 'Wie spricht man Sukun aus', erwartet: /sukun|vokallos/i },
  { f: 'Was ist eine Schadda', erwartet: /schadda|verdoppl/i },
  { f: 'Was ist Idgham', erwartet: /idgham|verschmelz/i },
  // --- Alltag / Adhkar ---
  { f: 'Welches Bittgebet sagt man vor dem Essen', erwartet: /bismillah|essen|dua/i },
  { f: 'Was sagt man wenn man das Haus verlässt', erwartet: /haus|hinaus|tawakkal/i },
  { f: 'Wie grüßt man als Muslim', erwartet: /salam|gru(ß|ss)|friede/i },
  { f: 'Was sagt man beim Niesen', erwartet: /nies|alhamdulillah|hadith/i },
  { f: 'Welche Duas gibt es zum Schlafen', erwartet: /schlaf|nacht|dua/i },
  // --- Ethik / typische Lebensfragen ---
  { f: 'Ist Alkohol verboten', erwartet: /alkohol|wein|rausch|khamr|chamr/i },
  { f: 'Darf ich Schweinefleisch essen', erwartet: /schwein/i },
  { f: 'Was sagt der Islam über die Eltern', erwartet: /eltern|mutter|vater/i },
  { f: 'Wie gehe ich mit Wut um', erwartet: /zorn|wut|nicht zornig/i },
  { f: 'Was tun bei Streit in der Ehe', erwartet: /ehe|streit|4:35|4:128/i },
  { f: 'Wie werde ich geduldiger', erwartet: /geduld|sabr/i },
  { f: 'Was sagt der Islam über Nachbarn', erwartet: /nachbar/i },
  { f: 'Ist Musik erlaubt', erwartet: /./ },
  { f: 'Was ist Riba', erwartet: /zins|wucher|riba/i },
  { f: 'Wie bereue ich eine Sünde', erwartet: /reue|tauba|vergeb/i },
  { f: 'Was hilft gegen Angst', erwartet: /angst|furcht|sorge/i },
  { f: 'Wie finde ich innere Ruhe', erwartet: /herz|ruhe|gedenken/i },
  // --- Sonstiges / Grenzfälle ---
  { f: 'Wer war Abu Bakr', erwartet: /abu bakr/i },
  { f: 'Was geschah in der Schlacht von Badr', erwartet: /badr/i },
  { f: 'Wann wurde der Prophet geboren', erwartet: /mekka|geburt|570|elefant/i },
  { f: 'Was bedeutet Bismillah', erwartet: /namen allahs|bismillah/i },
  { f: 'Was ist die Nacht der Bestimmung', erwartet: /qadr|bestimmung|97/i },
  { f: 'Was ist Eid', erwartet: /eid|fest/i },
  { f: 'Darf eine Frau ohne Kopftuch beten', erwartet: /./ },
  { f: 'Wie werde ich Muslim', erwartet: /schahada|glaubensbekenntnis|islam annehm/i },
  // --- 2026-07-27 ergänzt: die 40 im Audit gemeldeten Lücken (Stichprobe aus
  //     allen sechs Clustern; die Fragen sind so formuliert, wie ein Nutzer sie
  //     tippt, nicht wie der Eintrag heißt) ---
  { f: 'Darf ich während der Periode beten', erwartet: /menstruation|hayd|monatsblutung|periode/i },
  { f: 'Was ist Nifas', erwartet: /nifas|wochenbett|entbindung/i },
  { f: 'Wie hole ich Fastentage nach', erwartet: /nachhol|qada|fidya|andere tage/i },
  { f: 'Was muss eine Frau beim Beten bedecken', erwartet: /awra|bedeck|kopftuch|gesicht und h(ä|ae)nd/i },
  { f: 'Darf eine Frau in die Moschee', erwartet: /moschee|frauenreihe|dienerinnen/i },
  { f: 'Darf ich schwanger fasten', erwartet: /schwanger|stillen|fidya/i },
  { f: 'Was mache ich wenn ich mich im Gebet verzähle', erwartet: /sahw|vergessens|niederwerfung/i },
  { f: 'Ich komme zu spät zum Gemeinschaftsgebet', erwartet: /masbuq|imam|rakat/i },
  { f: 'Wie bete ich im Flugzeug', erwartet: /flugzeug|fahrzeug|sitzen|reise/i },
  { f: 'Wie fastet man in Skandinavien', erwartet: /nordeuropa|breitengrad|mekka|aqrab/i },
  { f: 'Was ist Tahadschud', erwartet: /tahadschud|qiyam|nachtgebet/i },
  { f: 'Was ist Tarawih', erwartet: /tarawih|ramadan|witr/i },
  { f: 'Darf ich über Socken streichen statt Füße waschen', erwartet: /khuff|socken|masch|streich/i },
  { f: 'Muss ich als Konvertit meinen Namen ändern', erwartet: /namen|konvertit|33:5|v(ä|ae)ter/i },
  { f: 'Was passiert mit meinen Sünden vor dem Islam', erwartet: /vergang|vergeb|neuanfang|tilg/i },
  { f: 'Wie sage ich meinen Eltern dass ich Muslim bin', erwartet: /eltern|familie|g(ü|ue)te|weisheit/i },
  { f: 'Was sagt der Islam über Jesus', erwartet: /isa|maryam|masih|gesandt/i },
  { f: 'Unterschied Sunniten Schiiten', erwartet: /schia|schiit|sunnit|nachfolge/i },
  { f: 'Was bedeutet Dschihad', erwartet: /dschihad|anstrengung|qital|kein zwang/i },
  { f: 'Warum muss man auf Arabisch beten', erwartet: /arabisch|fatiha|wortlaut/i },
  { f: 'Warum lässt Allah Leid zu', erwartet: /pr(ü|ue)f|leid|geduld|jenseits/i },
  { f: 'Was ist Sufismus', erwartet: /tasawwuf|sufi|ihsan/i },
  { f: 'Darf ich ein Haus mit Kredit kaufen', erwartet: /hypothek|zins|murabaha|finanzier/i },
  { f: 'Sind Aktien und ETFs erlaubt', erwartet: /aktie|etf|anteil|zins/i },
  { f: 'Sind Versicherungen erlaubt', erwartet: /versicher|takaful|pflicht/i },
  { f: 'Ist Gelatine halal', erwartet: /gelatine|zutat|e ?nummer|schwein/i },
  { f: 'Darf ich Medikamente mit Alkohol nehmen', erwartet: /medikament|zwangslage|impf|alkohol/i },
  { f: 'Darf ich im Supermarkt arbeiten wo Alkohol verkauft wird', erwartet: /arbeit|alkohol|kasse|beteilig/i },
  { f: 'Wie bekomme ich für das Freitagsgebet frei', erwartet: /freitag|arbeit|urlaub|pause/i },
  { f: 'Wie läuft eine islamische Hochzeit ab', erwartet: /nikah|wali|zeugen|mahr/i },
  { f: 'Was ist Mahr', erwartet: /mahr|morgengabe|brautgabe/i },
  { f: 'Wie funktioniert Scheidung im Islam', erwartet: /talaq|chul|idda|scheid/i },
  { f: 'Was tut man bei der Geburt eines Kindes', erwartet: /aqiqa|geburt|namensgebung|siebten tag/i },
  { f: 'Darf man ein Kind adoptieren', erwartet: /adoption|kafala|waise|pflege/i },
  { f: 'Ist Mehrehe erlaubt', erwartet: /mehrehe|vier|gerecht|4:3/i },
  { f: 'Was ist Zakat al-Fitr', erwartet: /fitr|fastenabgabe|sa(ʿ|')|eid/i },
  { f: 'Was ist das Opfertier zu Eid', erwartet: /udhiyah|opfer|qurban|dhul-hidscha/i },
  { f: 'Wie schaffe ich den Koran im Ramadan', erwartet: /khatmah|dschuz|leseplan|durchgang/i },
  // --- 2026-07-27 ergänzt: fremdsprachige Umschriften islamischer Fachbegriffe.
  //     Nutzer tippen sie in der Schreibweise IHRER Sprache, der deutsche Korpus
  //     führt aber nur die deutsche. Diese Fragen sichern die Umschrift-Gruppen
  //     in SYNONYM_GRUPPEN gegen Regressionen ab (siehe
  //     docs/audit-2026-07-27/SUCHE-UMSCHRIFTEN.md). ---
  { f: 'Was ist die alquibla', erwartet: /qibla|kaaba|gebetsrichtung/i },
  { f: 'Was ist Tecvid', erwartet: /tadschwied|tajwid|rezitat|aussprache/i },
  { f: 'Was ist die chahada', erwartet: /schahada|glaubensbekenntnis|zeugnis/i },
  { f: 'Wie macht man Abdest', erwartet: /wudu|waschung/i },
  { f: 'Was ist Teravih', erwartet: /tarawih|ramadan|witr/i },
  { f: 'Was ist Mehir', erwartet: /mahr|morgengabe|brautgabe/i },
];

const voll = process.argv.includes('--voll');

// ---------- Betriebsart 3: die sechs Vorschlags-Chips des leeren Chats ----------
//
// Geprüft wird der ANZEIGETEXT aus src/locales/<lang>.json (ki.example1…6),
// weil genau der seit 2026-07-29 abgeschickt wird, sobald ein übersetzter
// Korpus geladen ist. Erwartung als Doc-ID-Muster, identisch für alle Sprachen
// (die Korpora teilen sich die IDs). Die Grenze ist bewusst 3 Passagen: mehr
// liefert der Screen dem Zitat-Modus nicht (ki-native.tsx: suche(..., 3)).
const BEISPIEL_ERWARTUNG = [
  { key: 'example1', ids: /^(w-fuenf-saeulen|k-nawawi40-nawawi-03)/ },
  { key: 'example2', ids: /^(w-wudu-kurz|g-wudu)/ },
  { key: 'example3', ids: /^w-gebet-ischa/ },
  { key: 'example4', ids: /^w-fasten-bricht/ },
  { key: 'example5', ids: /^w-zakat/ },
  { key: 'example6', ids: /^(w-geduld|k-akhlaq-akhlaq-03)/ },
];
const BEISPIEL_PASSAGEN = 3;

const beispielArg = process.argv.find((a) => a === '--beispielfragen' || a.startsWith('--beispielfragen='));
if (beispielArg) {
  const wunsch = beispielArg.includes('=') ? beispielArg.slice('--beispielfragen='.length) : 'alle';
  // SPRACHEN kann 'de' bereits enthalten — ohne Set stünde Deutsch doppelt in
  // der Tabelle und die Gesamtzahl wäre um sechs zu hoch.
  const ziele = wunsch === 'alle' ? [...new Set(['de', ...SPRACHEN])] : wunsch.split(',').map((s) => s.trim()).filter(Boolean);
  let gesamtOk = 0;
  let gesamt = 0;
  const fehler = [];
  console.log(`=== Beispielfragen des leeren KI-Chats (Anzeigetext aus src/locales, ${BEISPIEL_PASSAGEN} Passagen) ===`);
  for (const lang of ziele) {
    const pfad = korpusPfad(lang);
    if (!existsSync(pfad)) {
      console.log(`${lang}: Korpus fehlt (${path.relative(path.join(HIER, '..'), pfad)}) — erst node scripts/build-ki-korpus.mjs`);
      continue;
    }
    const idx = baueIndex(JSON.parse(readFileSync(pfad, 'utf8')).docs);
    const texte = JSON.parse(readFileSync(path.join(HIER, '..', 'src', 'locales', `${lang}.json`), 'utf8')).ki;
    let ok = 0;
    for (const { key, ids } of BEISPIEL_ERWARTUNG) {
      const frage = texte[key];
      const treffer = suche(idx, frage, BEISPIEL_PASSAGEN);
      const rang = treffer.findIndex((d) => ids.test(d.id)) + 1;
      gesamt++;
      if (rang > 0) {
        ok++;
        gesamtOk++;
      } else {
        fehler.push(`${lang} ${key} („${frage}") — Platz 1: ${treffer[0] ? `${treffer[0].id} — ${treffer[0].src}` : '(leer)'}`);
      }
      if (voll) {
        console.log(`[${rang > 0 ? ' ok ' : 'MISS'}] ${lang} ${key} (Rang ${rang || '—'}): ${frage}`);
        for (const d of treffer) console.log(`        · ${d.id} — ${d.src}`);
      }
    }
    console.log(`${lang.padEnd(4)} ${ok}/${BEISPIEL_ERWARTUNG.length}`);
  }
  console.log(`\n=== ${gesamtOk}/${gesamt} Beispielfragen finden ihre erwartete Quelle in den ersten ${BEISPIEL_PASSAGEN} Passagen ===`);
  if (fehler.length) console.log('Verfehlt:\n  - ' + fehler.join('\n  - '));
  process.exit(fehler.length ? 1 : 0);
}

// ---------- Betriebsart 2: mehrsprachig, Erwartung über die Doc-ID ----------
const sprachArg = process.argv.find((a) => a.startsWith('--sprachen='));
if (sprachArg) {
  const wunsch = sprachArg.slice('--sprachen='.length);
  const ziele = wunsch === 'alle' ? SPRACHEN : wunsch.split(',').map((s) => s.trim()).filter(Boolean);
  const katalog = JSON.parse(readFileSync(path.join(HIER, 'data', 'ki-eval-fragen.json'), 'utf8')).fragen;
  const zeilen = [];
  for (const lang of ziele) {
    const pfad = korpusPfad(lang);
    if (!existsSync(pfad)) {
      console.log(`${lang}: Korpus fehlt (${path.relative(path.join(HIER, '..'), pfad)}) — erst node scripts/build-ki-korpus.mjs`);
      continue;
    }
    const k = JSON.parse(readFileSync(pfad, 'utf8'));
    const idx = baueIndex(k.docs);
    let ok = 0;
    let leer = 0;
    // Treffer, die NUR über ein deutsches Fallback-Dokument (Feld fb) zustande
    // kommen: sie zählen als Treffer, sind für den Nutzer aber eine deutsche
    // Passage. Getrennt ausgewiesen, damit die Zahl nicht besser aussieht als
    // die Auslieferung wirklich ist.
    let nurDeutsch = 0;
    // Obergrenze: Fragen, deren erwartete Quelle in DIESER Sprache überhaupt
    // übersetzt vorliegt. Solange die kuratierte Wissensschicht (w-*) nur auf
    // Deutsch existiert, sind Fragen, die ausschliesslich daraus beantwortet
    // werden, in einer übersetzten Formulierung gar nicht erreichbar — ohne
    // diese Spalte sähe die Quote nach einem Retrieval-Problem aus, obwohl es
    // ein reines Inhalts-Problem ist.
    let erreichbar = 0;
    // Rang-Metrik (2026-07-28 ergänzt): Die Trefferquote misst nur, OB die
    // erwartete Quelle unter den sechs ausgelieferten Passagen ist. Für die
    // Antwortqualität zählt aber der RANG: Das Modell bekommt die erste Passage
    // als Hauptquelle und hält sich daran. Eine Frage, deren richtige Quelle auf
    // Platz 5 steht, zählt in der Trefferquote wie ein Volltreffer, liefert dem
    // Nutzer aber die falsche Antwort (belegt: „Wer ist Allah" bekam die
    // Reise-Dua als Hauptquelle).
    let platz1 = 0;
    let platz12 = 0;
    let mrrSumme = 0;
    const nichtPlatz1 = [];
    const schlecht = [];
    for (const eintrag of katalog) {
      const frage = eintrag.f[lang];
      if (!frage) continue;
      const erwartet = new RegExp(eintrag.ids);
      if (k.docs.some((d) => d.fb !== 1 && erwartet.test(d.id))) erreichbar++;
      const treffer = suche(idx, frage, 6);
      const passend = treffer.filter((d) => erwartet.test(d.id));
      const rang = treffer.findIndex((d) => erwartet.test(d.id)) + 1; // 0 = nicht gefunden
      if (rang === 1) platz1++;
      if (rang === 1 || rang === 2) platz12++;
      if (rang > 0) mrrSumme += 1 / rang;
      if (rang !== 1) {
        nichtPlatz1.push(
          `${eintrag.id} („${frage}") Rang ${rang || '—'} · Platz 1: ${treffer[0] ? `${treffer[0].id} — ${treffer[0].src}` : '(leer)'}`,
        );
      }
      if (treffer.length === 0) leer++;
      if (passend.length) {
        ok++;
        if (passend.every((d) => d.fb === 1)) nurDeutsch++;
      } else {
        schlecht.push(`${eintrag.id} („${frage}")`);
      }
      if (voll) {
        const marke = passend.length ? ' ok ' : treffer.length ? 'MISS' : 'LEER';
        console.log(`[${marke}] ${lang} ${eintrag.id}: ${frage} (Rang ${rang || '—'})`);
        for (const d of treffer.slice(0, 4)) console.log(`        · ${d.id} — ${d.src}`);
      }
    }
    const gesamt = katalog.filter((e) => e.f[lang]).length;
    zeilen.push({
      lang,
      ok,
      gesamt,
      leer,
      nurDeutsch,
      erreichbar,
      docs: k.docs.length,
      fallback: k.fallback ?? 0,
      schlecht,
      platz1,
      platz12,
      mrr: mrrSumme,
      nichtPlatz1,
    });
  }

  console.log('\n=== Trefferquote je Sprache (Erwartung = Doc-ID des deutschen Laufs) ===');
  console.log('spr  treffer  quote  leer  nur-dt.-Treffer  uebersetzt-erreichbar  Docs  dt.-Docs');
  for (const z of zeilen) {
    const quote = ((z.ok / z.gesamt) * 100).toFixed(0);
    console.log(
      `${z.lang.padEnd(4)} ${String(z.ok).padStart(3)}/${z.gesamt}  ${quote.padStart(4)}%  ${String(z.leer).padStart(4)}  ` +
        `${String(z.nurDeutsch).padStart(15)}  ${`${z.erreichbar}/${z.gesamt}`.padStart(21)}  ${String(z.docs).padStart(4)}  ${String(z.fallback).padStart(8)}`,
    );
  }

  // ---------- Rangqualität ----------
  // Ergänzt (nicht ersetzt) die Trefferquote: Anteil der Fragen, deren erwartete
  // Quelle auf Platz 1 der ausgelieferten Passagen steht, plus MRR.
  console.log('\n=== Rangqualität je Sprache (Rang der erwarteten Quelle in den 6 Passagen) ===');
  console.log('spr  Platz1   Quote   Platz1-2    MRR');
  let sPlatz1 = 0;
  let sPlatz12 = 0;
  let sMrr = 0;
  let sGesamt = 0;
  for (const z of zeilen) {
    sPlatz1 += z.platz1;
    sPlatz12 += z.platz12;
    sMrr += z.mrr;
    sGesamt += z.gesamt;
    console.log(
      `${z.lang.padEnd(4)} ${String(z.platz1).padStart(3)}/${z.gesamt}  ${((z.platz1 / z.gesamt) * 100).toFixed(0).padStart(4)}%  ` +
        `${`${z.platz12}/${z.gesamt}`.padStart(8)}  ${(z.mrr / z.gesamt).toFixed(4).padStart(6)}`,
    );
  }
  if (sGesamt > 0) {
    console.log(
      `SUM  ${String(sPlatz1).padStart(3)}/${sGesamt}  ${((sPlatz1 / sGesamt) * 100).toFixed(0).padStart(4)}%  ` +
        `${`${sPlatz12}/${sGesamt}`.padStart(8)}  ${(sMrr / sGesamt).toFixed(4).padStart(6)}`,
    );
  }

  for (const z of zeilen) {
    if (z.schlecht.length) console.log(`\n${z.lang} verfehlt:\n  - ${z.schlecht.join('\n  - ')}`);
  }
  if (voll) {
    for (const z of zeilen) {
      if (z.nichtPlatz1.length) console.log(`\n${z.lang} nicht auf Platz 1:\n  - ${z.nichtPlatz1.join('\n  - ')}`);
    }
  }
  process.exit(0);
}

// ---------- Betriebsart 1: Deutsch, Erwartung über den Treffertext ----------
const index = baueIndex(korpus.docs);
console.log(`Korpus: ${korpus.docs.length} Dokumente\n`);

let ok = 0;
let leer = 0;
const schlecht = [];
// Rang-Metrik wie im mehrsprachigen Lauf: Platz der ERSTEN Passage, die das
// Erwartungsmuster allein erfüllt. Ist keine einzelne Passage ausreichend
// (Muster über mehrere Passagen erfüllt), zählt die Frage als „nicht auf Rang".
let platz1 = 0;
let platz12 = 0;
let mrrSumme = 0;
const nichtPlatz1 = [];
for (const { f, erwartet } of FRAGEN) {
  const treffer = suche(index, f, 6);
  const kombiniert = treffer.map((d) => `${d.src} ${d.t}`).join(' • ');
  const passt = treffer.length > 0 && erwartet.test(kombiniert);
  const rang = treffer.findIndex((d) => erwartet.test(`${d.src} ${d.t}`)) + 1;
  if (rang === 1) platz1++;
  if (rang === 1 || rang === 2) platz12++;
  if (rang > 0) mrrSumme += 1 / rang;
  if (rang !== 1) nichtPlatz1.push(`${f} — Rang ${rang || '—'} · Platz 1: ${treffer[0] ? treffer[0].src : '(leer)'}`);
  if (treffer.length === 0) leer++;
  if (passt) ok++;
  else schlecht.push(f);
  const marke = treffer.length === 0 ? 'LEER' : passt ? ' ok ' : 'MISS';
  console.log(`[${marke}] (Rang ${rang || '—'}) ${f}`);
  if (!passt || voll) {
    for (const d of treffer.slice(0, voll ? 6 : 3)) {
      console.log(`        · ${d.src}: ${d.t.slice(0, 110).replace(/\s+/g, ' ')}`);
    }
  }
}

console.log(`\n=== ${ok}/${FRAGEN.length} thematisch passend · ${leer} ganz ohne Treffer ===`);
console.log(
  `=== Rangqualität: Platz 1 in ${platz1}/${FRAGEN.length} (${((platz1 / FRAGEN.length) * 100).toFixed(0)}%) · ` +
    `Platz 1-2 in ${platz12}/${FRAGEN.length} · MRR ${(mrrSumme / FRAGEN.length).toFixed(4)} ===`,
);
if (schlecht.length) console.log('Nicht passend:\n  - ' + schlecht.join('\n  - '));
if (voll && nichtPlatz1.length) console.log('Nicht auf Platz 1:\n  - ' + nichtPlatz1.join('\n  - '));
