import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Switch,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Illustrations } from '@/constants/illustrations';
import { SectionHeader, SectionHero } from '@/components/section-header';
import { signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadDemoProfile, clearDemoData, type DemoPreset } from '@/utils/demoMode';
import { HEALTH_ENDPOINT } from '@/constants/api';
import { useLanguage } from '@/context/Language';
import { tr } from '@/constants/translations';
import {
  requestNotificationPermissions,
  scheduleDailyReminder,
  cancelDailyReminder,
  scheduleReviewReminder,
  cancelReviewReminder,
  setAchievementAlertsEnabled,
} from '@/utils/notifications';

type HealthCheck = { ok: boolean; latency_ms?: number; error?: string; characters_used?: number; characters_limit?: number };
type HealthData = {
  ok: boolean;
  checks: { groq: HealthCheck; elevenlabs: HealthCheck; firebase: HealthCheck };
  cache: { size: number; max_size: number; hits: number; misses: number; hit_rate: number };
  now: string;
};

interface Settings {
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  language: 'en' | 'ro';
  dailyGoal: number;
  sessionDuration: number;
  notifications: {
    dailyReminder: boolean;
    achievementAlerts: boolean;
    reviewReminders: boolean;
  };
  darkMode: boolean;
  soundEnabled: boolean;
  volume: number;
}

const DEFAULT_SETTINGS: Settings = {
  difficulty: 'intermediate',
  language: 'en',
  dailyGoal: 10,
  sessionDuration: 20,
  notifications: {
    dailyReminder: true,
    achievementAlerts: true,
    reviewReminders: true,
  },
  darkMode: true,
  soundEnabled: true,
  volume: 100,
};

function makeTheme(dark: boolean) {
  return {
    bg:       dark ? '#0A1628' : '#060D1A',
    card:     dark ? '#060D1A' : '#0F1B2D',
    border:   dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.08)',
    text:     dark ? '#F0F6FF' : '#0F172A',
    text2:    dark ? '#8BA0B8' : '#64748B',
    active:   '#8B5CF6',
    activeBg: dark ? 'rgba(139,92,246,0.18)' : 'rgba(139,92,246,0.08)',
  };
}

export default function SettingsScreen() {
  const router = useRouter();
  const { lang, setLang } = useLanguage();
  // App is dark-only — always use the canonical dark palette.
  const T = makeTheme(false);

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<
    'general' | 'learning' | 'notifications' | 'account'
  >('general');
  const [health, setHealth]           = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<DemoPreset | null>(null);

  const runHealthCheck = async () => {
    setHealthLoading(true);
    try {
      const r = await fetch(HEALTH_ENDPOINT);
      if (r.ok) setHealth(await r.json());
      else setHealth(null);
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem('app_settings');
      if (stored) {
        const parsed: Settings = JSON.parse(stored);
        setSettings(parsed);
        // Re-sync OS notifications with saved preferences (no permission prompt;
        // silently no-ops if permission was never granted).
        const n = parsed.notifications ?? DEFAULT_SETTINGS.notifications;
        if (n.dailyReminder) scheduleDailyReminder(); else cancelDailyReminder();
        if (n.reviewReminders) scheduleReviewReminder(); else cancelReviewReminder();
        setAchievementAlertsEnabled(n.achievementAlerts ?? true);
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: Settings) => {
    setSaving(true);
    try {
      await AsyncStorage.setItem('app_settings', JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (e) {
      Alert.alert('Error', 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDifficultyChange = (level: 'beginner' | 'intermediate' | 'advanced') => {
    const newSettings = { ...settings, difficulty: level };
    saveSettings(newSettings);
  };

  const handleLanguageChange = (l: 'en' | 'ro') => {
    setLang(l);
    const newSettings = { ...settings, language: l };
    saveSettings(newSettings);
  };

  const handleNotificationToggle = async (key: keyof Settings['notifications']) => {
    const next = !settings.notifications[key];

    // Enabling a scheduled reminder requires OS notification permission.
    if (next && (key === 'dailyReminder' || key === 'reviewReminders' || key === 'achievementAlerts')) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(tr('error', lang), tr('notifPermDenied', lang));
        return;
      }
    }

    const newSettings = {
      ...settings,
      notifications: { ...settings.notifications, [key]: next },
    };
    await saveSettings(newSettings);

    // Reflect the change in the OS scheduler.
    if (key === 'dailyReminder') {
      await (next ? scheduleDailyReminder() : cancelDailyReminder());
    }
    if (key === 'reviewReminders') {
      await (next ? scheduleReviewReminder() : cancelReviewReminder());
    }
    if (key === 'achievementAlerts') {
      await setAchievementAlertsEnabled(next);
    }
  };

  const handleDailyGoalChange = (value: number) => {
    const newSettings = { ...settings, dailyGoal: value };
    saveSettings(newSettings);
  };

  const handleSessionDurationChange = (value: number) => {
    const newSettings = { ...settings, sessionDuration: value };
    saveSettings(newSettings);
  };

  const handleSignOut = () => {
    Alert.alert(tr('signOutTitle', lang), tr('signOutMsg', lang), [
      { text: tr('cancel', lang), style: 'cancel' },
      {
        text: tr('signOut', lang),
        onPress: async () => {
          try {
            await signOut(auth);
            router.replace('/login');
          } catch (e) {
            Alert.alert(tr('error', lang), 'Failed to sign out');
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const handleResetData = () => {
    Alert.alert(
      tr('resetProgress', lang),
      tr('resetProgressMsg', lang),
      [
        { text: tr('cancel', lang), style: 'cancel' },
        {
          text: tr('reset', lang),
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('learner_profile_anonymous');
              router.push('/(tabs)');
            } catch (e) {
              Alert.alert(tr('error', lang), 'Could not reset data');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#8B5CF6" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: T.bg }]}>
      <View style={[styles.header, { borderBottomColor: T.border }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={tr('back', lang)}
        >
          <Feather name="chevron-left" size={18} color="#8B5CF6" />
          <Text style={styles.backText}>{tr('back', lang)}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>{tr('settingsTitle', lang)}</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={[styles.tabsContainer, { borderBottomColor: T.border }]}>
        {(['general', 'learning', 'notifications', 'account'] as const).map((tab) => {
          const tabKey = tab === 'general' ? 'tabGeneral' : tab === 'learning' ? 'tabLearning' : tab === 'notifications' ? 'tabNotifications' : 'tabAccount';
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeSection === tab && styles.tabActive]}
              onPress={() => setActiveSection(tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeSection === tab }}
              accessibilityLabel={tr(tabKey as any, lang)}
            >
              <Feather
                name={tab === 'general' ? 'settings' : tab === 'learning' ? 'book' : tab === 'notifications' ? 'bell' : 'user'}
                size={18}
                color={activeSection === tab ? T.active : T.text2}
              />
              <Text style={[styles.tabLabel, { color: activeSection === tab ? T.active : T.text2 }]}>
                {tr(tabKey as any, lang)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <SectionHero
          art={
            activeSection === 'general'       ? Illustrations.adjustSettings
            : activeSection === 'learning'    ? Illustrations.goals
            : activeSection === 'notifications' ? Illustrations.alarmClock
            :                                   Illustrations.secureLogin
          }
          title={tr(
            (activeSection === 'general' ? 'tabGeneral'
            : activeSection === 'learning' ? 'tabLearning'
            : activeSection === 'notifications' ? 'tabNotifications'
            : 'tabAccount') as any,
            lang,
          )}
          subtitle={tr('settingsTitle', lang)}
        />

        {/* GENERAL SETTINGS */}
        {activeSection === 'general' && (
          <>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: T.text }]}>{tr('difficultyLevel', lang)}</Text>
              {(['beginner', 'intermediate', 'advanced'] as const).map((level) => {
                const active = settings.difficulty === level;
                const labelKey = level === 'beginner' ? 'beginner' : level === 'intermediate' ? 'intermediate' : 'advanced';
                const subKey   = level === 'beginner' ? 'beginnerSub' : level === 'intermediate' ? 'intermediateSub' : 'advancedSub';
                return (
                  <TouchableOpacity
                    key={level}
                    activeOpacity={0.7}
                    style={[styles.optionCard, { backgroundColor: active ? T.activeBg : T.card, borderColor: active ? T.active : T.border }]}
                    onPress={() => handleDifficultyChange(level)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionTitle, { color: active ? T.active : T.text, fontWeight: active ? '700' : '600' }]}>
                        {tr(labelKey as any, lang)}
                      </Text>
                      <Text style={[styles.optionSubtitle, { color: T.text2 }]}>
                        {tr(subKey as any, lang)}
                      </Text>
                    </View>
                    <View style={[styles.radioOuter, { borderColor: active ? T.active : T.border }]}>
                      {active && <View style={[styles.radioInner, { backgroundColor: T.active }]} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: T.text }]}>{tr('language', lang)}</Text>
              <Text style={[styles.optionSubtitle, { color: T.text2, marginBottom: 12 }]}>
                {tr('languageNote', lang)}
              </Text>
              {(['en', 'ro'] as const).map((l) => {
                const active = lang === l;
                return (
                  <TouchableOpacity
                    key={l}
                    activeOpacity={0.7}
                    style={[styles.optionCard, { backgroundColor: active ? T.activeBg : T.card, borderColor: active ? T.active : T.border }]}
                    onPress={() => handleLanguageChange(l)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionTitle, { color: active ? T.active : T.text, fontWeight: active ? '700' : '600' }]}>
                        {l === 'en' ? 'English' : 'Română'}
                      </Text>
                      <Text style={[styles.optionSubtitle, { color: T.text2 }]}>
                        {l === 'en' ? tr('englishInterface', lang) : tr('romanianInterface', lang)}
                      </Text>
                    </View>
                    <View style={[styles.radioOuter, { borderColor: active ? T.active : T.border }]}>
                      {active && <View style={[styles.radioInner, { backgroundColor: T.active }]} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: T.text }]}>{tr('sound', lang)}</Text>
              <View style={[styles.settingRow, { backgroundColor: T.card, borderColor: T.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: T.text }]}>{tr('enableSound', lang)}</Text>
                  <Text style={[styles.settingDescription, { color: T.text2 }]}>{tr('soundDesc', lang)}</Text>
                </View>
                <Switch
                  value={settings.soundEnabled}
                  onValueChange={() => saveSettings({ ...settings, soundEnabled: !settings.soundEnabled })}
                  trackColor={{ false: '#445566', true: '#8B5CF6' }}
                  thumbColor="#fff"
                  accessibilityLabel={tr('enableSound', lang)}
                />
              </View>
            </View>

          </>
        )}

        {/* LEARNING SETTINGS */}
        {activeSection === 'learning' && (
          <>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: T.text }]}>{tr('dailyGoals', lang)}</Text>
              <View style={[styles.settingRow, { backgroundColor: T.card, borderColor: T.border }]}>
                <View>
                  <Text style={[styles.settingLabel, { color: T.text }]}>{tr('wordsPerSession', lang)}</Text>
                  <Text style={[styles.settingDescription, { color: T.text2 }]}>
                    {tr('wordsTarget', lang, { n: settings.dailyGoal })}
                  </Text>
                </View>
              </View>

              <View style={styles.sliderContainer}>
                {[5, 10, 15, 20].map((goal) => (
                  <TouchableOpacity
                    key={goal}
                    style={[
                      styles.sliderOption,
                      settings.dailyGoal === goal && styles.sliderOptionActive,
                    ]}
                    onPress={() => handleDailyGoalChange(goal)}
                  >
                    <Text
                      style={[
                        styles.sliderOptionText,
                        settings.dailyGoal === goal && styles.sliderOptionTextActive,
                      ]}
                    >
                      {goal}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: T.text }]}>{tr('sessionDuration', lang)}</Text>
              <View style={[styles.settingRow, { backgroundColor: T.card, borderColor: T.border }]}>
                <View>
                  <Text style={[styles.settingLabel, { color: T.text }]}>{tr('preferredDuration', lang)}</Text>
                  <Text style={[styles.settingDescription, { color: T.text2 }]}>
                    {tr('minutesPerSession', lang, { n: settings.sessionDuration })}
                  </Text>
                </View>
              </View>

              <View style={styles.sliderContainer}>
                {[10, 20, 30, 45].map((duration) => (
                  <TouchableOpacity
                    key={duration}
                    style={[
                      styles.sliderOption,
                      settings.sessionDuration === duration && styles.sliderOptionActive,
                    ]}
                    onPress={() => handleSessionDurationChange(duration)}
                  >
                    <Text
                      style={[
                        styles.sliderOptionText,
                        settings.sessionDuration === duration &&
                          styles.sliderOptionTextActive,
                      ]}
                    >
                      {duration}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}

        {/* NOTIFICATION SETTINGS */}
        {activeSection === 'notifications' && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: T.text }]}>{tr('inAppReminders', lang)}</Text>
            <Text style={[styles.settingDescription, { color: T.text2, marginBottom: 16 }]}>
              {tr('remindersDesc', lang)}
            </Text>

            <View style={[styles.settingRow, { backgroundColor: T.card, borderColor: T.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: T.text }]}>{tr('dailyReminder', lang)}</Text>
                <Text style={[styles.settingDescription, { color: T.text2 }]}>
                  {tr('dailyReminderDesc', lang)}
                </Text>
              </View>
              <Switch
                value={settings.notifications.dailyReminder}
                onValueChange={() => handleNotificationToggle('dailyReminder')}
                trackColor={{ false: '#445566', true: '#8B5CF6' }}
                thumbColor="#fff"
                accessibilityLabel={tr('dailyReminder', lang)}
              />
            </View>

            <View style={[styles.settingRow, { backgroundColor: T.card, borderColor: T.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: T.text }]}>{tr('achievementAlerts', lang)}</Text>
                <Text style={[styles.settingDescription, { color: T.text2 }]}>
                  {tr('achievementDesc', lang)}
                </Text>
              </View>
              <Switch
                value={settings.notifications.achievementAlerts}
                onValueChange={() => handleNotificationToggle('achievementAlerts')}
                trackColor={{ false: '#445566', true: '#8B5CF6' }}
                thumbColor="#fff"
                accessibilityLabel={tr('achievementAlerts', lang)}
              />
            </View>

            <View style={[styles.settingRow, { backgroundColor: T.card, borderColor: T.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: T.text }]}>{tr('reviewReminders', lang)}</Text>
                <Text style={[styles.settingDescription, { color: T.text2 }]}>
                  {tr('reviewDesc', lang)}
                </Text>
              </View>
              <Switch
                value={settings.notifications.reviewReminders}
                onValueChange={() => handleNotificationToggle('reviewReminders')}
                trackColor={{ false: '#445566', true: '#8B5CF6' }}
                thumbColor="#fff"
                accessibilityLabel={tr('reviewReminders', lang)}
              />
            </View>
          </View>
        )}

        {/* ACCOUNT SETTINGS */}
        {activeSection === 'account' && (
          <>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: T.text }]}>{tr('accountLabel', lang)}</Text>
              <View style={[styles.accountInfo, { backgroundColor: T.card }]}>
                <Text style={[styles.accountLabel, { color: T.text2 }]}>{tr('loggedInAs', lang)}</Text>
                <Text style={[styles.accountEmail, { color: T.text }]}>
                  {auth.currentUser?.email || 'Anonymous'}
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: T.text }]}>{tr('apiStatus', lang)}</Text>
              <Text style={[styles.demoDescription, { marginBottom: 12 }]}>
                {tr('apiStatusDesc', lang)}
              </Text>
              <TouchableOpacity
                style={[styles.healthBtn, healthLoading && { opacity: 0.7 }]}
                onPress={runHealthCheck}
                disabled={healthLoading}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ disabled: healthLoading, busy: healthLoading }}
                accessibilityLabel={tr('runHealthCheck', lang)}
              >
                {healthLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.healthBtnText}>{tr('runHealthCheck', lang)}</Text>}
              </TouchableOpacity>

              {health && (
                <View style={styles.healthCard}>
                  <View style={styles.healthHeaderRow}>
                    <View style={[styles.healthDot, {
                      backgroundColor: health.ok ? '#0FBA9A' : '#EF4444',
                    }]} />
                    <Text style={[styles.healthHeader, {
                      color: health.ok ? '#0FBA9A' : '#EF4444',
                    }]}>
                      {health.ok ? tr('allSystemsOk', lang) : tr('issuesDetected', lang)}
                    </Text>
                  </View>

                  {(['groq', 'elevenlabs', 'firebase'] as const).map(svc => {
                    const c = health.checks[svc];
                    const label = svc === 'groq' ? 'Groq (Whisper + LLaMA)'
                                : svc === 'elevenlabs' ? 'ElevenLabs (TTS)'
                                : 'Firebase (Auth)';
                    return (
                      <View key={svc} style={styles.healthRow}>
                        <View style={[styles.healthDot, {
                          backgroundColor: c.ok ? '#0FBA9A' : '#EF4444',
                        }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.healthSvc}>{label}</Text>
                          <Text style={styles.healthDetail}>
                            {c.ok
                              ? `OK · ${c.latency_ms ?? 0}ms`
                              : `FAIL · ${c.error || 'unknown'}`}
                            {svc === 'elevenlabs' && c.characters_used != null && c.characters_limit != null && (
                              ` · ${c.characters_used}/${c.characters_limit} chars used`
                            )}
                          </Text>
                        </View>
                      </View>
                    );
                  })}

                  <Text style={styles.healthCacheInfo}>
                    Cache: {health.cache.hits} hits / {health.cache.misses} misses
                    ({health.cache.hit_rate}% hit rate) · {health.cache.size}/{health.cache.max_size} entries
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: T.text }]}>{tr('demoDataTitle', lang)}</Text>
              <Text style={[styles.demoDescription, { marginBottom: 12 }]}>
                {tr('demoChoose', lang)}
              </Text>

              {(
                [
                  { preset: 'weak'   as DemoPreset, icon: 'trending-down' as const, color: '#EF4444', label: tr('demoWeakLabel', lang),   range: tr('demoWeakRange', lang)   },
                  { preset: 'medium' as DemoPreset, icon: 'trending-up' as const,   color: '#8B5CF6', label: tr('demoMedLabel', lang),    range: tr('demoMedRange', lang)    },
                  { preset: 'strong' as DemoPreset, icon: 'award' as const,         color: '#8B5CF6', label: tr('demoStrongLabel', lang), range: tr('demoStrongRange', lang) },
                ] as const
              ).map(({ preset, icon, color, label, range }) => {
                const busy = demoLoading === preset;
                return (
                  <TouchableOpacity
                    key={preset}
                    style={[styles.demoProfileCard, { borderColor: color + '50', backgroundColor: busy ? color + '18' : T.card }]}
                    activeOpacity={0.75}
                    disabled={demoLoading !== null}
                    onPress={async () => {
                      setDemoLoading(preset);
                      try {
                        await loadDemoProfile(preset);
                        Alert.alert('Demo', `${label} profile loaded. Open Progress to see results.`);
                      } catch (e: any) {
                        Alert.alert(tr('error', lang), String(e?.message || e));
                      } finally {
                        setDemoLoading(null);
                      }
                    }}
                  >
                    {busy
                      ? <ActivityIndicator size="small" color={color} />
                      : <Feather name={icon} size={20} color={color} />}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.demoProfileLabel, { color }]}>{label}</Text>
                    </View>
                    <View style={[styles.demoRangeBadge, { backgroundColor: color + '18', borderColor: color + '40' }]}>
                      <Text style={[styles.demoRangeText, { color }]}>{range}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={[styles.demoCard, { borderColor: '#94A3B8', marginTop: 10 }]}
                onPress={() => {
                  Alert.alert(
                    tr('clearDemoTitle', lang),
                    tr('clearDemoMsg', lang),
                    [
                      { text: tr('cancel', lang), style: 'cancel' },
                      {
                        text: tr('clear', lang),
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await clearDemoData();
                            Alert.alert('Done', 'Demo data cleared. Go to Home to pick a new profile.');
                          } catch (e: any) {
                            Alert.alert(tr('error', lang), String(e?.message || e));
                          }
                        },
                      },
                    ]
                  );
                }}
              >
                <Text style={[styles.demoTitle, { color: '#475569' }]}>{tr('clearDemo', lang)}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: T.text }]}>{tr('resetProgress', lang)}</Text>

              <TouchableOpacity
                style={styles.dangerCard}
                onPress={handleResetData}
                accessibilityRole="button"
                accessibilityLabel={tr('resetProgressBtn', lang)}
              >
                <View>
                  <Text style={styles.dangerTitle}>{tr('resetProgressBtn', lang)}</Text>
                  <Text style={styles.dangerDescription}>
                    {tr('resetProgressMsg', lang)}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <TouchableOpacity
                style={styles.signOutBtn}
                onPress={handleSignOut}
                accessibilityRole="button"
                accessibilityLabel={tr('signOut', lang)}
              >
                <Text style={styles.signOutText}>{tr('signOut', lang)}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footerText}>
              <Text style={styles.versionText}>VocaFlow v1.0.0</Text>
              <Text style={styles.copyrightText}>© 2026 All rights reserved</Text>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060D1A' },
  cornerArtBL: { position: 'absolute', bottom: 24, left: -26, width: 220, height: 220, opacity: 1, zIndex: 3, elevation: 3, backgroundColor: 'rgba(139,92,246,0.22)', borderTopLeftRadius: 110, borderBottomRightRadius: 110, borderTopRightRadius: 38, borderBottomLeftRadius: 38, pointerEvents: 'none' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 1, paddingVertical: 6, paddingRight: 12 },
  backText: { color: '#8B5CF6', fontSize: 15, fontWeight: '600' },
  headerTitle: { color: '#F0F6FF', fontSize: 18, fontWeight: '700' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 20,
  },
  tab:      { flex: 1, paddingVertical: 12, alignItems: 'center', gap: 4, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:{ borderBottomColor: '#8B5CF6' },
  tabText:  { fontSize: 18 },
  tabLabel: { fontSize: 10, fontWeight: '600' },

  contentContainer: { paddingHorizontal: 20, paddingTop: 20, maxWidth: 900, width: '100%', alignSelf: 'center' },

  section: { marginBottom: 28 },
  sectionTitle: { color: '#F0F6FF', fontSize: 16, fontWeight: '700', marginBottom: 14 },

  optionCard: {
    backgroundColor: '#0F1B2D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionTitle:    { fontSize: 14 },
  optionSubtitle: { fontSize: 12, marginTop: 2 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },

  settingRow: {
    backgroundColor: '#0F1B2D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  settingLabel: { color: '#F0F6FF', fontSize: 14, fontWeight: '600' },
  settingDescription: { color: '#94A3B8', fontSize: 12, marginTop: 2 },

  sliderContainer: { flexDirection: 'row', gap: 10 },
  sliderOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  sliderOptionActive: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
  sliderOptionText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  sliderOptionTextActive: { color: '#fff' },

  accountInfo: { backgroundColor: '#0F1B2D', borderRadius: 12, padding: 16 },
  accountLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  accountEmail: { color: '#94A3B8', fontSize: 14 },

  dangerCard: {
    backgroundColor: 'rgba(127,29,29,0.5)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EF444460',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
  },
  dangerTitle: { color: 'rgba(239,68,68,0.25)', fontSize: 14, fontWeight: '600' },
  dangerDescription: { color: '#EF4444', fontSize: 12, marginTop: 4 },

  demoCard: {
    backgroundColor: '#0F1B2D',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#0FBA9A',
    padding: 14,
  },
  demoTitle:       { color: '#0FBA9A', fontSize: 14, fontWeight: '800' },
  demoDescription: { color: '#94A3B8', fontSize: 12, marginTop: 4, lineHeight: 16 },
  demoProfileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
  },
  demoProfileLabel: { fontSize: 14, fontWeight: '800' },
  demoRangeBadge:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  demoRangeText:    { fontSize: 11, fontWeight: '900' },

  healthBtn: {
    backgroundColor: '#0FBA9A',
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 11, alignItems: 'center',
    shadowColor: '#0FBA9A', shadowOpacity: 0.3, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  healthBtnText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  healthCard: {
    backgroundColor: '#0F1B2D', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    padding: 14, marginTop: 12,
  },
  healthHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  healthHeader: { fontSize: 13, fontWeight: '800' },
  healthRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  healthDot: { width: 10, height: 10, borderRadius: 5 },
  healthSvc: { fontSize: 13, fontWeight: '700', color: '#F0F6FF' },
  healthDetail: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  healthCacheInfo: {
    fontSize: 10, color: '#94A3B8', fontStyle: 'italic',
    textAlign: 'center', marginTop: 10, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },

  signOutBtn: {
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ef4444',
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  signOutText: { color: '#ef4444', fontSize: 14, fontWeight: '700' },

  footerText: { alignItems: 'center', gap: 4, marginTop: 20 },
  versionText: { color: '#94A3B8', fontSize: 12 },
  copyrightText: { color: '#475569', fontSize: 11 },
});
