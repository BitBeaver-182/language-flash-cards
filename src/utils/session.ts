import { estimateRecall, Progress } from './recall';
import { Word } from './vocabulary';

export function selectWords(
  words: Word[],
  progress: Record<string, Progress>,
  now: Date,
  topic?: string,
): Word[] {
  // Group related dictionary entries so another translation of a reviewed
  // Hungarian word cannot consume a new-word slot.
  const groups = new Map<string, Word[]>();
  for (const word of words) {
    if (!word.eligible || progress[word.id]?.removed || (topic && !word.tags.includes(topic)))
      continue;
    const key = word.hu.normalize('NFC').toLocaleLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), word]);
  }

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

  if (groups.size > 10) fresh.sort((a, b) => a.random - b.random);
  reviews.sort(
    (a, b) => Number(a.recent) - Number(b.recent) || a.recall - b.recall || a.random - b.random,
  );

  const size = Math.min(10, fresh.length + reviews.length);
  const reviewCount = Math.min(
    reviews.length,
    Math.max(size - Math.ceil(size * 0.7), size - fresh.length),
  );
  const newCount = Math.min(fresh.length, size - reviewCount);
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
