import { FormEvent, useState } from 'react';
import { BuildXpPanel } from '../components/BuildXpPanel';
import { Button } from '../components/Button';
import { OneRowCard } from '../components/OneRowCard';
import { PhaseColumns } from '../components/PhaseColumns';
import { PhasePills } from '../components/PhasePills';
import { ResumeStrip } from '../components/ResumeStrip';
import { useGardenStore } from '../store/useGardenStore';
import type { PhaseId } from '../types';
import { DEFAULT_TASK_XP } from '../lib/xp';

function FirstTaskForm() {
  const phases = useGardenStore((state) => state.phases);
  const activePhase = useGardenStore((state) => state.activePhase);
  const addTask = useGardenStore((state) => state.addTask);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [why, setWhy] = useState('');
  const [phaseId, setPhaseId] = useState<PhaseId>(activePhase);
  const [xpValue, setXpValue] = useState(DEFAULT_TASK_XP);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;

    addTask({
      title,
      description: description || 'One clean next thing.',
      why: why || 'You said this matters. That is enough to begin.',
      phaseId,
      totalCycles: 1,
      estimateMinutes: 25,
      xpValue,
    });
    setTitle('');
    setDescription('');
    setWhy('');
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[20px] border border-rule bg-paper p-7 shadow-soft lg:p-8">
      <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-sienna">
        ✦ Load-bearing task
      </p>
      <h2 className="max-w-3xl font-display text-[42px] leading-none tracking-[-0.02em] text-ink lg:text-[48px]">
        Put the first piece on the board.
      </h2>
      <p className="mt-4 max-w-2xl text-[16px] leading-7 text-ink-soft">
        Add the next piece that would make the structure stronger. Keep it small enough that starting feels believable.
      </p>

      <div className="mt-7 grid gap-4">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="rounded-2xl border border-rule bg-bg px-5 py-4 text-[16px] text-ink outline-none placeholder:text-ink-muted focus:border-sienna"
          placeholder="Load-bearing task"
        />
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="min-h-24 rounded-2xl border border-rule bg-bg px-5 py-4 text-[15px] text-ink outline-none placeholder:text-ink-muted focus:border-sienna"
          placeholder="What does done look like?"
        />
        <input
          value={why}
          onChange={(event) => setWhy(event.target.value)}
          className="rounded-2xl border border-rule bg-bg px-5 py-4 text-[15px] text-ink outline-none placeholder:text-ink-muted focus:border-sienna"
          placeholder="Why does this matter?"
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {phases.map((phase) => (
          <button
            key={phase.id}
            type="button"
            onClick={() => setPhaseId(phase.id)}
            className={`rounded-full border px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${
              phaseId === phase.id ? 'border-sienna bg-sienna text-paper' : 'border-rule text-ink-soft'
            }`}
          >
            {phase.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 rounded-full border border-rule px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          XP
          <input
            type="number"
            min="1"
            value={xpValue}
            onChange={(event) => setXpValue(Number(event.target.value) || DEFAULT_TASK_XP)}
            className="w-14 bg-transparent text-right text-ink outline-none"
          />
        </label>
      </div>

      <Button className="mt-7" type="submit">
        Add to board
      </Button>
    </form>
  );
}

export function TodayScreen() {
  const tasks = useGardenStore((state) => state.tasks);
  const currentTaskId = useGardenStore((state) => state.currentTaskId);
  const goal = useGardenStore((state) => state.goal);
  const currentTask = tasks.find((task) => task.id === currentTaskId) ?? tasks[0] ?? null;

  return (
    <div className="mx-auto max-w-garden">
      <div className="space-y-6">
        <ResumeStrip />

        <section>
          <PhasePills />
          <h1 className="font-display text-[64px] leading-none tracking-[-0.02em] text-ink lg:text-[72px]">
            Good morning.
          </h1>
          <p className="mt-4 max-w-[580px] font-display text-[22px] italic leading-8 text-ink-soft">
            The board is clear. One load-bearing task today. The rest can wait.
          </p>
        </section>

        {currentTask ? <OneRowCard task={currentTask} /> : <FirstTaskForm />}
        <BuildXpPanel goal={goal} />
      </div>

      <div className="mt-14">
        <PhaseColumns />
      </div>
    </div>
  );
}
