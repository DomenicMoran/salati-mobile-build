import { addMistake, mistakeKey, MISTAKES_MAX, parseMistakes, removeMistake } from './mistakes';
import type { QuizQuestion } from '../learn/quiz';

function q(text: string, correct = 'A'): QuizQuestion {
  return {
    promptKey: 'p',
    promptText: text,
    display: '',
    displayArabic: false,
    optionsArabic: false,
    options: [correct, 'B', 'C', 'D'],
    correctIndex: 0,
  };
}

describe('Fehler-Wiederholung (mistakes)', () => {
  it('fügt vorn an und ersetzt Duplikate statt sie zu doppeln', () => {
    let list = addMistake([], q('Frage 1'));
    list = addMistake(list, q('Frage 2'));
    list = addMistake(list, q('Frage 1'));
    expect(list).toHaveLength(2);
    expect(list[0].promptText).toBe('Frage 1');
  });

  it('kappt auf MISTAKES_MAX', () => {
    let list: QuizQuestion[] = [];
    for (let i = 0; i < MISTAKES_MAX + 10; i++) list = addMistake(list, q(`F${i}`));
    expect(list).toHaveLength(MISTAKES_MAX);
    expect(list[0].promptText).toBe(`F${MISTAKES_MAX + 9}`);
  });

  it('entfernt gezielt über den stabilen Key', () => {
    let list = addMistake([], q('bleibt'));
    list = addMistake(list, q('geht'));
    list = removeMistake(list, q('geht'));
    expect(list.map((m) => m.promptText)).toEqual(['bleibt']);
  });

  it('Key unterscheidet Fragen mit gleichem Text aber anderer Antwort', () => {
    expect(mistakeKey(q('x', 'A'))).not.toBe(mistakeKey(q('x', 'Z')));
  });

  it('parseMistakes übersteht kaputtes JSON', () => {
    expect(parseMistakes('kaputt{')).toEqual([]);
    expect(parseMistakes(null)).toEqual([]);
  });
});
