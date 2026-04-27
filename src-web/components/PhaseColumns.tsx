import { useGardenStore } from '../store/useGardenStore';

export function PhaseColumns() {
  const phases = useGardenStore((state) => state.phases);
  const tasks = useGardenStore((state) => state.tasks);
  const activePhase = useGardenStore((state) => state.activePhase);
  const setCurrentTask = useGardenStore((state) => state.setCurrentTask);

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      {phases.map((phase) => {
        const phaseTasks = tasks.filter((task) => task.phaseId === phase.id && task.status !== 'done');

        return (
          <div
            key={phase.id}
            className={`rounded-2xl border border-rule bg-paper p-5 transition ${
              activePhase === phase.id ? 'opacity-100' : 'opacity-70'
            }`}
          >
            <div className="mb-5 flex items-end justify-between gap-4 border-b border-rule pb-4">
              <div>
                <h3 className="font-display text-2xl italic text-ink">{phase.label}</h3>
                <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
                  {phase.window}
                </p>
              </div>
              <span className="font-display text-[12px] italic text-ink-soft">{phase.note}</span>
            </div>

            <div className="space-y-3">
              {phaseTasks.length === 0 ? (
                <p className="py-2 text-[13px] italic text-ink-muted">Nothing planted here yet.</p>
              ) : null}
              {phaseTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => setCurrentTask(task.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left transition hover:bg-bg"
                >
                  <span
                    className={`h-4 w-4 shrink-0 rounded-full border ${
                      task.status === 'tending' ? 'border-sienna bg-sienna' : 'border-rule bg-bg'
                    }`}
                  />
                  <span className="min-w-0 flex-1 text-[14px] font-medium text-ink">{task.title}</span>
                  <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-muted">
                    {task.cyclesDone}/{task.totalCycles}
                  </span>
                  {task.status === 'tending' ? (
                    <span className="rounded-full bg-sienna px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-paper">
                      tending
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
