import { Platform } from 'react-native';

const VocaFlowTheme = {
  light: {
    // VocaFlow brand palette — refined for landing-page consistency
    text: '#0F172A',          // Near-black for high contrast text
    background: '#F8FAFC',    // Clean light gray background
    tint: '#0FBA9A',          // Refined teal (primary actions)
    tintLight: '#ECFDF5',     // Light teal for subtle backgrounds
    accent: '#FF7A59',        // Coral for highlights and tags
    card: '#FFFFFF',          // Card background
    border: '#E5E7EB',        // Subtle border
    borderSoft: '#F1F5F9',    // Even softer divider
    surface: '#FFFFFF',       // Same as card
    textSecondary: '#64748B', // Muted text
    textLight: '#94A3B8',     // Even lighter
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    error: '#EF4444',         // Alias for danger
    shadow: '#0F172A',
    gradient: ['#0FBA9A', '#0AA088'],
    accentGradient: ['#FF7A59', '#FF9A81'],
  },
  dark: {
    text: '#F7F9FC',
    background: '#0D0D0D',
    tint: '#1EE8B5',
    accent: '#FF7A59',
    card: '#1A1A1A',
    border: '#2D2D2D',
    surface: '#1A1A1A', // Same as card
    textSecondary: '#D1D5DB', // Light gray for secondary text
    textLight: '#9CA3AF', // Lighter gray
    success: '#28A745',
    warning: '#FFC107',
    danger: '#DC3545',
    error: '#DC3545', // Alias for danger
    shadow: '#000000',
    gradient: ['#1EE8B5', '#00D4A3'],
    accentGradient: ['#FF7A59', '#FF9A81'],
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    round: 999,
    full: 999,
  },
  typography: {
    h1: {
      fontSize: 36,
      fontWeight: 'bold',
      lineHeight: 44,
      fontFamily: 'System',
    },
    h2: {
      fontSize: 28,
      fontWeight: 'bold',
      lineHeight: 34,
      fontFamily: 'System',
    },
    h3: {
      fontSize: 22,
      fontWeight: '600',
      lineHeight: 28,
      fontFamily: 'System',
    },
    body: {
      fontSize: 16,
      lineHeight: 24,
      fontFamily: 'System',
    },
    caption: {
      fontSize: 12,
      lineHeight: 16,
      fontFamily: 'System',
    },
  },
};

export const Colors = VocaFlowTheme;

export const Gradients = {
  primary: ['#0FBA9A', '#0AA088'] as readonly string[],
  accent:  ['#FF7A59', '#FF9A81'] as readonly string[],
  teal:    ['#0FBA9A', '#0AA088'] as readonly string[],
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  round: 999,
  full: 999, // Alias for round
};

export const Shadows = {
  sm: {
    shadowColor: VocaFlowTheme.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: VocaFlowTheme.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  lg: {
    shadowColor: VocaFlowTheme.light.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
};

export const Typography = {
  h1: {
    fontSize: 36,
    fontWeight: '700' as const,
    lineHeight: 44,
    color: VocaFlowTheme.light.text,
    fontFamily: 'System',
  },
  h2: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
    color: VocaFlowTheme.light.text,
    fontFamily: 'System',
  },
  h3: {
    fontSize: 22,
    fontWeight: '600' as const,
    lineHeight: 28,
    color: VocaFlowTheme.light.text,
    fontFamily: 'System',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: VocaFlowTheme.light.text,
    fontFamily: 'System',
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    color: VocaFlowTheme.light.text,
    opacity: 0.7,
    fontFamily: 'System',
  },
};

export const Animations = {
  fast: 200,
  medium: 400,
  normal: 300, // Standard animation duration
  slow: 600,
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
