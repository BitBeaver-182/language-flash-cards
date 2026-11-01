import { Word } from './vocabulary';

export function getWordTags(word: Word, custom?: string[]): string[] {
  if (custom) return custom;
  const tags = word.topics
    .flatMap(topic => topic.split(/\s*\/\s*|\s*,\s*/))
    .map(tag => tag.trim())
    .filter(tag => tag && tag.toLowerCase() !== 'vocabulary');
  const type =
    /[.!?]/.test(word.hu) && word.hu.split(/\s+/).length > 3
      ? 'Sentence'
      : word.hu.trim().includes(' ')
        ? 'Phrase'
        : 'Word';
  return Array.from(new Set([...tags, type]));
}
