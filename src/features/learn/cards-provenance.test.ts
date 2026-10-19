import { buildCards } from './cards';
import type { Lesson } from './curriculum';

describe('Quellen pro Lernkarte', () => {
  it('bewahrt die abschnittsspezifische Quelle statt nur der Sammelquelle', () => {
    const lesson: Lesson = {
      id: 'review-test', kind: 'story', source: 'Sammelquelle',
      story: [
        { title: { de: 'A' }, text: { de: 'Text A' }, source: 'Werk A, S. 38' },
        { title: { de: 'B' }, text: { de: 'Text B' }, source: 'Werk B, Regel 235' },
      ],
    };
    const cards = buildCards(lesson, 'de');
    expect(cards.map(card => card.source)).toEqual(['Werk A, S. 38', 'Werk B, Regel 235']);
    expect(cards.map(card => card.text)).toEqual(['Text A', 'Text B']);
  });
});
