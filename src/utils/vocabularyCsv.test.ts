import { exportVocabularyCsv, importVocabularyCsv } from './vocabularyCsv';
import { Word } from './vocabulary';

it('round trips quoted words, tags and removal with stable IDs', () => {
  const words: Word[] = [
    {
      id: 'stable-id',
      hu: 'kényelmes',
      en: 'comfortable, cosy',
      es: 'cómodo',
      tags: ['people', 'description'],
      eligible: true,
    },
  ];
  const csv = exportVocabularyCsv(words, {
    'stable-id': {
      wordId: 'stable-id',
      removed: true,
      strength: 0,
      stabilityDays: 1,
      reviewedAt: '',
      reviews: 0,
      recent: [],
    },
  });
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
    { id: 'x', hu: 'ház', en: 'house', es: 'casa', tags: ['a|b', 'c\\d'], eligible: true },
  ];
  const csv = exportVocabularyCsv(words, {});
  expect(importVocabularyCsv(csv)[0].tags).toEqual(['a|b', 'c\\d']);
});

it('accepts semicolon-delimited CSV from localized Excel', () => {
  const csv = 'id;hungarian;english;spanish;tags;removed\n1;alma;apple;manzana;fruit;false';
  expect(importVocabularyCsv(csv)[0].hu).toBe('alma');
});

it('round trips a word that only has a third-language meaning', () => {
  const words: Word[] = [
    {
      id: 'sk-only',
      hu: 'répa',
      en: '',
      es: '',
      translations: { sk: 'mrkva' },
      tags: ['Vegetables'],
      eligible: true,
    },
  ];
  const csv = exportVocabularyCsv(words, {});
  const imported = importVocabularyCsv(csv)[0];
  expect(imported.en).toBe('');
  expect(imported.es).toBe('');
  expect(imported.translations).toEqual({ sk: 'mrkva' });
});

it('supports custom language columns such as slovak', () => {
  const words: Word[] = [
    {
      id: 'custom-lang',
      hu: 'répa',
      en: 'carrot',
      es: 'zanahoria',
      translations: { en: 'carrot', es: 'zanahoria', sk: 'mrkva' },
      tags: ['Vegetables'],
      eligible: true,
    },
  ];
  const csv = exportVocabularyCsv(words, {});
  expect(csv).toContain('slovak');
  const imported = importVocabularyCsv(csv);
  expect(imported[0].hu).toBe('répa');
  expect(imported[0].translations?.sk).toBe('mrkva');
});
