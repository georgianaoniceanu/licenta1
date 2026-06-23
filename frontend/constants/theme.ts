import { Platform } from 'react-native';

const VocaFlowTheme = {
  light: {
    // VocaFlow dark palette — two accent colors: teal + purple
    text:           '#F0F6FF',                   // white text
    background:     '#060D1A',                   // deep navy
    tint:           '#0FBA9A',                   // teal (primary)
    tintLight:      'rgba(15,186,154,0.12)',      // subtle teal bg
    accent:         '#8B5CF6',                   // purple (secondary)
    card:           '#0F1B2D',                   // dark card
    border:         'rgba(255,255,255,0.08)',     // subtle border
    borderSoft:     'rgba(255,255,255,0.04)',     // softer divider
    surface:        '#0F1B2D',                   // same as card
    textSecondary:  '#94A3B8',                   // muted
    textLight:      '#475569',                   // dimmer
    success:        '#0FBA9A',                   // teal
    warning:        '#8B5CF6',                   // purple
    danger:         '#EF4444',
    error:          '#EF4444',
    shadow:         '#000000',
    gradient:       ['#8B5CF6', '#0FBA9A'],
    accentGradient: ['#8B5CF6', '#8B5CF6'],
  },
  dark: {
    text: '#F7F9FC',
    background: '#0D0D0D',
    tint: '#0FBA9A',
    accent: '#8B5CF6',
    card: '#1A1A1A',
    border: '#2D2D2D',
    surface: '#1A1A1A', // Same as card
    textSecondary: '#D1D5DB', // Light gray for secondary text
    textLight: '#9CA3AF', // Lighter gray
    success: '#0FBA9A',
    warning: '#8B5CF6',
    danger: '#EF4444',
    error: '#EF4444', // Alias for danger
    shadow: '#000000',
    gradient: ['#0FBA9A', '#0AA088'],
    accentGradient: ['#8B5CF6', '#8B5CF6'],
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

/**
 * Single source of truth for the app's (dark-only) colour palette.
 * Screens import from here instead of re-declaring hex literals locally.
 */
export const palette = {
  // Surfaces
  bg:         '#060D1A', // app background (deepest navy)
  bgElevated: '#0A1628', // raised surface / inset
  card:       '#0F1B2D', // cards, rows, panels
  border:     'rgba(255,255,255,0.08)',
  borderSoft: 'rgba(255,255,255,0.04)',

  // Text
  text:       '#F0F6FF', // primary
  textMuted:  '#94A3B8', // secondary
  textSubtle: '#64748B', // tertiary
  textFaint:  '#475569', // disabled / hints

  // Brand accents
  teal:       '#0FBA9A', // primary accent
  tealDark:   '#0AA088',
  purple:     '#8B5CF6', // secondary accent
  purpleSoft: '#C4B5FD',

  // Status
  success:    '#0FBA9A',
  warning:    '#F59E0B',
  danger:     '#EF4444',
  info:       '#0EA5E9',
} as const;

export type Palette = typeof palette;

export const Gradients = {
  primary: ['#0FBA9A', '#0AA088'] as readonly string[],
  accent:  ['#8B5CF6', '#8B5CF6'] as readonly string[],
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
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
