import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useDataPersist, DataPersistKeys } from '@/hooks/useDataPersist';
import {
  hydrated,
  initialLearningState,
  LearningState,
  LEARNING_STATE_VERSION,
} from '@/slices/learning.slice';
import { State } from '@/utils/store';
import legacyCatalog from '@/data/legacyVocabulary.json';
import { LegacyWord } from '@/utils/vocabulary';
import { createVocabularyState, normalizeWordKey } from '@/utils/vocabularyModel';
import { randomUUID } from 'expo-crypto';
import i18n from '@/i18n';

type LegacyState = Omit<LearningState, 'words'> & {
  userWords?: Record<string, LegacyWord>;
  customTags?: Record<string, string[]>;
  words?: LearningState['words'];
  duplicatesConsolidated?: boolean;
};

export function useLearningPersistence(): boolean {
  const dispatch = useDispatch();
  const persistence = useRef(useDataPersist());
  const pendingWrite = useRef<Promise<unknown>>(Promise.resolve());
  const learning = useSelector((state: State) => state.learning);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    persistence.current
      .getPersistData<{ version: number; data: LegacyState }>(DataPersistKeys.LEARNING)
      .then(saved => {
        if (
          active &&
          (saved?.version === 1 || saved?.version === 2 || saved?.version === 3) &&
          saved.data &&
          typeof saved.data.progress === 'object'
        ) {
          const enabled = saved.data.remindersEnabled ?? saved.data.reminders?.count > 0;
          const dailyGoal = saved.data.dailyGoal ?? 1;
          const seedIds = new Map(
            Object.values(initialLearningState.words).map(word => [
              normalizeWordKey(word.hu),
              word.id,
            ]),
          );
          const migrated =
            saved.version === 1
              ? createVocabularyState(
                  legacyCatalog,
                  saved.data.userWords ?? {},
                  saved.data.customTags ?? {},
                  saved.data.progress,
                  legacyId => seedIds.get(normalizeWordKey(legacyId.split('|')[0])) ?? randomUUID(),
                )
              : undefined;
          const {
            userWords: _oldWords,
            customTags: _oldTags,
            duplicatesConsolidated: _oldFlag,
            ...settings
          } = saved.data;
          const loadedWords = migrated?.words ?? saved.data.words ?? initialLearningState.words;
          const normalizedWords =
            saved.version === 2
              ? Object.fromEntries(
                  Object.values(loadedWords).map((word: LearningState['words'][string]) => [
                    word.id,
                    {
                      ...word,
                      tags: Array.from(
                        new Set(
                          word.tags
                            .flatMap(tag => tag.split(/\s*\/\s*|\s*,\s*|\s+&\s+|\s+and\s+/i))
                            .map(tag => tag.trim())
                            .filter(tag => tag && tag.toLowerCase() !== 'vocabulary'),
                        ),
                      ),
                    },
                  ]),
                )
              : loadedWords;
          const loadedProgress = migrated?.progress ?? saved.data.progress;
          const normalizedProgress = Object.fromEntries(
            Object.entries(loadedProgress).map(([id, entry]) => [
              id,
              {
                ...entry,
                recent: Array.isArray(entry.recent) ? entry.recent.slice(-20).map(Boolean) : [],
              },
            ]),
          );
          dispatch(
            hydrated({
              ...initialLearningState,
              ...settings,
              words: normalizedWords,
              answerHistory: (
                saved.data.answerHistory ??
                [...(saved.data.sessions ?? [])]
                  .sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt))
                  .flatMap(session =>
                    (session.answers ?? []).map(answer => ({
                      wordId: migrated?.idMap[answer.wordId] ?? answer.wordId,
                      correct: answer.correct,
                      at: session.completedAt,
                    })),
                  )
              ).slice(-20),
              progress: normalizedProgress,
              sessions: (saved.data.sessions ?? []).map(session => ({
                ...session,
                answers: session.answers?.map(answer => ({
                  ...answer,
                  wordId: migrated?.idMap[answer.wordId] ?? answer.wordId,
                })),
              })),
              remindersEnabled: enabled,
              reminders: { ...saved.data.reminders, count: enabled ? dailyGoal : 0 },
            }),
          );
        } else if (active && !saved) {
          dispatch(hydrated(initialLearningState));
        } else {
          return;
        }
        if (active) setReady(true);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [dispatch]);
  useEffect(() => {
    if (ready) {
      if (learning.language) void i18n.changeLanguage(learning.language);
      pendingWrite.current = pendingWrite.current
        .catch(() => undefined)
        .then(() =>
          persistence.current.setPersistData(DataPersistKeys.LEARNING, {
            version: LEARNING_STATE_VERSION,
            data: learning,
          }),
        )
        .catch(() => undefined);
    }
  }, [learning, ready]);
  return ready;
}
