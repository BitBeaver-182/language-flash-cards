import { estimateRecall, isLearned, recordReview } from './recall';

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

  it('appends attempts and keeps only the last ten in order', () => {
    let progress = recordReview(undefined, 'a', 'correct', 'recall', now);
    progress = recordReview(progress, 'a', 'incorrect', 'recall', now);
    expect(progress.recent).toEqual([true, false]);

    for (let i = 0; i < 10; i++) {
      progress = recordReview(progress, 'a', i % 2 === 0 ? 'correct' : 'incorrect', 'recall', now);
    }
    expect(progress.recent).toHaveLength(10);
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
    ]);
  });

  it('graduates after ten attempts with at least eight correct', () => {
    expect(isLearned(withRecent(Array(9).fill(true)))).toBe(false);
    expect(isLearned(withRecent([...Array(8).fill(true), false, false]))).toBe(true);
    expect(isLearned(withRecent([...Array(7).fill(true), false, false, false]))).toBe(false);
    expect(isLearned(undefined)).toBe(false);
  });

  it('reopens learning after a miss drops the window below eighty percent', () => {
    const learned = withRecent([true, true, true, true, true, true, true, true, false, false]);
    expect(isLearned(learned)).toBe(true);
    expect(isLearned(recordReview(learned, 'a', 'incorrect', 'recall', now))).toBe(false);
  });
});
