import type { MorphFeatures, MorphSegment, MorphWord } from '../morphologieTypen';

import { lehrtextVerweise } from './lehrtextMatch';

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
    text: overrides.text ?? 'x',
    kind: overrides.kind ?? 'stem',
    pos: overrides.pos ?? 'N',
    features: { ...LEERE_FEATURES, ...(overrides.features ?? {}) },
    derived: overrides.derived ?? [],
    raw: overrides.raw ?? overrides.pos ?? 'N',
  };
}

function wort(overrides: Partial<MorphWord>): MorphWord {
  return {
    position: 1,
    text: 'x',
    root: null,
    lemma: 'x',
    segments: [segment()],
    ...overrides,
  };
}

describe('lehrtextMatch', () => {
  it('ordnet badal (Relation App) dem Eintrag badal zu', () => {
    expect(lehrtextVerweise(wort({ syntax: { relation: 'App', relationAr: 'بدل', head: 2 } }))).toEqual([
      { bereich: 'partikel-syntax', id: 'badal' },
    ]);
  });

  it('ordnet Konjunktionen (Relation conj) huruf-atf zu', () => {
    expect(lehrtextVerweise(wort({ syntax: { relation: 'conj', relationAr: 'معطوف', head: 2 } }))).toEqual([
      { bereich: 'partikel-syntax', id: 'huruf-atf' },
    ]);
  });

  it('ordnet kaana-Familie (pred <<kan>>) kaana-wa-akhawatuha zu', () => {
    expect(
      lehrtextVerweise(wort({ syntax: { relation: 'pred <<kan>>', relationAr: 'خبر', head: 1 } })),
    ).toEqual([{ bereich: 'partikel-syntax', id: 'kaana-wa-akhawatuha' }]);
  });

  it('ordnet Präpositionen (POS P) huruf-jarr zu, wenn das Wort ein Harf ist', () => {
    expect(
      lehrtextVerweise(
        wort({
          segments: [segment({ text: 'لِ', pos: 'P', raw: 'P' })],
        }),
      ),
    ).toEqual([{ bereich: 'partikel-syntax', id: 'huruf-jarr' }]);
  });

  it('begrenzt auf höchstens zwei Treffer', () => {
    const treffer = lehrtextVerweise(
      wort({
        syntax: { relation: 'App', relationAr: 'بدل', head: 2 },
        segments: [
          segment({ text: 'وَ', kind: 'prefix', pos: 'CONJ', raw: 'CONJ' }),
          segment({ text: 'x', kind: 'stem', pos: 'N', raw: 'N' }),
        ],
      }),
      2,
    );
    expect(treffer.length).toBeLessThanOrEqual(2);
    expect(treffer[0]).toEqual({ bereich: 'partikel-syntax', id: 'badal' });
  });

  it('liefert eine leere Liste, wenn nichts passt', () => {
    expect(lehrtextVerweise(wort({ syntax: { relation: 'root', relationAr: 'جذر', head: null as unknown as number } }))).toEqual(
      [],
    );
  });
});
