import { Word, getWordMeaning } from './vocabulary';

const GENERIC_TAGS = new Set([
  'word',
  'phrase',
  'sentences',
  'sentence',
  'not in source',
  'general',
  'general vocabulary',
  'vocabulary encounters',
  'earliest vocabulary encounters',
  'vocabulary examples',
  'practice sentence',
  'reading text',
  'other',
]);

export function capitalizeOption(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function shuffleArray<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

export interface MakeChoicesOptions {
  rng?: () => number;
  shuffle?: boolean;
}

export function makeChoices(
  target: Word,
  words: Word[],
  language: string,
  options: MakeChoicesOptions = {},
): string[] {
  const rng = options.rng ?? Math.random;
  const shouldShuffle = options.shuffle !== false;

  const meanings = getWordMeaning(target, language)
    .split('\n')
    .map(value => value.trim())
    .filter(Boolean);
  if (meanings.length === 0) return [];

  const targetAnswer = capitalizeOption(meanings[0]);
  if (!targetAnswer || /[/;,]/.test(targetAnswer)) return [];

  const targetSpecificTags = (target.tags || [])
    .map(tag => tag.trim())
    .filter(tag => tag && !GENERIC_TAGS.has(tag.toLowerCase()));

  const seenLower = new Set<string>([targetAnswer.toLowerCase()]);
  for (const meaning of meanings) {
    seenLower.add(meaning.toLowerCase());
  }

  interface Candidate {
    option: string;
    sharedCount: number;
  }

  const relatedPool: Candidate[] = [];
  const generalPool: Candidate[] = [];

  for (const word of words) {
    if (!word.eligible || word.hu.toLowerCase() === target.hu.toLowerCase()) continue;
    const raw = getWordMeaning(word, language).split('\n')[0].trim();
    if (!raw || /[/;,]/.test(raw)) continue;

    const option = capitalizeOption(raw);
    const lower = option.toLowerCase();
    if (seenLower.has(lower)) continue;

    const wordSpecificTags = (word.tags || [])
      .map(tag => tag.trim())
      .filter(tag => tag && !GENERIC_TAGS.has(tag.toLowerCase()));

    let sharedCount = 0;
    if (targetSpecificTags.length > 0) {
      for (const tag of wordSpecificTags) {
        if (targetSpecificTags.some(targetTag => targetTag.toLowerCase() === tag.toLowerCase())) {
          sharedCount++;
        }
      }
    }

    if (sharedCount > 0) {
      relatedPool.push({ option, sharedCount });
    } else {
      generalPool.push({ option, sharedCount: 0 });
    }
  }

  const shuffledRelated = shouldShuffle ? shuffleArray(relatedPool, rng) : relatedPool;
  shuffledRelated.sort((a, b) => b.sharedCount - a.sharedCount);

  const shuffledGeneral = shouldShuffle ? shuffleArray(generalPool, rng) : generalPool;

  const pickedDistractors: string[] = [];
  const pickedOptions = new Set<string>([targetAnswer.toLowerCase()]);

  for (const item of shuffledRelated) {
    const lower = item.option.toLowerCase();
    if (!pickedOptions.has(lower)) {
      pickedOptions.add(lower);
      pickedDistractors.push(item.option);
      if (pickedDistractors.length === 2) break;
    }
  }

  if (pickedDistractors.length < 2) {
    for (const item of shuffledGeneral) {
      const lower = item.option.toLowerCase();
      if (!pickedOptions.has(lower)) {
        pickedOptions.add(lower);
        pickedDistractors.push(item.option);
        if (pickedDistractors.length === 2) break;
      }
    }
  }

  if (pickedDistractors.length < 2) return [];

  const choices = [targetAnswer, ...pickedDistractors];
  return shouldShuffle ? shuffleArray(choices, rng) : choices;
}
