import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Progress, recordReview } from '@/utils/recall';
import catalog from '@/data/vocabulary.json';
import { Word } from '@/utils/vocabulary';
import { CsvWord } from '@/utils/vocabularyCsv';
import { consolidateDuplicates, mergedVocabulary } from '@/utils/mergedVocabulary';

const baseById = new Map(catalog.map(word => [word.id, word]));

export interface PracticeSession {
  id: string;
  completedAt: string;
  topic: string;
  correct: number;
  total: number;
  answers?: SessionAnswer[];
}

export interface SessionAnswer {
  wordId: string;
  kind: 'word' | 'phrase' | 'sentence';
  prompt: string;
  expected: string;
  answer: string;
  correct: boolean;
}

export interface LearningState {
  progress: Record<string, Progress>;
  language: 'en' | 'es';
  reminders: { count: number; quietStart: number; quietEnd: number };
  dailyGoal: number;
  remindersEnabled: boolean;
  customTags: Record<string, string[]>;
  userWords: Record<string, Word>;
  sessions: PracticeSession[];
  duplicatesConsolidated?: boolean;
}

export const initialLearningState: LearningState = {
  progress: {},
  language: 'en',
  reminders: { count: 0, quietStart: 1320, quietEnd: 480 },
  dailyGoal: 1,
  remindersEnabled: false,
  customTags: {},
  userWords: {},
  sessions: [],
};

const slice = createSlice({
  name: 'learning',
  initialState: initialLearningState,
  reducers: {
    hydrated: (_state, action: PayloadAction<LearningState>) => {
      const data = action.payload;
      if (data.duplicatesConsolidated) return data;
      return {
        ...data,
        ...consolidateDuplicates(catalog, data.userWords, data.customTags, data.progress),
        duplicatesConsolidated: true,
      };
    },
    dailyGoalChanged: (state, action: PayloadAction<number>) => {
      state.dailyGoal = Math.max(1, Math.min(12, action.payload));
      if (state.remindersEnabled) state.reminders.count = state.dailyGoal;
    },
    remindersEnabledChanged: (state, action: PayloadAction<boolean>) => {
      state.remindersEnabled = action.payload;
      state.reminders.count = action.payload ? state.dailyGoal : 0;
    },
    tagsChanged: (state, action: PayloadAction<{ wordId: string; tags: string[] }>) => {
      state.customTags[action.payload.wordId] = action.payload.tags;
    },
    vocabularyImported: (state, action: PayloadAction<CsvWord[]>) => {
      for (const row of action.payload) {
        const existing = state.userWords[row.id] ?? baseById.get(row.id);
        state.userWords[row.id] = {
          id: row.id,
          hu: row.hu,
          en: row.en,
          es: row.es,
          topics: existing?.topics ?? [],
          sourceRows: existing?.sourceRows ?? [],
          eligible: existing?.eligible ?? true,
        };
        state.customTags[row.id] = row.tags;
        if (state.progress[row.id]) state.progress[row.id].removed = row.removed;
        else if (row.removed)
          state.progress[row.id] = {
            wordId: row.id,
            removed: true,
            strength: 0,
            stabilityDays: 1,
            reviewedAt: '',
            reviews: 0,
          };
      }
    },
    sessionCompleted: (state, action: PayloadAction<PracticeSession>) => {
      if (
        action.payload.total > 0 &&
        !state.sessions.some(session => session.id === action.payload.id)
      )
        state.sessions.unshift(action.payload);
    },
    languageChanged: (state, action: PayloadAction<'en' | 'es'>) => {
      state.language = action.payload;
    },
    remindersChanged: (state, action: PayloadAction<LearningState['reminders']>) => {
      state.reminders = action.payload;
    },
    wordRemovalChanged: (state, action: PayloadAction<{ wordId: string; removed: boolean }>) => {
      const { wordId, removed } = action.payload;
      const allWords = mergedVocabulary(catalog, state.userWords);
      const word = allWords.find(item => item.id === wordId);
      const ids = word
        ? allWords
            .filter(item => item.hu.toLocaleLowerCase() === word.hu.toLocaleLowerCase())
            .map(item => item.id)
        : [wordId];
      for (const id of ids) {
        if (!state.progress[id])
          state.progress[id] = {
            wordId: id,
            removed,
            strength: 0,
            stabilityDays: 1,
            reviewedAt: '',
            reviews: 0,
          };
        else state.progress[id].removed = removed;
      }
    },
    reviewRecorded: (
      state,
      action: PayloadAction<{
        wordId: string;
        result: 'correct' | 'incorrect';
        mode: 'recall' | 'recognition';
        at: string;
      }>,
    ) => {
      const { wordId, result, mode, at } = action.payload;
      state.progress[wordId] = recordReview(
        state.progress[wordId],
        wordId,
        result,
        mode,
        new Date(at),
      );
    },
  },
});
export const {
  hydrated,
  languageChanged,
  remindersChanged,
  wordRemovalChanged,
  reviewRecorded,
  dailyGoalChanged,
  sessionCompleted,
  remindersEnabledChanged,
  tagsChanged,
  vocabularyImported,
} = slice.actions;
export default slice.reducer;
