import { estimateRecall, isLearned, Progress } from './recall';
import { Word } from './vocabulary';

export const MAX_ACTIVE_WORDS = 36;
export const MAX_NEW_PER_SESSION = 3;
const SESSION_SIZE = 10;

const formOf = (word: Word) => word.hu.trim().normalize('NFC').toLocaleLowerCase();

function groupWords(words: Word[], progress: Record<string, Progress>, topic?: string) {
  const groups = new Map<string, Word[]>();
  for (const word of words) {
    if (!word.eligible || progress[word.id]?.removed || (topic && !word.tags.includes(topic)))
      continue;
    const key = formOf(word);
    groups.set(key, [...(groups.get(key) ?? []), word]);
  }
  return groups;
}

function isActive(progress: Progress | undefined): boolean {
  return Boolean(progress && progress.reviews > 0 && !isLearned(progress));
}

export function countActiveWords(words: Word[], progress: Record<string, Progress>): number {
  let count = 0;
  for (const group of groupWords(words, progress).values()) {
    if (group.some(word => isActive(progress[word.id]))) count++;
  }
  return count;
}

export function sessionNewLimit(words: Word[], progress: Record<string, Progress>): number {
  const practicedForms = new Set(
    words.filter(word => (progress[word.id]?.reviews ?? 0) > 0).map(formOf),
  );
  const initialRemaining = Math.max(0, SESSION_SIZE - practicedForms.size);
  return initialRemaining > 0 ? initialRemaining : MAX_NEW_PER_SESSION;
}

interface SelectionOptions {
  excludedForms?: Set<string>;
  maxNew?: number;
  reservedActiveSlots?: number;
  rng?: () => number;
}

export function selectWords(
  words: Word[],
  progress: Record<string, Progress>,
  now: Date,
  topic?: string,
  options: SelectionOptions = {},
): Word[] {
  // Group related dictionary entries so another translation of a reviewed
  // Hungarian word cannot consume a new-word slot.
  const groups = groupWords(words, progress, topic);
  const rng = options.rng ?? Math.random;

  const fresh: { word: Word; random: number }[] = [];
  const reviews: { word: Word; priority: number }[] = [];
  for (const group of groups.values()) {
    if (options.excludedForms?.has(formOf(group[0]))) continue;
    const reviewed = group
      .map(word => ({ word, recall: estimateRecall(progress[word.id], now) }))
      .filter((entry): entry is { word: Word; recall: number } => entry.recall !== null)
      .sort((a, b) => a.recall - b.recall);
    if (reviewed.length) {
      const { word, recall } = reviewed[0];
      const elapsed = now.getTime() - Date.parse(progress[word.id].reviewedAt);
      const history = progress[word.id].recent.slice(-10);
      // An empty migrated history is unknown, not ten wrong answers.
      const accuracy = history.length ? history.filter(Boolean).length / history.length : 0.5;
      // Every reviewed word retains a nonzero chance. Poor recent results have
      // up to 10x the weight of a perfect record; fading recall and very recent
      // practice continue to influence the draw without making it deterministic.
      const historyWeight = 1 + 9 * (1 - accuracy);
      const recallWeight = 1 + (100 - recall) / 100;
      const recencyWeight = elapsed < 6 * 3600000 ? 0.25 : 1;
      const weight = historyWeight * recallWeight * recencyWeight;
      const sample = Math.max(Number.EPSILON, Math.min(1 - Number.EPSILON, rng()));
      reviews.push({ word, priority: -Math.log(sample) / weight });
    } else {
      fresh.push({ word: group[0], random: rng() });
    }
  }

  if (groups.size > SESSION_SIZE) fresh.sort((a, b) => a.random - b.random);
  reviews.sort((a, b) => a.priority - b.priority);

  const activeCount = countActiveWords(words, progress);
  const newCount = Math.min(
    fresh.length,
    options.maxNew ?? sessionNewLimit(words, progress),
    Math.max(0, MAX_ACTIVE_WORDS - activeCount - (options.reservedActiveSlots ?? 0)),
  );
  const reviewCount = Math.min(reviews.length, SESSION_SIZE - newCount);
  const size = newCount + reviewCount;
  const selected: Word[] = [];
  let newIndex = 0;
  let reviewIndex = 0;
  for (let i = 0; i < size; i++) {
    if (
      reviewIndex < reviewCount &&
      (newIndex === newCount || (i * reviewCount) % size < reviewCount)
    ) {
      selected.push(reviews[reviewIndex++].word);
    } else {
      selected.push(fresh[newIndex++].word);
    }
  }
  return selected;
}

/** Select one replacement without repeating a queued form or exceeding the
 * session's original new-word allowance and the global active-word limit. */
export function selectReplacement(
  words: Word[],
  progress: Record<string, Progress>,
  sessionStartProgress: Record<string, Progress>,
  queue: Word[],
  removed: Word,
  now: Date,
  topic?: string,
): Word | undefined {
  const removedForm = formOf(removed);
  const excludedForms = new Set([...queue.map(formOf), removedForm]);
  const initiallyReviewed = new Set(
    words.filter(word => (sessionStartProgress[word.id]?.reviews ?? 0) > 0).map(formOf),
  );
  const currentlyReviewed = new Set(
    words.filter(word => (progress[word.id]?.reviews ?? 0) > 0).map(formOf),
  );
  const queuedNew = new Set(queue.map(formOf).filter(form => !initiallyReviewed.has(form)));
  const pendingNew = [...queuedNew].filter(form => !currentlyReviewed.has(form)).length;
  const newBudget = Math.max(0, sessionNewLimit(words, sessionStartProgress) - queuedNew.size);
  // Removal is dispatched separately; reflect all same-form variants here before
  // evaluating eligibility and active capacity, without mutating the store.
  const afterRemoval = { ...progress };
  for (const word of words) {
    if (formOf(word) === removedForm && afterRemoval[word.id]) {
      afterRemoval[word.id] = { ...afterRemoval[word.id], removed: true };
    }
  }
  return selectWords(words, afterRemoval, now, topic, {
    excludedForms,
    maxNew: newBudget,
    reservedActiveSlots: pendingNew,
  })[0];
}
