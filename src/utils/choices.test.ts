import { makeChoices } from './choices';
import { Word } from './vocabulary';

const word = (id: string, en: string): Word => ({
  id,
  hu: id,
  en,
  es: en,
  topics: [],
  sourceRows: [],
  eligible: true,
});

it('offers one correct meaning and never uses another valid meaning as a distractor', () => {
  const target = word('one', 'castle\nwait');
  expect(
    makeChoices(
      target,
      [target, word('other', 'wait'), word('two', 'house'), word('three', 'tree')],
      'en',
    ),
  ).toEqual(['castle', 'house', 'tree']);
});

it('requires distinct safe answers and includes the target', () => {
  const target = word('one', 'one');
  expect(makeChoices(target, [target, word('two', 'two')], 'en')).toEqual([]);
  expect(makeChoices(target, [target, word('two', 'two'), word('three', 'three')], 'en')).toEqual([
    'one',
    'two',
    'three',
  ]);
});
