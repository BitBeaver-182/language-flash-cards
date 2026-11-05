import {
  countActiveWords,
  MAX_ACTIVE_WORDS,
  MAX_NEW_PER_SESSION,
  selectReplacement,
  selectWords,
} from './session';
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
  const selected = selectWords(many, progress, now, undefined, { rng: () => 0.5 });
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
  expect(selectWords(many, progress, now)).toHaveLength(10);
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
  expect(selected).toHaveLength(6);
  expect(selected.every(word => word.tags.includes('people'))).toBe(true);
  expect(selected.filter(word => progress[word.id])).toHaveLength(2);
  expect(selected.filter(word => !progress[word.id])).toHaveLength(4);
});

it('fills remaining slots with reviews when few unseen words remain', () => {
  const many = freshWords(12);
  const progress = Object.fromEntries(many.slice(0, 11).map(word => [word.id, reviewed(word.id)]));
  const selected = selectWords(many, progress, now);
  expect(selected).toHaveLength(10);
  expect(selected.filter(word => !progress[word.id])).toHaveLength(1);
});

it('introduces ten distinct words on a fresh start and excludes ignored words', () => {
  const many = freshWords(20);
  const progress = { '0': { ...reviewed('0', []), removed: true } };
  const selected = selectWords(many, progress, now);
  expect(selected).toHaveLength(10);
  expect(selected.some(word => word.id === '0')).toBe(false);
});

it('finishes the initial ten across sessions, then limits new words to three', () => {
  const many = freshWords(30);
  const nine = Object.fromEntries(many.slice(0, 9).map(word => [word.id, reviewed(word.id)]));
  expect(selectWords(many, nine, now).filter(word => !nine[word.id])).toHaveLength(1);
  const ten: Record<string, ReturnType<typeof reviewed>> = { ...nine, '9': reviewed('9') };
  expect(selectWords(many, ten, now).filter(word => !ten[word.id])).toHaveLength(3);
  ten['0'] = { ...ten['0'], removed: true };
  expect(selectWords(many, ten, now).filter(word => !ten[word.id])).toHaveLength(3);
});

it('counts previously answered duplicate forms only once across topics', () => {
  const many = freshWords(20);
  const duplicate = { ...many[0], id: 'other', tags: ['other'] };
  const progress: Record<string, ReturnType<typeof reviewed>> = {
    '0': reviewed('0'),
    other: reviewed('other'),
  };
  expect(
    selectWords([...many, duplicate], progress, now).filter(word => !progress[word.id]),
  ).toHaveLength(9);
});

it('replaces a removed word with the weakest eligible review without repeating the queue', () => {
  const many = freshWords(20);
  const progress = Object.fromEntries(many.slice(0, 12).map(word => [word.id, reviewed(word.id)]));
  progress['10'] = { ...progress['10'], strength: 0.1 };
  const queue = [...many.slice(0, 9), many[12]];
  const random = jest.spyOn(Math, 'random').mockReturnValue(0.5);
  const replacement = selectReplacement(many, progress, progress, queue, many[9], now);
  expect(replacement?.id).toBe('10');
  random.mockRestore();
});

it('uses the freed new-word slot but does not exceed three new words after bootstrap', () => {
  const many = freshWords(30);
  const progress = Object.fromEntries(many.slice(0, 10).map(word => [word.id, reviewed(word.id)]));
  const queue = [...many.slice(0, 7), many[10], many[11]];
  const replacement = selectReplacement(many, progress, progress, queue, many[12], now);
  expect(replacement).toBeDefined();
  // Remaining reviews take priority, so no extra unseen word is needed.
  expect(progress[replacement!.id]).toBeDefined();
  const allReviewsQueued = [...many.slice(0, 10), ...many.slice(10, 12)];
  const freshReplacement = selectReplacement(
    many,
    progress,
    progress,
    allReviewsQueued,
    many[12],
    now,
  );
  expect(freshReplacement).toBeDefined();
  expect(progress[freshReplacement!.id]).toBeUndefined();
  const threeQueued = [...allReviewsQueued, freshReplacement!];
  expect(selectReplacement(many, progress, progress, threeQueued, many[13], now)).toBeUndefined();
});

it('does not reuse a duplicate form, a removed word, or a word outside the topic', () => {
  const many = freshWords(12).map((word, i) => ({ ...word, tags: [i < 10 ? 'a' : 'b'] }));
  const duplicate = { ...many[0], id: 'duplicate' };
  const progress = Object.fromEntries(many.map(word => [word.id, reviewed(word.id)]));
  const queue = many.slice(0, 9);
  expect(
    selectReplacement([...many, duplicate], progress, progress, queue, many[9], now, 'a'),
  ).toBeUndefined();
});

it('reserves active slots for queued new words and frees a removed active slot', () => {
  const many = freshWords(45);
  const progress = Object.fromEntries(many.slice(0, 35).map(word => [word.id, reviewed(word.id)]));
  // One unreviewed word already reserves the final active slot; no other new word fits.
  const allReviews = [...many.slice(0, 35), many[35]];
  expect(selectReplacement(many, progress, progress, allReviews, many[36], now)).toBeUndefined();
  const removedActive = many[0];
  const queue = [...many.slice(1, 35), many[35]];
  const replacement = selectReplacement(many, progress, progress, queue, removedActive, now);
  expect(replacement).toBeDefined();
  expect(progress[replacement!.id]).toBeUndefined();
});

it('replaces ignored new words during the initial ten without consuming an extra place', () => {
  const many = freshWords(12);
  const replacement = selectReplacement(many, {}, {}, many.slice(1, 10), many[0], now);
  expect(replacement).toBeDefined();
  expect(many.slice(1, 10)).not.toContain(replacement);
  expect(replacement?.id).not.toBe('0');
});

it('selects lower last-ten accuracy more often while retaining a chance for perfect words', () => {
  const pool = freshWords(20);
  const progress = Object.fromEntries(
    pool.map((word, i) => [word.id, reviewed(word.id, Array(10).fill(i >= 10))]),
  );
  let seed = 1234567;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  let weak = 0;
  let strong = 0;
  for (let i = 0; i < 1000; i++) {
    for (const word of selectWords(pool, progress, now, undefined, { rng })) {
      if (Number(word.id) < 10) weak++;
      else strong++;
    }
  }
  expect(weak).toBeGreaterThan(strong * 2);
  expect(strong).toBeGreaterThan(0);
});

it('uses partial history proportionally and treats missing history as unknown', () => {
  const pool = freshWords(3);
  const progress = {
    '0': reviewed('0', [false]),
    '1': reviewed('1', [true]),
    '2': { ...reviewed('2', []), reviews: 1 },
  };
  const chosen = selectWords(pool, progress, now, undefined, { rng: () => 0.5 });
  expect(chosen.map(word => word.id)).toEqual(['0', '2', '1']);
});
