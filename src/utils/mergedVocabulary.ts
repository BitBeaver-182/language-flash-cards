import { LegacyWord as Word } from './vocabulary';
import { Progress } from './recall';
import { getLegacyWordTags } from './tags';

export function findDuplicateWords(words: Word[]): Word[][] {
  const groups = new Map<string, Word[]>();
  for (const word of words) {
    const key = word.hu.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('hu');
    const group = groups.get(key) ?? [];
    group.push(word);
    groups.set(key, group);
  }
  return [...groups.values()].filter(group => group.length > 1);
}

export function mergedVocabulary(base: Word[], overrides: Record<string, Word>): Word[] {
  const ids = new Set(base.map(word => word.id));
  return [
    ...base.map(word => overrides[word.id] ?? word),
    ...Object.values(overrides).filter(word => !ids.has(word.id)),
  ].filter(word => !word.mergedInto);
}

export function consolidateDuplicates(
  base: Word[],
  overrides: Record<string, Word>,
  tags: Record<string, string[]>,
  progress: Record<string, Progress>,
) {
  const userWords = { ...overrides };
  const customTags = { ...tags };
  const updatedProgress = { ...progress };
  for (const group of findDuplicateWords(mergedVocabulary(base, overrides))) {
    const canonical = group[0];
    const unique = (values: string[]) => {
      const seen = new Set<string>();
      return values
        .map(value => value.trim())
        .filter(value => {
          const key = value.normalize('NFC').toLocaleLowerCase();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    };
    userWords[canonical.id] = {
      ...canonical,
      en: unique(group.flatMap(word => word.en.split('\n'))).join('\n'),
      es: unique(group.flatMap(word => word.es.split('\n'))).join('\n'),
      topics: unique(group.flatMap(word => word.topics)),
      sourceRows: Array.from(new Set(group.flatMap(word => word.sourceRows))),
      eligible: group.some(word => word.eligible),
    };
    customTags[canonical.id] = unique(
      group.flatMap(word => getLegacyWordTags(word, tags[word.id])),
    );
    const reviews = group
      .map(word => progress[word.id])
      .filter(Boolean)
      .sort((a, b) => (b.reviewedAt || '').localeCompare(a.reviewedAt || ''));
    if (reviews.length)
      updatedProgress[canonical.id] = {
        ...reviews[0],
        wordId: canonical.id,
        removed: group.every(word => Boolean(progress[word.id]?.removed)),
      };
    for (const word of group.slice(1)) userWords[word.id] = { ...word, mergedInto: canonical.id };
  }
  return { userWords, customTags, progress: updatedProgress };
}
