import reducer, {
  languageChanged,
  reviewRecorded,
  wordRemovalChanged,
  sessionCompleted,
  dailyGoalChanged,
  hydrated,
  initialLearningState,
  remindersEnabledChanged,
  vocabularyImported,
} from './learning.slice';
import catalog from '@/data/vocabulary.json';

it('imports edits by stable ID without losing existing review progress', () => {
  const reviewed = reducer(
    undefined,
    reviewRecorded({
      wordId: 'custom-1',
      result: 'correct',
      mode: 'recall',
      at: '2026-01-01T00:00:00.000Z',
    }),
  );
  const state = reducer(
    reviewed,
    vocabularyImported([
      { id: 'custom-1', hu: 'alma', en: 'apple', es: 'manzana', tags: ['fruit'], removed: false },
    ]),
  );
  expect(state.progress['custom-1'].reviews).toBe(1);
  expect(state.words['custom-1'].hu).toBe('alma');
  expect(state.words['custom-1'].tags).toEqual(['fruit']);
});

it('keeps removal and language without claiming unreviewed words are known', () => {
  let state = reducer(undefined, languageChanged('es'));
  state = reducer(state, wordRemovalChanged({ wordId: 'a', removed: true }));
  expect(state.language).toBe('es');
  expect(state.progress.a.removed).toBe(true);
  expect(state.progress.a.reviews).toBe(0);
  state = reducer(state, wordRemovalChanged({ wordId: 'a', removed: false }));
  state = reducer(
    state,
    reviewRecorded({
      wordId: 'a',
      result: 'correct',
      mode: 'recall',
      at: '2026-01-01T00:00:00.000Z',
    }),
  );
  expect(state.progress.a.reviews).toBe(1);
});

it('ties the reminder count to the session goal and lets reminders be disabled', () => {
  let state = reducer(undefined, dailyGoalChanged(3));
  state = reducer(state, remindersEnabledChanged(true));
  expect(state.reminders.count).toBe(3);
  state = reducer(state, dailyGoalChanged(2));
  expect(state.reminders.count).toBe(2);
  state = reducer(state, remindersEnabledChanged(false));
  expect(state.reminders.count).toBe(0);
  expect(state.dailyGoal).toBe(2);
});

it('stores completed sessions and a separate daily goal without losing old settings', () => {
  const old = { ...initialLearningState, reminders: { count: 3, quietStart: 1320, quietEnd: 480 } };
  const loaded = reducer(undefined, hydrated(old));
  const state = reducer(
    reducer(loaded, dailyGoalChanged(2)),
    sessionCompleted({
      id: 'session-1',
      completedAt: '2026-10-31T10:00:00.000Z',
      topic: 'people',
      correct: 3,
      total: 4,
    }),
  );
  expect(state.sessions).toEqual([
    {
      id: 'session-1',
      completedAt: '2026-10-31T10:00:00.000Z',
      topic: 'people',
      correct: 3,
      total: 4,
    },
  ]);
  expect(state.dailyGoal).toBe(2);
  expect(state.reminders.count).toBe(3);
});

it('removes and restores the consolidated vocabulary entry', () => {
  const variants = catalog.filter(word => word.hu.toLocaleLowerCase() === 'kedves');
  expect(variants).toHaveLength(1);
  const removed = reducer(undefined, wordRemovalChanged({ wordId: variants[0].id, removed: true }));
  expect(variants.every(word => removed.progress[word.id]?.removed)).toBe(true);
  const restored = reducer(removed, wordRemovalChanged({ wordId: variants[0].id, removed: false }));
  expect(variants.every(word => !restored.progress[word.id]?.removed)).toBe(true);
});
