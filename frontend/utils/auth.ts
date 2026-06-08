import { auth } from '@/config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Returns a fresh, valid Firebase ID token.
 * - If currentUser is already available, gets a fresh token (auto-refreshed).
 * - Otherwise, waits up to 5s for onAuthStateChanged to restore the session.
 * - Last resort: returns the cached AsyncStorage token (may be expired).
 */
export async function getFreshToken(): Promise<string | null> {
  // Fast path: user already restored
  if (auth.currentUser) {
    return auth.currentUser.getIdToken(true);
  }

  // Wait for auth state restoration (async with AsyncStorage persistence)
  return new Promise((resolve) => {
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      // Last resort: cached token
      AsyncStorage.getItem('authToken').then(resolve);
    }, 5000);

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribe();
      if (user) {
        user.getIdToken(true).then(resolve).catch(() => resolve(null));
      } else {
        AsyncStorage.getItem('authToken').then(resolve);
      }
    });
  });
}
