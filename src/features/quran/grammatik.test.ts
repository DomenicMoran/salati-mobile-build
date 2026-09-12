import {
  farbGruppe,
  fragmentRolle,
  ismEigenschaften,
  istFiil,
  istHarf,
  istIsm,
  istVerneinung,
  relationBasis,
  verbEigenschaften,
  wortart,
  wurzelTyp,
} from './grammatik';
import type { MorphFeatures, MorphSegment, MorphWord } from './morphologieTypen';

// Eigene Fixtures — keine Netzabhängigkeit, keine Abhängigkeit von der
// parallel gebauten Pipeline. Nur die Felder, die ein Test tatsächlich
// braucht, werden überschrieben; der Rest bleibt "leer" (null/[]), damit
// jeder Test zeigt, worauf es ihm ankommt.
const LEERE_FEATURES: MorphFeatures = {
  person: null,
  gender: null,
  number: null,
  case: null,
  state: null,
  mood: null,
  tense: null,
  voice: null,
  verbForm: null,
  derivation: null,
};

interface SegmentOverrides extends Omit<Partial<MorphSegment>, 'features'> {
  features?: Partial<MorphFeatures>;
}

function segment(overrides: SegmentOverrides = {}): MorphSegment {
  return {
    text: overrides.text ?? 'س',
    kind: overrides.kind ?? 'stem',
    pos: overrides.pos ?? 'N',
    features: { ...LEERE_FEATURES, ...(overrides.features ?? {}) },
    derived: overrides.derived ?? [],
    raw: overrides.raw ?? overrides.pos ?? 'N',
  };
}

function word(overrides: Partial<MorphWord> = {}): MorphWord {
  return {
    position: overrides.position ?? 1,
    text: overrides.text ?? 'كلمة',
    root: overrides.root ?? null,
    lemma: overrides.lemma ?? 'كلمة',
    segments: overrides.segments ?? [segment()],
    syntax: overrides.syntax,
  };
}

// Alle 45 real im Korpus vorkommenden QAC-POS-Tags (.daten-cache/out/morphologie/
// meta.json → posHaeufigkeit) — siehe Auszählung in grammatik.ts. Jeder Tag MUSS
// eine der drei Wortarten liefern, kein `null` mehr.
const ALLE_45_POS_TAGS = [
  'ACC', 'ADJ', 'AMD', 'ANS', 'AVR', 'CAUS', 'CERT', 'CIRC', 'COM', 'COND',
  'CONJ', 'DEM', 'DET', 'EMPH', 'EQ', 'EXH', 'EXL', 'EXP', 'FUT', 'IMPN',
  'IMPV', 'INC', 'INL', 'INT', 'INTG', 'LOC', 'N', 'NEG', 'P', 'PN', 'PREV',
  'PRO', 'PRON', 'PRP', 'REL', 'REM', 'RES', 'RET', 'RSLT', 'SUB', 'SUP',
  'SUR', 'T', 'V', 'VOC',
];

describe('wortart / istIsm / istFiil / istHarf', () => {
  it('erkennt alle drei Wortarten korrekt', () => {
    expect(wortart('N')).toBe('ism');
    expect(wortart('V')).toBe('fiil');
    expect(wortart('CONJ')).toBe('harf');
  });

  it('deckt alle 45 real vorkommenden POS-Tags ab — keiner liefert null', () => {
    expect(ALLE_45_POS_TAGS).toHaveLength(45);
    for (const pos of ALLE_45_POS_TAGS) {
      expect(wortart(pos)).not.toBeNull();
    }
  });

  it('ordnet die Ism-Tags korrekt zu (Substantiv, Eigenname, Adjektiv, Pronomen, Demonstrativ, Relativ, Zeit, Ort, اسم فعل الأمر)', () => {
    for (const pos of ['N', 'PN', 'ADJ', 'PRON', 'DEM', 'REL', 'T', 'LOC', 'IMPN']) {
      expect(wortart(pos)).toBe('ism');
    }
  });

  it('ordnet Fiʿl NUR dem regulären Verb (V) zu', () => {
    expect(wortart('V')).toBe('fiil');
  });

  it('ordnet den bestimmten Artikel (DET) als Harf ein', () => {
    expect(wortart('DET')).toBe('harf');
  });

  // Gegen die echten Daten geprüft (qac-0.4.txt, Spalte 3 = TAG, nicht die
  // gleichnamige Marke im Feature-String eines V-Stamms): IMPV kommt GENAU
  // 78× vor, AUSNAHMSLOS als eigenes PREFIX-Segment mit Text "لْ" und
  // Feature-String "PREFIX|l:IMPV+" — die Befehls-Lām (لام الأمر), die vor
  // einem Imperfekt-Verb steht, nicht das Verb selbst. Frühere Einordnung bei
  // Fiʿl war falsch (hätte 78 Partikel-Präfixe als eigenständige Verben
  // gezählt) — siehe HARF_TAGS-Kommentar in grammatik.ts.
  it('ordnet IMPV (لام الأمر, Befehls-Lām-Präfix) als Harf ein, nicht als Fiʿl', () => {
    expect(wortart('IMPV')).toBe('harf');
    const praefix = segment({ kind: 'prefix', pos: 'IMPV', text: 'لْ', raw: 'PREFIX|l:IMPV+' });
    expect(istHarf(praefix)).toBe(true);
    expect(istFiil(praefix)).toBe(false);
  });

  // Gegen die echten Daten geprüft: IMPN (اسم فعل الأمر) kommt GENAU 2× vor,
  // beide Male als STEM ohne jede PGN-/Tempus-/Modus-Markierung im
  // Feature-String — مِسَاسَ (20:97:10, "STEM|POS:IMPN|LEM:misaAs|ROOT:mss")
  // und هَآؤُمُ (69:19:7, "STEM|POS:IMPN|LEM:haA^&umu") — morphologisch ein
  // unflektiertes Nomen. Die traditionelle arabische Grammatik (اسم الفعل,
  // z. B. Ibn Mālik, Alfiyya) ordnet diese Kategorie als Unterart von اسم ein
  // — sie TRÄGT Befehls-Bedeutung, IST aber namentlich und morphologisch ein
  // Nomen, kein Verb.
  it('ordnet IMPN (اسم فعل الأمر) als Ism ein, nicht als Fiʿl', () => {
    expect(wortart('IMPN')).toBe('ism');
    const misaAsa = segment({ kind: 'stem', pos: 'IMPN', text: 'مِسَاسَ', raw: 'STEM|POS:IMPN|LEM:misaAs|ROOT:mss' });
    expect(istIsm(misaAsa)).toBe(true);
    expect(istFiil(misaAsa)).toBe(false);
  });

  it('istIsm/istFiil/istHarf sind für ein Nomen konsistent true/false', () => {
    const s = segment({ pos: 'N' });
    expect(istIsm(s)).toBe(true);
    expect(istFiil(s)).toBe(false);
    expect(istHarf(s)).toBe(false);
  });

  it('istIsm/istFiil/istHarf sind für ein Verb konsistent true/false', () => {
    const s = segment({ pos: 'V' });
    expect(istFiil(s)).toBe(true);
    expect(istIsm(s)).toBe(false);
    expect(istHarf(s)).toBe(false);
  });

  it('istIsm/istFiil/istHarf sind für einen Harf konsistent true/false', () => {
    const s = segment({ pos: 'P' });
    expect(istHarf(s)).toBe(true);
    expect(istIsm(s)).toBe(false);
    expect(istFiil(s)).toBe(false);
  });

  it('liefert null für ein unbekanntes POS-Tag statt zu raten', () => {
    const s = segment({ pos: 'ZUKUNFTSTAG_XYZ' });
    expect(wortart('ZUKUNFTSTAG_XYZ')).toBeNull();
    expect(istIsm(s)).toBeNull();
    expect(istFiil(s)).toBeNull();
    expect(istHarf(s)).toBeNull();
  });
});

describe('Wort mit Präfix + Stamm + Suffix', () => {
  it('gliedert sich in genau die drei erwarteten Segmentarten', () => {
    const w = word({
      segments: [
        segment({ text: 'وَ', kind: 'prefix', pos: 'CONJ', raw: 'CONJ|PREF' }),
        segment({ text: 'كَاتِب', kind: 'stem', pos: 'N' }),
        segment({ text: 'هُ', kind: 'suffix', pos: 'PRON', features: { gender: 'm', number: 'sg', person: '3' } }),
      ],
    });

    expect(w.segments.map((s) => s.kind)).toEqual(['prefix', 'stem', 'suffix']);
    expect(fragmentRolle(w.segments[0])).toBe('konjunktion');
    expect(fragmentRolle(w.segments[1])).toBe('stamm');
    expect(fragmentRolle(w.segments[2])).toBe('pronomenSuffix');
  });
});

describe('ismEigenschaften — Beleg vs. Herleitung', () => {
  it('markiert ein explizit im Korpus stehendes Merkmal als "beleg"', () => {
    const s = segment({ pos: 'N', features: { gender: 'f' }, derived: [] });
    expect(ismEigenschaften(s).genus).toEqual({ wert: 'f', herkunft: 'beleg' });
  });

  it('markiert eine hergeleitete Bestimmtheit als "hergeleitet"', () => {
    const s = segment({ pos: 'N', features: { state: 'indefinite' }, derived: ['state'] });
    const eigenschaften = ismEigenschaften(s);
    expect(eigenschaften.bestimmtheit).toEqual({ wert: 'indefinite', herkunft: 'hergeleitet' });
    // Die übrigen drei Eigenschaften sind hier nicht belegt.
    expect(eigenschaften.genus).toBeNull();
    expect(eigenschaften.numerus).toBeNull();
    expect(eigenschaften.kasus).toBeNull();
  });

  it('liefert alle vier Eigenschaften mit Kasus', () => {
    const s = segment({
      pos: 'N',
      features: { gender: 'm', number: 'pl', state: 'definite', case: 'gen' },
      derived: [],
    });
    expect(ismEigenschaften(s)).toEqual({
      genus: { wert: 'm', herkunft: 'beleg' },
      numerus: { wert: 'pl', herkunft: 'beleg' },
      bestimmtheit: { wert: 'definite', herkunft: 'beleg' },
      kasus: { wert: 'gen', herkunft: 'beleg' },
    });
  });
});

describe('verbEigenschaften — hergeleitete Verbform I', () => {
  it('markiert Verbform I als "hergeleitet", wenn sie im derived-Array steht', () => {
    const s = segment({
      pos: 'V',
      features: { tense: 'perfect', voice: 'active', verbForm: 1, person: '3', gender: 'm', number: 'sg' },
      derived: ['verbForm'],
    });
    const eigenschaften = verbEigenschaften(s);
    expect(eigenschaften.verbform).toEqual({ wert: 1, herkunft: 'hergeleitet' });
    expect(eigenschaften.tempus).toEqual({ wert: 'perfect', herkunft: 'beleg' });
    expect(eigenschaften.genusVerbi).toEqual({ wert: 'active', herkunft: 'beleg' });
    expect(eigenschaften.person).toEqual({ wert: '3', herkunft: 'beleg' });
  });

  it('lässt nicht belegte Merkmale (z. B. Modus bei einem Perfekt-Verb) null', () => {
    const s = segment({ pos: 'V', features: { tense: 'perfect' }, derived: [] });
    expect(verbEigenschaften(s).modus).toBeNull();
  });
});

describe('istVerneinung', () => {
  // Gegen die echten Daten geprüft (siehe grammatik.ts-Kommentar bei istVerneinung):
  // pos === 'NEG' trifft exakt 2688 Mal, deckungsgleich mit meta.json →
  // posHaeufigkeit.NEG — kein Zusatzabgleich über den Text nötig oder erwünscht.
  it('erkennt eine Verneinung über das QAC-Tag NEG', () => {
    const negSegment = segment({ text: 'لَمْ', pos: 'NEG' });
    const w = word({ segments: [negSegment, segment({ text: 'يَقُلْ', pos: 'V', features: { tense: 'imperfect' } })] });
    const treffer = istVerneinung(w);
    expect(treffer?.segment).toBe(negSegment);
    expect(treffer?.form).toBe('لم');
  });

  it('erkennt auch die klassische Verneinung "in" (QAC-Tag NEG, 114 Belege im Korpus)', () => {
    const negSegment = segment({ text: 'إِنْ', pos: 'NEG' });
    const w = word({ segments: [negSegment] });
    expect(istVerneinung(w)?.segment).toBe(negSegment);
  });

  // Realdaten-Fund: Textabgleich ohne POS-Prüfung schlägt falsch-positiv zu.
  // لِنتَ (3:159, Wurzel ل-ي-ن "sanft sein") hat einen Stamm, der nach
  // Diakritika-Entfernung mit لن (der Verneinung "lan") textgleich ist —
  // ist aber ein normales Verb (pos "V"), keine Verneinung. Ebenso لُمْتُنَّنِى
  // (12:32, Wurzel ل-و-م "tadeln") ist textgleich mit لم, ebenfalls ein Verb.
  it.each([
    ['لِن', 'V' as const],
    ['لُمْ', 'V' as const],
  ])('erkennt eine Verneinung NICHT allein am Text (%s ist im Korpus ein Verb, keine Verneinung)', (text, pos) => {
    const verbSegment = segment({ text, pos });
    const w = word({ segments: [verbSegment] });
    expect(istVerneinung(w)).toBeNull();
  });

  // Realdaten-Fund: مَا trägt an rund 1800 Stellen ein anderes Tag (REL, INTG,
  // COND, PREV, SUB, SUP) als NEG, weil es dort relativ/interrogativ/bedingend/
  // einschränkend statt verneinend fungiert — das ist keine "andere Taggung
  // derselben Verneinung", sondern schlicht eine andere Wortfunktion.
  it('erkennt مَا mit anderer Funktion (z. B. REL) nicht als Verneinung', () => {
    const w = word({ segments: [segment({ text: 'مَا', pos: 'REL' })] });
    expect(istVerneinung(w)).toBeNull();
  });

  it('liefert null für ein Wort ohne Verneinungspartikel', () => {
    const w = word({ segments: [segment({ text: 'كَاتِب', pos: 'N' })] });
    expect(istVerneinung(w)).toBeNull();
  });

  it('liefert null für ein Wort ohne Segmente (kaputte/leere Daten)', () => {
    expect(istVerneinung(word({ segments: [] }))).toBeNull();
  });
});

describe('fragmentRolle', () => {
  it('erkennt Konjunktion (harf atf), Präposition (harf jarr) und Fragepartikel', () => {
    expect(fragmentRolle(segment({ pos: 'CONJ' }))).toBe('konjunktion');
    expect(fragmentRolle(segment({ pos: 'P' }))).toBe('praeposition');
    expect(fragmentRolle(segment({ pos: 'INTG' }))).toBe('fragepartikel');
  });

  it('erkennt den bestimmten Artikel über das POS-Tag DET, unabhängig vom Text', () => {
    expect(fragmentRolle(segment({ text: 'ٱلْ', kind: 'prefix', pos: 'DET' }))).toBe('artikel');
  });

  // Realdaten-Fund: nach der Präposition لِ (lām) verliert der Artikel sein
  // Alif ganz — das Segment bleibt trotzdem eigenständig mit pos "DET", nur
  // der Text ist auf "لْ" geschrumpft (z. B. لِلْمُتَّقِينَ, 2:2). Ein rein
  // textbasierter Abgleich könnte diesen Fall gar nicht mehr erkennen.
  it('erkennt den Artikel auch dann, wenn sein Alif nach einer Präposition elidiert ist', () => {
    expect(fragmentRolle(segment({ text: 'لْ', kind: 'prefix', pos: 'DET' }))).toBe('artikel');
  });

  it('erkennt ein Pronomen-Suffix', () => {
    expect(fragmentRolle(segment({ kind: 'suffix', pos: 'PRON' }))).toBe('pronomenSuffix');
  });

  it('fällt für ein unbekanntes Harf-Tag auf die generische Sammelkategorie zurück, statt zu raten', () => {
    expect(fragmentRolle(segment({ kind: 'prefix', pos: 'AMD' }))).toBe('sonstigerHarf');
  });

  it('fällt für ein unbekanntes Wortart-Tag auf "sonstigesAffix" zurück', () => {
    expect(fragmentRolle(segment({ kind: 'prefix', pos: 'ZUKUNFTSTAG_XYZ' }))).toBe('sonstigesAffix');
  });
});

describe('farbGruppe — nur Gruppenschlüssel, keine Farbwerte', () => {
  it('gruppiert ein Verb nach Tempus (der POS-Tag ist im Korpus immer "V" — Tempus steckt in features.tense)', () => {
    expect(farbGruppe(segment({ pos: 'V', features: { tense: 'perfect' } }))).toBe('fiil-perfect');
    expect(farbGruppe(segment({ pos: 'V', features: { tense: 'imperfect' } }))).toBe('fiil-imperfect');
    expect(farbGruppe(segment({ pos: 'V', features: { tense: 'imperative' } }))).toBe('fiil-imperative');
  });

  it('gruppiert ein Nomen nach Bestimmtheit', () => {
    expect(farbGruppe(segment({ pos: 'N', features: { state: 'definite' } }))).toBe('ism-definite');
    expect(farbGruppe(segment({ pos: 'N', features: { state: 'indefinite' } }))).toBe('ism-indefinite');
    expect(farbGruppe(segment({ pos: 'N', features: {} }))).toBe('ism');
  });

  it('gruppiert Partikel nach Fragment-Rolle', () => {
    expect(farbGruppe(segment({ pos: 'CONJ' }))).toBe('harf-konjunktion');
    expect(farbGruppe(segment({ pos: 'P' }))).toBe('harf-praeposition');
    expect(farbGruppe(segment({ pos: 'NEG' }))).toBe('harf-verneinung');
  });

  it('gruppiert den bestimmten Artikel eigenständig statt in der generischen Harf-Gruppe', () => {
    expect(farbGruppe(segment({ text: 'ٱلْ', kind: 'prefix', pos: 'DET' }))).toBe('affix-artikel');
  });

  it('liefert für kein bekanntes Muster mindestens die generische Gruppe, ohne zu werfen', () => {
    expect(() => farbGruppe(segment({ pos: 'ZUKUNFTSTAG_XYZ' }))).not.toThrow();
    expect(farbGruppe(segment({ kind: 'stem', pos: 'ZUKUNFTSTAG_XYZ' }))).toBe('affix');
  });
});

describe('relationBasis', () => {
  it('reicht eine einfache Relation unverändert durch', () => {
    expect(relationBasis('conj')).toEqual({ basis: 'conj', regens: null });
    expect(relationBasis('App')).toEqual({ basis: 'App', regens: null });
    expect(relationBasis('NonRel')).toEqual({ basis: 'NonRel', regens: null });
  });

  // Reale Schreibweisen aus meta.json → relationHaeufigkeit — mal mit, mal
  // ohne Leerzeichen vor "<<".
  it.each([
    ['pred <<kan>>', { basis: 'pred', regens: 'kan' }],
    ['pred<<in>>', { basis: 'pred', regens: 'in' }],
    ['subj<<in>>', { basis: 'subj', regens: 'in' }],
    ['subj <<lays>>', { basis: 'subj', regens: 'lays' }],
    ["pred <<ka'ana>>", { basis: 'pred', regens: "ka'ana" }],
  ])('normalisiert "%s"', (relation, erwartet) => {
    expect(relationBasis(relation)).toEqual(erwartet);
  });

  it('reduziert alle 112 real vorkommenden Relationslabels auf 46 Basiswerte', () => {
    // Vollständige Liste aus .daten-cache/out/morphologie/meta.json → relationHaeufigkeit.
    const alle112 = [
      'root', 'gen', 'link', 'Obj', 'conj', 'Poss', 'sub', 'Adj', 'Pred', 'Subj',
      'neg', 'cond', 'pred<<in>>', 'circ', 'rslt', 'pred <<kan>>', 'NonRel',
      'subj<<in>>', 'App', 'intg', 'voc', 'cert', 'res', 'Pro', 'Pass', 'cog',
      'emph', 'pred<<an>>', 'Spec', 'subj <<kan>>', 'exp', 'prev', 'subj<<an>>',
      'subj <<la>>', 'pred <<lel>>', 'prp', 'ret', 'imrs', 'inc', 'sup',
      'subj <<ma>>', 'subj <<lays>>', 'amd', 'exl', 'int', 'pred <<kn>>', 'sur',
      'exh', 'pred <<lakin>>', 'fut', 'pred <<ykon>>', 'avr', 'subj <<lakin>>',
      'pred <<ma>>', 'state', 'ans', 'pred <<lakun>>', 'subj <<ykn>>',
      'pred <<tkon>>', 'subj <<ykon>>', 'subj <<lakun>>', "pred <<ka'ana>>",
      'pred <<ka>>', 'pred <<asbah>>', 'pred <<easaa>>', 'pred <<kant>>',
      'pred <<ykn>>', 'pred <<ykad>>', 'subj <<tkon>>', 'pred <<layt>>',
      'pred <<kon>>', 'pred <<kad>>', 'pred <<lays>>', 'subj <<easaa>>',
      'pred <<tkn>>', 'pred <<zala>>', 'pred <<yk>>', 'eq', 'subj <<tkn>>',
      'Cpnd', 'pred <<akon>>', 'subj <<ykad>>', 'pred <<la>>', 'subj <<kant>>',
      'subj <<layst>>', 'pred <<akn>>', 'pred <<ysbah>>', 'pred <<tusbih>>',
      'pred <<tkad>>', 'subj <<asbah>>', 'pred <<dm>>', 'pred <<nkon>>',
      'subj <<yazal>>', 'pred <<yazal>>', 'subj <<ysbah>>', 'subj <<tkad>>',
      'subj <<layt>>', "subj <<ka'ana>>", 'subj<<en>>', 'pred <<tk>>',
      'subj <<tknm>>', 'pred <<las>>', 'subj <<nkon>>', "pred <<tafta'>>",
      'subj <<dam>>', 'pred <<akad>>', 'pred <<barah>>', 'subj <<zala>>',
      'pred <<nkn>>', 'subj <<lel>>', 'impv', 'pred <<nko>>',
    ];
    expect(alle112).toHaveLength(112);
    const basisWerte = new Set(alle112.map((r) => relationBasis(r).basis));
    expect(basisWerte.size).toBe(46);
  });
});

describe('syntax.relation — Badal (App) und Konjunktion (conj)', () => {
  it('ein Wort mit syntax.relation === "conj" (harf atf) trägt seine Beziehung unverändert', () => {
    const w = word({
      position: 4,
      syntax: { relation: 'conj', relationAr: 'معطوف', head: 1 },
    });
    expect(w.syntax?.relation).toBe('conj');
    expect(w.syntax?.head).toBe(1);
  });

  it('ein Wort mit syntax.relation === "App" (Badal) trägt seine Beziehung unverändert', () => {
    const w = word({
      position: 7,
      syntax: { relation: 'App', relationAr: 'بدل', head: 6 },
    });
    expect(w.syntax?.relation).toBe('App');
    expect(w.syntax?.head).toBe(6);
  });

  it('syntax ist optional — ein Wort ohne Dependenzrelation wirft nicht', () => {
    const w = word({ syntax: undefined });
    expect(w.syntax).toBeUndefined();
  });
});

// Alle Wurzeln unten sind an .daten-cache/out/morphologie/v<N>/roots.json
// (aktuelle Schemaversion, siehe MORPHOLOGIE_SCHEMA_VERSION) geprüft (dort
// tatsächlich vorhanden, siehe Bericht) — QAC normalisiert
// Hamza-Radikale auf bloßes Alif (siehe Kopf-Kommentar in grammatik.ts vor
// wurzelTyp), daher "امن" statt "أمن" für die mahmūz-Probe.
describe('wurzelTyp', () => {
  it('liefert null bei fehlender Wurzel', () => {
    expect(wurzelTyp(null)).toBeNull();
    expect(wurzelTyp(undefined)).toBeNull();
  });

  it('قول und كون sind أجوف (aǧwaf) — 2. Radikal و', () => {
    expect(wurzelTyp('قول')).toEqual([{ kategorie: 'ajwaf', radikale: ['ق', 'و', 'ل'], positionen: [2] }]);
    expect(wurzelTyp('كون')).toEqual([{ kategorie: 'ajwaf', radikale: ['ك', 'و', 'ن'], positionen: [2] }]);
  });

  it('وعد ist مثال (miṯāl) — 1. Radikal و', () => {
    expect(wurzelTyp('وعد')).toEqual([{ kategorie: 'mithal', radikale: ['و', 'ع', 'د'], positionen: [1] }]);
  });

  it('دعو und هدي sind ناقص (nāqiṣ) — 3. Radikal و/ي', () => {
    expect(wurzelTyp('دعو')).toEqual([{ kategorie: 'naaqis', radikale: ['د', 'ع', 'و'], positionen: [3] }]);
    expect(wurzelTyp('هدي')).toEqual([{ kategorie: 'naaqis', radikale: ['ه', 'د', 'ي'], positionen: [3] }]);
  });

  it('امن (أمن) ist صحيح UND مهموز (mahmūz) — Hamza als normalisiertes Alif an Position 1', () => {
    expect(wurzelTyp('امن')).toEqual([
      { kategorie: 'sahih', radikale: ['ا', 'م', 'ن'] },
      { kategorie: 'mahmuz', radikale: ['ا', 'م', 'ن'], positionen: [1] },
    ]);
  });

  it('مدد und مسس sind صحيح UND مضاعف (muḍāʿaf) — 2. und 3. Radikal identisch', () => {
    expect(wurzelTyp('مدد')).toEqual([
      { kategorie: 'sahih', radikale: ['م', 'د', 'د'] },
      { kategorie: 'mudaaf', radikale: ['م', 'د', 'د'] },
    ]);
    expect(wurzelTyp('مسس')).toEqual([
      { kategorie: 'sahih', radikale: ['م', 'س', 'س'] },
      { kategorie: 'mudaaf', radikale: ['م', 'س', 'س'] },
    ]);
  });

  it('وقي ist لفيف مفروق (lafīf mafrūq) — 1. und 3. Radikal schwach', () => {
    expect(wurzelTyp('وقي')).toEqual([
      { kategorie: 'lafifMafruq', radikale: ['و', 'ق', 'ي'], positionen: [1, 3] },
    ]);
  });

  it('طوي ist لفيف مقرون (lafīf maqrūn) — 2. und 3. Radikal schwach', () => {
    expect(wurzelTyp('طوي')).toEqual([
      { kategorie: 'lafifMaqrun', radikale: ['ط', 'و', 'ي'], positionen: [2, 3] },
    ]);
  });

  it('نصر und كتب sind صحيح (ṣaḥīḥ) — kein schwacher Radikal, kein Hamza, keine Verdopplung', () => {
    expect(wurzelTyp('نصر')).toEqual([{ kategorie: 'sahih', radikale: ['ن', 'ص', 'ر'] }]);
    expect(wurzelTyp('كتب')).toEqual([{ kategorie: 'sahih', radikale: ['ك', 'ت', 'ب'] }]);
  });

  it('رباعي-Wurzeln (4 Radikale) bekommen die eigene Kategorie "rubai", ohne Zerlegung', () => {
    expect(wurzelTyp('زلزل')).toEqual([{ kategorie: 'rubai', radikale: ['ز', 'ل', 'ز', 'ل'] }]);
  });

  it('Grenzfall ohne klassischen Namen (schwach an Position 1+2, "يوم"): Einzelkategorien statt erfundenem Sammelnamen', () => {
    expect(wurzelTyp('يوم')).toEqual([
      { kategorie: 'mithal', radikale: ['ي', 'و', 'م'], positionen: [1] },
      { kategorie: 'ajwaf', radikale: ['ي', 'و', 'م'], positionen: [2] },
    ]);
  });
});
