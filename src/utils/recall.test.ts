import { estimateRecall, isLearned, recentAccuracy, recordReview } from './recall';

function withRecent(recent: boolean[]) {
  return {
    wordId: 'a',
    strength: 0,
    stabilityDays: 1,
    reviewedAt: '',
    reviews: recent.length,
    removed: false,
    recent,
  };
}

describe('recall estimates', () => {
  const now = new Date('2026-01-01T00:00:00Z');

  it('does not assign an estimate to an unassessed word', () => {
    expect(estimateRecall(undefined, now)).toBeNull();
  });

  it('halves an estimate after its stability period and clamps clock changes', () => {
    const progress = {
      wordId: 'a',
      strength: 0.8,
      stabilityDays: 7,
      reviewedAt: now.toISOString(),
      reviews: 1,
      removed: false,
      recent: [],
    };
    expect(estimateRecall(progress, new Date('2026-01-08T00:00:00Z'))).toBe(40);
    expect(estimateRecall(progress, new Date('2025-12-31T00:00:00Z'))).toBe(80);
  });

  it('rewards recall more than recognition and reduces a missed answer', () => {
    const initial = recordReview(undefined, 'a', 'correct', 'recall', now);
    const later = new Date('2026-01-02T00:00:00Z');
    expect(recordReview(initial, 'a', 'correct', 'recall', later).strength).toBeGreaterThan(
      recordReview(initial, 'a', 'correct', 'recognition', later).strength,
    );
    expect(
      estimateRecall(recordReview(initial, 'a', 'incorrect', 'recall', later), later),
    ).toBeLessThan(estimateRecall(initial, later)!);
  });

  it('retains up to twenty recent attempts in order', () => {
    let progress = recordReview(undefined, 'a', 'correct', 'recall', now);
    progress = recordReview(progress, 'a', 'incorrect', 'recall', now);
    expect(progress.recent).toEqual([true, false]);

    for (let i = 0; i < 10; i++) {
      progress = recordReview(progress, 'a', i % 2 === 0 ? 'correct' : 'incorrect', 'recall', now);
    }
    expect(progress.recent).toHaveLength(12);
    expect(progress.recent).toEqual([
      true,
      false,
      true,
      false,
      true,
      false,
      true,
      false,
      true,
      false,
      true,
      false,
    ]);
  });

  it('graduates after ten attempts with at least eight correct', () => {
    expect(isLearned(withRecent(Array(9).fill(true)))).toBe(false);
    expect(isLearned(withRecent([...Array(8).fill(true), false, false]))).toBe(true);
    expect(isLearned(withRecent([...Array(7).fill(true), false, false, false]))).toBe(false);
    expect(isLearned(undefined)).toBe(false);
  });

  it('keeps previously learned words graduated after a later miss', () => {
    const learned = withRecent([true, true, true, true, true, true, true, true, false, false]);
    expect(isLearned(learned)).toBe(true);
    expect(isLearned(recordReview(learned, 'a', 'incorrect', 'recall', now))).toBe(true);
  });
});

it('graduates only after three spaced successes including free recall and stays graduated', () => {
  let p = recordReview(
    undefined,
    'spaced',
    'correct',
    'recognition',
    new Date('2026-01-01T10:00:00Z'),
  );
  p = recordReview(p, 'spaced', 'correct', 'recall', new Date('2026-01-01T12:00:00Z'));
  expect(p.spacedSuccesses).toHaveLength(1);
  p = recordReview(p, 'spaced', 'correct', 'recall', new Date('2026-01-02T10:00:00Z'));
  expect(isLearned(p)).toBe(false);
  p = recordReview(p, 'spaced', 'correct', 'recognition', new Date('2026-01-03T10:00:00Z'));
  expect(isLearned(p)).toBe(true);
  p = recordReview(p, 'spaced', 'incorrect', 'recall', new Date('2026-01-04T10:00:00Z'));
  expect(isLearned(p)).toBe(true);
});

it('does not graduate on recognition only or when recent results are poor', () => {
  let p = recordReview(undefined, 'w', 'correct', 'recognition', new Date('2026-01-01'));
  p = recordReview(p, 'w', 'correct', 'recognition', new Date('2026-01-02'));
  p = recordReview(p, 'w', 'correct', 'recognition', new Date('2026-01-03'));
  expect(isLearned(p)).toBe(false);
  p = recordReview(p, 'w', 'incorrect', 'recall', new Date('2026-01-03T01:00:00Z'));
  p = recordReview(p, 'w', 'incorrect', 'recall', new Date('2026-01-03T02:00:00Z'));
  p = recordReview(p, 'w', 'correct', 'recall', new Date('2026-01-04'));
  expect(isLearned(p)).toBe(true); // Three of the last five are correct.
});

it('retains and reports only the latest twenty per-word answers', () => {
  let p = recordReview(undefined, 'w', 'correct', 'recall', new Date('2026-01-01'));
  for (let i = 0; i < 24; i++)
    p = recordReview(
      p,
      'w',
      i < 4 ? 'incorrect' : 'correct',
      'recognition',
      new Date('2026-01-01'),
    );
  expect(p.recent).toHaveLength(20);
  expect(recentAccuracy(p)).toEqual({ correct: 20, total: 20, percent: 100 });
  expect(recentAccuracy(undefined)).toBeNull();
  expect(recentAccuracy(withRecent([true, true, true, false]))).toEqual({
    correct: 3,
    total: 4,
    percent: 75,
  });
});

it('does not graduate with fewer than three correct in the last five', () => {
  let p = recordReview(undefined, 'w', 'correct', 'recall', new Date('2026-01-01'));
  p = recordReview(p, 'w', 'correct', 'recognition', new Date('2026-01-02'));
  for (let i = 0; i < 4; i++)
    p = recordReview(p, 'w', 'incorrect', 'recall', new Date('2026-01-02T01:00:00Z'));
  p = recordReview(p, 'w', 'correct', 'recognition', new Date('2026-01-03'));
  expect(isLearned(p)).toBe(false);
});
