export function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');

  return `${minutes}:${seconds}`;
}

export function nowCaughtLabel(): string {
  return `caught ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

export function deterministicTilt(seed: string): number {
  const total = seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return ((total % 50) - 25) / 10;
}
