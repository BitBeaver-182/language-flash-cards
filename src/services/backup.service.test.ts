import {
  BackupEnvelope,
  BackupError,
  createBackupPackage,
  parseBackupPackage,
} from './backup.service';
import { initialLearningState, LearningState } from '@/slices/learning.slice';

describe('backup.service', () => {
  const sampleState: LearningState = {
    ...initialLearningState,
    language: 'es',
    dailyGoal: 5,
    sessions: [
      {
        id: 'session-1',
        completedAt: '2026-11-01T12:00:00Z',
        topic: 'Vegetables',
        correct: 4,
        total: 5,
      },
    ],
  };

  it('serializes and parses a valid backup package', () => {
    const pkg = createBackupPackage(sampleState);
    const parsedEnvelope = JSON.parse(pkg) as BackupEnvelope;

    expect(parsedEnvelope.app).toBe('magyar-recall');
    expect(parsedEnvelope.version).toBe(3);
    expect(parsedEnvelope.data.language).toBe('es');
    expect(parsedEnvelope.data.dailyGoal).toBe(5);

    const restoredState = parseBackupPackage(pkg);
    expect(restoredState.language).toBe('es');
    expect(restoredState.dailyGoal).toBe(5);
    expect(restoredState.sessions).toHaveLength(1);
    expect(restoredState.words).toEqual(sampleState.words);
  });

  it('restores progress without an attempt window', () => {
    const envelope = JSON.parse(createBackupPackage(sampleState)) as BackupEnvelope;
    envelope.data.progress = {
      a: {
        wordId: 'a',
        strength: 0.5,
        stabilityDays: 1,
        reviewedAt: '2026-11-01T00:00:00Z',
        reviews: 3,
        removed: false,
      } as never,
    };
    const restored = parseBackupPackage(JSON.stringify(envelope));
    expect(restored.progress.a.recent).toEqual([]);
  });

  it('round-trips an attempt window and rejects malformed values', () => {
    const envelope = JSON.parse(createBackupPackage(sampleState)) as BackupEnvelope;
    envelope.data.progress = {
      a: {
        wordId: 'a',
        strength: 0.5,
        stabilityDays: 1,
        reviewedAt: '2026-11-01T00:00:00Z',
        reviews: 10,
        removed: false,
        recent: [true, false, true],
      },
    };
    expect(parseBackupPackage(JSON.stringify(envelope)).progress.a.recent).toEqual([
      true,
      false,
      true,
    ]);

    envelope.data.progress.a.recent = 'nope' as never;
    expect(() => parseBackupPackage(JSON.stringify(envelope))).toThrow(
      'Incomplete or incompatible backup data',
    );
  });

  it('rejects invalid JSON string', () => {
    expect(() => parseBackupPackage('invalid-json')).toThrow('Invalid JSON format');
  });

  it('rejects backup missing words or progress', () => {
    const invalid = JSON.stringify({ app: 'magyar-recall', version: 3, data: { sessions: [] } });
    expect(() => parseBackupPackage(invalid)).toThrow('Incomplete or incompatible backup data');
  });

  it('rejects a backup without a supported version envelope', () => {
    const envelope = JSON.parse(createBackupPackage(sampleState)) as Partial<BackupEnvelope>;
    delete envelope.version;
    expect(() => parseBackupPackage(JSON.stringify(envelope))).toThrow(
      'Unsupported backup version',
    );
  });

  it('rejects a backup whose words are not stored as a record', () => {
    const envelope = JSON.parse(createBackupPackage(sampleState)) as BackupEnvelope;
    const corrupted = { ...envelope, data: { ...envelope.data, words: [] } };
    expect(() => parseBackupPackage(JSON.stringify(corrupted))).toThrow(
      'Incomplete or incompatible backup data',
    );
  });

  it('rejects a backup from another app or an unknown future version', () => {
    const otherApp = JSON.parse(createBackupPackage(sampleState)) as BackupEnvelope;
    otherApp.app = 'another-app';
    expect(() => parseBackupPackage(JSON.stringify(otherApp))).toThrow('Not a Beszélj! backup');
    const future = JSON.parse(createBackupPackage(sampleState)) as BackupEnvelope;
    future.version = 99;
    expect(() => parseBackupPackage(JSON.stringify(future))).toThrow('Unsupported backup version');
  });

  it('rejects malformed word records and empty vocabularies instead of wedging the app', () => {
    const envelope = JSON.parse(createBackupPackage(sampleState)) as BackupEnvelope;
    const malformed = {
      ...envelope,
      data: {
        ...envelope.data,
        words: { broken: { id: 'broken', hu: 'elromlott' } },
      },
    };
    expect(() => parseBackupPackage(JSON.stringify(malformed))).toThrow(
      'Incomplete or incompatible backup data',
    );
    const empty = { ...envelope, data: { ...envelope.data, words: {} } };
    expect(() => parseBackupPackage(JSON.stringify(empty))).toThrow(
      'Incomplete or incompatible backup data',
    );
  });

  it('normalizes restored settings into the supported ranges', () => {
    const envelope = JSON.parse(createBackupPackage(sampleState)) as BackupEnvelope;
    envelope.data.language = 'xx';
    envelope.data.dailyGoal = 999;
    envelope.data.remindersEnabled = true;
    envelope.data.reminders = { count: 0, quietStart: -10, quietEnd: 5000 };
    const restored = parseBackupPackage(JSON.stringify(envelope));
    expect(restored.language).toBe('en');
    expect(restored.dailyGoal).toBe(12);
    expect(restored.reminders).toEqual({ count: 12, quietStart: 0, quietEnd: 1439 });
  });

  it('reports a stable error code so the UI can localize the message', () => {
    try {
      parseBackupPackage('[]');
    } catch (error) {
      expect(error).toBeInstanceOf(BackupError);
      expect((error as BackupError).code).toBe('invalidFile');
    }
    const future = JSON.parse(createBackupPackage(sampleState)) as BackupEnvelope;
    future.version = 99;
    try {
      parseBackupPackage(JSON.stringify(future));
    } catch (error) {
      expect((error as BackupError).code).toBe('unsupportedVersion');
    }
  });
});
