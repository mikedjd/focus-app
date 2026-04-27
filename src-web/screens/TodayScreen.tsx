import { FormEvent, useEffect, useState } from 'react';
import { BuildXpPanel } from '../components/BuildXpPanel';
import { Button } from '../components/Button';
import { OneRowCard } from '../components/OneRowCard';
import { PhaseColumns } from '../components/PhaseColumns';
import { PhasePills } from '../components/PhasePills';
import { ResumeStrip } from '../components/ResumeStrip';
import { useGardenStore } from '../store/useGardenStore';
import type { PhaseId } from '../types';
import { DURATION_OPTIONS, xpFromDuration } from '../lib/xp';

const TIME_SLOTS = [
  { label: 'Morning', value: '09:00' },
  { label: 'Mid-morning', value: '10:30' },
  { label: 'Midday', value: '12:30' },
  { label: 'Afternoon', value: '14:30' },
  { label: 'Evening', value: '17:00' },
];

const EMAIL_PATTERN = /\bemail[s]?\b/i;

function FirstTaskForm() {
  const phases = useGardenStore((state) => state.phases);
  const activePhase = useGardenStore((state) => state.activePhase);
  const addTask = useGardenStore((state) => state.addTask);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [why, setWhy] = useState('');
  const [phaseId, setPhaseId] = useState<PhaseId>(activePhase);
  const [estimateMinutes, setEstimateMinutes] = useState(DURATION_OPTIONS[1].minutes);
  const [scheduledTime, setScheduledTime] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [autoTagged, setAutoTagged] = useState(false);

  const isAdmin = phaseId === 'admin';
  const xpValue = xpFromDuration(estimateMinutes, isAdmin);

  useEffect(() => {
    if (EMAIL_PATTERN.test(title)) {
      setPhaseId('admin');
      setAutoTagged(true);
    } else if (autoTagged) {
      setPhaseId(activePhase);
      setAutoTagged(false);
    }
  }, [title]);

  function handlePhaseClick(id: PhaseId) {
    setPhaseId(id);
    setAutoTagged(false);
  }

  function handleTimeSlot(value: string) {
    setScheduledTime(value);
    setShowCustomTime(false);
    setCustomTime('');
  }

  function handleCustomTime(value: string) {
    setCustomTime(value);
    setScheduledTime(value);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;

    addTask({
      title,
      description: description || 'One clean next thing.',
      why: why || 'You said this matters. That is enough to begin.',
      phaseId,
      totalCycles: 1,
      estimateMinutes,
      xpValue,
      scheduledTime: scheduledTime || undefined,
    });
    setTitle('');
    setDescription('');
    setWhy('');
    setPhaseId(activePhase);
    setEstimateMinutes(DURATION_OPTIONS[1].minutes);
    setScheduledTime('');
    setCustomTime('');
    setShowCustomTime(false);
    setAutoTagged(false);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[20px] border border-rule bg-paper p-7 shadow-soft lg:p-8">
      <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-sienna">
        ✦ Main task
      </p>
      <h2 className="max-w-3xl font-display text-[42px] leading-none tracking-[-0.02em] text-ink lg:text-[48px]">
        Add your first task.
      </h2>
      <p className="mt-4 max-w-2xl text-[16px] leading-7 text-ink-soft">
        Pick something concrete to work on today. Keep it small enough that starting feels easy.
      </p>

      <div className="mt-7 grid gap-4">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="rounded-2xl border border-rule bg-bg px-5 py-4 text-[16px] text-ink outline-none placeholder:text-ink-muted focus:border-sienna"
          placeholder="Task name"
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

      {/* Phase selector */}
      <div className="mt-5">
        <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">Phase</p>
        <div className="flex flex-wrap gap-2">
          {phases.map((phase) => (
            <button
              key={phase.id}
              type="button"
              onClick={() => handlePhaseClick(phase.id)}
              className={`rounded-full border px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition ${
                phaseId === phase.id ? 'border-sienna bg-sienna text-paper' : 'border-rule text-ink-soft hover:border-ink-muted'
              }`}
            >
              {phase.label}
            </button>
          ))}
          {autoTagged && (
            <span className="self-center rounded-full bg-amber-100 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">
              Auto-tagged: Admin · 0 XP
            </span>
          )}
        </div>
      </div>

      {/* Duration selector */}
      <div className="mt-5">
        <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">How long will this take?</p>
        <div className="flex flex-wrap gap-2">
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.minutes}
              type="button"
              onClick={() => setEstimateMinutes(opt.minutes)}
              className={`rounded-full border px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition ${
                isAdmin ? 'cursor-default opacity-40' : ''
              } ${
                estimateMinutes === opt.minutes && !isAdmin
                  ? 'border-sienna bg-sienna text-paper'
                  : 'border-rule text-ink-soft hover:border-ink-muted'
              }`}
              disabled={isAdmin}
            >
              {opt.label}
            </button>
          ))}
          <span className={`self-center rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] ${
            isAdmin ? 'bg-ink-muted/10 text-ink-muted' : 'bg-sienna/10 text-sienna'
          }`}>
            {xpValue} XP
          </span>
        </div>
      </div>

      {/* Time-of-day selector */}
      <div className="mt-5">
        <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">When in the day?</p>
        <div className="flex flex-wrap gap-2">
          {TIME_SLOTS.map((slot) => (
            <button
              key={slot.value}
              type="button"
              onClick={() => handleTimeSlot(scheduledTime === slot.value ? '' : slot.value)}
              className={`rounded-full border px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition ${
                scheduledTime === slot.value
                  ? 'border-sienna bg-sienna text-paper'
                  : 'border-rule text-ink-soft hover:border-ink-muted'
              }`}
            >
              {slot.label} <span className="opacity-60">{slot.value}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setShowCustomTime(!showCustomTime); setScheduledTime(''); }}
            className={`rounded-full border px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition ${
              showCustomTime ? 'border-sienna bg-sienna text-paper' : 'border-rule text-ink-soft hover:border-ink-muted'
            }`}
          >
            Custom
          </button>
          {showCustomTime && (
            <input
              type="time"
              value={customTime}
              onChange={(e) => handleCustomTime(e.target.value)}
              className="rounded-full border border-sienna bg-bg px-4 py-1.5 font-mono text-[12px] text-ink outline-none"
            />
          )}
        </div>
      </div>

      <Button className="mt-7" type="submit">
        Add task
      </Button>
    </form>
  );
}

export function TodayScreen() {
  const tasks = useGardenStore((state) => state.tasks);
  const currentTaskId = useGardenStore((state) => state.currentTaskId);
  const goal = useGardenStore((state) => state.goal);
  const userName = useGardenStore((state) => state.userName);
  const currentTask = tasks.find((task) => task.id === currentTaskId) ?? tasks[0] ?? null;

  const pendingCount = tasks.filter((t) => t.status !== 'done').length;
  const subText = goal.title
    ? `One main task today — the rest can wait.`
    : 'No tasks yet. Add one below.';

  return (
    <div className="mx-auto max-w-garden">
      <div className="space-y-6">
        <ResumeStrip />

        <section>
          <PhasePills />
          <h1 className="font-display text-[64px] leading-none tracking-[-0.02em] text-ink lg:text-[72px]">
            Good morning{userName ? `, ${userName}` : ''}.
          </h1>
          <p className="mt-4 max-w-[580px] font-display text-[22px] italic leading-8 text-ink-soft">
            {pendingCount > 0 ? subText : 'No tasks yet. Add one below.'}
          </p>
        </section>

        <BuildXpPanel goal={goal} />

        {currentTask ? <OneRowCard task={currentTask} /> : <FirstTaskForm />}
      </div>

      <div className="mt-14">
        <PhaseColumns />
      </div>
    </div>
  );
}
