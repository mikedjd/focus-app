import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ResumeContext } from '../../types';
import { C } from '../../constants/colors';
import { formatShortDate, isYesterday } from '../../utils/dates';

interface Props {
  resumeContext: ResumeContext;
  onCarryForward: (taskId: string) => void;
  onDismiss: (taskId: string) => void;
  errorMessage?: string | null;
}

export function ResumeContextBanner({
  resumeContext,
  onCarryForward,
  onDismiss,
  errorMessage,
}: Props) {
  const label = isYesterday(resumeContext.fromDate)
    ? 'Left unfinished yesterday'
    : `Still unfinished from ${formatShortDate(resumeContext.fromDate)}`;

  return (
    <View style={styles.wrapper}>
      <View style={styles.banner}>
        <View style={styles.content}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.taskTitle} numberOfLines={2}>
            {resumeContext.taskTitle}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.carryButton}
            onPress={() => onCarryForward(resumeContext.taskId)}
            activeOpacity={0.8}
          >
            <Text style={styles.carryButtonText}>Carry forward</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDismiss(resumeContext.taskId)} hitSlop={12}>
            <Text style={styles.dismiss}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.accentLight,
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: C.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  taskTitle: {
    fontSize: 14,
    color: C.text,
    fontWeight: '500',
  },
  actions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  carryButton: {
    backgroundColor: C.accent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  carryButtonText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  dismiss: {
    fontSize: 16,
    color: C.textMuted,
    paddingLeft: 12,
  },
  errorText: {
    marginTop: 8,
    fontSize: 13,
    color: C.accent,
  },
});
