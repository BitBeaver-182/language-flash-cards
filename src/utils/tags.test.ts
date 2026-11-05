import { getLegacyWordTags } from './tags';

it('creates searchable tags from source labels and distinguishes phrases', () => {
  const word = {
    id: '1',
    hu: 'egy kicsit',
    en: 'a little',
    es: 'un poco',
    topics: ['Vocabulary / Adverbs'],
    sourceRows: [1],
    eligible: true,
  };
  expect(getLegacyWordTags(word)).toEqual(['Adverbs', 'Phrase']);
  expect(getLegacyWordTags(word, ['My tag'])).toEqual(['My tag']);
});
