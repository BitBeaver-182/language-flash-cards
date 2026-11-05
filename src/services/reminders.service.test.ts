import * as Notifications from 'expo-notifications';
import { syncRemindersAsync } from './reminders.service';

jest.mock('expo-notifications', () => ({
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  getPermissionsAsync: jest.fn(async () => ({ granted: false })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: false })),
  cancelScheduledNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
}));

it('reports permission denial without scheduling', async () => {
  expect(await syncRemindersAsync({ count: 2, quietStart: 1320, quietEnd: 480 })).toBe(
    'permission-denied',
  );
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('cancels only owned reminders when disabled or quiet all day', async () => {
  jest
    .mocked(Notifications.getAllScheduledNotificationsAsync)
    .mockResolvedValueOnce([
      { identifier: 'hungarian-recall-0' },
      { identifier: 'other-app-notification' },
    ] as Notifications.NotificationRequest[]);
  expect(await syncRemindersAsync({ count: 2, quietStart: 480, quietEnd: 480 })).toBe('disabled');
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('hungarian-recall-0');
  expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
    'other-app-notification',
  );
});
