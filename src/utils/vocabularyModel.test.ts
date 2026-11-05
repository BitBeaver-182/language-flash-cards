import { createVocabularyState, createWordId } from './vocabularyModel';
import catalog from '@/data/vocabulary.json';

jest.mock('expo-crypto', () => {
  let counter = 0;
  return {
    randomUUID: () => `00000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`,
  };
});

it('creates unique word identifiers with the seed identifier shape', () => {
  const first = createWordId();
  const second = createWordId();
  expect(first).toMatch(/^word-[0-9a-f]{32}$/);
  expect(second).not.toBe(first);
});

it('migrates legacy entries and their tags into one canonical record', () => {
  const legacy = [
    {
      id: 'alma|apple|manzana',
      hu: 'alma',
      en: 'apple',
      es: 'manzana',
      topics: ['Vocabulary / Food'],
      sourceRows: [2],
      eligible: true,
    },
  ];
  const result = createVocabularyState(
    legacy,
    {},
    { 'alma|apple|manzana': ['Fruit'] },
    {},
    () => 'stable-id',
  );
  expect(result.words['stable-id']).toEqual({
    id: 'stable-id',
    hu: 'alma',
    en: 'apple',
    es: 'manzana',
    tags: ['Fruit'],
    eligible: true,
  });
  expect(result.idMap['alma|apple|manzana']).toBe('stable-id');
});

it('ships seed entries with distinct stable IDs and individual tags', () => {
  expect(new Set(catalog.map(word => word.id)).size).toBe(catalog.length);
  expect(catalog.every(word => /^word-[0-9a-f]{32}$/.test(word.id))).toBe(true);
  expect(catalog.every(word => Array.isArray(word.tags) && !('topics' in word))).toBe(true);
  expect(
    catalog.every(word => word.tags.every(tag => tag !== 'Vocabulary' && !tag.includes(' / '))),
  ).toBe(true);
});

it('merges duplicate words and maps old review records to the new id', () => {
  const base = [
    {
      id: 'a',
      hu: 'vár',
      en: 'castle',
      es: 'castillo',
      topics: ['Places'],
      sourceRows: [1],
      eligible: true,
    },
    {
      id: 'b',
      hu: 'VÁR',
      en: 'wait',
      es: 'esperar',
      topics: ['Verbs'],
      sourceRows: [2],
      eligible: true,
    },
  ];
  const progress = {
    b: {
      wordId: 'b',
      strength: 0.5,
      stabilityDays: 1,
      reviewedAt: '2026-01-02',
      reviews: 1,
      removed: false,
      recent: [],
    },
  };
  const result = createVocabularyState(base, {}, {}, progress, () => 'new-id');
  expect(Object.keys(result.words)).toEqual(['new-id']);
  expect(result.words['new-id'].en).toBe('castle\nwait');
  expect(result.words['new-id'].tags).toEqual(expect.arrayContaining(['Places', 'Verbs']));
  expect(result.idMap).toEqual({ a: 'new-id', b: 'new-id' });
  expect(result.progress['new-id'].reviews).toBe(1);
});
