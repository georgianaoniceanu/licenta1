import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useLanguage } from '@/context/Language';
import { tr, type TKey } from '@/constants/translations';
import { palette } from '@/constants/theme';

// Theme
const BG     = palette.bg;
const CARD   = palette.card;
const TEAL   = palette.teal;
const CORAL  = palette.purple;
const TEXT   = palette.text;
const TEXT2  = palette.textMuted;
const BORDER = palette.border;

// Menu definition
type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

const MENU_ITEMS: { key: TKey; route: string; icon: FeatherIconName; color: string }[] = [
  { key: 'dashboard',     route: '/(tabs)',               icon: 'home',        color: TEAL      },
  { key: 'appShowcase',   route: '/(tabs)/home',          icon: 'layers',      color: '#8B5CF6' },
  { key: 'profile',       route: '/(tabs)/profile',       icon: 'user',        color: '#8B5CF6' },
  { key: 'vocabulary',    route: '/(tabs)/vocabulary',    icon: 'book-open',   color: '#8B5CF6' },
  { key: 'accentDna',     route: '/(tabs)/accent',        icon: 'mic',         color: CORAL     },
  { key: 'shadowSpeak',   route: '/(tabs)/shadow',        icon: 'headphones',  color: '#0FBA9A' },
  { key: 'assessment',    route: '/(tabs)/assessment',    icon: 'clipboard',   color: '#8B5CF6' },
  { key: 'practiceHub',   route: '/(tabs)/practice',      icon: 'zap',         color: '#0FBA9A' },
  { key: 'progress',      route: '/(tabs)/progress',      icon: 'trending-up', color: '#8B5CF6' },
  { key: 'examProfile',   route: '/(tabs)/exam-profile',  icon: 'award',       color: '#8B5CF6' },
  { key: 'history',       route: '/(tabs)/history',       icon: 'clock',       color: '#64748B' },
  { key: 'dualDiagnosis', route: '/dual_diagnosis',       icon: 'bar-chart-2', color: TEAL      },
  { key: 'coverageMap',   route: '/(tabs)/coverage-map',  icon: 'map',         color: '#8B5CF6' },
  { key: 'settings',      route: '/(tabs)/settings',      icon: 'settings',    color: '#64748B' },
  { key: 'about',         route: '/modal',                icon: 'info',        color: '#8B5CF6' },
];

// MenuItem
const MenuItem = ({
  label,
  route,
  icon,
  color,
  isActive,
  onClose,
}: {
  label: string;
  route: string;
  icon: FeatherIconName;
  color: string;
  isActive: boolean;
  onClose?: () => void;
}) => {
  const router   = useRouter();
  const pressAnim = useRef(new Animated.Value(1)).current;

  const onPressIn  = () => Animated.spring(pressAnim, { toValue: 0.96, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(pressAnim, { toValue: 1,    useNativeDriver: true }).start();

  const handlePress = () => {
    onClose?.();
    router.navigate(route as any);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={1}
      accessibilityRole="link"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={label}
    >
      <Animated.View
        style={[
          MI.wrap,
          isActive && { backgroundColor: color + '15', borderColor: color + '30' },
          { transform: [{ scale: pressAnim }] },
        ]}
      >
        <View style={[MI.iconBox, { backgroundColor: color + '18' }]}>
          <Feather name={icon} size={17} color={isActive ? color : TEXT2} />
        </View>
        <Text style={[MI.label, isActive && { color: TEXT, fontWeight: '700' }]}>
          {label}
        </Text>
        {isActive && (
          <View style={[MI.activeDot, { backgroundColor: color }]} />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const MI = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginHorizontal: 10,
    borderRadius: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 12,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT2,
    flex: 1,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

// SidebarMenu
interface SidebarMenuProps {
  onClose?: () => void;
}

export default function SidebarMenu({ onClose }: SidebarMenuProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const { lang } = useLanguage();

  const doSignOut = async () => {
    try {
      await signOut(auth);
      await AsyncStorage.multiRemove(['authToken', 'onboardingCompleted']);
      onClose?.();
      router.replace('/login');
    } catch {
      if (Platform.OS === 'web') {
        window.alert('Failed to sign out');
      } else {
        Alert.alert('Error', 'Failed to sign out');
      }
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if ((window as any).confirm(tr('signOutMsg', lang))) {
        doSignOut();
      }
    } else {
      Alert.alert(tr('signOutTitle', lang), tr('signOutMsg', lang), [
        { text: tr('cancel', lang), style: 'cancel' },
        { text: tr('signOut', lang), style: 'destructive', onPress: doSignOut },
      ]);
    }
  };

  const isActive = (route: string) => {
    if (route === '/(tabs)') return pathname === '/' || pathname === '/index';
    return pathname.includes(route.replace('/(tabs)/', '').replace('/', ''));
  };

  return (
    <View style={S.container}>
      {/* Header */}
      <LinearGradient colors={['#0A2540', '#060D1A']} style={S.header}>
        <TouchableOpacity
          style={S.closeBtn}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={tr('close', lang)}
        >
          <Feather name="x" size={18} color={palette.textMuted} />
        </TouchableOpacity>
        <View style={S.logoRow}>
          <LinearGradient colors={[TEAL, '#00C49A']} style={S.logoBubble}>
            <Text style={S.logoV}>V</Text>
          </LinearGradient>
          <View>
            <Text style={S.title}>VocaFlow</Text>
            <Text style={S.subtitle}>{tr('aiLanguageCoach', lang)}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Menu items */}
      <ScrollView style={S.list} showsVerticalScrollIndicator={false}>
        <Text style={S.groupLabel}>{tr('modules', lang)}</Text>
        {MENU_ITEMS.map((item) => (
          <MenuItem
            key={item.route}
            label={tr(item.key, lang)}
            route={item.route}
            icon={item.icon}
            color={item.color}
            isActive={isActive(item.route)}
            onClose={onClose}
          />
        ))}

        {/* Research section */}
        <Text style={[S.groupLabel, { marginTop: 16 }]}>{tr('researchBasis', lang)}</Text>
        <View style={S.researchCard}>
          <Text style={S.researchLine}>CAF Framework — Pallotti (2015)</Text>
          <Text style={S.researchLine}>K-Means Clustering — Goldshtein (2024)</Text>
          <Text style={S.researchLine}>Skill Acquisition — DeKeyser (2025)</Text>
          <Text style={S.researchLine}>Interaction — Long (1983)</Text>
          <Text style={S.researchLine}>SRS — Ebbinghaus / SM-2</Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={S.footer}>
        <TouchableOpacity
          style={S.logoutBtn}
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel={tr('signOut', lang)}
        >
          <Feather name="log-out" size={16} color={palette.purple} />
          <Text style={S.logoutLabel}>{tr('signOut', lang)}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  container: {
    width: 270,
    backgroundColor: BG,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    height: '100%',
  },

  // Header
  header: {
    paddingTop: 52,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeBtnText: {
    fontSize: 18,
    color: TEXT2,
    fontWeight: '700',
    lineHeight: 22,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  logoBubble: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoV: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0D3D30',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: TEXT2,
    marginTop: 1,
  },

  // List
  list: {
    flex: 1,
    paddingTop: 8,
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: TEXT2,
    letterSpacing: 1.5,
    paddingHorizontal: 20,
    paddingBottom: 8,
    paddingTop: 4,
  },

  // Research card
  researchCard: {
    marginHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 5,
    marginBottom: 8,
  },
  researchLine: {
    fontSize: 11,
    color: TEXT2,
    lineHeight: 16,
  },

  // Footer
  footer: {
    paddingHorizontal: 14,
    paddingBottom: 28,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(139,92,246,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.2)',
  },
  logoutIcon: {
    fontSize: 18,
  },
  logoutLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: CORAL,
  },
});
