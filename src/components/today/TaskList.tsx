import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TaskCard } from '../TaskCard';
import { C } from '../../constants/colors';
import type { DailyTask, Project } from '../../types';

interface Props {
  title: string;
  tasks: DailyTask[];
  projects: Project[];
  doneCount: number;
  canAddMore: boolean;
  activeProjectFilter: string | null;
  emptyStateText: string;
  showAddButton?: boolean;
  firstAddLabel?: string;
  onToggleTask: (taskId: string) => void;
  onFocusTask: (taskId: string) => void;
  onDropTask: (taskId: string) => void;
  onPressAddTask: () => void;
}

export function TaskList({
  title,
  tasks,
  projects,
  doneCount,
  canAddMore,
  activeProjectFilter,
  emptyStateText,
  showAddButton = true,
  firstAddLabel = '+ Add task',
  onToggleTask,
  onFocusTask,
  onDropTask,
  onPressAddTask,
}: Props) {
  const visibleTasks = activeProjectFilter
    ? tasks.filter((t) => t.projectId === activeProjectFilter)
    : tasks;

  const allDone = visibleTasks.length > 0 && visibleTasks.every((t) => t.status === 'done');
  const firstPendingId = visibleTasks.find((t) => t.status === 'pending')?.id ?? null;

  // Group tasks by project
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const groups: Array<{ project: Project | null; tasks: DailyTask[] }> = [];

  if (activeProjectFilter) {
    groups.push({ project: projectMap.get(activeProjectFilter) ?? null, tasks: visibleTasks });
  } else if (projects.length > 0) {
    // Group by project, ungrouped at end
    const byProject = new Map<string | null, DailyTask[]>();
    for (const task of visibleTasks) {
      const key = task.projectId ?? null;
      if (!byProject.has(key)) byProject.set(key, []);
      byProject.get(key)!.push(task);
    }
    for (const project of projects) {
      const ptasks = byProject.get(project.id);
      if (ptasks?.length) groups.push({ project, tasks: ptasks });
    }
    const ungrouped = byProject.get(null);
    if (ungrouped?.length) groups.push({ project: null, tasks: ungrouped });
  } else {
    groups.push({ project: null, tasks: visibleTasks });
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {tasks.length > 0 ? (
          <Text style={styles.taskCounter}>{doneCount}/{tasks.length}</Text>
        ) : null}
      </View>

      {allDone ? (
        <View style={styles.allDoneBanner}>
          <Text style={styles.allDoneText}>All {visibleTasks.filter(t => t.status === 'done').length} done</Text>
        </View>
      ) : null}

      {visibleTasks.length === 0 && tasks.length === 0 && showAddButton ? (
        <TouchableOpacity style={styles.firstTaskButton} onPress={onPressAddTask} activeOpacity={0.7}>
          <Text style={styles.firstTaskButtonText}>{firstAddLabel}</Text>
          <Text style={styles.firstTaskHint}>up to 3 · concrete actions only</Text>
        </TouchableOpacity>
      ) : visibleTasks.length === 0 && tasks.length === 0 ? (
        <View style={styles.emptyFilter}>
          <Text style={styles.emptyFilterText}>{emptyStateText}</Text>
        </View>
      ) : visibleTasks.length === 0 ? (
        <View style={styles.emptyFilter}>
          <Text style={styles.emptyFilterText}>No tasks in this project today</Text>
        </View>
      ) : null}

      {groups.map(({ project, tasks: groupTasks }, idx) => (
        <View key={project?.id ?? '__none__'} style={idx > 0 ? styles.groupGap : undefined}>
          {project && groups.length > 1 ? (
            <View style={styles.groupHeader}>
              <View style={[styles.groupDot, { backgroundColor: project.color }]} />
              <Text style={styles.groupName}>{project.name}</Text>
            </View>
          ) : null}
          {groupTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isNextUp={task.id === firstPendingId}
              onToggle={onToggleTask}
              onFocus={onFocusTask}
              onDrop={onDropTask}
            />
          ))}
        </View>
      ))}

      {showAddButton && canAddMore && tasks.length > 0 ? (
        <TouchableOpacity style={styles.addButton} onPress={onPressAddTask} activeOpacity={0.7}>
          <Text style={styles.addButtonText}>+ Add task</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: C.text, letterSpacing: -0.3 },
  taskCounter: { fontSize: 13, color: C.textMuted, fontWeight: '500' },
  allDoneBanner: {
    backgroundColor: C.successLight,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  allDoneText: { fontSize: 14, color: C.success, fontWeight: '600', textAlign: 'center' },
  firstTaskButton: {
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
  },
  firstTaskButtonText: { fontSize: 16, color: '#fff', fontWeight: '600' },
  firstTaskHint: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  emptyFilter: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyFilterText: { fontSize: 14, color: C.textMuted },
  groupGap: { marginTop: 16 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  groupDot: { width: 8, height: 8, borderRadius: 4 },
  groupName: { fontSize: 13, fontWeight: '600', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
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
  addButtonText: { fontSize: 15, color: C.accent, fontWeight: '600' },
});
