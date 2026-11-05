import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { renderHook, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import reducer, { initialLearningState } from '@/slices/learning.slice';
import { useLearningPersistence } from './useLearningPersistence';
import { useDataPersist } from './useDataPersist';

jest.mock('./useDataPersist', () => ({
  DataPersistKeys: { LEARNING: 'LEARNING' },
  useDataPersist: jest.fn(),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'new-custom-id' }));

it('migrates saved vocabulary, tags, progress and history before saving the new version', async () => {
  const get = jest.fn().mockResolvedValue({
    version: 1,
    data: {
      ...initialLearningState,
      words: undefined,
      userWords: {
        old: {
          id: 'old',
          hu: 'tesztmigration',
          en: 'test',
          es: 'prueba',
          topics: [],
          sourceRows: [],
          eligible: true,
        },
      },
      customTags: { old: ['Custom'] },
      progress: {
        old: {
          wordId: 'old',
          strength: 0.8,
          stabilityDays: 2,
          reviewedAt: '2026-01-01',
          reviews: 1,
          removed: false,
        },
      },
      sessions: [
        {
          id: 's',
          completedAt: '2026-01-01',
          topic: '',
          correct: 1,
          total: 1,
          answers: [
            {
              wordId: 'old',
              kind: 'word',
              prompt: 'tesztmigration',
              expected: 'test',
              answer: 'remembered',
              correct: true,
            },
          ],
        },
      ],
    },
  });
  const set = jest.fn().mockResolvedValue(true);
  jest
    .mocked(useDataPersist)
    .mockReturnValue({ getPersistData: get, setPersistData: set } as unknown as ReturnType<
      typeof useDataPersist
    >);
  const store = configureStore({ reducer: { learning: reducer } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  const { result } = await renderHook(() => useLearningPersistence(), { wrapper });
  await waitFor(() => expect(result.current).toBe(true));
  const data = store.getState().learning;
  expect(data.words['new-custom-id'].tags).toEqual(['Custom']);
  expect(data.progress['new-custom-id'].reviews).toBe(1);
  expect(data.progress['new-custom-id'].recent).toEqual([]);
  expect(data.sessions[0].answers?.[0].wordId).toBe('new-custom-id');
  expect(data).not.toHaveProperty('customTags');
  expect(data).not.toHaveProperty('userWords');
  await waitFor(() =>
    expect(set).toHaveBeenCalledWith('LEARNING', expect.objectContaining({ version: 3 })),
  );
});

it('normalizes old composite labels into separate stored tags', async () => {
  const set = jest.fn().mockResolvedValue(true);
  jest.mocked(useDataPersist).mockReturnValue({
    getPersistData: jest.fn().mockResolvedValue({
      version: 2,
      data: {
        ...initialLearningState,
        words: {
          w: {
            id: 'w',
            hu: 'vár',
            en: 'castle',
            es: 'castillo',
            tags: ['Vocabulary / Adverbs & Places'],
            eligible: true,
          },
        },
      },
    }),
    setPersistData: set,
  } as unknown as ReturnType<typeof useDataPersist>);
  const store = configureStore({ reducer: { learning: reducer } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  const { result } = await renderHook(() => useLearningPersistence(), { wrapper });
  await waitFor(() => expect(result.current).toBe(true));
  expect(store.getState().learning.words.w.tags).toEqual(['Adverbs', 'Places']);
});

it('keeps up to the latest twenty saved attempts when hydrating', async () => {
  const set = jest.fn().mockResolvedValue(true);
  const word = Object.values(initialLearningState.words)[0];
  const recent = Array.from({ length: 12 }, (_, index) => index % 2 === 0);
  jest.mocked(useDataPersist).mockReturnValue({
    getPersistData: jest.fn().mockResolvedValue({
      version: 3,
      data: {
        ...initialLearningState,
        progress: {
          [word.id]: {
            wordId: word.id,
            strength: 0.5,
            stabilityDays: 1,
            reviewedAt: '2026-01-01',
            reviews: 12,
            removed: false,
            recent,
          },
        },
      },
    }),
    setPersistData: set,
  } as unknown as ReturnType<typeof useDataPersist>);
  const store = configureStore({ reducer: { learning: reducer } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  const { result } = await renderHook(() => useLearningPersistence(), { wrapper });
  await waitFor(() => expect(result.current).toBe(true));
  expect(store.getState().learning.progress[word.id].recent).toEqual(recent.slice(-20));
});
