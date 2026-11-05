# New-word cap: design

## Intent

Stop sessions from endlessly injecting fresh vocabulary. The user should be able to finish learning the words already in progress before the app introduces more. Two limits do that: a hard cap of 36 words in active learning, and at most 3 new words introduced per session.

## Current behaviour

`selectWords` in `src/utils/session.ts` splits a 10-question session between words with any progress ("reviews") and words with none ("fresh"). A word is fresh forever until it is answered once, so every session adds up to 10 new words before a review backlog exists, and about 7 after that. Nothing ever marks a word as learned, so the active set only grows.

## Desired behaviour

- **Active learning set:** at most **36** words at a time, across all topics.
- **Introduction limit:** at most **3** new words per session.
- **Learned:** a word graduates when it has at least 10 recorded attempts and at least 8 of its last 10 attempts were correct (80 %).
- The window is rolling. A later incorrect answer can drop a learned word back below 80 %, returning it to the active set.
- Learned words are **not** removed from practice. They stay in the review pool and are prioritised by estimated recall as today. The cap only gates the introduction of unseen words.
- When 36 words are active, sessions contain reviews only. A slot frees up only when a word graduates or is removed.
- Session length stays up to 10. With fewer reviews available, a session is simply shorter (for example 3 new words on a first session).

## Data model

`Progress` gains `recent: boolean[]`, the last 10 attempt results in chronological order (oldest first, newest appended).

```ts
interface Progress {
  wordId: string;
  strength: number;
  stabilityDays: number;
  reviewedAt: string;
  reviews: number;
  removed: boolean;
  recent: boolean[]; // max 10
}
```

Helpers in `src/utils/recall.ts`:

- `recordReview` appends the result and keeps `recent.slice(-10)`.
- `isLearned(progress)` returns `progress.recent.length >= 10 && correctCount >= 8`.
- `learnedCount` is derived from `recent`, not from `strength`.

Newly created progress records (import, removal, restore) start with `recent: []`.

### Compatibility

The persisted/backup schema stays version 3. `recent` is additive:

- Hydration normalises missing or malformed `recent` to `[]` and truncates to the last 10.
- Backup restore accepts progress without `recent` and normalises it to `[]`.
- Existing words therefore stay in learning until they are answered 10 more times. Their `strength` and review history are preserved.

## Selection algorithm

In `src/utils/session.ts`, group eligible, non-removed words by normalised Hungarian form as today. For each group:

- **fresh:** no member has a progress record with `reviews > 0`.
- **active:** at least one member has `reviews > 0`, is not removed, and is not learned.
- **learned:** every reviewed member is learned.

Count active groups once, before selection.

```
availableSlots = max(0, MAX_ACTIVE_WORDS - activeGroupCount)
newCount       = min(3, availableSlots, fresh.length)
reviewCount    = min(reviews.length, 10 - newCount)
sessionSize    = newCount + reviewCount
```

Keep the existing priority for reviews (not reviewed in the last 6 hours first, then lowest estimated recall, then random) and the existing interleaving so new words are spread through the session. When `newCount` is 0, the session is reviews only. Topic filtering applies to the chosen pool but the 36 limit is global.

## UI

Home shows a small `Learning <active> / 36` line. The count uses the same group logic as selection, so it reflects what the algorithm will do. Add the label to `en`, `es`, and `sk` locale files.

## Tests

- `recall`: window appends, truncates at 10, graduation at 8/10, a later miss re-opens learning.
- `session`: introduces at most 3 new words; stops introducing at 36 active; reduces session length instead of padding with new words; learned words still appear as reviews; removed words do not count as active; duplicate Hungarian forms count once.
- `learning.slice` / hydration: new records start with `recent: []`; legacy progress without `recent` is normalised.
- `backup.service`: v3 backup without `recent` restores; with `recent` round-trips.
- `Home`: the learning counter renders and updates.

## Out of scope

- Changing the 10-question session size.
- Changing the spaced-repetition constants or mastery percentage shown elsewhere.
- Per-topic caps.
