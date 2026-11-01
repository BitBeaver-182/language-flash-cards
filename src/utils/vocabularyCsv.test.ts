import { exportVocabularyCsv, importVocabularyCsv } from './vocabularyCsv';
import { Word } from './vocabulary';

it('round trips quoted words, tags and removal with stable IDs', () => {
  const words: Word[] = [
    {
      id: 'stable-id',
      hu: 'kényelmes',
      en: 'comfortable, cosy',
      es: 'cómodo',
      topics: ['Adjectives'],
      sourceRows: [2],
      eligible: true,
    },
  ];
  const csv = exportVocabularyCsv(
    words,
    { 'stable-id': ['people', 'description'] },
    {
      'stable-id': {
        wordId: 'stable-id',
        removed: true,
        strength: 0,
        stabilityDays: 1,
        reviewedAt: '',
        reviews: 0,
      },
    },
  );
  expect(importVocabularyCsv(csv)).toEqual([
    {
      id: 'stable-id',
      hu: 'kényelmes',
      en: 'comfortable, cosy',
      es: 'cómodo',
      tags: ['people', 'description'],
      removed: true,
    },
  ]);
});

it('rejects malformed CSV without returning partial changes', () => {
  expect(() =>
    importVocabularyCsv(
      'id,hungarian,english,spanish,tags,removed\n1,alma,apple,manzana,fruit,false\n2,,bad,bad,,false',
    ),
  ).toThrow();
});

it('preserves delimiters and backslashes inside tags', () => {
  const words: Word[] = [
    { id: 'x', hu: 'ház', en: 'house', es: 'casa', topics: [], sourceRows: [], eligible: true },
  ];
  const csv = exportVocabularyCsv(words, { x: ['a|b', 'c\\d'] }, {});
  expect(importVocabularyCsv(csv)[0].tags).toEqual(['a|b', 'c\\d']);
});

it('accepts semicolon-delimited CSV from localized Excel', () => {
  const csv = 'id;hungarian;english;spanish;tags;removed\n1;alma;apple;manzana;fruit;false';
  expect(importVocabularyCsv(csv)[0].hu).toBe('alma');
});
