import { Progress } from './recall';
import { getWordTags } from './tags';
import { parseCsv, Word } from './vocabulary';

export interface CsvWord {
  id: string;
  hu: string;
  en: string;
  es: string;
  translations?: Record<string, string>;
  tags: string[];
  removed: boolean;
}

function quote(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function encodeTags(tags: string[]): string {
  return tags.map(tag => tag.replace(/\\/g, '\\\\').replace(/\|/g, '\\|')).join('|');
}

function decodeTags(value: string): string[] {
  const tags: string[] = [];
  let current = '';
  for (let i = 0; i < value.length; i++) {
    if (
      value[i] === '\\' &&
      i + 1 < value.length &&
      (value[i + 1] === '\\' || value[i + 1] === '|')
    )
      current += value[++i];
    else if (value[i] === '|') {
      if (current.trim()) tags.push(current.trim());
      current = '';
    } else current += value[i];
  }
  if (current.trim()) tags.push(current.trim());
  return tags;
}

const KNOWN_LANG_HEADER_TO_CODE: Record<string, string> = {
  english: 'en',
  en: 'en',
  spanish: 'es',
  es: 'es',
  slovak: 'sk',
  sk: 'sk',
  slovencina: 'sk',
  german: 'de',
  de: 'de',
  deutsch: 'de',
  french: 'fr',
  fr: 'fr',
};

const KNOWN_CODE_TO_HEADER: Record<string, string> = {
  en: 'english',
  es: 'spanish',
  sk: 'slovak',
  de: 'german',
  fr: 'french',
};

export function exportVocabularyCsv(words: Word[], progress: Record<string, Progress>): string {
  const extraLangCodes = new Set<string>();
  for (const word of words) {
    if (word.translations) {
      for (const code of Object.keys(word.translations)) {
        if (code !== 'en' && code !== 'es') {
          extraLangCodes.add(code.toLowerCase());
        }
      }
    }
  }

  const extraLangs = Array.from(extraLangCodes);
  const extraHeaders = extraLangs.map(code => KNOWN_CODE_TO_HEADER[code] || code);
  const allHeaders = ['id', 'hungarian', 'english', 'spanish', ...extraHeaders, 'tags', 'removed'];

  const rows = words.map(word => {
    const values = [
      word.id,
      word.hu,
      word.en ?? '',
      word.es ?? '',
      ...extraLangs.map(code => word.translations?.[code] ?? ''),
      encodeTags(getWordTags(word)),
      String(Boolean(progress[word.id]?.removed)),
    ];
    return values.map(quote).join(',');
  });

  return '\ufeff' + allHeaders.join(',') + '\r\n' + rows.join('\r\n') + '\r\n';
}

export function importVocabularyCsv(csv: string): CsvWord[] {
  const contents = csv.replace(/^\ufeff/, '');
  const headerLine = contents.split(/\r?\n/, 1)[0];
  const delimiter = headerLine.includes(';') && !headerLine.includes(',') ? ';' : ',';
  const rows = parseCsv(contents, delimiter);
  if (!rows.length) throw new Error('Empty CSV');

  const rawHeaders = rows.shift() ?? [];
  const headers = rawHeaders.map(h => h.trim().toLowerCase());

  const idIdx = headers.indexOf('id');
  const huIdx = headers.indexOf('hungarian');
  const tagsIdx = headers.indexOf('tags');
  const removedIdx = headers.indexOf('removed');

  if (idIdx === -1 || huIdx === -1 || tagsIdx === -1 || removedIdx === -1) {
    throw new Error('Invalid CSV header');
  }

  const langCols: { code: string; index: number }[] = [];
  headers.forEach((h, index) => {
    if (index !== idIdx && index !== huIdx && index !== tagsIdx && index !== removedIdx) {
      const code = KNOWN_LANG_HEADER_TO_CODE[h] || h;
      langCols.push({ code, index });
    }
  });

  const seen = new Set<string>();
  return rows
    .filter(row => row.some(value => value.trim()))
    .map((row, index) => {
      if (row.length !== headers.length) throw new Error(`Invalid row ${index + 2}`);
      const id = row[idIdx].trim();
      const hu = row[huIdx].trim();
      const tags = row[tagsIdx].trim();
      const removed = row[removedIdx].trim();

      if (!hu || !['', 'true', 'false'].includes(removed.toLowerCase())) {
        throw new Error(`Invalid row ${index + 2}`);
      }

      const translations: Record<string, string> = {};
      for (const { code, index: colIdx } of langCols) {
        const val = row[colIdx].trim();
        if (val) {
          translations[code] = val;
        }
      }

      const en = translations['en'] ?? '';
      const es = translations['es'] ?? '';

      if (!en && !es && Object.keys(translations).length === 0) {
        throw new Error(`Invalid row ${index + 2}`);
      }

      if (id && seen.has(id)) throw new Error(`Duplicate ID in row ${index + 2}`);
      if (id) seen.add(id);

      const result: CsvWord = {
        id,
        hu,
        en,
        es,
        tags: decodeTags(tags),
        removed: removed.toLowerCase() === 'true',
      };

      if (Object.keys(translations).some(k => k !== 'en' && k !== 'es')) {
        result.translations = translations;
      }

      return result;
    });
}
