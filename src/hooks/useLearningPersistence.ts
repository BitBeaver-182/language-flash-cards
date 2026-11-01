import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useDataPersist, DataPersistKeys } from '@/hooks/useDataPersist';
import { hydrated, initialLearningState, LearningState } from '@/slices/learning.slice';
import { State } from '@/utils/store';

export function useLearningPersistence(): boolean {
  const dispatch = useDispatch();
  const persistence = useRef(useDataPersist());
  const pendingWrite = useRef<Promise<unknown>>(Promise.resolve());
  const learning = useSelector((state: State) => state.learning);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    persistence.current
      .getPersistData<{ version: number; data: LearningState }>(DataPersistKeys.LEARNING)
      .then(saved => {
        if (
          active &&
          saved?.version === 1 &&
          saved.data &&
          typeof saved.data.progress === 'object'
        ) {
          const enabled = saved.data.remindersEnabled ?? saved.data.reminders?.count > 0;
          const dailyGoal = saved.data.dailyGoal ?? 1;
          dispatch(
            hydrated({
              ...initialLearningState,
              ...saved.data,
              remindersEnabled: enabled,
              reminders: { ...saved.data.reminders, count: enabled ? dailyGoal : 0 },
            }),
          );
        } else if (active) {
          dispatch(hydrated(initialLearningState));
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [dispatch]);
  useEffect(() => {
    if (ready)
      pendingWrite.current = pendingWrite.current
        .catch(() => undefined)
        .then(() =>
          persistence.current.setPersistData(DataPersistKeys.LEARNING, {
            version: 1,
            data: learning,
          }),
        )
        .catch(() => undefined);
  }, [learning, ready]);
  return ready;
}
