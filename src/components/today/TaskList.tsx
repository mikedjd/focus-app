import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { EmptyState } from '../EmptyState';
import { TaskCard } from '../TaskCard';
import { C } from '../../constants/colors';
import type { DailyTask, Goal } from '../../types';

interface Props {
  tasks: DailyTask[];
  activeGoal: Goal | null;
  doneCount: number;
  canAddMore: boolean;
  onToggleTask: (taskId: string) => void;
  onFocusTask: (taskId: string) => void;
  onDropTask: (taskId: string) => void;
  onPressAddTask: () => void;
  onPressSetGoal: () => void;
}

export function TaskList({
  tasks,
  activeGoal,
  doneCount,
  canAddMore,
  onToggleTask,
  onFocusTask,
  onDropTask,
  onPressAddTask,
  onPressSetGoal,
}: Props) {
  const allDone = tasks.length > 0 && doneCount === tasks.length;

  // No goal — single consolidated empty state
  if (!activeGoal) {
    return (
      <EmptyState
        title="Set a goal to start"
        subtitle="Your goal anchors everything. Set one, then add up to 3 daily tasks."
        action={{ label: 'Set a Goal', onPress: onPressSetGoal }}
      />
    );
  }

  // Find first pending task for "next up" treatment
  const firstPendingId = tasks.find((t) => t.status === 'pending')?.id ?? null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Tasks</Text>
        {tasks.length > 0 ? (
          <Text style={styles.taskCounter}>
            {doneCount}/{tasks.length}
          </Text>
        ) : null}
      </View>

      {allDone ? (
        <View style={styles.allDoneBanner}>
          <Text style={styles.allDoneText}>All {doneCount} done</Text>
        </View>
      ) : null}

      {tasks.length === 0 ? (
        <TouchableOpacity style={styles.firstTaskButton} onPress={onPressAddTask} activeOpacity={0.7}>
          <Text style={styles.firstTaskButtonText}>+ Add your first task</Text>
          <Text style={styles.firstTaskHint}>up to 3 · concrete actions only</Text>
        </TouchableOpacity>
      ) : null}

      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          isNextUp={task.id === firstPendingId}
          onToggle={onToggleTask}
          onFocus={onFocusTask}
          onDrop={onDropTask}
        />
      ))}

      {canAddMore && tasks.length > 0 ? (
        <TouchableOpacity style={styles.addButton} onPress={onPressAddTask} activeOpacity={0.7}>
          <Text style={styles.addButtonText}>+ Add task</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: C.text,
    letterSpacing: -0.3,
  },
  taskCounter: {
    fontSize: 13,
    color: C.textMuted,
    fontWeight: '500',
  },
  allDoneBanner: {
    backgroundColor: C.successLight,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  allDoneText: {
    fontSize: 14,
    color: C.success,
    fontWeight: '600',
    textAlign: 'center',
  },
  firstTaskButton: {
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
  },
  firstTaskButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  firstTaskHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  addButton: {
    backgroundColor: C.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'dashed',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  addButtonText: {
    fontSize: 15,
    color: C.accent,
    fontWeight: '600',
  },
});
