import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { buildVocabulary } from '../src/utils/vocabulary';

const words = buildVocabulary(readFileSync('material/dictionarycsv.csv', 'utf8'));
mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/vocabulary.json', JSON.stringify(words));
