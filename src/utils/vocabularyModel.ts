import { LegacyWord as Word } from './vocabulary';
import { Progress } from './recall';
import { consolidateDuplicates, mergedVocabulary } from './mergedVocabulary';
import { getLegacyWordTags } from './tags';

export function normalizeWordKey(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('hu');
}

export interface VocabularyWord {
  id: string;
  hu: string;
  en: string;
  es: string;
  tags: string[];
  eligible: boolean;
}

export function createVocabularyState(
  base: Word[],
  overrides: Record<string, Word>,
  tags: Record<string, string[]>,
  progress: Record<string, Progress>,
  createId: (legacyId: string) => string,
) {
  const merged = consolidateDuplicates(base, overrides, tags, progress);
  const records = mergedVocabulary(base, merged.userWords);
  const words: Record<string, VocabularyWord> = {};
  const idMap: Record<string, string> = {};
  const newProgress: Record<string, Progress> = {};
  for (const record of records) {
    const id = createId(record.id);
    idMap[record.id] = id;
    words[id] = {
      id,
      hu: record.hu,
      en: record.en,
      es: record.es,
      tags: getLegacyWordTags(record, merged.customTags[record.id]),
      eligible: record.eligible,
    };
    if (merged.progress[record.id]) newProgress[id] = { ...merged.progress[record.id], wordId: id };
  }
  for (const word of Object.values(merged.userWords)) {
    if (word.mergedInto && idMap[word.mergedInto]) idMap[word.id] = idMap[word.mergedInto];
  }
  return { words, progress: newProgress, idMap };
}
