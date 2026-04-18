import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from '../../constants/colors';

interface Props {
  taskTitle: string;
  onStartFocus: () => void;
  onDismiss: () => void;
}

/**
 * Compact session-only nudge that appears when tasks exist and none are in focus yet.
 * Shown once per app open; dismissed with ✕ or when the user taps a task directly.
 */
export function NextUpPrompt({ taskTitle, onStartFocus, onDismiss }: Props) {
  return (
    <View style={styles.row}>
      <TouchableOpacity style={styles.main} onPress={onStartFocus} activeOpacity={0.75}>
        <Text style={styles.arrow}>→</Text>
        <Text style={styles.taskTitle} numberOfLines={1}>
          {taskTitle}
        </Text>
        <View style={styles.focusPill}>
          <Text style={styles.focusPillText}>Focus</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.dismiss} onPress={onDismiss} hitSlop={12}>
        <Text style={styles.dismissText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.accentLight,
    borderRadius: 10,
    marginBottom: 14,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 10,
    gap: 8,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  arrow: {
    fontSize: 16,
    color: C.accent,
    fontWeight: '700',
  },
  taskTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: C.text,
  },
  focusPill: {
    backgroundColor: C.accent,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  focusPillText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  dismiss: {
    paddingLeft: 6,
  },
  dismissText: {
    fontSize: 15,
    color: C.textMuted,
  },
});
