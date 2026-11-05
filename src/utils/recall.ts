export const GRADUATION_SUCCESSES = 3;
export const MIN_SUCCESS_INTERVAL_SECONDS = 24 * 60 * 60;
export const ANSWER_HISTORY_LIMIT = 20;

export interface Progress {
  wordId: string;
  strength: number;
  stabilityDays: number;
  reviewedAt: string;
  reviews: number;
  removed: boolean;
  recent: boolean[];
  graduated?: boolean;
  introducedAt?: string;
  spacedSuccesses?: { at: string; recall: boolean }[];
}

// Older data has no milestone dates. Preserve previously earned graduation.
export function isLearned(progress: Progress | undefined): boolean {
  if (!progress) return false;
  if (progress.graduated !== undefined) return progress.graduated;
  const lastTen = progress.recent.slice(-10);
  return lastTen.length >= 10 && lastTen.filter(Boolean).length >= 8;
}

export function recentAccuracy(
  progress: Progress | undefined,
): { percent: number; correct: number; total: number } | null {
  const history = progress?.recent?.slice(-ANSWER_HISTORY_LIMIT) ?? [];
  if (!history.length) return null;
  const correct = history.filter(Boolean).length;
  return { percent: Math.round((correct / history.length) * 100), correct, total: history.length };
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
  const recent = [...(progress?.recent ?? []), correct].slice(-ANSWER_HISTORY_LIMIT);
  const milestones = [...(progress?.spacedSuccesses ?? [])];
  const last = milestones.at(-1);
  if (
    correct &&
    (!last || now.getTime() - Date.parse(last.at) >= MIN_SUCCESS_INTERVAL_SECONDS * 1000)
  ) {
    milestones.push({ at: now.toISOString(), recall: mode === 'recall' });
  }
  const lastFive = recent.slice(-5);
  const graduate =
    isLearned(progress) ||
    (correct &&
      milestones.length >= GRADUATION_SUCCESSES &&
      milestones.some(m => m.recall) &&
      (lastFive.length < 5 || lastFive.filter(Boolean).length >= 3));
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
    recent,
    graduated: graduate,
    introducedAt: progress?.introducedAt ?? (first ? now.toISOString() : undefined),
    spacedSuccesses: milestones.slice(-GRADUATION_SUCCESSES),
  };
}
