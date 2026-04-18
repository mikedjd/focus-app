import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { dbDismissResumeContext, dbIsReviewDue, dbRefreshResumeContext } from '../../src/db';
import { AddTaskSheet } from '../../src/components/today/AddTaskSheet';
import { GoalAnchorCard } from '../../src/components/today/GoalAnchorCard';
import { NextUpPrompt } from '../../src/components/today/NextUpPrompt';
import { ResumeContextBanner } from '../../src/components/today/ResumeContextBanner';
import { TaskList } from '../../src/components/today/TaskList';
import { C } from '../../src/constants/colors';
import { useGoals } from '../../src/hooks/useGoals';
import { useTodayTasks } from '../../src/hooks/useTodayTasks';
import { useAppStore } from '../../src/store/useAppStore';
import { formatDisplayDate } from '../../src/utils/dates';

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
    doneCount,
    refresh: refreshTasks,
  } = useTodayTasks(activeGoal?.id ?? null);

  const resumeContext = useAppStore((state) => state.resumeContext);
  const setResumeContext = useAppStore((state) => state.setResumeContext);
  const setReviewDue = useAppStore((state) => state.setReviewDue);

  const [showAddSheet, setShowAddSheet] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  // Session-only: dismissed when user acts on or dismisses the prompt
  const [promptDismissed, setPromptDismissed] = useState(false);

  const refreshScreen = useCallback(() => {
    refreshGoals();
    refreshTasks();
    setResumeContext(dbRefreshResumeContext());
    setReviewDue(dbIsReviewDue());
  }, [refreshGoals, refreshTasks, setResumeContext, setReviewDue]);

  useFocusEffect(
    useCallback(() => {
      refreshScreen();
      // Reset prompt visibility each time the tab comes into focus
      setPromptDismissed(false);
    }, [refreshScreen])
  );

  const handleToggle = useCallback(
    (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      if (task.status === 'done') {
        uncompleteTask(taskId);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      completeTask(taskId);
    },
    [tasks, completeTask, uncompleteTask]
  );

  const handleFocus = useCallback(
    (taskId: string) => {
      setPromptDismissed(true);
      router.push(`/focus?taskId=${taskId}`);
    },
    [router]
  );

  const handleDrop = useCallback(
    (taskId: string) => {
      dropTask(taskId);
    },
    [dropTask]
  );

  const handleAddTask = useCallback(
    (title: string) => {
      setResumeError(null);
      return addTask(title, weeklyFocus?.id ?? null);
    },
    [addTask, weeklyFocus?.id]
  );

  const handleDismissResume = useCallback(
    (taskId: string) => {
      dbDismissResumeContext(taskId);
      setResumeError(null);
      setResumeContext(null);
    },
    [setResumeContext]
  );

  const handleCarryForward = useCallback(
    (taskId: string) => {
      const result = carryForwardTask(taskId);
      if (result.ok) {
        setResumeError(null);
        setResumeContext(dbRefreshResumeContext());
        return;
      }
      if (result.reason === 'task_limit_reached') {
        setResumeError("Today's 3-task limit is already full.");
        return;
      }
      setResumeError('That task could not be carried forward right now.');
    },
    [carryForwardTask, setResumeContext]
  );

  // Show prompt only when: goal set, tasks exist, first task is pending, not dismissed
  const firstPendingTask = tasks.find((t) => t.status === 'pending') ?? null;
  const showNextUpPrompt =
    !!activeGoal &&
    !!firstPendingTask &&
    !promptDismissed &&
    !resumeContext;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Today</Text>
          <Text style={styles.date}>{formatDisplayDate()}</Text>
        </View>

        {resumeContext ? (
          <ResumeContextBanner
            resumeContext={resumeContext}
            onCarryForward={handleCarryForward}
            onDismiss={handleDismissResume}
            errorMessage={resumeError}
          />
        ) : null}

        {showNextUpPrompt ? (
          <NextUpPrompt
            taskTitle={firstPendingTask!.title}
            onStartFocus={() => handleFocus(firstPendingTask!.id)}
            onDismiss={() => setPromptDismissed(true)}
          />
        ) : null}

        <GoalAnchorCard
          activeGoal={activeGoal}
          weeklyFocus={weeklyFocus}
          onPress={() => router.push('/(tabs)/goals')}
        />

        <TaskList
          tasks={tasks}
          activeGoal={activeGoal}
          doneCount={doneCount}
          canAddMore={canAddMore}
          onToggleTask={handleToggle}
          onFocusTask={handleFocus}
          onDropTask={handleDrop}
          onPressAddTask={() => setShowAddSheet(true)}
          onPressSetGoal={() => router.push('/(tabs)/goals')}
        />
      </ScrollView>

      <AddTaskSheet
        visible={showAddSheet}
        activeGoalTitle={activeGoal?.title}
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
  header: { paddingTop: 16, marginBottom: 16 },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: C.text,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  date: { fontSize: 14, color: C.textSecondary },
});
