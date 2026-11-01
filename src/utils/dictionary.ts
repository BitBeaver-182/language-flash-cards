import { estimateRecall, Progress } from './recall';
import { getWordTags } from './tags';
import { Word } from './vocabulary';

const collator = new Intl.Collator('hu');
const cache = new WeakMap<
  Word,
  { hu: string; en: string; es: string; tags: string; tokens: { en: string[]; es: string[] } }
>();
const tagCache = new WeakMap<string[], { text: string; tokens: string[] }>();
const tokenSeparator = /[^\p{L}\p{N}]+/u;

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0,
    j = 0,
    edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + Number(i < a.length || j < b.length) <= 1;
}

function searchable(word: Word) {
  let entry = cache.get(word);
  if (!entry) {
    const hu = normalize(word.hu),
      en = normalize(word.en),
      es = normalize(word.es),
      tags = normalize(getWordTags(word).join(' '));
    entry = {
      hu,
      en,
      es,
      tags,
      tokens: {
        en: `${hu} ${en} ${tags}`.split(tokenSeparator),
        es: `${hu} ${es} ${tags}`.split(tokenSeparator),
      },
    };
    cache.set(word, entry);
  }
  return entry;
}

function customTagIndex(tags: string[]) {
  let entry = tagCache.get(tags);
  if (!entry) {
    const text = normalize(tags.join(' '));
    entry = { text, tokens: text.split(tokenSeparator) };
    tagCache.set(tags, entry);
  }
  return entry;
}

export function prepareDictionary(
  words: Word[],
  progress: Record<string, Progress>,
  customTags: Record<string, string[]>,
  query: string,
  removed: boolean,
  sortBy: 'alphabet' | 'knowledge',
  ascending: boolean,
  now: Date,
  language: 'en' | 'es' = 'en',
): Word[] {
  const normalizedQuery = normalize(query.trim());
  const rows = words
    .filter(
      word =>
        Boolean(progress[word.id]?.removed) === removed &&
        (!normalizedQuery ||
          (() => {
            const entry = searchable(word);
            const custom = customTags[word.id] ? customTagIndex(customTags[word.id]) : null;
            const text = `${entry.hu} ${entry[language]} ${custom ? custom.text : entry.tags}`;
            if (text.includes(normalizedQuery)) return true;
            const queryTokens = normalizedQuery.split(/\s+/);
            const tokens = custom
              ? [
                  ...entry.hu.split(tokenSeparator),
                  ...entry[language].split(tokenSeparator),
                  ...custom.tokens,
                ]
              : entry.tokens[language];
            return queryTokens.every(term =>
              tokens.some(
                token => token.includes(term) || (term.length >= 4 && withinOneEdit(term, token)),
              ),
            );
          })()),
    )
    .map(word => ({
      word,
      score: sortBy === 'knowledge' ? estimateRecall(progress[word.id], now) : null,
      rank:
        !normalizedQuery || searchable(word).hu === normalizedQuery
          ? 0
          : searchable(word).hu.includes(normalizedQuery)
            ? 1
            : `${searchable(word)[language]} ${customTags[word.id] ? customTagIndex(customTags[word.id]).text : searchable(word).tags}`.includes(
                  normalizedQuery,
                )
              ? 2
              : 3,
    }));
  rows.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (sortBy === 'knowledge') {
      if (a.score === null && b.score !== null) return 1;
      if (a.score !== null && b.score === null) return -1;
      const difference = (a.score ?? 0) - (b.score ?? 0);
      if (difference) return ascending ? difference : -difference;
    }
    const alphabet = collator.compare(a.word.hu, b.word.hu);
    return sortBy === 'alphabet' && !ascending ? -alphabet : alphabet;
  });
  return rows.map(row => row.word);
}
