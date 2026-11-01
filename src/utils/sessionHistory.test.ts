import { getWeekProgress, summarizeSessions } from './sessionHistory';

it('groups sessions by local calendar day and counts correct answers', () => {
  const now = new Date(2026, 9, 31, 12);
  const sessions = [
    {
      id: '1',
      completedAt: new Date(2026, 9, 31, 10).toISOString(),
      topic: '',
      correct: 3,
      total: 4,
    },
  ];
  expect(summarizeSessions(sessions, now)).toEqual({ sessions: 1, correct: 3, total: 4 });
  const week = getWeekProgress(sessions, now, 1);
  expect(week).toHaveLength(7);
  expect(week.find(day => day.isToday)?.completed).toBe(true);
  expect(week.filter(day => day.completed)).toHaveLength(1);
});
