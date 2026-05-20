import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle;
}

const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
}) => {
  const sizeStyles = {
    sm: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, minHeight: 36 },
    md: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, minHeight: 48 },
    lg: { paddingVertical: Spacing.lg, paddingHorizontal: Spacing.xl, minHeight: 56 },
  };

  const fontSizes = {
    sm: { fontSize: 12, fontWeight: '700' as const },
    md: { fontSize: 14, fontWeight: '700' as const },
    lg: { fontSize: 16, fontWeight: '700' as const },
  };

  const getBackgroundColor = () => {
    if (disabled) return Colors.light.border;
    if (variant === 'outline' || variant === 'ghost') return 'transparent';
    if (variant === 'accent') return Colors.light.accent;
    if (variant === 'secondary') return Colors.light.card;
    return Colors.light.tint; // primary
  };

  const getBorderColor = () => {
    if (variant === 'outline') return Colors.light.tint;
    if (variant === 'secondary') return Colors.light.border;
    return 'transparent';
  };

  const getTextColor = () => {
    if (variant === 'ghost' || variant === 'outline') return Colors.light.tint;
    if (variant === 'secondary') return Colors.light.text;
    return '#ffffff';
  };

  const containerStyle: ViewStyle = {
    ...sizeStyles[size],
    borderRadius: BorderRadius.md,
    borderWidth: variant === 'outline' || variant === 'secondary' ? 1.5 : 0,
    borderColor: getBorderColor(),
    backgroundColor: getBackgroundColor(),
    // Soft shadow on solid variants
    ...(variant === 'primary' || variant === 'accent'
      ? {
          shadowColor: variant === 'accent' ? Colors.light.accent : Colors.light.tint,
          shadowOpacity: disabled ? 0 : 0.3,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: disabled ? 0 : 4,
        }
      : {}),
  };

  return (
    <TouchableOpacity
      disabled={disabled || loading}
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.container, containerStyle, style as any]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <>
          {icon && <Text style={styles.icon}>{icon}</Text>}
          <Text style={[styles.text, fontSizes[size], { color: getTextColor() }, textStyle]}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  icon: {
    marginRight: Spacing.sm,
    fontSize: 18,
  },
});

export default Button;
