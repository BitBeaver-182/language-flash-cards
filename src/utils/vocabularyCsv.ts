import { Progress } from './recall';
import { getWordTags } from './tags';
import { parseCsv, Word } from './vocabulary';

export interface CsvWord {
  id: string;
  hu: string;
  en: string;
  es: string;
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

export function exportVocabularyCsv(
  words: Word[],
  tags: Record<string, string[]>,
  progress: Record<string, Progress>,
): string {
  const rows = words.map(word =>
    [
      word.id,
      word.hu,
      word.en,
      word.es,
      encodeTags(getWordTags(word, tags[word.id])),
      String(Boolean(progress[word.id]?.removed)),
    ]
      .map(quote)
      .join(','),
  );
  return '\ufeffid,hungarian,english,spanish,tags,removed\r\n' + rows.join('\r\n') + '\r\n';
}

export function importVocabularyCsv(csv: string): CsvWord[] {
  const contents = csv.replace(/^\ufeff/, '');
  const header = contents.split(/\r?\n/, 1)[0];
  const rows = parseCsv(contents, header.includes(';') && !header.includes(',') ? ';' : ',');
  if (rows.shift()?.join(',').toLowerCase() !== 'id,hungarian,english,spanish,tags,removed')
    throw new Error('Invalid CSV header');
  const seen = new Set<string>();
  return rows
    .filter(row => row.some(value => value.trim()))
    .map((row, index) => {
      if (row.length !== 6) throw new Error(`Invalid row ${index + 2}`);
      const [id, hu, en, es, tags, removed] = row.map(value => value.trim());
      if (!hu || !en || !es || !['', 'true', 'false'].includes(removed.toLowerCase()))
        throw new Error(`Invalid row ${index + 2}`);
      if (id && seen.has(id)) throw new Error(`Duplicate ID in row ${index + 2}`);
      if (id) seen.add(id);
      return { id, hu, en, es, tags: decodeTags(tags), removed: removed.toLowerCase() === 'true' };
    });
}
