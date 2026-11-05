import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { LearningState, LEARNING_STATE_VERSION } from '@/slices/learning.slice';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { Word } from '@/utils/vocabulary';

const APP_ID = 'magyar-recall';
const supportedLanguages = new Set(SUPPORTED_LANGUAGES.map(language => language.code));

export interface BackupEnvelope {
  app: string;
  version: number;
  exportedAt: string;
  data: LearningState;
}

export type BackupErrorCode =
  | 'invalidJson'
  | 'invalidFile'
  | 'wrongApp'
  | 'unsupportedVersion'
  | 'incompleteData'
  | 'sharingUnavailable';

export class BackupError extends Error {
  readonly code: BackupErrorCode;

  constructor(code: BackupErrorCode, message: string = code) {
    super(message);
    this.name = 'BackupError';
    this.code = code;
  }
}

const errorMessages: Record<BackupErrorCode, string> = {
  invalidJson: 'Invalid JSON format',
  invalidFile: 'Invalid backup file',
  wrongApp: 'Not a Magyar Recall backup',
  unsupportedVersion: 'Unsupported backup version',
  incompleteData: 'Incomplete or incompatible backup data',
  sharingUnavailable: 'Sharing is not available on this device.',
};

function fail(code: BackupErrorCode): never {
  throw new BackupError(code, errorMessages[code]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWord(value: unknown): value is Word {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.hu === 'string' &&
    value.hu.length > 0 &&
    Array.isArray(value.tags) &&
    value.tags.every(tag => typeof tag === 'string') &&
    (value.en === undefined || typeof value.en === 'string') &&
    (value.es === undefined || typeof value.es === 'string') &&
    (value.eligible === undefined || typeof value.eligible === 'boolean') &&
    (value.translations === undefined ||
      (isRecord(value.translations) &&
        Object.values(value.translations).every(translation => typeof translation === 'string')))
  );
}

function isProgress(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.wordId === 'string' &&
    typeof value.strength === 'number' &&
    Number.isFinite(value.strength) &&
    typeof value.stabilityDays === 'number' &&
    Number.isFinite(value.stabilityDays) &&
    typeof value.reviewedAt === 'string' &&
    typeof value.reviews === 'number' &&
    Number.isFinite(value.reviews) &&
    (value.removed === undefined || typeof value.removed === 'boolean') &&
    (value.recent === undefined ||
      (Array.isArray(value.recent) && value.recent.every(item => typeof item === 'boolean')))
  );
}

function isSessionAnswer(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.wordId === 'string' &&
    typeof value.kind === 'string' &&
    typeof value.prompt === 'string' &&
    typeof value.expected === 'string' &&
    typeof value.answer === 'string' &&
    typeof value.correct === 'boolean'
  );
}

function isSession(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.completedAt === 'string' &&
    typeof value.topic === 'string' &&
    typeof value.correct === 'number' &&
    Number.isFinite(value.correct) &&
    typeof value.total === 'number' &&
    Number.isFinite(value.total) &&
    (value.answers === undefined ||
      (Array.isArray(value.answers) && value.answers.every(isSessionAnswer)))
  );
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function createBackupPackage(state: LearningState): string {
  const envelope: BackupEnvelope = {
    app: APP_ID,
    version: LEARNING_STATE_VERSION,
    exportedAt: new Date().toISOString(),
    data: state,
  };
  return JSON.stringify(envelope, null, 2);
}

export function parseBackupPackage(jsonString: string): LearningState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString.trim());
  } catch {
    fail('invalidJson');
  }

  if (!isRecord(parsed)) {
    fail('invalidFile');
  }

  if (parsed.app !== APP_ID) {
    fail('wrongApp');
  }
  if (parsed.version !== LEARNING_STATE_VERSION) {
    fail('unsupportedVersion');
  }

  const data = parsed.data;
  if (
    !isRecord(data) ||
    !isRecord(data.words) ||
    !isRecord(data.progress) ||
    !Array.isArray(data.sessions)
  ) {
    fail('incompleteData');
  }

  const wordEntries = Object.entries(data.words);
  if (wordEntries.length === 0 || !wordEntries.every(([, word]) => isWord(word))) {
    fail('incompleteData');
  }
  if (!Object.values(data.progress).every(isProgress)) {
    fail('incompleteData');
  }
  if (!data.sessions.every(isSession)) {
    fail('incompleteData');
  }

  const words = Object.fromEntries(
    wordEntries.map(([id, word]) => [
      id,
      { ...(word as Word), eligible: (word as Word).eligible !== false },
    ]),
  );
  const reminders = isRecord(data.reminders) ? data.reminders : {};
  const dailyGoal = clamp(Number(data.dailyGoal ?? 1), 1, 12);
  const remindersEnabled = Boolean(data.remindersEnabled);
  const progress = Object.fromEntries(
    Object.entries(data.progress as LearningState['progress']).map(([id, entry]) => [
      id,
      {
        ...entry,
        recent: Array.isArray(entry.recent) ? entry.recent.slice(-10) : [],
      },
    ]),
  );

  return {
    progress,
    language:
      typeof data.language === 'string' && supportedLanguages.has(data.language)
        ? data.language
        : 'en',
    reminders: {
      count: remindersEnabled ? dailyGoal : 0,
      quietStart: clamp(Number(reminders.quietStart ?? 1320), 0, 1439),
      quietEnd: clamp(Number(reminders.quietEnd ?? 480), 0, 1439),
    },
    dailyGoal,
    remindersEnabled,
    words,
    sessions: data.sessions as LearningState['sessions'],
  };
}

export async function exportBackupFileAsync(
  state: LearningState,
  dialogTitle = 'Export Magyar Recall Backup',
): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    fail('sharingUnavailable');
  }
  const dateStr = new Date().toISOString().slice(0, 10);
  const file = new File(Paths.cache, `magyar-recall-backup-${dateStr}.json`);
  const json = createBackupPackage(state);
  file.write(json);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle,
  });
}

export async function pickBackupFileAsync(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/json', 'text/plain'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.length) return null;
  return new File(result.assets[0].uri).text();
}
