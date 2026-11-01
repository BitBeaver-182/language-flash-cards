import { estimateRecall, recordReview } from './recall';

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
});
