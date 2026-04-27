export type PhaseId = 'deep' | 'admin' | 'creative';

export type SessionState = 'idle' | 'running' | 'paused' | 'complete';

export type BrainDumpStatus = 'pile' | 'task' | 'parked' | 'deleted';

export type TaskStatus = 'idle' | 'tending' | 'done' | 'parked';

export interface Phase {
  id: PhaseId;
  label: string;
  window: string;
  note: string;
}

export interface Task {
  id: string;
  title: string;
  italicTitle?: string;
  description: string;
  why: string;
  phaseId: PhaseId;
  cyclesDone: number;
  totalCycles: number;
  estimateMinutes: number;
  status: TaskStatus;
  lastNote?: string;
}

export interface Milestone {
  id: string;
  label: string;
  date: string;
  state: 'done' | 'up-next' | 'future';
}

export type FrictionHistory = number[];

export interface Goal {
  id: string;
  title: string;
  target: string;
  startedAt: string;
  harvestBy: string;
  sownDaysAgo: number;
  whyQuote: string;
  practicalReason: string;
  emotionalReason: string;
  costOfDrift: string;
  milestones: Milestone[];
}

export interface Session {
  id: string;
  taskId: string;
  startedAt: string;
  elapsedSeconds: number;
  cycleIndex: number;
  totalCycles: number;
  state: SessionState;
}

export interface BrainDumpItem {
  id: string;
  body: string;
  caughtAt: string;
  tilt: number;
  status: BrainDumpStatus;
}

export interface ResumeState {
  taskId: string;
  note: string;
  timestampLabel: string;
}

export interface GoalProgress {
  currentMilestoneId: string;
  completedMilestones: number;
  totalMilestones: number;
}
