/**
 * Analyse-Übung — reine Logik (features/quran/uebung/modell.ts + anzeige.ts).
 *
 * Getestet gegen einen echten Ausschnitt der Morphologie-Pipeline
 * (__fixtures__/morphologie-1.json, Al-Fatiha, wie in grammatik.realdaten.test.ts
 * und wort-analyse-sheet.test.tsx) sowie gegen handgebaute Fixtures für Fälle,
 * die im kurzen Fixture-Ausschnitt nicht vorkommen (unbekanntes POS-Tag, Wort
 * ganz ohne Syntaxdaten).
 */
import sure1Fixture from '@/features/quran/__fixtures__/morphologie-1.json';
import type { MorphFeatures, MorphologieDatei, MorphSegment, MorphWord } from '@/features/quran/morphologieTypen';
import { translate } from '@/lib/i18n';

import {
  kasusTempusWertBegriff,
  satzrolleOptionBegriff,
  wortartBegriff,
} from '@/features/quran/uebung/anzeige';
import {
  aktiveDimensionen,
  baueSchritte,
  baueUebungsWort,
  bewerteDimension,
  satzrolleOptionen,
  trefferquote,
  werteAus,
  type Antwort,
} from '@/features/quran/uebung/modell';

const sure1 = sure1Fixture as unknown as MorphologieDatei;
const ayah1 = sure1.verses['1']; // Basmala — 4 Ism-Wörter, alle Kasus 'gen'
const ayah7 = sure1.verses['7']; // "...nicht derer, die Zorn erregt haben, und nicht der Irregehenden"
const t = (key: string) => translate('de', key);

// ---------- Eigene Fixture-Bauhilfen (wie in grammatik.test.ts) ----------

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

function segment(overrides: Partial<Omit<MorphSegment, 'features'>> & { features?: Partial<MorphFeatures> } = {}): MorphSegment {
  return {
    text: overrides.text ?? 'ك',
    kind: overrides.kind ?? 'stem',
    pos: overrides.pos ?? 'N',
    features: { ...LEERE_FEATURES, ...(overrides.features ?? {}) },
    derived: overrides.derived ?? [],
    raw: overrides.raw ?? overrides.pos ?? 'N',
  };
}

function wort(overrides: Partial<MorphWord> = {}): MorphWord {
  return {
    position: overrides.position ?? 1,
    text: overrides.text ?? 'كلمة',
    root: overrides.root ?? null,
    lemma: overrides.lemma ?? 'كلمة',
    segments: overrides.segments ?? [segment()],
    syntax: overrides.syntax,
  };
}

describe('baueUebungsWort — Wortart/Kasus-Tempus/Satzrolle aus echten Daten', () => {
  it('بِسْمِ (1:1:1): Ism, Kasus Genitiv (beleg), Satzrolle "gen"', () => {
    const u = baueUebungsWort(ayah1[0]);
    expect(u.wortart).toBe('ism');
    expect(u.kasusTempus).toEqual({ typ: 'kasus', wert: 'gen' });
    expect(u.satzrolleBasis).toBe('gen');
  });

  it('أَنْعَمْتَ (1:7:3): Fiʿl, Tempus Vergangenheit, Satzrolle "conj"', () => {
    const u = baueUebungsWort(ayah7[2]);
    expect(u.wortart).toBe('fiil');
    expect(u.kasusTempus).toEqual({ typ: 'tempus', wert: 'perfect' });
    expect(u.satzrolleBasis).toBe('conj');
  });

  it('وَلَا (1:7:8): Harf (NEG-Stamm) — kein Kasus/Tempus, Satzrolle "emph"', () => {
    const u = baueUebungsWort(ayah7[7]);
    expect(u.wortart).toBe('harf');
    expect(u.kasusTempus).toBeNull();
    expect(u.satzrolleBasis).toBe('emph');
  });

  it('ٱلَّذِينَ (1:7:2): Ism (Relativpronomen) OHNE Kasus-Angabe im Korpus', () => {
    const u = baueUebungsWort(ayah7[1]);
    expect(u.wortart).toBe('ism');
    expect(u.kasusTempus).toBeNull();
    expect(u.satzrolleBasis).toBe('Poss');
  });

  it('صِرَٰطَ (1:7:1): head ist null, die Satzrolle selbst bleibt trotzdem auswertbar', () => {
    const u = baueUebungsWort(ayah7[0]);
    expect(ayah7[0].syntax?.head).toBeNull();
    expect(u.satzrolleBasis).toBe('App');
  });

  it('ein Wort ganz ohne Syntaxdaten liefert satzrolleBasis: null', () => {
    const u = baueUebungsWort(wort({ syntax: undefined }));
    expect(u.satzrolleBasis).toBeNull();
  });

  it('ein unbekanntes POS-Tag liefert wortart: null (nicht geraten)', () => {
    const u = baueUebungsWort(wort({ segments: [segment({ pos: 'ZZZ', kind: 'stem' })] }));
    expect(u.wortart).toBeNull();
  });
});

describe('aktiveDimensionen — nur abfragen, was der Korpus belegt', () => {
  it('Stufe 1 fragt bei jedem auswertbaren Wort nur die Wortart', () => {
    expect(aktiveDimensionen(baueUebungsWort(ayah1[0]), 1)).toEqual(['wortart']);
  });

  it('Stufe 2 ergänzt Kasus/Tempus NUR, wenn der Korpus einen Wert liefert', () => {
    expect(aktiveDimensionen(baueUebungsWort(ayah1[0]), 2)).toEqual(['wortart', 'kasusTempus']);
    // ٱلَّذِينَ hat keinen Kasus im Korpus — die Dimension entfällt, statt mit
    // einem geratenen Wert abgefragt zu werden.
    expect(aktiveDimensionen(baueUebungsWort(ayah7[1]), 2)).toEqual(['wortart']);
    // Harf hat grundsätzlich keinen Kasus/Tempus.
    expect(aktiveDimensionen(baueUebungsWort(ayah7[7]), 2)).toEqual(['wortart']);
  });

  it('Stufe 3 ergänzt Satzrolle NUR, wenn das Wort Syntaxdaten trägt', () => {
    expect(aktiveDimensionen(baueUebungsWort(ayah1[0]), 3)).toEqual(['wortart', 'kasusTempus', 'satzrolle']);
    expect(aktiveDimensionen(baueUebungsWort(wort({ syntax: undefined })), 3)).toEqual(['wortart']);
  });

  it('ein Wort ohne jede abfragbare Dimension liefert ein leeres Array', () => {
    const u = baueUebungsWort(wort({ segments: [segment({ pos: 'ZZZ', kind: 'stem' })], syntax: undefined }));
    expect(aktiveDimensionen(u, 3)).toEqual([]);
  });
});

describe('baueSchritte — Wörter ohne jede Dimension fallen aus der Übung', () => {
  it('entfernt ein Wort ganz, wenn keine Dimension abfragbar ist', () => {
    const woerter = [ayah1[0], wort({ position: 99, segments: [segment({ pos: 'ZZZ', kind: 'stem' })], syntax: undefined })];
    const schritte = baueSchritte(woerter, 3);
    expect(schritte).toHaveLength(1);
    expect(schritte[0].wort.word.position).toBe(1);
  });

  it('behält ein Wort auf Stufe 2, auch wenn nur die Wortart abfragbar ist', () => {
    const schritte = baueSchritte(ayah7, 2);
    const relWort = schritte.find((s) => s.wort.word.position === 2);
    expect(relWort?.dimensionen).toEqual(['wortart']);
  });
});

describe('satzrolleOptionen — genug Auswahl, garantiert korrekt', () => {
  it('übernimmt alle im Vers tatsächlich vorkommenden Grundrelationen', () => {
    const schritte = baueSchritte(ayah7, 3);
    const optionen = satzrolleOptionen(schritte);
    for (const basis of ['App', 'Poss', 'conj', 'link', 'Pass', 'emph']) {
      expect(optionen).toContain(basis);
    }
  });

  it('füllt mit Reserve-Werten auf, wenn der Vers zu wenig Varianz bietet', () => {
    const einWort = wort({ position: 1, syntax: { relation: 'conj', relationAr: 'معطوف', head: null } });
    const schritte = baueSchritte([einWort], 3);
    const optionen = satzrolleOptionen(schritte);
    expect(optionen).toContain('conj');
    expect(optionen.length).toBeGreaterThanOrEqual(3);
    // Sortiert, keine Duplikate.
    expect(optionen).toEqual([...new Set(optionen)].sort());
  });
});

describe('bewerteDimension — nicht bewertbar ist NIE falsch', () => {
  it('bewertet eine korrekte/falsche Wortart-Antwort erwartungsgemäß', () => {
    const u = baueUebungsWort(ayah1[0]); // ism
    expect(bewerteDimension(u, 'wortart', { wortart: 'ism' })).toBe('richtig');
    expect(bewerteDimension(u, 'wortart', { wortart: 'fiil' })).toBe('falsch');
  });

  it('ein Wort ohne Kasus-Angabe wird bei "kasusTempus" als nichtBewertet geführt, nie als falsch', () => {
    const u = baueUebungsWort(ayah7[1]); // ٱلَّذِينَ, kein Kasus
    expect(u.kasusTempus).toBeNull();
    expect(bewerteDimension(u, 'kasusTempus', { kasusTempus: 'irgendwas-falsches' })).toBe('nichtBewertet');
    expect(bewerteDimension(u, 'kasusTempus', {})).toBe('nichtBewertet');
  });

  it('ein Wort ohne Syntaxdaten wird bei "satzrolle" als nichtBewertet geführt, nie als falsch', () => {
    const u = baueUebungsWort(wort({ syntax: undefined }));
    expect(bewerteDimension(u, 'satzrolle', { satzrolle: 'Subj' })).toBe('nichtBewertet');
  });

  it('eine fehlende NUTZER-Antwort (Wort in `antworten` nicht vorhanden) zählt als falsch, nicht als nichtBewertet', () => {
    const u = baueUebungsWort(ayah1[0]);
    expect(bewerteDimension(u, 'wortart', {})).toBe('falsch');
  });
});

describe('werteAus + trefferquote', () => {
  it('zählt nichtBewertete Dimensionen weder als richtig noch als falsch — und sie fließen nicht in die Trefferquote ein', () => {
    const schritte = baueSchritte([ayah1[0], ayah7[1]], 2); // 1x Ism+Kasus, 1x Ism ohne Kasus
    const antworten: Record<number, Antwort> = {
      [ayah1[0].position]: { wortart: 'ism', kasusTempus: 'gen' }, // beide richtig
      [ayah7[1].position]: { wortart: 'fiil' }, // Wortart falsch geraten
    };
    const ergebnis = werteAus(schritte, antworten);
    // 2 bewertete Elemente (Wortart+Kasus von Wort 1), 1 falsches Element (Wortart von Wort 2 der ayah7 im Schnipsel).
    expect(ergebnis.richtig).toBe(2);
    expect(ergebnis.falsch).toBe(1);
    expect(ergebnis.nichtBewertet).toBe(0); // Kasus wurde für ٱلَّذِينَ ja gar nicht erst gefragt (s. baueSchritte)
    expect(trefferquote(ergebnis)).toBeCloseTo(2 / 3);
  });

  it('trefferquote() liefert 0 statt NaN/Absturz, wenn nichts bewertbar war (0/0)', () => {
    expect(trefferquote({ richtig: 0, falsch: 0, nichtBewertet: 3, elemente: [] })).toBe(0);
  });
});

describe('anzeige.ts — Begründungstexte inkl. Fallback und Familienformen', () => {
  it('wortartBegriff liefert Name, arabischen Terminus und Begründung', () => {
    const b = wortartBegriff('fiil', t);
    expect(b.name).toBe(t('grammatik.wortarten.fiil.name'));
    expect(b.ar).toBe(t('grammatik.wortarten.fiil.ar'));
    expect(b.info.length).toBeGreaterThan(0);
  });

  it('kasusTempusWertBegriff fällt auf die Merkmals-Info zurück, wenn der Wert keine eigene hat (Kasus)', () => {
    const b = kasusTempusWertBegriff('kasus', 'acc', t);
    expect(b.name).toBe(t('grammatik.ismEigenschaften.kasus.werte.acc.name'));
    expect(b.info).toBe(t('grammatik.ismEigenschaften.kasus.info'));
  });

  it('kasusTempusWertBegriff nutzt die eigene Info, wenn vorhanden (Tempus)', () => {
    const b = kasusTempusWertBegriff('tempus', 'perfect', t);
    expect(b.info).toBe(t('grammatik.verbEigenschaften.tempus.werte.perfect.info'));
    expect(b.info).not.toBe(t('grammatik.verbEigenschaften.tempus.info'));
  });

  it('satzrolleOptionBegriff nutzt für pred/subj die eigenen analyseUebung-Texte statt des {wort}-Platzhalters', () => {
    const pred = satzrolleOptionBegriff('pred', t);
    expect(pred.name).toBe(t('analyseUebung.satzrolleFamilie.pred.name'));
    expect(pred.name).not.toContain('{wort}');
  });

  it('satzrolleOptionBegriff nutzt für einfache Relationen den grammatik.relationen-Eintrag', () => {
    const gen = satzrolleOptionBegriff('gen', t);
    expect(gen.name).toBe(t('grammatik.relationen.gen.name'));
  });
});
