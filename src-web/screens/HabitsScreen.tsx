import { FormEvent, useMemo, useState } from 'react';
import { Button } from '../components/Button';
import {
  formatHabitDate,
  getHabitAutomaticity,
  getHabitStreak,
  getRecentDateKeys,
  wasHabitDoneToday,
} from '../lib/habits';
import { useGardenStore } from '../store/useGardenStore';
import type { Habit, HabitCadence } from '../types';

function HabitForm() {
  const addHabit = useGardenStore((state) => state.addHabit);
  const [title, setTitle] = useState('');
  const [identity, setIdentity] = useState('');
  const [tinyAction, setTinyAction] = useState('');
  const [anchor, setAnchor] = useState('');
  const [location, setLocation] = useState('');
  const [frictionCut, setFrictionCut] = useState('');
  const [celebration, setCelebration] = useState('');
  const [cadence, setCadence] = useState<HabitCadence>('daily');
  const [targetPerWeek, setTargetPerWeek] = useState(7);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;

    addHabit({
      title,
      identity,
      tinyAction,
      anchor,
      location,
      frictionCut,
      celebration,
      cadence,
      targetPerWeek,
    });

    setTitle('');
    setIdentity('');
    setTinyAction('');
    setAnchor('');
    setLocation('');
    setFrictionCut('');
    setCelebration('');
    setCadence('daily');
    setTargetPerWeek(7);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[20px] border border-rule bg-paper p-7 shadow-soft">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-sienna">
        new habit
      </p>
      <h2 className="mt-2 font-display text-[38px] leading-none text-ink">Build a habit that sticks.</h2>
      <p className="mt-4 max-w-3xl text-[15px] leading-7 text-ink-soft">
        The best habits are small, triggered by something you already do, and tied to a specific place.
      </p>

      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="rounded-2xl border border-rule bg-bg px-5 py-4 text-[15px] outline-none placeholder:text-ink-muted focus:border-sienna"
          placeholder="What's the habit? e.g. Morning walk"
        />
        <input
          value={identity}
          onChange={(event) => setIdentity(event.target.value)}
          className="rounded-2xl border border-rule bg-bg px-5 py-4 text-[15px] outline-none placeholder:text-ink-muted focus:border-sienna"
          placeholder="Who does this make you? e.g. Someone who moves daily"
        />
        <input
          value={anchor}
          onChange={(event) => setAnchor(event.target.value)}
          className="rounded-2xl border border-rule bg-bg px-5 py-4 text-[15px] outline-none placeholder:text-ink-muted focus:border-sienna"
          placeholder="What triggers it? e.g. After I pour my coffee"
        />
        <input
          value={tinyAction}
          onChange={(event) => setTinyAction(event.target.value)}
          className="rounded-2xl border border-rule bg-bg px-5 py-4 text-[15px] outline-none placeholder:text-ink-muted focus:border-sienna"
          placeholder="What's the action? e.g. Do 5 push-ups"
        />
        <input
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          className="rounded-2xl border border-rule bg-bg px-5 py-4 text-[15px] outline-none placeholder:text-ink-muted focus:border-sienna"
          placeholder="Where? e.g. Kitchen, gym, desk"
        />
        <input
          value={frictionCut}
          onChange={(event) => setFrictionCut(event.target.value)}
          className="rounded-2xl border border-rule bg-bg px-5 py-4 text-[15px] outline-none placeholder:text-ink-muted focus:border-sienna"
          placeholder="How to remove obstacles? e.g. Put trainers by the door"
        />
        <input
          value={celebration}
          onChange={(event) => setCelebration(event.target.value)}
          className="rounded-2xl border border-rule bg-bg px-5 py-4 text-[15px] outline-none placeholder:text-ink-muted focus:border-sienna"
          placeholder="Mini-celebration? e.g. Fist pump, tick it off"
        />
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-rule bg-bg px-5 py-4">
          {(['daily', 'weekdays', 'custom'] as HabitCadence[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setCadence(option)}
              className={`rounded-full border px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${
                cadence === option ? 'border-sienna bg-sienna text-paper' : 'border-rule text-ink-soft'
              }`}
            >
              {option}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
            weekly
            <input
              type="number"
              min="1"
              max="7"
              value={targetPerWeek}
              onChange={(event) => setTargetPerWeek(Math.max(1, Math.min(7, Number(event.target.value) || 1)))}
              className="w-12 bg-transparent text-right text-ink outline-none"
            />
          </label>
        </div>
      </div>

      <Button className="mt-7" type="submit">
        Add habit
      </Button>
    </form>
  );
}

function HabitCard({ habit }: { habit: Habit }) {
  const completeHabit = useGardenStore((state) => state.completeHabit);
  const pauseHabit = useGardenStore((state) => state.pauseHabit);
  const archiveHabit = useGardenStore((state) => state.archiveHabit);
  const recentDays = useMemo(() => getRecentDateKeys(21), []);
  const completions = new Set(habit.completions);
  const doneToday = wasHabitDoneToday(habit);
  const automaticity = getHabitAutomaticity(habit);
  const streak = getHabitStreak(habit);

  return (
    <article className="rounded-[20px] border border-rule bg-paper p-6 shadow-soft">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-sienna">
            {habit.cadence} · {habit.targetPerWeek}/week
          </p>
          <h3 className="mt-2 font-display text-[32px] leading-none text-ink">{habit.title}</h3>
          {habit.identity ? (
            <p className="mt-2 font-display text-[18px] italic text-ink-soft">{habit.identity}</p>
          ) : null}
        </div>
        <Button
          variant={doneToday ? 'ghost' : 'primary'}
          onClick={() => completeHabit(habit.id)}
          disabled={doneToday || habit.status !== 'active'}
        >
          {doneToday ? 'Done today' : 'Mark done'}
        </Button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-rule bg-bg p-4">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
            Trigger & action
          </p>
          <p className="mt-2 text-[14px] leading-6 text-ink-soft">
            After <span className="font-semibold text-ink">{habit.anchor || '—'}</span>, I will{' '}
            <span className="font-semibold text-ink">{habit.tinyAction || '—'}</span>.
          </p>
        </div>
        <div className="rounded-2xl border border-rule bg-bg p-4">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
            Context
          </p>
          <p className="mt-2 text-[14px] leading-6 text-ink-soft">
            {habit.location || 'Location not set yet.'}
            {habit.frictionCut ? ` Make it easier: ${habit.frictionCut}` : ''}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex justify-between font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          <span>Automaticity signal</span>
          <span>{automaticity}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-bg">
          <div className="h-full rounded-full bg-sienna" style={{ width: `${automaticity}%` }} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {recentDays.map((day) => (
          <span
            key={day}
            title={formatHabitDate(day)}
            className={`h-5 w-5 rounded-full border ${
              completions.has(day) ? 'border-sienna bg-sienna' : 'border-rule bg-bg'
            }`}
          />
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          streak {streak} · {habit.celebration || 'choose a completion signal'}
        </span>
        <button
          type="button"
          onClick={() => pauseHabit(habit.id)}
          className="ml-auto rounded-full border border-rule px-3 py-2 text-[12px] font-semibold text-ink-soft hover:border-sienna hover:text-sienna"
        >
          {habit.status === 'paused' ? 'resume' : 'pause'}
        </button>
        <button
          type="button"
          onClick={() => archiveHabit(habit.id)}
          className="rounded-full border border-rule px-3 py-2 text-[12px] font-semibold text-ink-soft hover:border-sienna hover:text-sienna"
        >
          archive
        </button>
      </div>
    </article>
  );
}

export function HabitsScreen() {
  const habits = useGardenStore((state) => state.habits);
  const activeHabits = habits.filter((habit) => habit.status !== 'archived');

  return (
    <div className="mx-auto max-w-garden">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
        habits
      </p>
      <h1 className="mt-3 font-display text-[72px] leading-none tracking-[-0.02em] text-ink lg:text-[88px]">
        Your daily habits.
      </h1>
      <p className="mt-4 max-w-3xl font-display text-[20px] italic leading-8 text-ink-soft">
        Small repeated actions, done consistently, in the same context.
      </p>

      <div className="mt-9">
        <HabitForm />
      </div>

      <section className="mt-9 grid gap-5">
        {activeHabits.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-rule bg-paper p-8">
            <p className="font-display text-[30px] italic text-ink">No habits yet.</p>
            <p className="mt-2 max-w-xl text-[14px] leading-6 text-ink-soft">
              Start with something small. Consistency beats intensity every time.
            </p>
          </div>
        ) : null}
        {activeHabits.map((habit) => (
          <HabitCard key={habit.id} habit={habit} />
        ))}
      </section>
    </div>
  );
}
