# New-Word Cap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cap active learning at 36 words and introduce at most 3 new words per session, graduating a word after 8 correct answers in its last 10 attempts.

**Architecture:** Add a rolling 10-attempt window to `Progress`, derive learned status from it, then limit `selectWords` by the number of active groups. Hydration and backup restore normalise legacy records to an empty window. Home displays the active count.

**Tech Stack:** React Native, Expo, TypeScript, Redux Toolkit, React Native Testing Library, Jest.

**Spec:** `docs/superpowers/specs/2026-11-05-new-word-cap-design.md`

## Global Constraints

- Node ≥ 24, npm ≥ 11.
- Import with `@/`; keep TypeScript strict.
- Use `StyleSheet.create`; read colors from `@/theme`.
- Add copy to `en`, `es`, and `sk` locale files.
- `LEARNING_STATE_VERSION` stays `3`; `recent` is additive and optional in stored/backup data.
- Run `npm run check-types`, `npm run lint`, and `npm run test` before committing.
- Commit format `type(scope): description`.

## Review Focus

- A word with exactly 10 attempts and only 7 correct must stay in learning.
- Legacy progress without `recent` must normalise to `[]`, never crash or count as learned.
- A backup containing a malformed `recent` value must be rejected as incomplete.
- A removed word must not occupy an active slot.
- Duplicate Hungarian forms must count as one active word.
- Selecting a topic while the cap is full must return an empty list rather than overflow the cap.

---

### Task 1: Rolling attempt window and graduation rule

**Files:**

- Modify: `src/utils/recall.ts`
- Test: `src/utils/recall.test.ts`

**Interfaces:**

- Consumes: existing `Progress` and `recordReview`.
- Produces: `Progress.recent: boolean[]` (max 10, oldest first); `isLearned(progress: Progress | undefined): boolean`.

- [ ] **Step 1: Write the failing tests**

```ts
import { estimateRecall, isLearned, recordReview } from './recall';

function withRecent(recent: boolean[]) {
  return {
    wordId: 'a',
    strength: 0,
    stabilityDays: 1,
    reviewedAt: '',
    reviews: recent.length,
    removed: false,
    recent,
  };
}

it('appends attempts and keeps only the last ten in order', () => {
  let progress = recordReview(undefined, 'a', 'correct', 'recall', now);
  progress = recordReview(progress, 'a', 'incorrect', 'recall', now);
  expect(progress.recent).toEqual([true, false]);

  for (let i = 0; i < 10; i++) {
    progress = recordReview(progress, 'a', i % 2 === 0 ? 'correct' : 'incorrect', 'recall', now);
  }
  expect(progress.recent).toHaveLength(10);
  expect(progress.recent).toEqual([
    true,
    false,
    true,
    false,
    true,
    false,
    true,
    false,
    true,
    false,
  ]);
});

it('graduates after ten attempts with at least eight correct', () => {
  expect(isLearned(withRecent(Array(9).fill(true)))).toBe(false);
  expect(isLearned(withRecent([...Array(8).fill(true), false, false]))).toBe(true);
  expect(isLearned(withRecent([...Array(7).fill(true), false, false, false]))).toBe(false);
  expect(isLearned(undefined)).toBe(false);
});

it('reopens learning after a miss drops the window below eighty percent', () => {
  const learned = withRecent([true, true, true, true, true, true, true, true, false, false]);
  expect(isLearned(learned)).toBe(true);
  expect(isLearned(recordReview(learned, 'a', 'incorrect', 'recall', now))).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/utils/recall.test.ts -v`
Expected: FAIL because `isLearned` is not exported and `recent` is missing.

- [ ] **Step 3: Implement the window**

In `src/utils/recall.ts`:

- Add `recent: boolean[];` to `Progress`.
- Add `isLearned(progress: Progress | undefined): boolean` that returns `false` when `progress` is undefined, `progress.recent.length < 10`, or fewer than 8 entries are `true`.
- In `recordReview`, add `recent: [...(progress?.recent ?? []), correct].slice(-10)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/utils/recall.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Fix type errors from the new required field**

Run: `npm run check-types`
Add `recent: []` to every hand-built `Progress` fixture the compiler reports. Do not change test assertions.

- [ ] **Step 6: Commit**

```bash
git add src/utils/recall.ts src/utils/recall.test.ts
git commit -m "feat(recall): track a rolling ten-attempt window"
```

---

### Task 2: Active cap and new-word limit in session selection

**Files:**

- Modify: `src/utils/session.ts`
- Test: `src/utils/session.test.ts`

**Interfaces:**

- Consumes: `isLearned` and `Progress.recent` from Task 1.
- Produces: `MAX_ACTIVE_WORDS = 36`, `MAX_NEW_PER_SESSION = 3`, and `countActiveWords(words: Word[], progress: Record<string, Progress>): number`.

- [ ] **Step 1: Write the failing tests**

Add a helper and these tests, and update the existing mix tests:

```ts
function reviewed(id: string, recent: boolean[] = [true]) {
  return {
    wordId: id,
    strength: 0.5,
    stabilityDays: 1,
    reviewedAt: '2026-01-07T12:00:00Z',
    reviews: recent.length,
    removed: false,
    recent,
  };
}

it('introduces at most three unseen words per session', () => {
  const many = Array.from({ length: 25 }, (_, i) => ({
    ...words[0],
    id: String(i),
    hu: String(i),
  }));
  const progress = Object.fromEntries(many.slice(0, 10).map(word => [word.id, reviewed(word.id)]));
  const selected = selectWords(many, progress, now);
  expect(selected.filter(word => !progress[word.id])).toHaveLength(3);
  expect(selected.filter(word => progress[word.id])).toHaveLength(7);
  expect(selected).toHaveLength(10);
});

it('stops introducing new words at thirty-six active words', () => {
  const many = Array.from({ length: 50 }, (_, i) => ({
    ...words[0],
    id: String(i),
    hu: String(i),
  }));
  const progress = Object.fromEntries(many.slice(0, 36).map(word => [word.id, reviewed(word.id)]));
  expect(countActiveWords(many, progress)).toBe(36);
  const selected = selectWords(many, progress, now);
  expect(selected).toHaveLength(10);
  expect(selected.every(word => progress[word.id])).toBe(true);
});

it('allows one new word when thirty-five are active', () => {
  const many = Array.from({ length: 50 }, (_, i) => ({
    ...words[0],
    id: String(i),
    hu: String(i),
  }));
  const progress = Object.fromEntries(many.slice(0, 35).map(word => [word.id, reviewed(word.id)]));
  const selected = selectWords(many, progress, now);
  expect(selected.filter(word => !progress[word.id])).toHaveLength(1);
});

it('shrinks the session instead of padding it with new words', () => {
  const many = Array.from({ length: 50 }, (_, i) => ({
    ...words[0],
    id: String(i),
    hu: String(i),
  }));
  const progress = Object.fromEntries(many.slice(0, 3).map(word => [word.id, reviewed(word.id)]));
  expect(selectWords(many, progress, now)).toHaveLength(6);
});

it('keeps learned words in review and frees their active slot', () => {
  const many = Array.from({ length: 50 }, (_, i) => ({
    ...words[0],
    id: String(i),
    hu: String(i),
  }));
  const progress = Object.fromEntries(many.slice(0, 36).map(word => [word.id, reviewed(word.id)]));
  const learnedId = many[0].id;
  progress[learnedId] = reviewed(learnedId, [
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    false,
    false,
  ]);
  expect(countActiveWords(many, progress)).toBe(35);
  expect(selectWords(many, progress, now).filter(word => !progress[word.id])).toHaveLength(1);
});

it('does not count removed words as active', () => {
  const many = Array.from({ length: 50 }, (_, i) => ({
    ...words[0],
    id: String(i),
    hu: String(i),
  }));
  const progress = Object.fromEntries(many.slice(0, 36).map(word => [word.id, reviewed(word.id)]));
  progress[many[0].id] = { ...progress[many[0].id], removed: true };
  expect(countActiveWords(many, progress)).toBe(35);
});
```

Rewrite the existing "mixes seven unseen..." test to expect **3 new + 7 reviewed**. Update the "fills empty review slots" expectation to 3 new + 7 reviewed (10 total when enough reviews exist) and the topic test to assert `newCount <= 3`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/utils/session.test.ts -v`
Expected: FAIL because `countActiveWords` and the constants are missing, and new-word counts are still 7.

- [ ] **Step 3: Implement the cap**

In `src/utils/session.ts`:

- Export `const MAX_ACTIVE_WORDS = 36;` and `const MAX_NEW_PER_SESSION = 3;`.
- Extract the existing eligible/non-removed grouping into a shared helper.
- Add `countActiveWords`: number of groups where at least one member has `progress[word.id]` with `reviews > 0` and `!isLearned(...)`.
- Compute `activeCount = countActiveWords(words, progress)` before selecting.
- Replace the size calculation with:

```ts
const newCount = Math.min(
  fresh.length,
  MAX_NEW_PER_SESSION,
  Math.max(0, MAX_ACTIVE_WORDS - activeCount),
);
const reviewCount = Math.min(reviews.length, 10 - newCount);
const size = newCount + reviewCount;
```

- Keep the existing review ordering and interleaving loop.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/utils/session.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/session.ts src/utils/session.test.ts
git commit -m "feat(session): cap active words and new-word intake"
```

---

### Task 3: Normalise `recent` in the slice and hydration

**Files:**

- Modify: `src/slices/learning.slice.ts`
- Modify: `src/hooks/useLearningPersistence.ts`
- Test: `src/slices/learning.slice.test.ts`
- Test: `src/hooks/useLearningPersistence.test.tsx`

**Interfaces:**

- Consumes: `Progress.recent` from Task 1.
- Produces: every progress record in Redux has `recent: boolean[]` after hydration.

- [ ] **Step 1: Write the failing tests**

In `learning.slice.test.ts`, extend the removal test:

```ts
expect(state.progress.a.recent).toEqual([]);
```

after the first removal, and after the review:

```ts
expect(state.progress.a.recent).toEqual([true]);
```

In `useLearningPersistence.test.tsx`, add to the existing migration test:

```ts
expect(data.progress['new-custom-id'].recent).toEqual([]);
```

Add a second assertion in a new test that saved progress with `recent: [true, false]` survives hydration, and `recent` longer than 10 is truncated to the last 10.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/slices/learning.slice.test.ts src/hooks/useLearningPersistence.test.tsx -v`
Expected: FAIL because new progress records have no `recent` and hydration does not add it.

- [ ] **Step 3: Implement**

In `src/slices/learning.slice.ts`:

- Add `recent: []` to the two progress records created in `vocabularyImported` and `wordRemovalChanged`.

In `src/hooks/useLearningPersistence.ts`:

- Normalise after migration:

```ts
const loadedProgress = migrated?.progress ?? saved.data.progress;
const normalizedProgress = Object.fromEntries(
  Object.entries(loadedProgress).map(([id, entry]) => [
    id,
    {
      ...entry,
      recent: Array.isArray(entry.recent) ? entry.recent.slice(-10).map(Boolean) : [],
    },
  ]),
);
```

- Pass `progress: normalizedProgress` to `hydrated`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/slices/learning.slice.test.ts src/hooks/useLearningPersistence.test.tsx -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/slices/learning.slice.ts src/slices/learning.slice.test.ts src/hooks/useLearningPersistence.ts src/hooks/useLearningPersistence.test.tsx
git commit -m "feat(learning): normalise attempt windows on the new schema"
```

---

### Task 4: Accept and normalise `recent` in backups

**Files:**

- Modify: `src/services/backup.service.ts`
- Test: `src/services/backup.service.test.ts`

**Interfaces:**

- Consumes: `Progress.recent` from Task 1.
- Produces: `parseBackupPackage` returns progress with `recent: boolean[]`.

- [ ] **Step 1: Write the failing tests**

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/services/backup.service.test.ts -v`
Expected: FAIL because `recent` is not normalised and malformed values are accepted.

- [ ] **Step 3: Implement**

In `src/services/backup.service.ts`:

- In `isProgress`, accept `recent` only when it is undefined or an array of booleans.
- In `parseBackupPackage`, replace the raw progress assignment with a map that sets `recent` to `Array.isArray(entry.recent) ? entry.recent.slice(-10) : []`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/services/backup.service.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/backup.service.ts src/services/backup.service.test.ts
git commit -m "feat(backup): normalise attempt windows on restore"
```

---

### Task 5: Show the active learning count on Home

**Files:**

- Modify: `src/scenes/home/Home.tsx`
- Modify: `src/locales/en.json`
- Modify: `src/locales/es.json`
- Modify: `src/locales/sk.json`
- Test: `src/scenes/home/Home.test.tsx`

**Interfaces:**

- Consumes: `countActiveWords`, `MAX_ACTIVE_WORDS` from Task 2.
- Produces: a `learning-count` test ID showing `Learning <active> / 36`.

- [ ] **Step 1: Write the failing test**

```ts
it('shows how many words are in active learning', async () => {
  await render(
    <Provider store={store}>
      <Home />
    </Provider>,
  );
  expect(screen.getByTestId('learning-count')).toHaveTextContent('Learning 0 / 36');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/scenes/home/Home.test.tsx -t "active learning" -v`
Expected: FAIL because `learning-count` does not exist.

- [ ] **Step 3: Implement**

In `Home.tsx`:

- Import `countActiveWords` and `MAX_ACTIVE_WORDS` from `@/utils/session`.
- Add `const activeLearning = useMemo(() => countActiveWords(words, progress), [words, progress]);`
- Render below the daily goal line in the "This week" card:

```tsx
<Text testID="learning-count" style={[styles.muted, isDark && { color: colors.darkMuted }]}>
  {t('practice.learningCount', { active: activeLearning, max: MAX_ACTIVE_WORDS })}
</Text>
```

Add to `practice` in each locale:

- `en`: `"learningCount": "Learning {{active}} / {{max}}"`
- `es`: `"learningCount": "Aprendiendo {{active}} / {{max}}"`
- `sk`: `"learningCount": "Učím sa {{active}} / {{max}}"`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/scenes/home/Home.test.tsx -v`
Expected: PASS.

- [ ] **Step 5: Run the full suite and checks**

Run: `npm run check-types && npm run lint && npm run test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/scenes/home/Home.tsx src/scenes/home/Home.test.tsx src/locales/en.json src/locales/es.json src/locales/sk.json
git commit -m "feat(home): show active learning count"
```
