import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { LearningState } from '@/slices/learning.slice';
import { getReminderMinutes } from '@/utils/reminderSchedule';

const prefix = 'hungarian-recall-';
type SyncResult = 'disabled' | 'scheduled' | 'permission-denied' | 'error';
let previousSync: Promise<SyncResult> = Promise.resolve('disabled');

export function syncRemindersAsync(settings: LearningState['reminders']): Promise<SyncResult> {
  previousSync = previousSync.then(() => scheduleRemindersAsync(settings));
  return previousSync;
}

async function scheduleRemindersAsync(settings: LearningState['reminders']): Promise<SyncResult> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter(item => item.identifier.startsWith(prefix))
        .map(item => Notifications.cancelScheduledNotificationAsync(item.identifier)),
    );
    const times = getReminderMinutes(settings.count, settings.quietStart, settings.quietEnd);
    if (!times.length) return 'disabled';
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && !(await Notifications.requestPermissionsAsync()).granted)
      return 'permission-denied';
    if (Platform.OS === 'android')
      await Notifications.setNotificationChannelAsync('practice', {
        name: 'Practice reminders',
        // Expo exports this enum at runtime; eslint's namespace resolver misses it.
        // eslint-disable-next-line import/namespace
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    await Promise.all(
      times.map((minute, index) =>
        Notifications.scheduleNotificationAsync({
          identifier: `${prefix}${index}`,
          content: { title: 'A little Hungarian?', body: 'A few words are ready for practice.' },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: Math.floor(minute / 60),
            minute: minute % 60,
            channelId: 'practice',
          },
        }),
      ),
    );
    return 'scheduled';
  } catch {
    return 'error';
  }
}
