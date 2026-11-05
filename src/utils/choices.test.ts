import { makeChoices, capitalizeOption } from './choices';
import { Word } from './vocabulary';

const word = (id: string, en: string, tags: string[] = []): Word => ({
  id,
  hu: id,
  en,
  es: en,
  tags,
  eligible: true,
});

it('capitalizes options using sentence case', () => {
  expect(capitalizeOption('carrot')).toBe('Carrot');
  expect(capitalizeOption('to eat')).toBe('To eat');
  expect(capitalizeOption('Apple')).toBe('Apple');
  expect(capitalizeOption('')).toBe('');
});

it('offers one correct meaning and never uses another valid meaning as a distractor', () => {
  const target = word('one', 'castle\nwait');
  const result = makeChoices(
    target,
    [target, word('other', 'wait'), word('two', 'house'), word('three', 'tree')],
    'en',
    { shuffle: false },
  );
  expect(result).toEqual(['Castle', 'House', 'Tree']);
});

it('requires distinct safe answers and includes the target', () => {
  const target = word('one', 'one');
  expect(makeChoices(target, [target, word('two', 'two')], 'en', { shuffle: false })).toEqual([]);
  expect(
    makeChoices(target, [target, word('two', 'two'), word('three', 'three')], 'en', {
      shuffle: false,
    }),
  ).toEqual(['One', 'Two', 'Three']);
});

it('prioritizes related words sharing specific tags over general words', () => {
  const target = word('carrot', 'carrot', ['Vegetables', 'Word']);
  const related1 = word('potato', 'potato', ['Vegetables', 'Word']);
  const related2 = word('onion', 'onion', ['Vegetables', 'Word']);
  const unrelated = word('car', 'car', ['Transport', 'Word']);
  const general = word('book', 'book', ['Word']);

  const result = makeChoices(target, [target, unrelated, general, related1, related2], 'en', {
    shuffle: false,
  });

  expect(result).toHaveLength(3);
  expect(result).toContain('Carrot');
  expect(result).toContain('Potato');
  expect(result).toContain('Onion');
  expect(result).not.toContain('Car');
  expect(result).not.toContain('Book');
});

it('falls back to general words when related words are insufficient', () => {
  const target = word('carrot', 'carrot', ['Vegetables', 'Word']);
  const related = word('potato', 'potato', ['Vegetables', 'Word']);
  const general = word('book', 'book', ['Word']);

  const result = makeChoices(target, [target, related, general], 'en', { shuffle: false });

  expect(result).toEqual(['Carrot', 'Potato', 'Book']);
});

it('shuffles the position of the correct answer across multiple calls', () => {
  const target = word('one', 'one');
  const pool = [target, word('two', 'two'), word('three', 'three')];

  const positions = new Set<number>();
  for (let i = 0; i < 30; i++) {
    const choices = makeChoices(target, pool, 'en', { shuffle: true });
    expect(choices).toHaveLength(3);
    const pos = choices.indexOf('One');
    expect(pos).toBeGreaterThanOrEqual(0);
    positions.add(pos);
  }

  // Over 30 runs, with random shuffling, the correct answer should appear at more than one position
  expect(positions.size).toBeGreaterThan(1);
});
