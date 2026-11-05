export interface Progress {
  wordId: string;
  strength: number;
  stabilityDays: number;
  reviewedAt: string;
  reviews: number;
  removed: boolean;
  recent: boolean[];
}

export function isLearned(progress: Progress | undefined): boolean {
  if (!progress || progress.recent.length < 10) return false;
  return progress.recent.filter(Boolean).length >= 8;
}

export function estimateRecall(progress: Progress | undefined, now: Date): number | null {
  if (!progress || progress.reviews === 0) return null;
  const elapsedDays = Math.max(0, (now.getTime() - Date.parse(progress.reviewedAt)) / 86400000);
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(100 * progress.strength * 2 ** (-elapsedDays / progress.stabilityDays)),
    ),
  );
}

export function recordReview(
  progress: Progress | undefined,
  wordId: string,
  result: 'correct' | 'incorrect',
  mode: 'recall' | 'recognition',
  now: Date,
): Progress {
  const estimate = estimateRecall(progress, now);
  const first = estimate === null;
  const p = (estimate ?? 0) / 100;
  const correct = result === 'correct';
  return {
    wordId,
    strength: first
      ? correct
        ? 0.6
        : 0.2
      : correct
        ? Math.min(0.95, p + (mode === 'recall' ? 0.25 : 0.12))
        : Math.max(0.1, p * 0.5),
    stabilityDays: first
      ? correct
        ? 1
        : 0.5
      : correct
        ? Math.min(90, progress!.stabilityDays * (mode === 'recall' ? 2 : 1.25))
        : Math.max(0.5, progress!.stabilityDays * 0.5),
    reviewedAt: now.toISOString(),
    reviews: (progress?.reviews ?? 0) + 1,
    removed: progress?.removed ?? false,
    recent: [...(progress?.recent ?? []), correct].slice(-10),
  };
}
