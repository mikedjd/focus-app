import { create } from 'zustand';
import {
  brainDumpItems as seedBrainDumpItems,
  frictionHistory as seedFrictionHistory,
  goal,
  phases,
  resumeState as seedResumeState,
  tasks as seedTasks,
} from '../lib/mockData';
import { deterministicTilt, nowCaughtLabel } from '../lib/format';
import type {
  BrainDumpItem,
  FrictionHistory,
  Goal,
  GoalProgress,
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
  currentTaskId: string;
  activePhase: PhaseId;
  sessionState: SessionState;
  activeSession: Session | null;
  frictionHistory: FrictionHistory;
  brainDumpItems: BrainDumpItem[];
  goalProgress: GoalProgress;
  resumeState: ResumeState | null;
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
}

const upNextMilestone = goal.milestones.find((milestone) => milestone.state === 'up-next');

export const useGardenStore = create<GardenState>((set, get) => ({
  phases,
  goal,
  tasks: seedTasks,
  currentTaskId: seedTasks[0].id,
  activePhase: 'deep',
  sessionState: 'idle',
  activeSession: null,
  frictionHistory: seedFrictionHistory,
  brainDumpItems: seedBrainDumpItems,
  goalProgress: {
    currentMilestoneId: upNextMilestone?.id ?? goal.milestones[0].id,
    completedMilestones: goal.milestones.filter((milestone) => milestone.state === 'done').length,
    totalMilestones: goal.milestones.length,
  },
  resumeState: seedResumeState,
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
      resumeState: {
        taskId: state.currentTaskId,
        note: state.tasks.find((task) => task.id === state.currentTaskId)?.lastNote ?? 'Step away on purpose.',
        timestampLabel: 'just now',
      },
    })),
  completeCurrentTask: () => {
    const currentTaskId = get().currentTaskId;
    const todayFloor = Math.max(1, get().frictionHistory.at(-1) ?? 0);

    set((state) => ({
      sessionState: 'complete',
      activeSession: state.activeSession ? { ...state.activeSession, state: 'complete' } : null,
      frictionHistory: [...state.frictionHistory.slice(1), todayFloor + 1],
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
        description: 'Pulled from the heap. Give it one clean next action before tending.',
        why: 'Captured thoughts become useful once they have a small handle.',
        phaseId: state.activePhase,
        cyclesDone: 0,
        totalCycles: 1,
        estimateMinutes: 25,
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
}));
