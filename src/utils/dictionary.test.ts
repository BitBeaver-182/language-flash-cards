import { prepareDictionary } from './dictionary';
import { Word } from './vocabulary';

it('sorts Hungarian words and searches edited tags without losing unknown scores', () => {
  const words: Word[] = ['zsiráf', 'alma', 'árvíz'].map(hu => ({
    id: hu,
    hu,
    en: hu,
    es: hu,
    topics: ['Food'],
    sourceRows: [],
    eligible: true,
  }));
  const now = new Date('2026-01-01T00:00:00Z');
  expect(
    prepareDictionary(words, {}, {}, '', false, 'alphabet', true, now).map(word => word.hu),
  ).toEqual(['alma', 'árvíz', 'zsiráf']);
  expect(
    prepareDictionary(words, {}, { alma: ['garden'] }, 'garden', false, 'alphabet', true, now).map(
      word => word.hu,
    ),
  ).toEqual(['alma']);
  expect(prepareDictionary(words, {}, {}, '', false, 'knowledge', false, now)).toHaveLength(3);
});

it('finds Hungarian accents without accents and matches the selected support language and tags', () => {
  const words: Word[] = [
    {
      id: 'a',
      hu: 'kényelmes',
      en: 'comfortable',
      es: 'cómodo',
      topics: ['Everyday'],
      sourceRows: [],
      eligible: true,
    },
  ];
  const now = new Date('2026-01-01T00:00:00Z');
  expect(
    prepareDictionary(words, {}, {}, 'kenyelmes', false, 'alphabet', true, now, 'en'),
  ).toHaveLength(1);
  expect(
    prepareDictionary(words, {}, {}, 'kenyelms', false, 'alphabet', true, now, 'en'),
  ).toHaveLength(1);
  expect(
    prepareDictionary(
      words,
      {},
      { a: ['árvíztűrő'] },
      'arvizturo',
      false,
      'alphabet',
      true,
      now,
      'en',
    ),
  ).toHaveLength(1);
  expect(
    prepareDictionary(words, {}, {}, 'comodo', false, 'alphabet', true, now, 'es'),
  ).toHaveLength(1);
  expect(
    prepareDictionary(words, {}, {}, 'comodo', false, 'alphabet', true, now, 'en'),
  ).toHaveLength(0);
});

it('orders estimated knowledge in both directions while leaving unassessed words last', () => {
  const words: Word[] = ['a', 'b', 'c'].map(hu => ({
    id: hu,
    hu,
    en: hu,
    es: hu,
    topics: [],
    sourceRows: [],
    eligible: true,
  }));
  const now = new Date('2026-01-01T00:00:00Z');
  const progress = Object.fromEntries(
    (
      [
        ['a', 0.3],
        ['b', 0.9],
      ] as [string, number][]
    ).map(([id, strength]) => [
      id,
      {
        wordId: id,
        strength,
        stabilityDays: 1,
        reviewedAt: now.toISOString(),
        reviews: 1,
        removed: false,
      },
    ]),
  );
  expect(
    prepareDictionary(words, progress, {}, '', false, 'knowledge', true, now).map(item => item.hu),
  ).toEqual(['a', 'b', 'c']);
  expect(
    prepareDictionary(words, progress, {}, '', false, 'knowledge', false, now).map(item => item.hu),
  ).toEqual(['b', 'a', 'c']);
});
