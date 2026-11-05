import { consolidateDuplicates, findDuplicateWords, mergedVocabulary } from './mergedVocabulary';
import { LegacyWord as Word } from './vocabulary';

it('includes new entries and updates existing ones without duplicating IDs', () => {
  const base: Word = {
    id: 'old',
    hu: 'alma',
    en: 'apple',
    es: 'manzana',
    topics: [],
    sourceRows: [2],
    eligible: true,
  };
  const edited: Word = { ...base, hu: 'körte' };
  const added: Word = { ...base, id: 'new', hu: 'kenyér' };
  const words = mergedVocabulary([base], { old: edited, new: added });
  expect(words.map(word => word.hu)).toEqual(['körte', 'kenyér']);
  expect(words.map(word => word.id).sort()).toEqual(['new', 'old']);
});

it('consolidates duplicate cards and retains their tags and latest review', () => {
  const first: Word = {
    id: 'one',
    hu: 'Vár',
    en: 'castle',
    es: 'castillo',
    topics: ['places'],
    sourceRows: [1],
    eligible: true,
  };
  const second: Word = {
    ...first,
    id: 'two',
    hu: 'vár',
    en: 'wait',
    es: 'esperar',
    topics: ['verbs'],
  };
  const old = {
    wordId: 'one',
    strength: 0.4,
    stabilityDays: 1,
    reviewedAt: '2026-01-01',
    reviews: 1,
    removed: false,
    recent: [],
  };
  const latest = { ...old, wordId: 'two', strength: 0.8, reviewedAt: '2026-01-02' };
  const result = consolidateDuplicates(
    [first, second],
    {},
    { one: ['places'], two: ['verbs'] },
    { one: old, two: latest },
  );
  const words = mergedVocabulary([first, second], result.userWords);
  expect(words).toHaveLength(1);
  expect(words[0].en).toBe('castle\nwait');
  expect(words[0].es).toBe('castillo\nesperar');
  expect(result.customTags.one).toEqual(['places', 'verbs']);
  expect(result.progress.one).toMatchObject({ wordId: 'one', strength: 0.8 });
  expect(result.userWords.two.mergedInto).toBe('one');
  expect(result.progress.two).toEqual(latest);
  expect(
    consolidateDuplicates([first, second], result.userWords, result.customTags, result.progress),
  ).toEqual(result);
});

it('finds duplicate Hungarian entries without treating accented letters as equivalent', () => {
  const base: Word = {
    id: 'one',
    hu: '  Vár ',
    en: 'castle',
    es: 'castillo',
    topics: ['places'],
    sourceRows: [1],
    eligible: true,
  };
  const other: Word = {
    ...base,
    id: 'two',
    hu: 'vár',
    en: 'wait',
    es: 'esperar',
    topics: ['verbs'],
    sourceRows: [2],
  };
  const different = { ...base, id: 'three', hu: 'var' };
  const result = findDuplicateWords([base, other, different]);
  expect(result).toHaveLength(1);
  expect(result[0].map(word => word.id)).toEqual(['one', 'two']);
});
