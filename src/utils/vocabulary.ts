export interface Word {
  id: string;
  hu: string;
  en: string;
  es: string;
  tags: string[];
  eligible: boolean;
}

export interface LegacyWord {
  id: string;
  hu: string;
  en: string;
  es: string;
  topics: string[];
  sourceRows: number[];
  eligible: boolean;
  mergedInto?: string;
}

// These entries are visibly inconsistent with the supplied dictionary.
const knownErrors = new Set(['csészé', 'belgium', 'inteligens', 'énekél', 'éredes']);

export function parseCsv(csv: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (char === '"') {
      if (quoted && csv[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && csv[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function buildVocabulary(csv: string): LegacyWord[] {
  const words = new Map<string, LegacyWord>();
  parseCsv(csv)
    .slice(1)
    .forEach((row, index) => {
      const [es, en, hu, topic] = row.map(value => value.trim());
      if (!es || !en || !hu) return;
      const id = [hu, en, es].map(value => value.normalize('NFC').toLocaleLowerCase()).join('|');
      const existing = words.get(id);
      if (existing) {
        existing.sourceRows.push(index + 2);
        if (topic && !existing.topics.includes(topic)) existing.topics.push(topic);
      } else {
        words.set(id, {
          id,
          hu,
          en,
          es,
          topics: topic ? [topic] : [],
          sourceRows: [index + 2],
          eligible:
            !hu.includes('/') &&
            !knownErrors.has(hu.toLocaleLowerCase()) &&
            hu.split(/\s+/).length <= 4,
        });
      }
    });
  return Array.from(words.values());
}
