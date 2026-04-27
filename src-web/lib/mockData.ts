import type { BrainDumpItem, FrictionHistory, Goal, Phase, ResumeState, Task } from '../types';

export const phases: Phase[] = [
  {
    id: 'deep',
    label: 'Deep',
    window: '8:30-11:30',
    note: 'load-bearing',
  },
  {
    id: 'admin',
    label: 'Body & admin',
    window: '12:30-3:00',
    note: 'site services',
  },
  {
    id: 'creative',
    label: 'Creative',
    window: '3:30-5:30',
    note: 'drafting',
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

export const resumeState: ResumeState | null = null;
