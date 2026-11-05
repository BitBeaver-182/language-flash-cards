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

it('prefers practiced words when falling back after exhausting shared tags', () => {
  const target = word('carrot', 'carrot', ['Vegetables']);
  const related = word('potato', 'potato', ['Vegetables']);
  const unknown = word('wall', 'wall', ['Buildings']);
  const practiced = word('train', 'train', ['Transport']);
  const progress = {
    train: {
      wordId: 'train',
      strength: 0.5,
      stabilityDays: 1,
      reviewedAt: '',
      reviews: 1,
      removed: false,
      recent: [],
    },
  };
  expect(
    makeChoices(target, [target, unknown, practiced, related], 'en', { shuffle: false, progress }),
  ).toEqual(['Carrot', 'Potato', 'Train']);
});

it('prefers a shared category over practiced unrelated words', () => {
  const target = word('carrot', 'carrot', ['Vegetables']);
  const potato = word('potato', 'potato', ['Vegetables']);
  const onion = word('onion', 'onion', ['Vegetables']);
  const progress = {
    wall: {
      wordId: 'wall',
      strength: 0.5,
      stabilityDays: 1,
      reviewedAt: '',
      reviews: 3,
      removed: false,
      recent: [],
    },
  };
  expect(
    makeChoices(target, [target, word('wall', 'wall'), potato, onion], 'en', {
      shuffle: false,
      progress,
    }),
  ).toEqual(['Carrot', 'Potato', 'Onion']);
});

it('uses nationality alternatives for the actual Canadian example, instead of bread or the country', () => {
  const target = word('kanadai', 'Canadian', ['Numbers', 'People', 'Pronunciation', 'Word']);
  const canadianCountry = word('kanada', 'Canada', ['Numbers', 'People', 'Pronunciation', 'Word']);
  const bread = word('kenyér', 'bread', ['Numbers', 'Word']);
  const german = word('német', 'German', ['People', 'Nationalities']);
  const spanish = word('spanyol', 'Spanish', ['People', 'Nationalities']);
  expect(
    makeChoices(target, [target, canadianCountry, bread, german, spanish], 'en', {
      shuffle: false,
    }),
  ).toEqual(['Canadian', 'German', 'Spanish']);
});

it('varies same-category alternatives when there are more than two', () => {
  const target = word('a', 'apple', ['Fruit']);
  const pool = [
    target,
    word('b', 'banana', ['Fruit']),
    word('c', 'cherry', ['Fruit']),
    word('d', 'date', ['Fruit']),
    word('e', 'elderberry', ['Fruit']),
  ];
  const alternatives = new Set<string>();
  for (let i = 0; i < 40; i++) {
    for (const option of makeChoices(target, pool, 'en'))
      if (option !== 'Apple') alternatives.add(option);
  }
  expect(alternatives.size).toBeGreaterThan(2);
});

it('excludes removed words and candidates whose other meanings match the answer', () => {
  const target = word('one', 'castle\nwait');
  const ambiguous = word('ambiguous', 'house\nwait');
  const removed = word('removed', 'boat');
  const progress = {
    removed: {
      wordId: 'removed',
      strength: 0,
      stabilityDays: 1,
      reviewedAt: '',
      reviews: 0,
      removed: true,
      recent: [],
    },
  };
  expect(
    makeChoices(target, [target, ambiguous, removed, word('x', 'tree'), word('y', 'door')], 'en', {
      shuffle: false,
      progress,
    }),
  ).toEqual(['Castle', 'Tree', 'Door']);
});
