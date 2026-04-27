import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  brainDumpItems as seedBrainDumpItems,
  frictionHistory as seedFrictionHistory,
  goal,
  habits as seedHabits,
  phases,
  resumeState as seedResumeState,
  tasks as seedTasks,
} from '../lib/mockData';
import { deterministicTilt, nowCaughtLabel } from '../lib/format';
import { todayKey } from '../lib/habits';
import { DEFAULT_TASK_XP, DEFAULT_XP_TARGET, calculateBuildStage } from '../lib/xp';
import type {
  BrainDumpItem,
  FrictionHistory,
  Goal,
  GoalProgress,
  Habit,
  HabitCadence,
  Phase,
  PhaseId,
  ResumeState,
  Session,
  SessionState,
  Task,
} from '../types';

interface GardenState {
  phases: Phase[];
  goal: Goal;
  tasks: Task[];
  currentTaskId: string | null;
  activePhase: PhaseId;
  sessionState: SessionState;
  activeSession: Session | null;
  frictionHistory: FrictionHistory;
  brainDumpItems: BrainDumpItem[];
  goalProgress: GoalProgress;
  resumeState: ResumeState | null;
  habits: Habit[];
  userName: string;
  setUserName: (name: string) => void;
  updateGoal: (input: GoalInput) => void;
  addTask: (input: TaskInput) => void;
  moveTask: (taskId: string, targetPhaseId: PhaseId) => void;
  addHabit: (input: HabitInput) => void;
  completeHabit: (habitId: string) => void;
  pauseHabit: (habitId: string) => void;
  archiveHabit: (habitId: string) => void;
  setActivePhase: (phaseId: PhaseId) => void;
  setCurrentTask: (taskId: string) => void;
  startSession: (taskId?: string) => void;
  pauseSession: () => void;
  stopSession: () => void;
  completeCurrentTask: () => void;
  resumeLastTask: () => void;
  addBrainDumpItem: (body: string) => void;
  convertBrainDumpToTask: (itemId: string) => void;
  parkBrainDumpItem: (itemId: string) => void;
  deleteBrainDumpItem: (itemId: string) => void;
  resetAppData: () => void;
}

export interface GoalInput {
  title: string;
  target: string;
  harvestBy: string;
  whyQuote: string;
  practicalReason: string;
  emotionalReason: string;
  costOfDrift: string;
  xpTarget: number;
}

export interface TaskInput {
  title: string;
  description: string;
  why: string;
  phaseId: PhaseId;
  totalCycles: number;
  estimateMinutes: number;
  xpValue: number;
  scheduledTime?: string;
  date?: string;
}

export interface HabitInput {
  title: string;
  identity: string;
  tinyAction: string;
  anchor: string;
  location: string;
  frictionCut: string;
  celebration: string;
  cadence: HabitCadence;
  targetPerWeek: number;
}

function createGoalProgress(sourceGoal: Goal): GoalProgress {
  const upNextMilestone = sourceGoal.milestones.find((milestone) => milestone.state === 'up-next');

  return {
    currentMilestoneId: upNextMilestone?.id ?? sourceGoal.milestones[0]?.id ?? '',
    completedMilestones: sourceGoal.milestones.filter((milestone) => milestone.state === 'done').length,
    totalMilestones: sourceGoal.milestones.length,
  };
}

const initialGoalProgress = createGoalProgress(goal);

export const useGardenStore = create<GardenState>()(
  persist((set, get) => ({
  phases,
  goal,
  tasks: seedTasks,
  currentTaskId: seedTasks[0]?.id ?? null,
  activePhase: 'deep',
  sessionState: 'idle',
  activeSession: null,
  frictionHistory: seedFrictionHistory,
  brainDumpItems: seedBrainDumpItems,
  goalProgress: initialGoalProgress,
  resumeState: seedResumeState,
  habits: seedHabits,
  userName: '',
  setUserName: (name) => set({ userName: name }),
  updateGoal: (input) => {
    const today = new Date();
    const startedAt = today.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const nextGoal: Goal = {
      id: `goal-${Date.now()}`,
      title: input.title.trim(),
      target: input.target.trim(),
      harvestBy: input.harvestBy.trim(),
      startedAt,
      sownDaysAgo: 0,
      whyQuote: input.whyQuote.trim(),
      practicalReason: input.practicalReason.trim(),
      emotionalReason: input.emotionalReason.trim(),
      costOfDrift: input.costOfDrift.trim(),
      xpTotal: 0,
      xpTarget: input.xpTarget || DEFAULT_XP_TARGET,
      buildHealth: 100,
      buildStage: 1,
      milestones: [
        { id: 'm1', label: 'First structural checkpoint', date: startedAt, state: 'up-next' },
        { id: 'm2', label: 'Second milestone', date: '', state: 'future' },
        { id: 'm3', label: 'Third milestone', date: '', state: 'future' },
        { id: 'm4', label: 'Fourth milestone', date: '', state: 'future' },
        { id: 'm5', label: 'Handoff point', date: input.harvestBy.trim(), state: 'future' },
      ],
    };

    set({
      goal: nextGoal,
      goalProgress: createGoalProgress(nextGoal),
    });
  },
  addTask: (input) => {
    const today = new Date().toISOString().slice(0, 10);
    const task: Task = {
      id: `task-${Date.now()}`,
      title: input.title.trim(),
      description: input.description.trim(),
      why: input.why.trim(),
      phaseId: input.phaseId,
      cyclesDone: 0,
      totalCycles: input.totalCycles,
      estimateMinutes: input.estimateMinutes,
      xpValue: input.xpValue,
      status: 'idle',
      scheduledTime: input.scheduledTime,
      date: input.date ?? today,
    };

    set((state) => ({
      tasks: [...state.tasks, task],
      currentTaskId: state.currentTaskId ?? task.id,
      activePhase: state.currentTaskId ? state.activePhase : task.phaseId,
    }));
  },
  moveTask: (taskId, targetPhaseId) => {
    set((state) => ({
      tasks: state.tasks.map((t) => t.id === taskId ? { ...t, phaseId: targetPhaseId } : t),
    }));
  },
  addHabit: (input) => {
    const habit: Habit = {
      id: `habit-${Date.now()}`,
      title: input.title.trim(),
      identity: input.identity.trim(),
      tinyAction: input.tinyAction.trim(),
      anchor: input.anchor.trim(),
      location: input.location.trim(),
      frictionCut: input.frictionCut.trim(),
      celebration: input.celebration.trim(),
      cadence: input.cadence,
      targetPerWeek: input.targetPerWeek,
      status: 'active',
      createdAt: todayKey(),
      completions: [],
      skips: [],
    };

    set((state) => ({ habits: [habit, ...state.habits] }));
  },
  completeHabit: (habitId) => {
    const today = todayKey();

    set((state) => ({
      habits: state.habits.map((habit) =>
        habit.id === habitId
          ? {
              ...habit,
              completions: habit.completions.includes(today)
                ? habit.completions
                : [...habit.completions, today],
              skips: habit.skips.filter((day) => day !== today),
            }
          : habit,
      ),
    }));
  },
  pauseHabit: (habitId) =>
    set((state) => ({
      habits: state.habits.map((habit) =>
        habit.id === habitId
          ? { ...habit, status: habit.status === 'paused' ? 'active' : 'paused' }
          : habit,
      ),
    })),
  archiveHabit: (habitId) =>
    set((state) => ({
      habits: state.habits.map((habit) =>
        habit.id === habitId ? { ...habit, status: 'archived' } : habit,
      ),
    })),
  setActivePhase: (phaseId) => set({ activePhase: phaseId }),
  setCurrentTask: (taskId) => {
    const task = get().tasks.find((candidate) => candidate.id === taskId);
    if (!task) return;

    set({
      currentTaskId: taskId,
      activePhase: task.phaseId,
    });
  },
  startSession: (taskId) => {
    const selectedTaskId = taskId ?? get().currentTaskId;
    if (!selectedTaskId) return;

    const task = get().tasks.find((candidate) => candidate.id === selectedTaskId);
    if (!task) return;

    set({
      currentTaskId: selectedTaskId,
      activePhase: task.phaseId,
      sessionState: 'running',
      resumeState: null,
      activeSession: {
        id: `session-${Date.now()}`,
        taskId: selectedTaskId,
        startedAt: new Date().toISOString(),
        elapsedSeconds: task.cyclesDone * 25 * 60,
        cycleIndex: Math.min(task.cyclesDone + 1, task.totalCycles),
        totalCycles: task.totalCycles,
        state: 'running',
      },
      tasks: get().tasks.map((candidate) =>
        candidate.id === selectedTaskId
          ? { ...candidate, status: 'tending' }
          : candidate.status === 'tending'
            ? { ...candidate, status: 'idle' }
            : candidate,
      ),
    });
  },
  pauseSession: () =>
    set((state) => ({
      sessionState: state.activeSession ? 'paused' : state.sessionState,
      activeSession: state.activeSession ? { ...state.activeSession, state: 'paused' } : null,
    })),
  stopSession: () =>
    set((state) => ({
      sessionState: 'idle',
      activeSession: null,
      resumeState: state.currentTaskId ? {
        taskId: state.currentTaskId,
        note: state.tasks.find((task) => task.id === state.currentTaskId)?.lastNote ?? 'Paused with context.',
        timestampLabel: 'just now',
      } : null,
    })),
  completeCurrentTask: () => {
    const currentTaskId = get().currentTaskId;
    if (!currentTaskId) return;

    const completedTask = get().tasks.find((task) => task.id === currentTaskId);
    if (!completedTask) return;

    const todayFloor = Math.max(1, get().frictionHistory.at(-1) ?? 0);

    set((state) => ({
      sessionState: 'complete',
      activeSession: state.activeSession ? { ...state.activeSession, state: 'complete' } : null,
      frictionHistory: [...state.frictionHistory.slice(1), todayFloor + 1],
      goal: {
        ...state.goal,
        xpTotal: (state.goal.xpTotal ?? 0) + (completedTask.xpValue ?? DEFAULT_TASK_XP),
        xpTarget: state.goal.xpTarget ?? DEFAULT_XP_TARGET,
        buildHealth: Math.min(100, (state.goal.buildHealth ?? 100) + 1),
        buildStage: calculateBuildStage(
          (state.goal.xpTotal ?? 0) + (completedTask.xpValue ?? DEFAULT_TASK_XP),
          state.goal.xpTarget ?? DEFAULT_XP_TARGET,
        ),
      },
      tasks: state.tasks.map((task) =>
        task.id === currentTaskId
          ? { ...task, status: 'done', cyclesDone: task.totalCycles }
          : task,
      ),
    }));
  },
  resumeLastTask: () => {
    const taskId = get().resumeState?.taskId;
    if (taskId) {
      get().startSession(taskId);
    }
  },
  addBrainDumpItem: (body) => {
    const trimmed = body.trim();
    if (!trimmed) return;

    const id = `dump-${Date.now()}`;
    const item: BrainDumpItem = {
      id,
      body: trimmed,
      caughtAt: nowCaughtLabel(),
      tilt: deterministicTilt(id + trimmed),
      status: 'pile',
    };

    set((state) => ({ brainDumpItems: [item, ...state.brainDumpItems] }));
  },
  convertBrainDumpToTask: (itemId) =>
    set((state) => {
      const item = state.brainDumpItems.find((candidate) => candidate.id === itemId);
      if (!item) return state;

      const task: Task = {
        id: `task-${Date.now()}`,
        title: item.body,
        description: 'Pulled from the drafting table. Give it one clean next action before starting.',
        why: 'Loose thoughts become usable once they have a clear line.',
        phaseId: state.activePhase,
        cyclesDone: 0,
        totalCycles: 1,
        estimateMinutes: 25,
        xpValue: DEFAULT_TASK_XP,
        status: 'idle',
      };

      return {
        tasks: [task, ...state.tasks],
        brainDumpItems: state.brainDumpItems.map((candidate) =>
          candidate.id === itemId ? { ...candidate, status: 'task' } : candidate,
        ),
      };
    }),
  parkBrainDumpItem: (itemId) =>
    set((state) => ({
      brainDumpItems: state.brainDumpItems.map((item) =>
        item.id === itemId ? { ...item, status: 'parked' } : item,
      ),
    })),
  deleteBrainDumpItem: (itemId) =>
    set((state) => ({
      brainDumpItems: state.brainDumpItems.map((item) =>
        item.id === itemId ? { ...item, status: 'deleted' } : item,
      ),
    })),
  resetAppData: () =>
    set({
      goal,
      tasks: [],
      currentTaskId: null,
      activePhase: 'deep',
      sessionState: 'idle',
      activeSession: null,
      frictionHistory: [],
      brainDumpItems: [],
      habits: [],
      goalProgress: initialGoalProgress,
      resumeState: null,
    }),
}), {
  name: 'garden-focus-app-v1',
  partialize: (state) => ({
    goal: state.goal,
    tasks: state.tasks,
    currentTaskId: state.currentTaskId,
    activePhase: state.activePhase,
    frictionHistory: state.frictionHistory,
    brainDumpItems: state.brainDumpItems,
    habits: state.habits,
    goalProgress: state.goalProgress,
    resumeState: state.resumeState,
    userName: state.userName,
  }),
  version: 1,
}));
