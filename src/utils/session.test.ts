import { selectWords } from './session';
import { Word } from './vocabulary';

const words: Word[] = ['a', 'b', 'c'].map(id => ({
  id,
  hu: id,
  en: id,
  es: id,
  topics: ['people'],
  sourceRows: [1],
  eligible: true,
}));

it('prioritizes weak words and excludes removed words', () => {
  const now = new Date('2026-01-08T00:00:00Z');
  const progress = {
    a: {
      wordId: 'a',
      strength: 0.8,
      stabilityDays: 7,
      reviewedAt: '2026-01-01T00:00:00Z',
      reviews: 1,
      removed: false,
    },
    c: { wordId: 'c', strength: 0, stabilityDays: 1, reviewedAt: '', reviews: 0, removed: true },
  };
  expect(selectWords(words, progress, now).map(word => word.id)).toEqual(['a', 'b']);
  expect(selectWords(words, progress, now, 'other')).toEqual([]);
});

it('does not include repeated forms of the same Hungarian word in one session', () => {
  const duplicates = [words[0], { ...words[0], id: 'another-sense' }, words[1]];
  expect(selectWords(duplicates, {}, new Date()).map(word => word.hu)).toEqual(['a', 'b']);
});

it('mixes seven unseen words with three reviewed words, prioritizing weak recall', () => {
  const now = new Date('2026-01-08T12:00:00Z');
  const many = Array.from({ length: 25 }, (_, i) => ({
    ...words[0],
    id: String(i),
    hu: String(i),
  }));
  const recentlyReviewed = Object.fromEntries(
    many.slice(0, 10).map(word => [
      word.id,
      {
        wordId: word.id,
        strength: word.id === '0' ? 0.1 : 0.6,
        stabilityDays: 1,
        reviewedAt: now.toISOString(),
        reviews: 1,
        removed: false,
      },
    ]),
  );
  const selected = selectWords(many, recentlyReviewed, now);
  expect(selected.filter(word => !recentlyReviewed[word.id])).toHaveLength(7);
  expect(selected.filter(word => recentlyReviewed[word.id])).toHaveLength(3);
  expect(selected.some(word => word.id === '0')).toBe(true);
  expect(selected.slice(0, 7).some(word => recentlyReviewed[word.id])).toBe(true);
});

it('treats duplicate Hungarian forms as reviewed rather than introducing them again', () => {
  const now = new Date('2026-01-08T12:00:00Z');
  const many = Array.from({ length: 15 }, (_, i) => ({
    ...words[0],
    id: String(i),
    hu: String(i),
  }));
  many.push({ ...many[0], id: 'duplicate' });
  const progress = {
    '0': {
      wordId: '0',
      strength: 0.6,
      stabilityDays: 1,
      reviewedAt: now.toISOString(),
      reviews: 1,
      removed: false,
    },
  };
  const selected = selectWords(many, progress, now);
  expect(selected.filter(word => word.hu === '0')).toHaveLength(1);
  expect(selected.find(word => word.hu === '0')?.id).toBe('0');
});

it('applies the mix within the chosen topic and fills empty review slots with new words', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({
    ...words[0],
    id: String(i),
    hu: String(i),
    topics: [i < 15 ? 'people' : 'food'],
  }));
  const now = new Date('2026-01-08T12:00:00Z');
  const progress = Object.fromEntries(
    [0, 1, 15, 16, 17, 18].map(i => [
      String(i),
      {
        wordId: String(i),
        strength: 0.5,
        stabilityDays: 1,
        reviewedAt: '2026-01-07T12:00:00Z',
        reviews: 1,
        removed: false,
      },
    ]),
  );
  const selected = selectWords(many, progress, now, 'people');
  expect(selected).toHaveLength(10);
  expect(selected.every(word => word.topics.includes('people'))).toBe(true);
  expect(selected.filter(word => progress[word.id])).toHaveLength(2);
});

it('fills remaining slots with reviews when few unseen words remain', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({
    ...words[0],
    id: String(i),
    hu: String(i),
  }));
  const progress = Object.fromEntries(
    many.slice(0, 11).map(word => [
      word.id,
      {
        wordId: word.id,
        strength: 0.5,
        stabilityDays: 1,
        reviewedAt: '2026-01-01T00:00:00Z',
        reviews: 1,
        removed: false,
      },
    ]),
  );
  const selected = selectWords(many, progress, new Date('2026-01-08T00:00:00Z'));
  expect(selected).toHaveLength(10);
  expect(selected.filter(word => !progress[word.id])).toHaveLength(1);
});
