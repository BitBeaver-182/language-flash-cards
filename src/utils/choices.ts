import { Word, getWordMeaning } from './vocabulary';
import { Progress } from './recall';

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
  'pronunciation',
  'other',
]);

// Some source records carry lesson-wide tags but omit their actual category.
// These nationality words are present in the supplied vocabulary; derive the
// category without changing the learner's stored or custom tags.
const NATIONALITIES = new Set([
  'amerikai',
  'angol',
  'argentin',
  'belga',
  'cseh',
  'dán',
  'finn',
  'francia',
  'görög',
  'holland',
  'horvát',
  'japán',
  'kanadai',
  'kínai',
  'lengyel',
  'magyar',
  'német',
  'olasz',
  'orosz',
  'osztrák',
  'portugál',
  'spanyol',
  'svéd',
  'szerb',
  'szlovák',
  'török',
]);

function specificTags(word: Word): Set<string> {
  const tags = new Set(
    (word.tags || [])
      .map(tag => tag.trim().normalize('NFC').toLocaleLowerCase())
      .filter(tag => tag && !GENERIC_TAGS.has(tag)),
  );
  if (NATIONALITIES.has(word.hu.trim().normalize('NFC').toLocaleLowerCase())) {
    tags.add('nationalities');
  }
  return tags;
}

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
  progress?: Record<string, Progress>;
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

  const targetTags = specificTags(target);
  const tagFrequency = new Map<string, number>();
  for (const word of words) {
    if (!word.eligible || options.progress?.[word.id]?.removed) continue;
    for (const tag of specificTags(word)) {
      tagFrequency.set(tag, (tagFrequency.get(tag) ?? 0) + 1);
    }
  }

  const validTargetMeanings = new Set(meanings.map(meaning => meaning.toLocaleLowerCase()));
  interface Candidate {
    option: string;
    // The rarest shared tag represents the most specific matching category.
    categorySize: number;
    practiced: boolean;
  }

  const relatedPool: Candidate[] = [];
  const generalPool: Candidate[] = [];

  for (const word of words) {
    if (
      !word.eligible ||
      options.progress?.[word.id]?.removed ||
      word.hu.trim().normalize('NFC').toLocaleLowerCase() ===
        target.hu.trim().normalize('NFC').toLocaleLowerCase()
    )
      continue;
    const wordMeanings = getWordMeaning(word, language)
      .split('\n')
      .map(meaning => meaning.trim())
      .filter(Boolean);
    const raw = wordMeanings[0];
    if (!raw || /[/;,]/.test(raw)) continue;
    if (wordMeanings.some(meaning => validTargetMeanings.has(meaning.toLocaleLowerCase())))
      continue;

    const shared = [...specificTags(word)].filter(tag => targetTags.has(tag));
    const candidate = {
      option: capitalizeOption(raw),
      categorySize: shared.includes('nationalities')
        ? -1
        : shared.length
          ? Math.min(...shared.map(tag => tagFrequency.get(tag) ?? words.length))
          : Infinity,
      practiced: (options.progress?.[word.id]?.reviews ?? 0) > 0,
    };
    (shared.length ? relatedPool : generalPool).push(candidate);
  }

  // Shuffle before stable sorting, so alternatives of equal relevance vary.
  const shuffledRelated = shouldShuffle ? shuffleArray(relatedPool, rng) : relatedPool;
  shuffledRelated.sort((a, b) => a.categorySize - b.categorySize);
  const shuffledGeneral = shouldShuffle ? shuffleArray(generalPool, rng) : generalPool;
  // Category always wins; familiarity matters when we have to fall back.
  shuffledGeneral.sort((a, b) => Number(b.practiced) - Number(a.practiced));

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
