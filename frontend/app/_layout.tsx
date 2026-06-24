import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { LearnerProfileProvider } from '@/context/LearnerProfile';
import { LanguageProvider } from '@/context/Language';
import { tickStreak } from '@/utils/streak';
import { configureNotifications } from '@/utils/notifications';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useFonts,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from '@expo-google-fonts/fredoka';

function AppShell() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });
  useEffect(() => {
    // App is dark-only: set up the notification handler once on launch.
    configureNotifications();
    const checkAuth = async () => {
      try {
        tickStreak();
        const token = await AsyncStorage.getItem('authToken');
        if (!token) { router.replace('/login'); return; }

        const onboardingDone = await AsyncStorage.getItem('onboardingCompleted');
        if (onboardingDone !== 'true') { router.replace('/onboarding'); return; }

        const diagnosticDone = await AsyncStorage.getItem('diagnosticCompleted');
        if (diagnosticDone !== 'true') { router.replace('/initial_diagnostic'); return; }

        router.replace('/(tabs)');
      } catch {
        router.replace('/login');
      }
    };
    checkAuth();
  }, [router]);

  // Don't block the whole app on fonts — render immediately and let Fredoka
  // swap in when ready (avoids a blank/unresponsive shell if the web font load
  // stalls). `fontsLoaded` is referenced so the re-render fires on load.
  void fontsLoaded;

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="initial_diagnostic" options={{ headerShown: false }} />
        <Stack.Screen name="dual_diagnosis" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'About VocaFlow', headerShown: true }} />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <LanguageProvider>
      <LearnerProfileProvider>
        <AppShell />
      </LearnerProfileProvider>
    </LanguageProvider>
  );
}
