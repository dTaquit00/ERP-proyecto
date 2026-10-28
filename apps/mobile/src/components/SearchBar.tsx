import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onScanPress?: () => void;
}

export function SearchBar({ value, onChangeText, placeholder = 'Buscar…', onScanPress }: SearchBarProps) {
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        autoCapitalize="none"
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} style={styles.clearButton}>
          <Text style={styles.clearText}>✕</Text>
        </Pressable>
      ) : null}
      {onScanPress ? (
        <Pressable onPress={onScanPress} style={styles.scanButton}>
          <Text style={styles.scanText}>📷</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    marginVertical: 8,
  },
  input: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: '#0f172a',
  },
  clearButton: {
    padding: 6,
  },
  clearText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: 'bold',
  },
  scanButton: {
    padding: 6,
    marginLeft: 6,
    backgroundColor: '#eff6ff',
    borderRadius: 6,
  },
  scanText: {
    fontSize: 16,
  },
});
