/**
 * Local notifications — daily study reminder, SRS review nudge, achievement alerts.
 *
 * All functions are no-ops on web (expo-notifications has no web scheduling) and
 * guard against missing permissions, so callers can fire-and-forget.
 *
 * Wired from the Settings → Notifications toggles. Scheduled notifications persist
 * across app restarts, so we store their ids in AsyncStorage to cancel them later.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// expo-notifications' remote/push features were removed from Expo Go (SDK 53+),
// which logs an error on launch. Treat Expo Go like web: all notification calls
// become no-ops here. They still work in a real development/production build.
const IN_EXPO_GO = Constants.executionEnvironment === 'storeClient';
const DISABLED = Platform.OS === 'web' || IN_EXPO_GO;

// Default times (24h, device-local).
const DAILY_HOUR = 19;
const DAILY_MINUTE = 0;
const REVIEW_HOUR = 10;
const REVIEW_MINUTE = 0;

const DAILY_ID_KEY = 'notif_daily_id';
const REVIEW_ID_KEY = 'notif_review_id';
const ACHIEVEMENTS_KEY = 'notif_achievements_enabled';

let configured = false;

/** Install the foreground handler + Android channel. Call once on app launch. */
export function configureNotifications(): void {
  if (configured || DISABLED) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => {});
  }
}

/** Ask the OS for permission. Returns true if granted. */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (DISABLED) return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return true;
    const { status: asked } = await Notifications.requestPermissionsAsync();
    return asked === 'granted';
  } catch {
    return false;
  }
}

// Daily study reminder

export async function scheduleDailyReminder(
  hour: number = DAILY_HOUR,
  minute: number = DAILY_MINUTE,
): Promise<void> {
  if (DISABLED) return;
  await cancelDailyReminder();
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Keep your streak alive',
        body: 'A few minutes of English practice today keeps you on track.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    await AsyncStorage.setItem(DAILY_ID_KEY, id);
  } catch {
    /* ignore — scheduling unavailable (e.g. Expo Go on some platforms) */
  }
}

export async function cancelDailyReminder(): Promise<void> {
  if (DISABLED) return;
  try {
    const id = await AsyncStorage.getItem(DAILY_ID_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(DAILY_ID_KEY);
    }
  } catch {
    /* ignore */
  }
}

// SRS review reminder

export async function scheduleReviewReminder(
  hour: number = REVIEW_HOUR,
  minute: number = REVIEW_MINUTE,
): Promise<void> {
  if (DISABLED) return;
  await cancelReviewReminder();
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time to review',
        body: 'Some words are due for review — a quick session locks them into memory.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    await AsyncStorage.setItem(REVIEW_ID_KEY, id);
  } catch {
    /* ignore */
  }
}

export async function cancelReviewReminder(): Promise<void> {
  if (DISABLED) return;
  try {
    const id = await AsyncStorage.getItem(REVIEW_ID_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(REVIEW_ID_KEY);
    }
  } catch {
    /* ignore */
  }
}

// Achievement alerts

export async function setAchievementAlertsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(ACHIEVEMENTS_KEY, enabled ? 'true' : 'false');
}

/** Fire an immediate local notification for an unlocked achievement. */
export async function notifyAchievement(title: string, body: string): Promise<void> {
  if (DISABLED) return;
  try {
    const enabled = await AsyncStorage.getItem(ACHIEVEMENTS_KEY);
    if (enabled === 'false') return; // default ON when unset
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null, // deliver now
    });
  } catch {
    /* ignore */
  }
}
