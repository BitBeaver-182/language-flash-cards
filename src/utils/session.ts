import { estimateRecall, isLearned, Progress } from './recall';
import { Word } from './vocabulary';

export const MAX_ACTIVE_WORDS = 36;
export const MAX_NEW_PER_SESSION = 3;
const SESSION_SIZE = 10;

function groupWords(words: Word[], progress: Record<string, Progress>, topic?: string) {
  const groups = new Map<string, Word[]>();
  for (const word of words) {
    if (!word.eligible || progress[word.id]?.removed || (topic && !word.tags.includes(topic)))
      continue;
    const key = word.hu.normalize('NFC').toLocaleLowerCase();
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

export function selectWords(
  words: Word[],
  progress: Record<string, Progress>,
  now: Date,
  topic?: string,
): Word[] {
  // Group related dictionary entries so another translation of a reviewed
  // Hungarian word cannot consume a new-word slot.
  const groups = groupWords(words, progress, topic);

  const fresh: { word: Word; random: number }[] = [];
  const reviews: { word: Word; recall: number; recent: boolean; random: number }[] = [];
  for (const group of groups.values()) {
    const reviewed = group
      .map(word => ({ word, recall: estimateRecall(progress[word.id], now) }))
      .filter((entry): entry is { word: Word; recall: number } => entry.recall !== null)
      .sort((a, b) => a.recall - b.recall);
    if (reviewed.length) {
      const { word, recall } = reviewed[0];
      const elapsed = now.getTime() - Date.parse(progress[word.id].reviewedAt);
      reviews.push({ word, recall, recent: elapsed < 6 * 3600000, random: Math.random() });
    } else {
      fresh.push({ word: group[0], random: Math.random() });
    }
  }

  if (groups.size > SESSION_SIZE) fresh.sort((a, b) => a.random - b.random);
  reviews.sort(
    (a, b) => Number(a.recent) - Number(b.recent) || a.recall - b.recall || a.random - b.random,
  );

  const activeCount = countActiveWords(words, progress);
  const newCount = Math.min(
    fresh.length,
    MAX_NEW_PER_SESSION,
    Math.max(0, MAX_ACTIVE_WORDS - activeCount),
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
