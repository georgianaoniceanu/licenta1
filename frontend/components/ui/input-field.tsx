import React, { useState } from 'react';
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';

interface InputFieldProps extends TextInputProps {
  label?: string;
  placeholder?: string;
  icon?: string;
  error?: string;
  showPassword?: boolean;
  containerStyle?: ViewStyle;
  onPasswordToggle?: (show: boolean) => void;
}

const InputField: React.FC<InputFieldProps> = ({
  label,
  placeholder,
  icon,
  error,
  showPassword = true,
  containerStyle,
  onPasswordToggle,
  secureTextEntry,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isSecure, setIsSecure] = useState(secureTextEntry ?? false);

  const handlePasswordToggle = () => {
    setIsSecure(!isSecure);
    onPasswordToggle?.(!isSecure);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
          error && styles.inputContainerError,
          Shadows.sm,
        ]}
      >
        {icon && <Text style={styles.icon}>{icon}</Text>}

        <TextInput
          {...props}
          placeholder={placeholder}
          placeholderTextColor={Colors.light.textSecondary}
          style={styles.input}
          secureTextEntry={isSecure && secureTextEntry}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          accessibilityLabel={label ?? placeholder}
          accessibilityHint={error}
        />

        {secureTextEntry && (
          <TouchableOpacity
            onPress={handlePasswordToggle}
            style={styles.passwordToggle}
            accessibilityRole="button"
            accessibilityLabel={isSecure ? 'Show password' : 'Hide password'}
            accessibilityState={{ checked: !isSecure }}
          >
            <Feather name={isSecure ? 'eye' : 'eye-off'} size={18} color={Colors.light.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: Spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.md,
    height: 48,
  },
  inputContainerFocused: {
    borderColor: Colors.light.tint,
    backgroundColor: Colors.light.tintLight,
  },
  inputContainerError: {
    borderColor: Colors.light.error,
  },
  icon: {
    fontSize: 18,
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    color: Colors.light.text,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: Spacing.md,
  },
  passwordToggle: {
    padding: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  passwordToggleText: {
    fontSize: 18,
  },
  error: {
    fontSize: 12,
    color: Colors.light.error,
    marginTop: Spacing.sm,
    fontWeight: '500',
  },
});

export default InputField;
