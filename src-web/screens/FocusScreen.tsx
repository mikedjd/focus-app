import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { formatSeconds } from '../lib/format';
import { DEFAULT_TASK_XP } from '../lib/xp';
import { useGardenStore } from '../store/useGardenStore';

function SunTimer({ elapsedSeconds, cyclesDone, totalCycles }: { elapsedSeconds: number; cyclesDone: number; totalCycles: number }) {
  const radius = 200;
  const circumference = 2 * Math.PI * radius;
  const cycleSeconds = 25 * 60;
  const remaining = Math.max(0, cycleSeconds - (elapsedSeconds % cycleSeconds));
  const progress = (cycleSeconds - remaining) / cycleSeconds;
  const dash = circumference * progress;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 460 460" className="h-[340px] w-[340px] md:h-[460px] md:w-[460px]" role="img" aria-label="Focus timer">
        <defs>
          <radialGradient id="sunGradient" cx="50%" cy="44%" r="58%">
            <stop offset="0%" stopColor="#F4D9A8" />
            <stop offset="54%" stopColor="#E89B5A" />
            <stop offset="100%" stopColor="#A8552A" />
          </radialGradient>
        </defs>
        <circle cx="230" cy="230" r={radius} fill="none" stroke="rgba(250,245,233,0.12)" strokeWidth="6" />
        <circle
          cx="230"
          cy="230"
          r={radius}
          fill="none"
          stroke="#A8552A"
          strokeLinecap="round"
          strokeWidth="6"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform="rotate(-90 230 230)"
        />
        <circle cx="230" cy="230" r="150" fill="url(#sunGradient)" />
        <text x="230" y="248" textAnchor="middle" fontFamily="Instrument Serif" fontSize="64" fill="#FAF5E9">
          {formatSeconds(remaining)}
        </text>
      </svg>
      <div className="mt-6 flex gap-3">
        {Array.from({ length: totalCycles }).map((_, index) => (
          <span
            key={index}
            className={`h-3 w-3 rounded-full ${
              index < cyclesDone
                ? 'bg-sienna/50'
                : index === cyclesDone
                  ? 'bg-sienna'
                  : 'bg-paper/15'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function FocusScreen() {
  const navigate = useNavigate();
  const tasks = useGardenStore((state) => state.tasks);
  const currentTaskId = useGardenStore((state) => state.currentTaskId);
  const activeSession = useGardenStore((state) => state.activeSession);
  const sessionState = useGardenStore((state) => state.sessionState);
  const startSession = useGardenStore((state) => state.startSession);
  const completeCurrentTask = useGardenStore((state) => state.completeCurrentTask);
  const stopSession = useGardenStore((state) => state.stopSession);
  const task = tasks.find((candidate) => candidate.id === currentTaskId) ?? tasks[0] ?? null;
  const [localElapsed, setLocalElapsed] = useState(activeSession?.elapsedSeconds ?? (task?.cyclesDone ?? 0) * 25 * 60);

  useEffect(() => {
    if (sessionState !== 'running') return;

    const interval = window.setInterval(() => {
      setLocalElapsed((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [sessionState]);

  useEffect(() => {
    if (task && !activeSession && sessionState === 'idle') {
      startSession(task.id);
    }
  }, [activeSession, sessionState, startSession, task]);

  const elapsedLabel = useMemo(() => formatSeconds(localElapsed), [localElapsed]);

  if (!task) {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-to-b from-focus-top to-focus-bottom px-7 py-7 text-paper">
        <div className="max-w-xl text-center">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-sienna-soft">
            no row yet
          </p>
          <h1 className="mt-4 font-display text-[56px] leading-none">Plant one row first.</h1>
          <p className="mt-4 text-[15px] leading-7 text-paper/70">
            The focus room opens once there is a real task to tend.
          </p>
          <Button className="mt-7" onClick={() => navigate('/')}>
            Back to Today
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-focus-top to-focus-bottom px-7 py-7 text-paper md:px-12">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between">
        <button
          onClick={() => {
            stopSession();
            navigate('/');
          }}
          className="grid h-9 w-9 place-items-center rounded-full bg-paper/10 text-2xl text-paper transition hover:bg-paper/15"
          aria-label="Exit focus"
        >
          ×
        </button>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-paper/70">
          tending · {elapsedLabel} elapsed
        </p>
      </div>

      <section className="mx-auto grid min-h-[calc(100vh-96px)] max-w-[1280px] items-center gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_520px]">
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-sienna-soft">
            ✦ The one row · cycle {Math.min(task.cyclesDone + 1, task.totalCycles)} of {task.totalCycles} · {task.xpValue ?? DEFAULT_TASK_XP} XP
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-[52px] leading-[0.98] tracking-[-0.02em] md:text-[64px]">
            {task.title}{' '}
            {task.italicTitle ? <span className="italic text-sienna-soft">{task.italicTitle}</span> : null}
          </h1>
          <p className="mt-6 max-w-2xl text-[16px] leading-7 text-paper/72">{task.description}</p>

          <div className="mt-8 rounded-2xl border border-paper/10 bg-paper/[0.05] p-6">
            <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-paper/55">
              Why · pinned
            </p>
            <p className="font-display text-[24px] italic leading-8 text-paper">{task.why}</p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              onClick={() => {
                completeCurrentTask();
                navigate('/');
              }}
            >
              ✓ It's done — close the row
            </Button>
            <Button
              variant="quiet"
              onClick={() => {
                stopSession();
                navigate('/');
              }}
            >
              Step away on purpose
            </Button>
          </div>
        </div>

        <SunTimer elapsedSeconds={localElapsed} cyclesDone={task.cyclesDone} totalCycles={task.totalCycles} />
      </section>
    </main>
  );
}
