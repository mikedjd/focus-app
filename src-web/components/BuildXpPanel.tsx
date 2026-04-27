import { calculateXpProgress, DEFAULT_XP_TARGET } from '../lib/xp';
import type { Goal } from '../types';

interface BuildXpPanelProps {
  goal: Goal;
  compact?: boolean;
}

export function BuildXpPanel({ goal, compact = false }: BuildXpPanelProps) {
  const xpTotal = goal.xpTotal ?? 0;
  const xpTarget = goal.xpTarget || DEFAULT_XP_TARGET;
  const buildHealth = goal.buildHealth ?? 100;
  const buildStage = goal.buildStage ?? 1;
  const progress = calculateXpProgress(xpTotal, xpTarget);
  const stageLabel = ['Starting out', 'Finding rhythm', 'Building momentum', 'Operating', 'Maintaining'][
    buildStage - 1
  ];

  return (
    <section className={`rounded-[20px] border border-rule bg-paper ${compact ? 'p-5' : 'p-7'} shadow-soft`}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-sienna">
            XP · structure stage {buildStage}
          </p>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="font-display text-[54px] leading-none text-sienna">{xpTotal}</span>
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">
              / {xpTarget} XP
            </span>
          </div>
          <p className="mt-1 font-display text-[18px] italic text-ink-soft">{stageLabel}</p>
        </div>

        <div className="min-w-[220px]">
          <div className="mb-2 flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
            <span>Structural integrity</span>
            <span>{buildHealth}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-bg">
            <div className="h-full rounded-full bg-sienna" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="mt-3 text-[13px] leading-5 text-ink-soft">
            Complete load-bearing tasks to earn XP. No streak noise; just visible structural progress.
          </p>
        </div>
      </div>
    </section>
  );
}
