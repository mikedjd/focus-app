import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ResumeContext } from '../../types';
import { C } from '../../constants/colors';
import { formatShortDate, isYesterday } from '../../utils/dates';

interface Props {
  resumeContext: ResumeContext;
  onPrimaryAction: (resumeContext: ResumeContext) => void;
  onDismiss: (resumeContext: ResumeContext) => void;
  errorMessage?: string | null;
}

export function ResumeContextBanner({
  resumeContext,
  onPrimaryAction,
  onDismiss,
  errorMessage,
}: Props) {
  const label =
    resumeContext.kind === 'focus-session'
      ? resumeContext.sessionStatus === 'active'
        ? 'Focus session still open'
        : `You exited early${resumeContext.exitReason ? ` · ${formatExitReason(resumeContext.exitReason)}` : ''}`
      : isYesterday(resumeContext.fromDate)
        ? 'Left unfinished yesterday'
        : `Still unfinished from ${formatShortDate(resumeContext.fromDate)}`;

  const actionLabel = resumeContext.kind === 'focus-session' ? 'Resume' : 'Carry forward';

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
            onPress={() => onPrimaryAction(resumeContext)}
            activeOpacity={0.8}
          >
            <Text style={styles.carryButtonText}>{actionLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDismiss(resumeContext)} hitSlop={12}>
            <Text style={styles.dismiss}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    </View>
  );
}

function formatExitReason(reason: NonNullable<Extract<ResumeContext, { kind: 'focus-session' }>['exitReason']>): string {
  switch (reason) {
    case 'distraction':
      return 'distraction';
    case 'task_unclear':
      return 'task unclear';
    case 'too_tired':
      return 'too tired';
    case 'interrupted':
      return 'interrupted';
    case 'avoided_it':
      return 'avoided it';
    case 'switched_task':
      return 'switched task';
    default:
      return reason;
  }
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
