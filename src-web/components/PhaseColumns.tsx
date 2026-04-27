import { useState } from 'react';
import { useGardenStore } from '../store/useGardenStore';
import type { PhaseId } from '../types';

export function PhaseColumns() {
  const phases = useGardenStore((state) => state.phases);
  const tasks = useGardenStore((state) => state.tasks);
  const activePhase = useGardenStore((state) => state.activePhase);
  const setCurrentTask = useGardenStore((state) => state.setCurrentTask);
  const moveTask = useGardenStore((state) => state.moveTask);

  const [dragOverPhase, setDragOverPhase] = useState<PhaseId | null>(null);

  function handleDragStart(event: React.DragEvent, taskId: string) {
    event.dataTransfer.setData('taskId', taskId);
    event.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(event: React.DragEvent, phaseId: PhaseId) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverPhase(phaseId);
  }

  function handleDrop(event: React.DragEvent, phaseId: PhaseId) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData('taskId');
    if (taskId) moveTask(taskId, phaseId);
    setDragOverPhase(null);
  }

  function handleDragLeave(event: React.DragEvent) {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setDragOverPhase(null);
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
      {phases.map((phase) => {
        const phaseTasks = tasks.filter((task) => task.phaseId === phase.id && task.status !== 'done');
        const isDropTarget = dragOverPhase === phase.id;

        return (
          <div
            key={phase.id}
            onDragOver={(e) => handleDragOver(e, phase.id)}
            onDrop={(e) => handleDrop(e, phase.id)}
            onDragLeave={handleDragLeave}
            className={`rounded-2xl border bg-paper p-5 transition ${
              isDropTarget ? 'border-sienna bg-sienna/5 shadow-md' : 'border-rule'
            } ${activePhase === phase.id ? 'opacity-100' : 'opacity-70'}`}
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
                <p className={`py-2 text-[13px] italic ${isDropTarget ? 'text-sienna' : 'text-ink-muted'}`}>
                  {isDropTarget ? 'Drop here' : 'Nothing on this board yet.'}
                </p>
              ) : null}
              {phaseTasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  className="group cursor-grab active:cursor-grabbing"
                >
                  <button
                    onClick={() => setCurrentTask(task.id)}
                    className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left transition hover:bg-bg"
                  >
                    <span
                      className={`h-4 w-4 shrink-0 rounded-full border ${
                        task.status === 'tending' ? 'border-sienna bg-sienna' : 'border-rule bg-bg'
                      }`}
                    />
                    <span className="min-w-0 flex-1 text-[14px] font-medium text-ink">{task.title}</span>
                    <div className="flex shrink-0 items-center gap-1">
                      {task.scheduledTime ? (
                        <span className="rounded-full bg-sienna/10 px-2 py-0.5 font-mono text-[9px] font-bold tracking-[0.08em] text-sienna">
                          {task.scheduledTime}
                        </span>
                      ) : null}
                      {task.xpValue > 0 ? (
                        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                          {task.xpValue}xp
                        </span>
                      ) : (
                        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-ink-muted/50">
                          admin
                        </span>
                      )}
                      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-muted">
                        {task.cyclesDone}/{task.totalCycles}
                      </span>
                    </div>
                    {task.status === 'tending' ? (
                      <span className="rounded-full bg-sienna px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-paper">
                        tending
                      </span>
                    ) : null}
                  </button>
                </div>
              ))}
              {isDropTarget && phaseTasks.length > 0 ? (
                <div className="mt-1 rounded-xl border-2 border-dashed border-sienna/40 py-3 text-center font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-sienna/60">
                  Drop here
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </section>
  );
}
