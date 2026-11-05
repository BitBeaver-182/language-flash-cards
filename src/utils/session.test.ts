import { countActiveWords, MAX_ACTIVE_WORDS, MAX_NEW_PER_SESSION, selectWords } from './session';
import { Word } from './vocabulary';

const now = new Date('2026-01-08T00:00:00Z');

const words: Word[] = ['a', 'b', 'c'].map(id => ({
  id,
  hu: id,
  en: id,
  es: id,
  tags: ['people'],
  eligible: true,
}));

function reviewed(id: string, recent: boolean[] = [true]) {
  return {
    wordId: id,
    strength: 0.5,
    stabilityDays: 1,
    reviewedAt: '2026-01-07T12:00:00Z',
    reviews: recent.length,
    removed: false,
    recent,
  };
}

function freshWords(count: number): Word[] {
  return Array.from({ length: count }, (_, i) => ({ ...words[0], id: String(i), hu: String(i) }));
}

it('prioritizes weak words and excludes removed words', () => {
  const progress = {
    a: {
      wordId: 'a',
      strength: 0.8,
      stabilityDays: 7,
      reviewedAt: '2026-01-01T00:00:00Z',
      reviews: 1,
      removed: false,
      recent: [true],
    },
    c: {
      wordId: 'c',
      strength: 0,
      stabilityDays: 1,
      reviewedAt: '',
      reviews: 0,
      removed: true,
      recent: [],
    },
  };
  expect(selectWords(words, progress, now).map(word => word.id)).toEqual(['a', 'b']);
  expect(selectWords(words, progress, now, 'other')).toEqual([]);
});

it('does not include repeated forms of the same Hungarian word in one session', () => {
  const duplicates = [words[0], { ...words[0], id: 'another-sense' }, words[1]];
  expect(selectWords(duplicates, {}, now).map(word => word.hu)).toEqual(['a', 'b']);
});

it('counts duplicate Hungarian forms as one active word', () => {
  const duplicates = [
    { ...words[0], id: 'one' },
    { ...words[0], id: 'two' },
  ];
  expect(countActiveWords(duplicates, { one: reviewed('one') })).toBe(1);
});

it('introduces at most three unseen words per session', () => {
  const many = freshWords(25);
  const progress = Object.fromEntries(
    many
      .slice(0, 10)
      .map(word => [word.id, { ...reviewed(word.id), strength: word.id === '0' ? 0.1 : 0.6 }]),
  );
  const selected = selectWords(many, progress, now);
  expect(MAX_NEW_PER_SESSION).toBe(3);
  expect(selected.filter(word => !progress[word.id])).toHaveLength(3);
  expect(selected.filter(word => progress[word.id])).toHaveLength(7);
  expect(selected).toHaveLength(10);
  expect(selected[0].id).toBe('0');
  expect(selected.map(word => (progress[word.id] ? 0 : 1)).join('')).toBe('0100100100');
});

it('stops introducing new words at thirty-six active words', () => {
  const many = freshWords(50);
  const progress = Object.fromEntries(many.slice(0, 36).map(word => [word.id, reviewed(word.id)]));
  expect(MAX_ACTIVE_WORDS).toBe(36);
  expect(countActiveWords(many, progress)).toBe(36);
  const selected = selectWords(many, progress, now);
  expect(selected).toHaveLength(10);
  expect(selected.every(word => progress[word.id])).toBe(true);
});

it('allows one new word when thirty-five are active', () => {
  const many = freshWords(50);
  const progress = Object.fromEntries(many.slice(0, 35).map(word => [word.id, reviewed(word.id)]));
  const selected = selectWords(many, progress, now);
  expect(selected.filter(word => !progress[word.id])).toHaveLength(1);
});

it('shrinks the session instead of padding it with new words', () => {
  const many = freshWords(50);
  const progress = Object.fromEntries(many.slice(0, 3).map(word => [word.id, reviewed(word.id)]));
  expect(selectWords(many, progress, now)).toHaveLength(6);
});

it('keeps learned words in review and frees their active slot', () => {
  const many = freshWords(50);
  const progress = Object.fromEntries(many.slice(0, 36).map(word => [word.id, reviewed(word.id)]));
  const learnedId = many[0].id;
  progress[learnedId] = reviewed(learnedId, [
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    false,
    false,
  ]);
  expect(countActiveWords(many, progress)).toBe(35);
  expect(selectWords(many, progress, now).filter(word => !progress[word.id])).toHaveLength(1);
});

it('does not count removed words as active', () => {
  const many = freshWords(50);
  const progress = Object.fromEntries(many.slice(0, 36).map(word => [word.id, reviewed(word.id)]));
  progress[many[0].id] = { ...progress[many[0].id], removed: true };
  expect(countActiveWords(many, progress)).toBe(35);
});

it('keeps one session entry per reviewed Hungarian form', () => {
  const many = freshWords(15);
  many.push({ ...many[0], id: 'duplicate' });
  const progress = { '0': reviewed('0') };
  const selected = selectWords(many, progress, now);
  expect(selected.filter(word => word.hu === '0')).toHaveLength(1);
  expect(selected.find(word => word.hu === '0')?.id).toBe('0');
});

it('returns no words for a fresh-only topic when the cap is full', () => {
  const active = Array.from({ length: 36 }, (_, i) => ({
    ...words[0],
    id: `active-${i}`,
    hu: `active-${i}`,
    tags: ['food'],
  }));
  const fresh = Array.from({ length: 10 }, (_, i) => ({
    ...words[0],
    id: `fresh-${i}`,
    hu: `fresh-${i}`,
    tags: ['travel'],
  }));
  const progress = Object.fromEntries(active.map(word => [word.id, reviewed(word.id)]));
  expect(countActiveWords([...active, ...fresh], progress)).toBe(36);
  expect(selectWords([...active, ...fresh], progress, now, 'travel')).toEqual([]);
  expect(selectWords([...active, ...fresh], progress, now)).toHaveLength(10);
});

it('applies the cap within the chosen topic', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({
    ...words[0],
    id: String(i),
    hu: String(i),
    tags: [i < 15 ? 'people' : 'food'],
  }));
  const progress = Object.fromEntries(
    [0, 1, 15, 16, 17, 18].map(i => [String(i), reviewed(String(i))]),
  );
  const selected = selectWords(many, progress, now, 'people');
  expect(selected).toHaveLength(5);
  expect(selected.every(word => word.tags.includes('people'))).toBe(true);
  expect(selected.filter(word => progress[word.id])).toHaveLength(2);
  expect(selected.filter(word => !progress[word.id])).toHaveLength(3);
});

it('fills remaining slots with reviews when few unseen words remain', () => {
  const many = freshWords(12);
  const progress = Object.fromEntries(many.slice(0, 11).map(word => [word.id, reviewed(word.id)]));
  const selected = selectWords(many, progress, now);
  expect(selected).toHaveLength(10);
  expect(selected.filter(word => !progress[word.id])).toHaveLength(1);
});
