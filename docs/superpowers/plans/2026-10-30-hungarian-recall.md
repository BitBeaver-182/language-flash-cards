# Hungarian Recall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an offline Android app for remembering the user's existing Hungarian vocabulary through adaptive, enjoyable practice.

**Architecture:** Bundle curated vocabulary and exercises, store progress and settings locally, and calculate review priority with a deterministic time-decay heuristic. Expo Router screens consume a shared Redux slice and local persistence; a notification service schedules local Android reminders.

**Tech Stack:** Expo SDK 58, React Native, TypeScript, Redux Toolkit, AsyncStorage, Expo Notifications, Jest, React Native Testing Library, Maestro.

**Spec:** `docs/superpowers/specs/2026-10-30-hungarian-recall-design.md`

## Global Constraints

- Node ≥24 and npm ≥11; follow `AGENTS.md`, including theme, routing, service, component and test conventions.
- Android-first; practice, progress and reminders work offline after installation.
- Hungarian targets originate in `vocabulary.csv`; selectable English and Latin American Spanish support.
- No automatic free-form grammar correction, online AI, accounts or new target vocabulary.
- Never assert the estimate is a validated probability or guarantee; unassessed words have no percentage.
- Run `npx expo install expo-notifications` and `npm run dev:doctor` for the notification dependency.
- Commit only if explicitly requested by the user.

## Review Focus

- CSV quoted commas, diacritics and homographs: preserve distinct senses and prevent unsafe questions (Task 1).
- Clock changes or an untouched word: avoid negative elapsed time and fabricated confidence (Task 2).
- Removed words and restoration after restart: never appear in practice while removed (Tasks 3 and 4).
- Overnight or all-day quiet periods and disabled notification permission: never schedule in quiet time or imply reminders are active (Task 5).
- Sparse topics and ambiguous distractors: gracefully fall back to self-rated recall (Task 4).

## File map

- `scripts/build-vocabulary.ts`, `src/data/vocabulary.json`: CSV conversion and curated bundled data.
- `src/data/sentences.json`: source-checked sentence exercises with translations and target IDs.
- `src/types/learning.ts`, `src/utils/recall.ts`, `src/utils/session.ts`: shared contracts and pure learning logic.
- `src/slices/learning.slice.ts`, `src/hooks/useLearningPersistence.ts`: local state, hydration and persistence.
- `src/scenes/home/`, `src/scenes/practice/`, `src/scenes/words/`, `src/scenes/settings/`: product screens; route wrappers in `src/app/`.
- `src/services/reminders.service.ts`, `src/utils/reminderSchedule.ts`: notification integration and pure schedule calculations.
- Adjacent tests and `.maestro/` flows verify each feature.

### Task 1: Build a trustworthy offline vocabulary catalog

**Files:** Create `scripts/build-vocabulary.ts`, `src/data/vocabulary.json`, `src/data/sentences.json`, `src/types/learning.ts`, `scripts/build-vocabulary.test.ts`; modify `src/types/index.ts`, `package.json`.

**Interfaces:** Produce `Word { id: string; hu: string; en: string; es: string; topics: string[]; sourceRows: number[]; eligible: boolean }` and `Sentence { id: string; wordId: string; before: string; after: string; answer: string; en: string; es: string }`. IDs are stable across catalog rebuilds; catalog updates must not reset progress. Expose a `buildVocabulary(csv: string): Word[]` function.

- [ ] Write tests: quoted English `"watch, hour, clock"` remains one field; `ő`, `ű` survive; repeated identical entries coalesce with provenance; `mi` as “what” and “we” remain distinct; uncertain slash alternatives remain ineligible rather than being silently merged. Verify rebuilding produces identical IDs.
- [ ] Run `npm run test -- --runInBand scripts/build-vocabulary.test.ts`; expect failure before implementation.
- [ ] Implement a standards-compliant CSV parser using an SDK-compatible or lightweight dependency if necessary; preserve raw provenance and assign stable IDs. Curate topic aliases and flag uncertain glosses, merged senses, typographical errors and alternatives for review. Do not silently invent corrections. Build the bundled catalog from the CSV, including all reliably distinguishable entries; never use unreviewed ambiguous entries as graded distractors.
- [ ] Create at least five source-checked sentence blanks for existing vocabulary, each with both translations; verify every `wordId` exists, supporting vocabulary occurs in the supplied material, and each blank has an unambiguous answer. Sentence exercises are optional for other words. Run the catalog test and `npm run check-types`; expect pass.

### Task 2: Recall estimate and session selection

**Files:** Create `src/utils/recall.ts`, `src/utils/recall.test.ts`, `src/utils/session.ts`, `src/utils/session.test.ts`; modify `src/types/learning.ts`.

**Interfaces:** Produce `Progress { wordId: string; strength: number; stabilityDays: number; reviewedAt: string; reviews: number; removed: boolean }`; `estimateRecall(progress: Progress | undefined, now: Date): number | null`; `recordReview(progress: Progress | undefined, wordId: string, result: 'correct' | 'incorrect', mode: 'recall' | 'recognition', now: Date): Progress`; `selectWords(words: Word[], progress: Record<string, Progress>, now: Date, topic?: string): Word[]`.

- [ ] Write tests asserting unassessed returns null; a 0.8 strength with 7-day stability produces 80% at review and 40% after seven days, and future `reviewedAt` does not boost above 80%; an incorrect answer reduces estimate; recall success improves it more than recognition success; removed entries never appear; lowest assessed estimates come first and topic filtering works.
- [ ] Run `npm run test -- --runInBand src/utils/recall.test.ts src/utils/session.test.ts`; expect failure.
- [ ] Implement percentage as `round(100 * strength * 2 ** (-max(0, elapsedDays) / stabilityDays))`, clamped 0–100. For first correct use strength 0.6 and stability 1 day; first incorrect 0.2 and 0.5 days. For later correct use current estimated fraction `p`, strength `min(0.95, p + (mode === 'recall' ? 0.25 : 0.12))`, stability `min(90, previous stabilityDays * (mode === 'recall' ? 2 : 1.25))`; incorrect sets strength `max(0.1, p * 0.5)` and stability `max(0.5, previous stabilityDays * 0.5)`. Preserve `removed`, increment reviews, record UTC time.
- [ ] Select at most 10 eligible, nonremoved words: assessed words under 70% first by lowest estimate, then unassessed words, then remaining assessed words by estimate; use stable ID as tie-breaker. Run tests and type check; expect pass.

### Task 3: Persist progress, preferences and removal

**Files:** Create `src/slices/learning.slice.ts`, `src/slices/learning.slice.test.ts`, `src/hooks/useLearningPersistence.ts`; modify `src/slices/index.ts`, `src/utils/store.ts`, `src/providers/Provider.tsx`.

**Interfaces:** Produce `LearningState { progress: Record<string, Progress>; language: 'en' | 'es'; reminders: { count: number; quietStart: number; quietEnd: number } }`; slice actions `reviewRecorded`, `wordRemovalChanged`, `languageChanged`, `remindersChanged`, `hydrated`. Quiet hours are local minutes after midnight; count defaults to 0 and quiet hours to 22:00–08:00.

- [ ] Write tests that removal before first review creates a restorable unassessed record without manufacturing a score, and that review, removal and language preference survive a mocked persistence round trip. A corrupt or missing persisted payload loads safe defaults rather than crashing.
- [ ] Run `npm run test -- --runInBand src/slices/learning.slice.test.ts`; expect failure.
- [ ] Implement a versioned persisted envelope through the existing `useDataPersist` hook; hydrate before allowing edits and persist changes after hydration. Amend the progress type with an explicit unassessed representation so `estimateRecall` returns null for removal-only records. Keep selection, restoration and review consistent with that representation.
- [ ] Run tests and `npm run check-types`; expect pass.

### Task 4: Practice, words and bilingual screens

**Files:** Modify `src/scenes/home/Home.tsx` and existing routing layouts; create `src/scenes/practice/Practice.tsx`, `src/scenes/words/Words.tsx`, `src/scenes/settings/Settings.tsx`, their `index.ts` and adjacent tests, plus route wrappers and `.maestro/recall.yaml`.

**Interfaces:** Screens consume Tasks 1–3. Practice submits `recordReview` results; multiple choice is recognition, and reveal/self-rating is recall. Sentences are recognition if chosen from options. Use explicit English/Spanish copy dictionaries.

- [ ] Write component tests for switching language, starting a session, correct and incorrect feedback, removing a word, restoring it after hydration, and an empty session. Test a topic with fewer than three distinct unambiguous distractors falls back to self-rated recall, and an unavailable sentence or image never blocks practice.
- [ ] Run `npm run test -- --runInBand src/scenes`; expect new tests to fail.
- [ ] Implement home, topic selection, 10-word practice, estimated percentage/Not assessed, searchable active and Removed lists, and language settings. Shuffle eligible exercise types while prioritizing recall; multiple-choice options must be distinct, same-language and non-equivalent. Disable removed words immediately, including any current session queue. Add gentle feedback, accessible controls, theme support, and testIDs.
- [ ] Add `.maestro/recall.yaml`, beginning `runFlow: subflows/launch.yaml`, to switch language, practice, remove and restore a word. Run scene tests, `npm run check-types`, and `npm run lint`; expect pass. On a running Android build execute `npm run e2e:android`.

### Task 5: Offline reminders with quiet hours

**Files:** Create `src/utils/reminderSchedule.ts`, `src/utils/reminderSchedule.test.ts`, `src/services/reminders.service.ts`, `src/services/reminders.service.test.ts`; modify `src/services/index.ts`, settings screen/tests, `app.config.ts` if required by Expo, and `package.json`.

**Interfaces:** Produce `getReminderMinutes(count: number, quietStart: number, quietEnd: number): number[]` and `syncRemindersAsync(settings: LearningState['reminders']): Promise<'disabled' | 'scheduled' | 'permission-denied' | 'error'>`.

- [ ] Write tests for count 0, 22:00–08:00 overnight, 12:00–13:00 daytime, and equal start/end interpreted as all-day quiet; no time may fall in `[start,end)` in local time. Test denied permission, schedule errors, cancel/rebuild on change, and no duplicate reminders. Test settings displays permission denial and scheduling errors.
- [ ] Run targeted reminder tests; expect failure. Install using `npx expo install expo-notifications` and configure Android notification channel per current Expo documentation.
- [ ] Implement 0–12 reminders evenly distributed at midpoints of the allowed local-time window; equal quiet endpoints yield zero reminders with clear UI explanation. Schedule repeating daily local notifications, using only app-owned IDs; cancel old IDs when changed or disabled. Request permission only when enabling, preserve settings on denial, display actionable status, and resync on app foreground/timezone change. Tapping a reminder opens practice; delivery is subject to Android settings.
- [ ] Run targeted tests, `npm run dev:doctor`, `npm run check-types`, `npm run lint`, and `npm run test -- --runInBand`; expect pass. On a physical Android device verify offline delivery, quiet hours, permission denial, opening practice, and rescheduling after changing timezone; record actual results.

## Final verification

- [ ] Test airplane-mode sessions across app restart, language switch, removed-word restoration, and reminders on Android. Confirm accessibility labels and dark/light mode.
- [ ] Check catalog provenance and exercise quality against `material/03-Review-and-verification.md`; report excluded uncertain entries and any manual verification still needed.
