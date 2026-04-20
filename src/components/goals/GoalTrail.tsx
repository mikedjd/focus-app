import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  getFocusSessionsForWeek,
  getTasksForDate,
  subscribeToDataChanges,
} from '../../api/client';
import { C } from '../../constants/colors';
import { dbGetMilestonesForGoal } from '../../db';
import { formatDurationCompact, formatShortDate, todayString } from '../../utils/dates';

type GoalTrailEvent = {
  id: string;
  at: number;
  label: string;
  detail: string;
  kind: 'milestone' | 'task' | 'focus' | 'drift';
};

function formatEventDate(timestamp: number): string {
  const date = new Date(timestamp);
  const datePart = formatShortDate(
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  );
  const timePart = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${datePart} · ${timePart}`;
}

function kindLabel(kind: GoalTrailEvent['kind']): string {
  switch (kind) {
    case 'milestone':
      return 'Milestone';
    case 'task':
      return 'Task';
    case 'focus':
      return 'Focus';
    case 'drift':
      return 'Drift';
    default:
      return 'Trail';
  }
}

export function GoalTrail({ goalId }: { goalId: string | null | undefined }) {
  const [events, setEvents] = useState<GoalTrailEvent[]>([]);

  const refresh = useCallback(async () => {
    if (!goalId) {
      setEvents([]);
      return;
    }

    const taskDates: string[] = [];
    const base = new Date();
    for (let offset = 0; offset < 14; offset += 1) {
      const day = new Date(base);
      day.setDate(base.getDate() - offset);
      const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      taskDates.push(iso);
    }

    const taskRows = await Promise.all(taskDates.map((date) => getTasksForDate(date)));
    const tasks = taskRows.flat().filter((task) => task.goalId === goalId);
    const taskIds = new Set(tasks.map((task) => task.id));

    const focusWeeks = new Set<string>();
    for (const task of tasks) {
      const [year, month, day] = task.date.split('-').map(Number);
      const weekDate = new Date(year, month - 1, day);
      const dayOfWeek = weekDate.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      weekDate.setDate(weekDate.getDate() + diff);
      focusWeeks.add(
        `${weekDate.getFullYear()}-${String(weekDate.getMonth() + 1).padStart(2, '0')}-${String(weekDate.getDate()).padStart(2, '0')}`
      );
    }

    const focusRows = await Promise.all([...focusWeeks].map((weekOf) => getFocusSessionsForWeek(weekOf)));
    const focusSessions = focusRows.flat().filter((session) => taskIds.has(session.taskId));
    const milestones = dbGetMilestonesForGoal(goalId);

    const nextEvents: GoalTrailEvent[] = [
      ...milestones
        .filter((milestone) => milestone.completedAt !== null)
        .map((milestone) => ({
          id: `m:${milestone.id}`,
          at: milestone.completedAt!,
          label: milestone.title,
          detail: 'Milestone completed',
          kind: 'milestone' as const,
        })),
      ...tasks
        .filter((task) => task.completedAt !== null)
        .map((task) => ({
          id: `t:${task.id}`,
          at: task.completedAt!,
          label: task.title,
          detail: task.taskType === 'admin' ? 'Admin task finished' : 'Task finished',
          kind: 'task' as const,
        })),
      ...focusSessions
        .filter((session) => session.status !== 'active')
        .map((session) => ({
          id: `f:${session.id}`,
          at: session.endedAt ?? session.startedAt,
          label:
            tasks.find((task) => task.id === session.taskId)?.title ??
            'Focus session',
          detail:
            session.status === 'completed'
              ? `Stayed with it for ${formatDurationCompact(session.durationSeconds)}`
              : `Exited early${session.exitReason ? ` · ${session.exitReason.replaceAll('_', ' ')}` : ''}`,
          kind: session.status === 'completed' ? ('focus' as const) : ('drift' as const),
        })),
    ]
      .sort((a, b) => b.at - a.at)
      .slice(0, 6);

    setEvents(nextEvents);
  }, [goalId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => subscribeToDataChanges(() => void refresh()), [refresh]);

  if (!goalId) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Text style={styles.title}>Goal trail</Text>
        <Text style={styles.subtitle}>Recent proof you have been here before</Text>
      </View>

      {events.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Your trail will build as you finish tasks, complete milestones, and sit through focus sessions.
          </Text>
        </View>
      ) : (
        events.map((event, index) => (
          <View key={event.id} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  event.kind === 'milestone'
                    ? styles.dot_milestone
                    : event.kind === 'task'
                      ? styles.dot_task
                      : event.kind === 'focus'
                        ? styles.dot_focus
                        : styles.dot_drift,
                ]}
              />
              {index !== events.length - 1 ? <View style={styles.line} /> : null}
            </View>
            <View style={styles.body}>
              <View style={styles.rowTop}>
                <Text style={styles.kind}>{kindLabel(event.kind)}</Text>
                <Text style={styles.when}>{formatEventDate(event.at)}</Text>
              </View>
              <Text style={styles.label}>{event.label}</Text>
              <Text style={styles.detail}>{event.detail}</Text>
            </View>
          </View>
        ))
      )}

      <Text style={styles.footer}>Today: {formatShortDate(todayString())}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 4,
  },
  header: {
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: C.text,
  },
  subtitle: {
    fontSize: 13,
    color: C.textSecondary,
    marginTop: 2,
  },
  empty: {
    backgroundColor: C.surfaceSecondary,
    borderRadius: 12,
    padding: 14,
  },
  emptyText: {
    color: C.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 10,
  },
  rail: {
    width: 16,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  dot_milestone: {
    backgroundColor: C.success,
  },
  dot_task: {
    backgroundColor: C.accent,
  },
  dot_focus: {
    backgroundColor: '#0B8F62',
  },
  dot_drift: {
    backgroundColor: '#D9480F',
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: C.border,
    marginTop: 4,
  },
  body: {
    flex: 1,
    backgroundColor: C.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  kind: {
    color: C.accent,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  when: {
    color: C.textMuted,
    fontSize: 11,
  },
  label: {
    color: C.text,
    fontSize: 14,
    fontWeight: '600',
  },
  detail: {
    color: C.textSecondary,
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
  footer: {
    marginTop: 4,
    color: C.textMuted,
    fontSize: 11,
  },
});
