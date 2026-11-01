import { Word } from './vocabulary';

export function makeChoices(target: Word, words: Word[], language: 'en' | 'es'): string[] {
  const meanings = target[language]
    .split('\n')
    .map(value => value.trim())
    .filter(Boolean);
  const choices = [meanings[0]];
  if (/[/;,]/.test(choices[0])) return [];
  for (const word of words) {
    const value = word[language].split('\n')[0];
    if (!word.eligible || word.hu.toLowerCase() === target.hu.toLowerCase() || /[/;,]/.test(value))
      continue;
    if (
      !meanings.some(meaning => meaning.toLowerCase() === value.toLowerCase()) &&
      !choices.some(choice => choice.toLowerCase() === value.toLowerCase())
    )
      choices.push(value);
    if (choices.length === 3) return choices;
  }
  return [];
}
