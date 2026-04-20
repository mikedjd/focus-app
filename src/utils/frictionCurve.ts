/**
 * Progressive friction floor.
 * As the user logs more seated time per week, the suggested minimum task
 * duration grows — start with a 2-minute ask, rising to 25 min for users who
 * consistently put in 5+ hours a week.
 */
const MIN = 60;

const CURVE: Array<{ seconds: number; minutes: number }> = [
  { seconds: 0, minutes: 2 },
  { seconds: 30 * MIN, minutes: 5 },
  { seconds: 90 * MIN, minutes: 10 },
  { seconds: 180 * MIN, minutes: 15 },
  { seconds: 300 * MIN, minutes: 25 },
];

export function computeFrictionMinutes(weeklySeatedSeconds: number): number {
  let result = CURVE[0].minutes;
  for (const step of CURVE) {
    if (weeklySeatedSeconds >= step.seconds) result = step.minutes;
  }
  return result;
}

export function getNextFrictionThreshold(weeklySeatedSeconds: number): {
  nextMinutes: number | null;
  secondsUntilNext: number;
} {
  const next = CURVE.find((s) => s.seconds > weeklySeatedSeconds);
  if (!next) return { nextMinutes: null, secondsUntilNext: 0 };
  return {
    nextMinutes: next.minutes,
    secondsUntilNext: next.seconds - weeklySeatedSeconds,
  };
}
