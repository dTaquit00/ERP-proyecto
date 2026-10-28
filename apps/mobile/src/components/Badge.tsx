import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

export function Badge({ label, variant = 'default' }: BadgeProps) {
  const stylesByVariant = {
    success: { bg: '#e6f4ea', text: '#137333' },
    warning: { bg: '#fef7e0', text: '#b06000' },
    danger: { bg: '#fce8e6', text: '#c5221f' },
    info: { bg: '#e8f0fe', text: '#1a73e8' },
    default: { bg: '#f1f3f4', text: '#3c4043' },
  }[variant];

  return (
    <View style={[styles.container, { backgroundColor: stylesByVariant.bg }]}>
      <Text style={[styles.text, { color: stylesByVariant.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
