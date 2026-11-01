import { PracticeSession } from '@/slices/learning.slice';

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function summarizeSessions(sessions: PracticeSession[], date: Date) {
  const today = sessions.filter(session => sameDay(new Date(session.completedAt), date));
  return {
    sessions: today.length,
    correct: today.reduce((sum, session) => sum + session.correct, 0),
    total: today.reduce((sum, session) => sum + session.total, 0),
  };
}

export function getWeekProgress(sessions: PracticeSession[], now: Date, goal: number) {
  const monday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - ((now.getDay() + 6) % 7),
    12,
  );
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index, 12);
    const count = summarizeSessions(sessions, date).sessions;
    return {
      date,
      count,
      completed: count >= goal,
      isToday: sameDay(date, now),
      isFuture:
        date.getTime() > new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12).getTime(),
    };
  });
}
