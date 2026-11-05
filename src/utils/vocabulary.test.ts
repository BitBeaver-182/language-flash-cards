import { buildVocabulary, getWordMeaning } from './vocabulary';

it('resolves the selected language and falls back without returning blanks', () => {
  const word = {
    id: 'w',
    hu: 'répa',
    en: 'carrot',
    es: 'zanahoria',
    translations: { sk: 'mrkva' },
    tags: [],
    eligible: true,
  };
  expect(getWordMeaning(word, 'sk')).toBe('mrkva');
  expect(getWordMeaning(word, 'en')).toBe('carrot');
  expect(getWordMeaning(word, 'es')).toBe('zanahoria');
  expect(getWordMeaning(word, 'de')).toBe('carrot');
  expect(
    getWordMeaning(
      { id: 'z', hu: 'répa', translations: { sk: 'mrkva' }, tags: [], eligible: true },
      'de',
    ),
  ).toBe('mrkva');
  expect(getWordMeaning({ id: 'x', hu: 'ház', en: 'house', tags: [], eligible: true }, 'fr')).toBe(
    'house',
  );
  expect(
    getWordMeaning(
      { id: 'y', hu: 'kutya', es: 'perro', translations: { sk: 'pes' }, tags: [], eligible: true },
      'en',
    ),
  ).toBe('perro');
});

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
