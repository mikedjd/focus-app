import type { GoalWriteInput } from '../types';

export function createDefaultGoalInput(_todayStr?: string): GoalWriteInput {
  return { title: 'My first goal', why: 'To build momentum and prove the system works.' };
}
