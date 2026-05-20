import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { LearnerProfileProvider } from '@/context/LearnerProfile';
import { DarkModeProvider, useDarkMode } from '@/context/DarkMode';
import { LanguageProvider } from '@/context/Language';
import { tickStreak } from '@/utils/streak';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

function AppShell() {
  const { isDark } = useDarkMode();
  const router = useRouter();
  useEffect(() => {
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

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="initial_diagnostic" options={{ headerShown: false }} />
        <Stack.Screen name="dual_diagnosis" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'About VocaFlow', headerShown: true }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <DarkModeProvider>
      <LanguageProvider>
        <LearnerProfileProvider>
          <AppShell />
        </LearnerProfileProvider>
      </LanguageProvider>
    </DarkModeProvider>
  );
}
