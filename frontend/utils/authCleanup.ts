import AsyncStorage from '@react-native-async-storage/async-storage';

// AsyncStorage is device-wide, not per-account. On sign-out we purge ONLY caches
// that are safely recoverable from the cloud (or trivially redone), so the next
// account on this device doesn't inherit the previous user's data.
//
// IMPORTANT: we deliberately DO NOT clear the per-module session caches
// (vf_accent_sessions, vf_shadow_sessions, etc.). Accent/Shadow sessions are
// currently stored ONLY on the device, so clearing them here destroyed real
// user data with no cloud backup. They stay until those modules persist to the
// cloud with auth. Cross-account isolation for sessions is handled on the READ
// side (Progress re-hydrates per-account from Firestore).
const ACCOUNT_SCOPED_KEYS = [
  'authToken',
  'onboardingCompleted',
  // Initial-diagnostic cache (caused Dual Diagnosis to show another account's data).
  // Recoverable: the user can re-run the diagnostic; nothing is permanently lost.
  'rawIndicators',
  'baselineDiagnosis',
  'baselineDiagnosisOriginal',
  // Identity leftovers (caused every account to show the demo name "Mihai")
  'userDisplayName',
  'userJob',
];

export async function clearAccountScopedStorage(): Promise<void> {
  try {
    await AsyncStorage.multiRemove(ACCOUNT_SCOPED_KEYS);
  } catch {
    // best-effort; sign-out should never be blocked by a storage hiccup
  }
}
