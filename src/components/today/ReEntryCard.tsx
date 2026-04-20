import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from '../../constants/colors';
import { formatShortDate, isYesterday } from '../../utils/dates';
import type { DailyTask, ResumeContext } from '../../types';

interface Props {
  resumeContext: ResumeContext;
  resumeTask: DailyTask | null;
  onPrimaryAction: (resumeContext: ResumeContext) => void;
  onDismiss: (resumeContext: ResumeContext) => void;
  errorMessage?: string | null;
}

function formatExitReason(reason: NonNullable<Extract<ResumeContext, { kind: 'focus-session' }>['exitReason']>): string {
  switch (reason) {
    case 'task_unclear':
      return 'task got fuzzy';
    case 'too_tired':
      return 'energy dropped';
    case 'avoided_it':
      return 'avoidance kicked in';
    case 'interrupted':
      return 'you got interrupted';
    case 'distraction':
      return 'attention drifted';
    case 'switched_task':
      return 'you switched tasks';
    default:
      return reason;
  }
}

export function ReEntryCard({
  resumeContext,
  resumeTask,
  onPrimaryAction,
  onDismiss,
  errorMessage,
}: Props) {
  const title =
    resumeContext.kind === 'focus-session'
      ? resumeContext.sessionStatus === 'active'
        ? 'Your thread is still open'
        : 'Re-entry ready'
      : 'Pick up where you left off';
  const kicker =
    resumeContext.kind === 'focus-session'
      ? resumeContext.sessionStatus === 'active'
        ? 'Focus session still active'
        : `Last exit: ${resumeContext.exitReason ? formatExitReason(resumeContext.exitReason) : 'unfinished'}`
      : isYesterday(resumeContext.fromDate)
        ? 'Left unfinished yesterday'
        : `Still pending from ${formatShortDate(resumeContext.fromDate)}`;
  const actionLabel = resumeContext.kind === 'focus-session' ? 'Resume focus' : 'Carry into today';

  return (
    <View style={styles.wrapper}>
      <Text style={styles.sectionLabel}>RE-ENTRY</Text>
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.topCopy}>
            <Text style={styles.kicker}>{kicker}</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
          <TouchableOpacity onPress={() => onDismiss(resumeContext)} hitSlop={12}>
            <Text style={styles.dismiss}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.taskBlock}>
          <Text style={styles.taskTitle}>{resumeContext.taskTitle}</Text>
          {resumeTask?.nextStep ? (
            <Text style={styles.nextStep}>Next step: {resumeTask.nextStep}</Text>
          ) : (
            <Text style={styles.nextStep}>Open it and take the very next concrete action.</Text>
          )}
        </View>

        <View style={styles.metaRow}>
          {resumeTask?.scheduledWindowStart ? (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>Window {resumeTask.scheduledWindowStart}</Text>
            </View>
          ) : null}
          {resumeTask?.effortLevel ? (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>{resumeTask.effortLevel}</Text>
            </View>
          ) : null}
          {resumeTask?.taskType === 'admin' ? (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>Admin</Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => onPrimaryAction(resumeContext)}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 14,
  },
  sectionLabel: {
    marginBottom: 6,
    fontSize: 10,
    fontWeight: '700',
    color: C.accent,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: C.accentLight,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(59,91,219,0.12)',
  },
  topRow: {
    flexDirection: 'row',
    gap: 8,
  },
  topCopy: {
    flex: 1,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '600',
    color: C.accent,
    marginBottom: 2,
  },
  title: {
    fontSize: 18,
    color: C.text,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  dismiss: {
    color: C.textMuted,
    fontSize: 16,
  },
  taskBlock: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 12,
    padding: 12,
  },
  taskTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  nextStep: {
    color: C.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    marginBottom: 12,
  },
  metaChip: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metaChipText: {
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  errorText: {
    marginTop: 8,
    fontSize: 13,
    color: C.danger,
  },
});
