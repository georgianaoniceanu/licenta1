import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_STREAK       = 'streak_current';
const KEY_STREAK_BEST  = 'streak_best';
const KEY_LAST_ACTIVE  = 'streak_last_active';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10); // "2026-05-18"
}

export type StreakData = { current: number; best: number };

export async function getStreak(): Promise<StreakData> {
  const [cur, best] = await AsyncStorage.multiGet([KEY_STREAK, KEY_STREAK_BEST]);
  return {
    current: parseInt(cur[1] ?? '0', 10) || 0,
    best:    parseInt(best[1] ?? '0', 10) || 0,
  };
}

/** Call once when the app opens / user lands on home. Returns updated streak. */
export async function tickStreak(): Promise<StreakData> {
  const today = todayStr();
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  const [lastRaw, curRaw, bestRaw] = await AsyncStorage.multiGet([
    KEY_LAST_ACTIVE, KEY_STREAK, KEY_STREAK_BEST,
  ]);

  const last = lastRaw[1];
  let   cur  = parseInt(curRaw[1]  ?? '0', 10) || 0;
  let   best = parseInt(bestRaw[1] ?? '0', 10) || 0;

  if (last === today) {
    return { current: cur, best };
  }

  if (last === yesterday) {
    cur += 1;
  } else {
    cur = 1;
  }

  best = Math.max(best, cur);

  await AsyncStorage.multiSet([
    [KEY_LAST_ACTIVE, today],
    [KEY_STREAK,      String(cur)],
    [KEY_STREAK_BEST, String(best)],
  ]);

  return { current: cur, best };
}

export async function resetStreak(): Promise<void> {
  await AsyncStorage.multiRemove([KEY_STREAK, KEY_STREAK_BEST, KEY_LAST_ACTIVE]);
}
