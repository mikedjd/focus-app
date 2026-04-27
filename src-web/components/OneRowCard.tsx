import { useNavigate } from 'react-router-dom';
import { Button } from './Button';
import { useGardenStore } from '../store/useGardenStore';
import type { Task } from '../types';
import { DEFAULT_TASK_XP } from '../lib/xp';

interface OneRowCardProps {
  task: Task;
}

function Ring({ progress }: { progress: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * progress;

  return (
    <div className="relative grid h-20 w-20 place-items-center rounded-full bg-bg">
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 80 80" aria-hidden="true">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="#D4C49E" strokeWidth="5" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="#A8552A"
          strokeLinecap="round"
          strokeWidth="5"
          strokeDasharray={`${dash} ${circumference - dash}`}
        />
      </svg>
      <span className="font-display text-[21px] text-sienna">{Math.round(progress * 100)}%</span>
    </div>
  );
}

export function OneRowCard({ task }: OneRowCardProps) {
  const navigate = useNavigate();
  const startSession = useGardenStore((state) => state.startSession);
  const phases = useGardenStore((state) => state.phases);
  const phase = phases.find((candidate) => candidate.id === task.phaseId);
  const progress = task.totalCycles > 0 ? task.cyclesDone / task.totalCycles : 0;

  return (
    <section className="rounded-[20px] border border-rule bg-paper p-7 shadow-soft lg:p-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
        <div>
          <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-sienna">
            ✦ Up next · {phase?.label}
          </p>
          <h2 className="max-w-3xl font-display text-[42px] leading-[0.98] tracking-[-0.02em] text-ink lg:text-[48px]">
            {task.title}{' '}
            {task.italicTitle ? <span className="italic text-sienna">{task.italicTitle}</span> : null}
          </h2>
          <p className="mt-5 max-w-2xl text-[16px] leading-7 text-ink-soft">{task.description}</p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button
              onClick={() => {
                startSession(task.id);
                navigate('/focus');
              }}
            >
              Start focus session →
            </Button>
            <Button variant="ghost">Choose another task</Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-6 lg:flex-col lg:items-end">
          <Ring progress={progress} />
          <div className="text-right font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">
            <div>
              cycle {task.cyclesDone + 1} of {task.totalCycles}
            </div>
            <div>{task.estimateMinutes} min baseline</div>
            <div>{task.xpValue ?? DEFAULT_TASK_XP} XP</div>
          </div>
        </div>
      </div>
    </section>
  );
}
