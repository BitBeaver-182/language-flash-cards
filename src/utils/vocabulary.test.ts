import { buildVocabulary } from './vocabulary';

it('preserves quoted commas, accents, distinct senses and stable identifiers', () => {
  const csv =
    'Spanish (Latin America),English,Hungarian Word/Phrase,Grammar/Topic Area,Source\nreloj,"watch, hour, clock",óra,Objects,1\nqué,what,mi,Question,1\nnosotros,we,mi,Pronoun,1\nreloj,"watch, hour, clock",óra,Objects,2';
  const words = buildVocabulary(csv);
  expect(words).toHaveLength(3);
  expect(words[0].en).toBe('watch, hour, clock');
  expect(words[0].hu).toBe('óra');
  expect(words[0].sourceRows).toEqual([2, 5]);
  expect(words[1].id).not.toBe(words[2].id);
  expect(buildVocabulary(csv)).toEqual(words);
});

it('excludes known transcription errors from practice without losing the source entry', () => {
  const csv =
    'Spanish,English,Hungarian,Topic,Source\ntaza,cup,csészé,Objects,3\nBélgica,Belgium,Belgium,Countries,1';
  expect(buildVocabulary(csv).map(word => word.eligible)).toEqual([false, false]);
});

it('does not treat complete sentences as vocabulary flashcards', () => {
  const csv =
    'Spanish,English,Hungarian,Topic,Source\nhola,hello,Jó napot kívánok!,Phrase,1\noración,sentence,A barátok között erős bizalom van.,Sentences,2';
  const words = buildVocabulary(csv);
  expect(words[0].eligible).toBe(true);
  expect(words[1].eligible).toBe(false);
});
