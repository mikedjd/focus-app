import type { BrainDumpItem, FrictionHistory, Goal, Habit, Phase, ResumeState, Task } from '../types';

export const phases: Phase[] = [
  {
    id: 'deep',
    label: 'Deep',
    window: '8:30-11:30',
    note: 'deep work',
  },
  {
    id: 'admin',
    label: 'Body & admin',
    window: '12:30-3:00',
    note: 'admin',
  },
  {
    id: 'creative',
    label: 'Creative',
    window: '3:30-5:30',
    note: 'creative',
  },
  {
    id: 'review',
    label: 'Review & Plan',
    window: '5:30-6:00',
    note: 'planning',
  },
];

export const tasks: Task[] = [];

export const goal: Goal = {
  id: 'goal-empty',
  title: '',
  target: '',
  startedAt: '',
  harvestBy: '',
  sownDaysAgo: 0,
  whyQuote: '',
  practicalReason: '',
  emotionalReason: '',
  costOfDrift: '',
  milestones: [],
  xpTotal: 0,
  xpTarget: 300,
  buildHealth: 100,
  buildStage: 1,
};

export const frictionHistory: FrictionHistory = [];

export const brainDumpItems: BrainDumpItem[] = [];

export const habits: Habit[] = [];

export const resumeState: ResumeState | null = null;
