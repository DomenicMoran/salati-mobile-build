import sure1Fixture from '@/features/quran/__fixtures__/morphologie-1.json';
import { translate } from '@/lib/i18n';
import type { MorphFeatures, MorphologieDatei, MorphSegment, MorphWord } from '../morphologieTypen';
import {
  bestimmtheitBegruendung,
  genusVerbiBegruendung,
  kasusBegruendung,
  loeseBegruendung,
  modusBegruendung,
  praepositionSchluessel,
  relationBegruendung,
  tempusBegruendung,
  verbformBegruendung,
} from './begruendungen';
import {
  fragmentAnzeige,
  ismEigenschaftenAnzeige,
  relationAnzeige,
  verbEigenschaftenAnzeige,
} from './wortAnalyseModel';

const sure1 = sure1Fixture as unknown as MorphologieDatei;
const ayah1 = sure1.verses['1'];
const ayah2 = sure1.verses['2'];
const t = (key: string) => translate('de', key);
const POS_N_INFO = t('grammatik.posTags.N.info');

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

describe('praepositionSchluessel', () => {
  it('erkennt häufige Präpositionen diakritikunabhängig', () => {
    expect(praepositionSchluessel('بِ')).toBe('bi');
    expect(praepositionSchluessel('لِ')).toBe('li');
    expect(praepositionSchluessel('فِي')).toBe('fi');
    expect(praepositionSchluessel('مِن')).toBe('min');
  });
});

describe('kasusBegruendung', () => {
  it('بِسْمِ-Stamm (1:1:1): Genitiv wegen Präposition bi', () => {
    const w = ayah1[0];
    const stamm = w.segments.find((s) => s.kind === 'stem')!;
    const muster = kasusBegruendung(w, stamm, ayah1, t);
    expect(muster?.schluessel).toBe('grammatik.begruendungen.kasus.praeposition');
    const text = loeseBegruendung(muster, t);
    expect(text).toContain('بِسْمِ');
    expect(text).toMatch(/Genitiv|Dscharr/i);
  });

  it('liefert fehlend-Fallback ohne case-Merkmal', () => {
    const w = wort({ text: 'هُوَ', segments: [segment({ pos: 'PRON', features: { person: '3', gender: 'm', number: 'sg' } })] });
    const muster = kasusBegruendung(w, w.segments[0], [], t);
    expect(muster?.schluessel).toBe('grammatik.begruendungen.kasus.fehlend');
  });

  it('Adj: Kongruenz-Begründung statt Kasus-aus-Relation', () => {
    const w = ayah1[2];
    const stamm = w.segments.find((s) => s.kind === 'stem')!;
    const muster = kasusBegruendung(w, stamm, ayah1, t);
    expect(muster?.schluessel).toBe('grammatik.begruendungen.kasus.relationAdj');
    expect(muster?.ersetze.headText).toBe('ٱللَّهِ');
  });
});

describe('bestimmtheitBegruendung', () => {
  it('ٱللَّهِ: Eigenname', () => {
    const w = ayah1[1];
    const stamm = w.segments[0];
    expect(bestimmtheitBegruendung(w, stamm, ayah1)?.schluessel).toBe(
      'grammatik.begruendungen.bestimmtheit.eigenname',
    );
  });

  it('بِسْمِ: Artikel-Herleitung über DET nicht nötig — Mudaf vor Allah', () => {
    const w = ayah1[0];
    const stamm = w.segments.find((s) => s.kind === 'stem')!;
    const muster = bestimmtheitBegruendung(w, stamm, ayah1);
    expect(muster?.schluessel).toBe('grammatik.begruendungen.bestimmtheit.mudaf');
    expect(muster?.ersetze.headWort).toBe('ٱللَّهِ');
  });
});

describe('tempusBegruendung / modusBegruendung', () => {
  it('نَعْبُدُ: Tempus imperfect', () => {
    const w = sure1.verses['5'][1];
    const stamm = w.segments[0];
    expect(tempusBegruendung(w, stamm)?.schluessel).toBe('grammatik.begruendungen.tempus.imperfect');
  });

  it('modus nur bei gesetztem mood — kein Hardcode bei null', () => {
    const w = sure1.verses['5'][1];
    expect(modusBegruendung(w, w.segments[0])).toBeNull();
    const mitSub = segment({ pos: 'V', features: { tense: 'imperfect', mood: 'sub', person: '3', number: 'sg' } });
    const wSub = wort({ segments: [mitSub] });
    expect(modusBegruendung(wSub, mitSub)?.schluessel).toBe('grammatik.begruendungen.modus.sub');
  });
});

describe('genusVerbiBegruendung', () => {
  it('Aktiv-Default bei voice null auf V-Stamm', () => {
    const w = sure1.verses['5'][1];
    expect(genusVerbiBegruendung(w, w.segments[0])?.schluessel).toBe('grammatik.begruendungen.genusVerbi.aktiv');
  });

  it('Passiv bei PASS-Tag auf V-Stamm', () => {
    const stamm = segment({
      pos: 'V',
      features: { tense: 'perfect', voice: 'passive', person: '3', gender: 'm', number: 'sg' },
      raw: 'STEM|POS:V|PASS|PERF|3MS',
    });
    const w = wort({ text: 'أُنزِلَ', segments: [stamm] });
    expect(genusVerbiBegruendung(w, stamm)?.schluessel).toBe('grammatik.begruendungen.genusVerbi.passiv');
  });
});

describe('verbformBegruendung', () => {
  it('Form I hergeleitet', () => {
    const w = sure1.verses['5'][1];
    expect(verbformBegruendung(w, 1, 'hergeleitet', '')?.schluessel).toBe('grammatik.begruendungen.verbform.form1');
  });

  it('Form X explizit mit Formmerkmal', () => {
    const w = sure1.verses['5'][3];
    const info = t('grammatik.verbEigenschaften.verbform.formen.10.info');
    const muster = verbformBegruendung(w, 10, 'beleg', info);
    expect(muster?.schluessel).toBe('grammatik.begruendungen.verbform.explizit');
    expect(loeseBegruendung(muster, t)).toContain('Verbform 10');
  });

  it('Form XII ehrlicher Fallback ohne Absturz', () => {
    const w = wort({ segments: [segment({ pos: 'V', features: { tense: 'imperfect', verbForm: 12, person: '3', number: 'sg' } })] });
    const muster = verbformBegruendung(w, 12, 'beleg', '');
    expect(muster?.schluessel).toBe('grammatik.begruendungen.verbform.selten');
    expect(loeseBegruendung(muster, t)).toContain('12');
  });
});

describe('wortAnalyseModel — Begründungen in Anzeige', () => {
  it('ismEigenschaftenAnzeige liefert Kasus-Begründung für بِسْمِ', () => {
    const w = ayah1[0];
    const stamm = w.segments.find((s) => s.kind === 'stem')!;
    const anzeige = ismEigenschaftenAnzeige(w, stamm, ayah1, t);
    expect(anzeige.kasus?.begruendung).toMatch(/Genitiv|Dscharr/i);
  });

  it('verbEigenschaftenAnzeige liefert synthetisches Aktiv-Genus verbi', () => {
    const w = sure1.verses['5'][1];
    const anzeige = verbEigenschaftenAnzeige(w, w.segments[0], t);
    expect(anzeige.genusVerbi?.wert).toBe('active');
    expect(anzeige.genusVerbi?.begruendung).toMatch(/Aktiv/i);
  });

  it('relationAnzeige liefert strukturelle Begründung', () => {
    const w = ayah1[1];
    const rel = relationAnzeige(w, ayah1, t);
    expect(rel?.begruendung).toContain('ٱللَّهِ');
    expect(rel?.begruendungKasus).toMatch(/Genitiv|Dscharr|Muḍāf/i);
  });

  it('بِسْمِ (1:1:1): Selbstbezug → kein Bezugswort, Begründung ohne Head-Bezug', () => {
    const w = ayah1[0];
    const rel = relationAnzeige(w, ayah1, t);
    expect(rel?.head).toBeNull();
    expect(rel?.headText).toBeNull();
    expect(relationBegruendung(w, ayah1, rel!.name)?.schluessel).toBe(
      'grammatik.begruendungen.relation.strukturellOhneHead',
    );
    expect(rel?.begruendung).toMatch(/kein Bezugswort/i);
  });

  it('ٱلْحَمْدُ (1:2:1): Selbstbezug root → kein Bezugswort', () => {
    const w = ayah2[0];
    const rel = relationAnzeige(w, ayah2, t);
    expect(rel?.head).toBeNull();
    expect(rel?.headText).toBeNull();
    expect(relationBegruendung(w, ayah2, rel!.name)?.schluessel).toBe(
      'grammatik.begruendungen.relation.strukturellOhneHead',
    );
  });

  it('رَبِّ (1:2:3): Bezug auf لِلَّهِ bleibt erhalten', () => {
    const w = ayah2[2];
    const headWort = ayah2[1];
    const rel = relationAnzeige(w, ayah2, t);
    expect(rel?.head).toBe(2);
    expect(rel?.headText).toBe(headWort.text);
    expect(rel?.begruendung).toContain(headWort.text);
  });

  it('fragmentAnzeige (Stamm): info ohne POS-Anhang', () => {
    const stamm = ayah1[0].segments.find((s) => s.kind === 'stem')!;
    const anzeige = fragmentAnzeige(stamm, t);
    expect(anzeige.info).not.toContain(POS_N_INFO);
    expect(anzeige.info).toContain('سْمِ');
  });
});
