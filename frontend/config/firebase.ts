import { initializeApp, getApps, getApp } from 'firebase/app';
// getReactNativePersistence ships in firebase's React Native build (resolved by Metro
// at runtime) but is missing from the bundled TS types in firebase v12.
// @ts-expect-error - missing from firebase/auth types, present in the RN entry
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: 'AIzaSyAhbJqzeI0vYBVznahVRWavdcTb8yn5sCk',
  authDomain: 'vocaflow-d1976.firebaseapp.com',
  projectId: 'vocaflow-d1976',
  storageBucket: 'vocaflow-d1976.firebasestorage.app',
  messagingSenderId: '708935286247',
  appId: '1:708935286247:web:547497d14d1954145ad142',
};

const isNew = !getApps().length;
const app = isNew ? initializeApp(firebaseConfig) : getApp();

// initializeAuth (with AsyncStorage persistence) must only be called once,
// on the first initialization. After that, getAuth() returns the same instance.
const auth = (Platform.OS !== 'web' && isNew)
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : getAuth(app);

export { app, auth };
