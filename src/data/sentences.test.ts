import { sentences } from './sentences';
import catalog from './vocabulary.json';

it('uses known target words and gives bilingual context for every exercise', () => {
  expect(sentences.length).toBeGreaterThanOrEqual(5);
  for (const sentence of sentences) {
    expect(catalog.some(word => word.hu.toLowerCase() === sentence.target)).toBe(true);
    expect(sentence.before).toBeTruthy();
    expect(sentence.en).toBeTruthy();
    expect(sentence.es).toBeTruthy();
    expect(sentence.source).toMatch(/^material\//);
  }
});
