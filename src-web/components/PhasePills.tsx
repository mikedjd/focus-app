import { useGardenStore } from '../store/useGardenStore';
import type { PhaseId } from '../types';

export function PhasePills() {
  const phases = useGardenStore((state) => state.phases);
  const activePhase = useGardenStore((state) => state.activePhase);
  const setActivePhase = useGardenStore((state) => state.setActivePhase);

  return (
    <div className="mb-7 flex flex-wrap gap-3">
      {phases.map((phase) => (
        <button
          key={phase.id}
          onClick={() => setActivePhase(phase.id as PhaseId)}
          className={`rounded-full border px-5 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition ${
            activePhase === phase.id
              ? 'border-sienna bg-sienna text-paper'
              : 'border-rule bg-paper text-ink-soft hover:border-sienna'
          }`}
        >
          {phase.label} · {phase.window}
        </button>
      ))}
    </div>
  );
}
