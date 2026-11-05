import { getReminderMinutes } from './reminderSchedule';

it('places reminders outside overnight and daytime quiet intervals', () => {
  expect(getReminderMinutes(0, 1320, 480)).toEqual([]);
  expect(getReminderMinutes(2, 1320, 480)).toEqual([675, 1065]);
  expect(getReminderMinutes(2, 720, 780).every(m => m < 720 || m >= 780)).toBe(true);
  expect(getReminderMinutes(4, 480, 480)).toEqual([]);
  expect(getReminderMinutes(1, 540, 480)).toEqual([]);
  expect(getReminderMinutes(12, 1320, 480).every(minute => minute <= 1260)).toBe(true);
});
