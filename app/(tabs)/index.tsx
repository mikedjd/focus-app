import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { BrainDumpCard } from '../../src/components/today/BrainDumpCard';
import { GoalAnchorCard } from '../../src/components/today/GoalAnchorCard';
import { NextUpPrompt } from '../../src/components/today/NextUpPrompt';
import { ProjectSidebar } from '../../src/components/today/ProjectSidebar';
import { ReEntryCard } from '../../src/components/today/ReEntryCard';
import { TaskList } from '../../src/components/today/TaskList';
import { STANDALONE_TASKS_GOAL_ID } from '../../src/constants/standaloneTaskGoal';
import { C } from '../../src/constants/colors';
import { useGoals } from '../../src/hooks/useGoals';
import { useBrainDump } from '../../src/hooks/useBrainDump';
import { useInbox } from '../../src/hooks/useInbox';
import { useProjects } from '../../src/hooks/useProjects';
import { useTodayTasks } from '../../src/hooks/useTodayTasks';
import { useAppStore } from '../../src/store/useAppStore';
import { formatDisplayDate } from '../../src/utils/dates';
import type { BrainDumpItem, DailyTask, ResumeContext } from '../../src/types';

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

  const { projects, addProject, removeProject } = useProjects(activeGoal?.id ?? null);
  const { items: brainDumpItems, capture: captureBrainDump, remove: removeBrainDumpItem } = useBrainDump();
  const { pendingCount: inboxCount } = useInbox(activeGoal?.id ?? null);

  const resumeContext = useAppStore((state) => state.resumeContext);
  const setResumeContext = useAppStore((state) => state.setResumeContext);
  const setReviewDue = useAppStore((state) => state.setReviewDue);

  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [activeProjectFilter, setActiveProjectFilter] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [promptDismissed, setPromptDismissed] = useState(false);
  const [resumeTask, setResumeTask] = useState<DailyTask | null>(null);

  const refreshScreen = useCallback(() => {
    void refreshGoals();
    void refreshTasks();
    void (async () => {
      setResumeContext(await refreshResumeContext());
      setReviewDue(await isReviewDue());
    })();
  }, [refreshGoals, refreshTasks, setResumeContext, setReviewDue]);

  useFocusEffect(
    useCallback(() => {
      refreshScreen();
      setPromptDismissed(false);
    }, [refreshScreen])
  );

  React.useEffect(() => {
    if (!resumeContext) {
      setResumeTask(null);
      return;
    }
    void (async () => {
      setResumeTask(await getTaskById(resumeContext.taskId));
    })();
  }, [resumeContext, tasks]);

  const handleToggle = useCallback(
    (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      if (task.status === 'done') { void uncompleteTask(taskId); return; }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void completeTask(taskId);
    },
    [tasks, completeTask, uncompleteTask]
  );

  const handleFocus = useCallback(
    (taskId: string) => { setPromptDismissed(true); router.push(`/focus?taskId=${taskId}`); },
    [router]
  );

  const handleDrop = useCallback((taskId: string) => { void dropTask(taskId); }, [dropTask]);

  const handleAddTask = useCallback(
    async (title: string, nextStep?: string, projectId?: string | null) => {
      setResumeError(null);
      return addTask(title, weeklyFocus?.id ?? null, nextStep, projectId);
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
          setPromptDismissed(true);
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

  const [promoteText, setPromoteText] = useState<string | null>(null);

  const handlePromoteBrainDump = useCallback((item: BrainDumpItem) => {
    setPromoteText(item.text);
    void removeBrainDumpItem(item.id);
    setShowAddSheet(true);
  }, [removeBrainDumpItem]);

  const taskCountByProject = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const task of tasks) {
      if (task.projectId) counts[task.projectId] = (counts[task.projectId] ?? 0) + 1;
    }
    return counts;
  }, [tasks]);

  const mainTasks = useMemo(
    () => tasks.filter((task) => task.goalId !== STANDALONE_TASKS_GOAL_ID && task.taskType === 'goal'),
    [tasks]
  );
  const secondaryTasks = useMemo(
    () => tasks.filter((task) => task.goalId === STANDALONE_TASKS_GOAL_ID || task.taskType !== 'goal'),
    [tasks]
  );
  const firstPendingTask = mainTasks.find((t) => t.status === 'pending') ?? null;
  const showNextUpPrompt = !!activeGoal && !!firstPendingTask && !promptDismissed && !resumeContext;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProjectSidebar
        visible={showSidebar}
        projects={projects}
        selectedProjectId={activeProjectFilter}
        taskCountByProject={taskCountByProject}
        onSelectProject={setActiveProjectFilter}
        onAddProject={(name, color) => void addProject(name, color)}
        onDeleteProject={(id) => {
          void removeProject(id);
          if (activeProjectFilter === id) setActiveProjectFilter(null);
        }}
        onClose={() => setShowSidebar(false)}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => setShowSidebar(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={styles.menuLine} />
            <View style={[styles.menuLine, styles.menuLineMid]} />
            <View style={styles.menuLine} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.screenTitle}>Today</Text>
            <Text style={styles.date}>{formatDisplayDate()}</Text>
          </View>
          {activeProjectFilter ? (
            <TouchableOpacity
              style={styles.filterChip}
              onPress={() => setActiveProjectFilter(null)}
            >
              <Text style={styles.filterChipText}>
                {projects.find((p) => p.id === activeProjectFilter)?.name ?? 'Filter'} ✕
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.inboxChip}
            onPress={() => router.push('/inbox')}
            hitSlop={8}
          >
            <Text style={styles.inboxChipText}>
              Inbox{inboxCount > 0 ? ` (${inboxCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {resumeContext ? (
          <ReEntryCard
            resumeContext={resumeContext}
            resumeTask={resumeTask}
            onPrimaryAction={handleResumePrimaryAction}
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
          title="Main Tasks"
          tasks={mainTasks}
          projects={projects}
          doneCount={mainTasks.filter((task) => task.status === 'done').length}
          canAddMore={false}
          activeProjectFilter={activeProjectFilter}
          emptyStateText={activeGoal ? 'No main tasks queued for this goal yet.' : 'No active goal right now.'}
          showAddButton={false}
          onToggleTask={handleToggle}
          onFocusTask={handleFocus}
          onDropTask={handleDrop}
          onPressAddTask={() => {}}
        />

        <TaskList
          title="Secondary Tasks"
          tasks={secondaryTasks}
          projects={[]}
          doneCount={secondaryTasks.filter((task) => task.status === 'done').length}
          canAddMore={canAddMore}
          activeProjectFilter={null}
          emptyStateText="Life admin and other non-goal tasks go here."
          firstAddLabel="+ Add your first secondary task"
          onToggleTask={handleToggle}
          onFocusTask={handleFocus}
          onDropTask={handleDrop}
          onPressAddTask={() => setShowAddSheet(true)}
        />

        <BrainDumpCard
          items={brainDumpItems}
          onCapture={(text) => void captureBrainDump(text)}
          onDelete={(id) => void removeBrainDumpItem(id)}
          onPromoteToTask={handlePromoteBrainDump}
        />
      </ScrollView>

      <AddTaskSheet
        visible={showAddSheet}
        activeGoalTitle={undefined}
        projects={[]}
        selectedProjectId={null}
        initialTitle={promoteText ?? undefined}
        onClose={() => { setShowAddSheet(false); setPromoteText(null); }}
        onSubmit={(title, nextStep) => handleAddTask(title, null, nextStep, null)}
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
  menuBtn: { paddingTop: 4, gap: 4, justifyContent: 'center' },
  menuLine: { width: 22, height: 2, backgroundColor: C.text, borderRadius: 1 },
  menuLineMid: { width: 16 },
  headerText: { flex: 1 },
  screenTitle: { fontSize: 28, fontWeight: '700', color: C.text, letterSpacing: -0.5, marginBottom: 2 },
  date: { fontSize: 14, color: C.textSecondary },
  inboxChip: {
    backgroundColor: C.surfaceSecondary,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  inboxChipText: {
    color: C.accent,
    fontWeight: '600',
    fontSize: 12,
  },
  filterChip: {
    backgroundColor: C.accentLight,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  filterChipText: { fontSize: 12, color: C.accent, fontWeight: '600' },
});
