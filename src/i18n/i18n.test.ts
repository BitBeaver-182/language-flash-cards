import en from '@/locales/en.json';
import es from '@/locales/es.json';
import sk from '@/locales/sk.json';
import { SUPPORTED_LANGUAGES } from '@/i18n';

const bundles: Record<string, Record<string, unknown>> = { en, es, sk };

function flattenEntries(value: Record<string, unknown>, prefix = ''): [string, unknown][] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object') {
      return flattenEntries(child as Record<string, unknown>, path);
    }
    return [[path, child] as [string, unknown]];
  });
}

function flatten(value: Record<string, unknown>): string[] {
  return flattenEntries(value).map(([key]) => key);
}

it('ships every supported language as a complete translation bundle', () => {
  const expected = flatten(en).sort();
  for (const language of SUPPORTED_LANGUAGES) {
    const bundle = bundles[language.code];
    expect(bundle).toBeDefined();
    expect(flatten(bundle).sort()).toEqual(expected);
  }
});

it('keeps every translation string non-empty', () => {
  for (const language of SUPPORTED_LANGUAGES) {
    for (const [, value] of flattenEntries(bundles[language.code])) {
      expect(typeof value).toBe('string');
      expect((value as string).trim()).not.toBe('');
    }
  }
});
