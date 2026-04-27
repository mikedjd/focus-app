import type { BrainDumpItem, FrictionHistory, Goal, Phase, ResumeState, Task } from '../types';

export const phases: Phase[] = [
  {
    id: 'deep',
    label: 'Deep',
    window: '8:30-11:30',
    note: 'the quiet row',
  },
  {
    id: 'admin',
    label: 'Body & admin',
    window: '12:30-3:00',
    note: 'small stones',
  },
  {
    id: 'creative',
    label: 'Creative',
    window: '3:30-5:30',
    note: 'loose soil',
  },
];

export const tasks: Task[] = [
  {
    id: 'task-ack-timer',
    title: 'Reproduce the dropped-ack case',
    italicTitle: 'then add the retry',
    description:
      "Start from yesterday's socket notes. Stay until the dropped ack is reproduced or exit on purpose.",
    why: 'The retry path is the last sharp edge before realtime sync can go to beta teams.',
    phaseId: 'deep',
    cyclesDone: 1,
    totalCycles: 4,
    estimateMinutes: 50,
    status: 'tending',
    lastNote: "It's the ack timer; resumes before the socket is hot.",
  },
  {
    id: 'task-beta-copy',
    title: 'Tighten the beta invite copy',
    description: 'Make the ask smaller, clearer, and ready for the first five teams.',
    why: 'Good copy reduces back-and-forth before onboarding calls.',
    phaseId: 'deep',
    cyclesDone: 0,
    totalCycles: 2,
    estimateMinutes: 35,
    status: 'idle',
  },
  {
    id: 'task-invoices',
    title: 'Send the two open invoices',
    description: 'One email, two PDFs, no ceremony.',
    why: 'Money admin should not borrow tomorrow morning.',
    phaseId: 'admin',
    cyclesDone: 0,
    totalCycles: 1,
    estimateMinutes: 20,
    status: 'idle',
  },
  {
    id: 'task-walk',
    title: 'Take the long loop before lunch',
    description: 'No headphones for the first ten minutes.',
    why: 'Body first makes the afternoon less crunchy.',
    phaseId: 'admin',
    cyclesDone: 0,
    totalCycles: 1,
    estimateMinutes: 30,
    status: 'idle',
  },
  {
    id: 'task-demo',
    title: 'Sketch the v2 demo beat',
    description: 'Five screens, one story, enough to record.',
    why: 'The demo decides what polish matters.',
    phaseId: 'creative',
    cyclesDone: 0,
    totalCycles: 2,
    estimateMinutes: 45,
    status: 'idle',
  },
];

export const goal: Goal = {
  id: 'goal-loom-v2',
  title: 'Ship the v2 of Loom.',
  target: 'Public beta · 50 paying teams · by July 15.',
  startedAt: 'Apr 9',
  harvestBy: 'Jul 15',
  sownDaysAgo: 18,
  whyQuote: 'I want the product to feel calm enough that a team can trust it with the messy middle.',
  practicalReason: 'A public beta creates a clean feedback loop with teams who will actually pay.',
  emotionalReason: 'Shipping this closes the open tab that has been humming in the background for months.',
  costOfDrift: 'Another month of almost-ready means the product keeps taking rent in your head.',
  milestones: [
    { id: 'm1', label: 'Realtime sync skeleton', date: 'Apr 12', state: 'done' },
    { id: 'm2', label: 'Dropped-ack retry path', date: 'Apr 27', state: 'up-next' },
    { id: 'm3', label: 'Beta invite loop', date: 'May 9', state: 'future' },
    { id: 'm4', label: 'Billing rehearsal', date: 'Jun 3', state: 'future' },
    { id: 'm5', label: 'Public beta garden gate', date: 'Jul 15', state: 'future' },
  ],
};

export const frictionHistory: FrictionHistory = [
  18, 20, 19, 24, 23, 27, 29, 28, 31, 30, 33, 35, 34, 37, 39, 38, 41, 42, 42, 43, 42,
];

export const brainDumpItems: BrainDumpItem[] = [
  {
    id: 'dump-1',
    body: 'Check whether the websocket retry should jitter before the third attempt.',
    caughtAt: 'caught 8:12am',
    tilt: -1.8,
    status: 'pile',
  },
  {
    id: 'dump-2',
    body: 'Ask Nina if beta team billing needs a grace period toggle.',
    caughtAt: 'caught yesterday',
    tilt: 1.2,
    status: 'pile',
  },
  {
    id: 'dump-3',
    body: 'Move the desk plant before it starts blocking the webcam again.',
    caughtAt: 'caught Mon',
    tilt: -0.7,
    status: 'pile',
  },
];

export const resumeState: ResumeState = {
  taskId: 'task-ack-timer',
  note: "It's the ack timer; resumes before the socket is hot.",
  timestampLabel: 'yesterday, 4:18pm',
};
