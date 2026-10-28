import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ title, onPress, variant = 'primary', loading = false, disabled = false, style }: ButtonProps) {
  const bgStyles = {
    primary: '#1d493d',
    secondary: '#0284c7',
    danger: '#dc2626',
    outline: 'transparent',
  }[variant];

  const textColors = {
    primary: '#ffffff',
    secondary: '#ffffff',
    danger: '#ffffff',
    outline: '#1d493d',
  }[variant];

  return (
    <Pressable
      style={[
        styles.button,
        { backgroundColor: bgStyles },
        variant === 'outline' && styles.outlineBorder,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={textColors} />
      ) : (
        <Text style={[styles.text, { color: textColors }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  outlineBorder: {
    borderWidth: 1.5,
    borderColor: '#1d493d',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 15,
    fontWeight: '700',
  },
});
