import { getAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Always returns a fresh Firebase ID token (auto-refreshed, valid 1h).
 * Falls back to the cached AsyncStorage token only if no Firebase user is
 * currently signed in (e.g. during the brief window before onAuthStateChanged).
 */
export async function getFreshToken(): Promise<string | null> {
  const user = getAuth().currentUser;
  if (user) return user.getIdToken();
  return AsyncStorage.getItem('authToken');
}
