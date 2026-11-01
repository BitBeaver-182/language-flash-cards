export interface SentenceExercise {
  target: string;
  before: string;
  after: string;
  en: string;
  es: string;
  source: string;
}

// Examples are drawn from the supplied grammar reference and lesson notes.
export const sentences: SentenceExercise[] = [
  {
    target: 'fekete',
    before: 'A macska ',
    after: '.',
    en: 'The cat is black.',
    es: 'El gato es negro.',
    source: 'material/02-Grammar.md#g03',
  },
  {
    target: 'barátságos',
    before: 'A nagymama kutyája nagyon ',
    after: '.',
    en: "Grandma's dog is very friendly.",
    es: 'El perro de la abuela es muy amigable.',
    source: 'material/14-2025-05.md:993',
  },
  {
    target: 'unalmas',
    before: 'A könyved ',
    after: '.',
    en: 'Your book is boring.',
    es: 'Tu libro es aburrido.',
    source: 'material/14-2025-05.md:759',
  },
  {
    target: 'kedves',
    before: 'Gábor nagyon ',
    after: '.',
    en: 'Gábor is very kind.',
    es: 'Gábor es muy amable.',
    source: 'material/21-2025-12.md:915',
  },
  {
    target: 'érdekes',
    before: 'A könyvünk nem unalmas, hanem ',
    after: '.',
    en: 'Our book is not boring, but interesting.',
    es: 'Nuestro libro no es aburrido, sino interesante.',
    source: 'material/21-2025-12.md:79',
  },
];
