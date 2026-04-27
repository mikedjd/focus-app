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

export const tasks: Task[] = [
  {
    id: 'starter-set-goal',
    title: 'Set your first goal',
    description: 'Open the Goal screen and write the outcome you want this app to help protect.',
    why: 'A clear goal gives every task somewhere to point.',
    phaseId: 'review',
    cyclesDone: 0,
    totalCycles: 1,
    estimateMinutes: 15,
    xpValue: 5,
    status: 'idle',
    scheduledTime: '08:30',
  },
  {
    id: 'starter-deep-task',
    title: 'Add one Deep task',
    description: 'Choose the most important focus task for the morning deep-work slot.',
    why: 'The day works better when the hard thing has a named place.',
    phaseId: 'deep',
    cyclesDone: 0,
    totalCycles: 1,
    estimateMinutes: 15,
    xpValue: 5,
    status: 'idle',
    scheduledTime: '09:00',
  },
  {
    id: 'starter-admin-task',
    title: 'Add one Body & Admin task',
    description: 'Pick one maintenance task for the midday admin slot.',
    why: 'Admin gets less distracting when it has its own container.',
    phaseId: 'admin',
    cyclesDone: 0,
    totalCycles: 1,
    estimateMinutes: 15,
    xpValue: 0,
    status: 'idle',
    scheduledTime: '12:30',
  },
  {
    id: 'starter-creative-task',
    title: 'Add one Creative task',
    description: 'Place one creative or exploratory task into the afternoon slot.',
    why: 'Shiny ideas are useful when they land in the right window.',
    phaseId: 'creative',
    cyclesDone: 0,
    totalCycles: 1,
    estimateMinutes: 15,
    xpValue: 5,
    status: 'idle',
    scheduledTime: '15:30',
  },
  {
    id: 'starter-review-task',
    title: 'Add one Review & Plan task',
    description: 'Add a small end-of-day planning task so tomorrow starts with less friction.',
    why: 'A short review keeps the backlog from quietly taking over.',
    phaseId: 'review',
    cyclesDone: 0,
    totalCycles: 1,
    estimateMinutes: 15,
    xpValue: 5,
    status: 'idle',
    scheduledTime: '17:30',
  },
];

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

export const habits: Habit[] = [
  {
    id: 'starter-daily-login',
    title: 'Log in to the app daily',
    identity: 'Someone who checks in before the day scatters.',
    tinyAction: "Open the app and look at today's active task",
    anchor: 'After I sit down to start the day',
    location: 'Wherever I start work',
    frictionCut: 'Keep the app bookmarked or pinned',
    celebration: 'Mark it done',
    cadence: 'daily',
    targetPerWeek: 7,
    status: 'active',
    createdAt: '',
    completions: [],
    skips: [],
  },
];

export const resumeState: ResumeState | null = null;
