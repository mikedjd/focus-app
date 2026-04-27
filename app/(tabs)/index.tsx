import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  dismissResumeContext,
  getTaskById,
  isReviewDue,
  refreshResumeContext,
} from '../../src/api/client';
import { AddTaskSheet } from '../../src/components/today/AddTaskSheet';
import { GoalAnchorCard } from '../../src/components/today/GoalAnchorCard';
import { ReEntryCard } from '../../src/components/today/ReEntryCard';
import { TaskList } from '../../src/components/today/TaskList';
import { C } from '../../src/constants/colors';
import { useGoals } from '../../src/hooks/useGoals';
import { useTodayTasks } from '../../src/hooks/useTodayTasks';
import { useGameStats } from '../../src/hooks/useGameStats';
import { useAppStore } from '../../src/store/useAppStore';
import { formatDisplayDate } from '../../src/utils/dates';
import { TIER_XP } from '../../src/types';
import type { DailyRequirement, DailyTask, ResumeContext } from '../../src/types';

const STATUS_LABEL: Record<string, string> = {
  ahead: 'Ahead',
  on_track: 'On track',
  behind: 'Behind',
  decaying: 'Decaying',
};

const STATUS_COLOR: Record<string, string> = {
  ahead: C.success,
  on_track: C.accent,
  behind: '#E67700',
  decaying: C.danger,
};

function isRequirementMet(requirement: DailyRequirement | null | undefined, targetTasks: DailyTask[]): boolean {
  if (!requirement) return false;
  const done = targetTasks.filter((task) => task.status === 'done');
  if (done.length < requirement.tasksRequired) return false;
  if (requirement.minimumTier) {
    return done.some((task) => (task.tier ?? 1) >= requirement.minimumTier!);
  }
  return true;
}

export default function TodayScreen() {
  const router = useRouter();
  const { activeGoal, weeklyFocus, refresh: refreshGoals } = useGoals();
  const {
    tasks,
    addTask,
    carryForwardTask,
    completeTask,
    uncompleteTask,
    dropTask,
    canAddMore,
    refresh: refreshTasks,
  } = useTodayTasks(activeGoal?.id ?? null);
  const { stats: gameStats, refresh: refreshGameStats } = useGameStats(activeGoal?.id ?? null);

  const resumeContext = useAppStore((state) => state.resumeContext);
  const setResumeContext = useAppStore((state) => state.setResumeContext);
  const setReviewDue = useAppStore((state) => state.setReviewDue);

  const [showAddSheet, setShowAddSheet] = useState(false);
  const [resumeTask, setResumeTask] = useState<DailyTask | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [feedbackMessages, setFeedbackMessages] = useState<string[]>([]);

  const refreshScreen = useCallback(() => {
    void refreshGoals();
    void refreshTasks();
    refreshGameStats();
    void (async () => {
      setResumeContext(await refreshResumeContext());
      setReviewDue(await isReviewDue());
    })();
  }, [refreshGameStats, refreshGoals, refreshTasks, setResumeContext, setReviewDue]);

  useFocusEffect(
    useCallback(() => {
      refreshScreen();
    }, [refreshScreen])
  );

  React.useEffect(() => {
    if (!resumeContext) { setResumeTask(null); return; }
    void (async () => {
      setResumeTask(await getTaskById(resumeContext.taskId));
    })();
  }, [resumeContext, tasks]);

  React.useEffect(() => {
    if (feedbackMessages.length === 0) return;
    const timeout = setTimeout(() => setFeedbackMessages([]), 2600);
    return () => clearTimeout(timeout);
  }, [feedbackMessages]);

  const handleToggle = useCallback(
    (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      if (task.status === 'done') { void uncompleteTask(taskId); return; }
      const beforeMet = isRequirementMet(gameStats?.dailyRequirement, tasks);
      const afterTasks = tasks.map((c) =>
        c.id === taskId ? { ...c, status: 'done' as const } : c
      );
      const afterMet = isRequirementMet(gameStats?.dailyRequirement, afterTasks);
      const messages = [`+${TIER_XP[task.tier ?? 2]} XP`];
      if (afterMet && !beforeMet) messages.push('Daily requirement met');
      setFeedbackMessages(messages);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void completeTask(taskId).then(refreshGameStats);
    },
    [completeTask, gameStats?.dailyRequirement, refreshGameStats, tasks, uncompleteTask]
  );

  const handleFocus = useCallback(
    (taskId: string) => { router.push(`/focus?taskId=${taskId}`); },
    [router]
  );

  const handleDrop = useCallback((taskId: string) => { void dropTask(taskId); }, [dropTask]);

  const handleAddTask = useCallback(
    async (input: Parameters<typeof addTask>[0]) => {
      setResumeError(null);
      return addTask(input, weeklyFocus?.id ?? null);
    },
    [addTask, weeklyFocus?.id]
  );

  const handleDismissResume = useCallback(
    (context: ResumeContext) => {
      void (async () => {
        await dismissResumeContext(context);
        setResumeError(null);
        setResumeContext(null);
      })();
    },
    [setResumeContext]
  );

  const handleResumePrimaryAction = useCallback(
    (context: ResumeContext) => {
      void (async () => {
        if (context.kind === 'focus-session') {
          setResumeError(null);
          router.push(`/focus?taskId=${context.taskId}&sessionId=${context.focusSessionId}`);
          return;
        }
        const result = await carryForwardTask(context.taskId);
        if (result.ok) { setResumeError(null); setResumeContext(await refreshResumeContext()); return; }
        if (result.reason === 'task_limit_reached') { setResumeError("Today's 3-task limit is already full."); return; }
        setResumeError('That task could not be carried forward right now.');
      })();
    },
    [carryForwardTask, router, setResumeContext]
  );

  const requirement = gameStats?.dailyRequirement ?? null;
  const xpAvailable = tasks.reduce((sum, task) => sum + TIER_XP[task.tier ?? 2], 0);
  const xpEarned = tasks
    .filter((task) => task.status === 'done')
    .reduce((sum, task) => sum + TIER_XP[task.tier ?? 2], 0);
  const perfStatus = activeGoal?.performanceStatus ?? 'on_track';
  const statusLabel = STATUS_LABEL[perfStatus] ?? 'On track';
  const statusColor = STATUS_COLOR[perfStatus] ?? C.accent;
  const buildHealth = gameStats?.buildHealth ?? activeGoal?.buildHealth ?? 100;
  const currentStreak = gameStats?.currentStreak ?? activeGoal?.currentStreak ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.screenTitle}>Today</Text>
            <Text style={styles.date}>{formatDisplayDate()}</Text>
          </View>
          <View style={[styles.statusPill, { borderColor: statusColor }]}>
            <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        {/* Mission card */}
        <View style={styles.missionCard}>
          <Text style={styles.missionLabel}>Mission</Text>
          <Text style={styles.missionTitle} numberOfLines={2}>
            {activeGoal?.title ?? 'No active goal'}
          </Text>
          {requirement ? (
            <Text style={styles.requirementCopy}>
              {`Phase ${requirement.phase} · ${requirement.phaseName} · ${requirement.minimumCopy}`}
            </Text>
          ) : (
            <Text style={styles.requirementCopy}>Set a goal in the Goal tab to begin.</Text>
          )}

          <View style={styles.metricsRow}>
            <View style={styles.metricCell}>
              <Text style={styles.metricValue}>{xpEarned}</Text>
              <Text style={styles.metricLabel}>XP earned</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricCell}>
              <Text style={styles.metricValue}>{xpAvailable}</Text>
              <Text style={styles.metricLabel}>XP available</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricCell}>
              <Text style={styles.metricValue}>{currentStreak}</Text>
              <Text style={styles.metricLabel}>day streak</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricCell}>
              <Text style={[styles.metricValue, buildHealth < 60 && { color: C.danger }]}>
                {buildHealth}
              </Text>
              <Text style={styles.metricLabel}>health</Text>
            </View>
          </View>
        </View>

        {/* XP feedback strip */}
        {feedbackMessages.length > 0 ? (
          <View style={styles.feedbackStrip}>
            {feedbackMessages.map((message) => (
              <Text key={message} style={styles.feedbackText}>{message}</Text>
            ))}
          </View>
        ) : null}

        {/* Resume context */}
        {resumeContext ? (
          <ReEntryCard
            resumeContext={resumeContext}
            resumeTask={resumeTask}
            onPrimaryAction={handleResumePrimaryAction}
            onDismiss={handleDismissResume}
            errorMessage={resumeError}
          />
        ) : null}

        {/* Goal anchor */}
        <GoalAnchorCard
          activeGoal={activeGoal}
          weeklyFocus={weeklyFocus}
          onPress={() => router.push('/(tabs)/goals')}
        />

        {/* Task list */}
        <TaskList
          title="Tasks"
          tasks={tasks}
          projects={[]}
          doneCount={tasks.filter((t) => t.status === 'done').length}
          canAddMore={canAddMore}
          activeProjectFilter={null}
          emptyStateText={
            activeGoal
              ? 'Add up to 3 tasks for today. Keep each one tied to your mission.'
              : 'Set an active goal first, then add today\'s tasks here.'
          }
          firstAddLabel="+ Add task"
          showAddButton={canAddMore}
          onToggleTask={handleToggle}
          onFocusTask={handleFocus}
          onDropTask={handleDrop}
          onPressAddTask={() => setShowAddSheet(true)}
        />
      </ScrollView>

      <AddTaskSheet
        visible={showAddSheet}
        activeGoalTitle={activeGoal?.title}
        projects={[]}
        selectedProjectId={null}
        initialPhaseId="phase1"
        onClose={() => setShowAddSheet(false)}
        onSubmit={handleAddTask}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 16,
    marginBottom: 16,
    gap: 12,
  },
  headerText: { flex: 1 },
  screenTitle: { fontSize: 28, fontWeight: '700', color: C.text, letterSpacing: -0.5, marginBottom: 2 },
  date: { fontSize: 14, color: C.textSecondary },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  missionCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    marginBottom: 14,
    gap: 6,
  },
  missionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: C.accent,
  },
  missionTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.5,
  },
  requirementCopy: {
    fontSize: 13,
    color: C.textSecondary,
    fontWeight: '500',
    lineHeight: 18,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: C.surfaceSecondary,
    borderRadius: 12,
    padding: 12,
  },
  metricCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: C.border,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: C.text,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  feedbackStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  feedbackText: {
    backgroundColor: C.successLight,
    color: C.success,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    fontSize: 13,
    fontWeight: '800',
  },
});
