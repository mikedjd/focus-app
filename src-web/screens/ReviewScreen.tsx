import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getHabitAutomaticity, getRecentDateKeys, todayKey } from '../lib/habits';
import { useGardenStore } from '../store/useGardenStore';

function weekDates(): string[] {
  return getRecentDateKeys(7);
}

export function ReviewScreen() {
  const tasks = useGardenStore((state) => state.tasks);
  const habits = useGardenStore((state) => state.habits);
  const goal = useGardenStore((state) => state.goal);
  const [weekNote, setWeekNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);

  const doneTasks = tasks.filter((t) => t.status === 'done');
  const openTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'parked');
  const parkedTasks = tasks.filter((t) => t.status === 'parked');
  const activeHabits = habits.filter((h) => h.status !== 'archived');
  const week = weekDates();
  const today = todayKey();

  function saveNote() {
    if (!weekNote.trim()) return;
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  }

  return (
    <div className="mx-auto max-w-garden space-y-10">
      <section>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-sienna">
          weekly review
        </p>
        <h1 className="mt-2 font-display text-[64px] leading-none tracking-[-0.02em] text-ink lg:text-[72px]">
          Weekly review.
        </h1>
        <p className="mt-4 max-w-[560px] font-display text-[22px] italic leading-8 text-ink-soft">
          Take stock of the week. What got done? What's still open? What needs to change?
        </p>
      </section>

      {/* Wins */}
      <section className="rounded-[20px] border border-rule bg-paper p-7 shadow-soft">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-sienna">
          what got done
        </p>
        <h2 className="mt-2 font-display text-[32px] leading-none text-ink">
          {doneTasks.length} task{doneTasks.length !== 1 ? 's' : ''} completed
        </h2>
        {doneTasks.length === 0 ? (
          <p className="mt-4 text-[14px] italic text-ink-muted">
            Nothing marked done yet — that's okay. Complete tasks on the{' '}
            <Link to="/" className="underline hover:text-sienna">Board</Link>.
          </p>
        ) : (
          <ul className="mt-5 space-y-2">
            {doneTasks.map((task) => (
              <li key={task.id} className="flex items-center gap-3 text-[14px] text-ink-soft">
                <span className="h-4 w-4 shrink-0 rounded-full border border-sienna bg-sienna" />
                <span className="font-medium text-ink">{task.title}</span>
                <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                  +{task.xpValue} xp
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Open items */}
      {openTasks.length > 0 && (
        <section className="rounded-[20px] border border-rule bg-paper p-7 shadow-soft">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
            still open
          </p>
          <h2 className="mt-2 font-display text-[32px] leading-none text-ink">
            {openTasks.length} task{openTasks.length !== 1 ? 's' : ''} on the board
          </h2>
          <p className="mt-2 text-[14px] text-ink-soft">
            Do these still matter? If not, park them.
          </p>
          <ul className="mt-5 space-y-2">
            {openTasks.map((task) => (
              <li key={task.id} className="flex items-center gap-3 text-[14px]">
                <span className="h-4 w-4 shrink-0 rounded-full border border-rule bg-bg" />
                <span className="text-ink">{task.title}</span>
                <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                  {task.phaseId}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Habits this week */}
      <section className="rounded-[20px] border border-rule bg-paper p-7 shadow-soft">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-sienna">
          habits this week
        </p>
        <h2 className="mt-2 font-display text-[32px] leading-none text-ink">
          {activeHabits.length} active routine{activeHabits.length !== 1 ? 's' : ''}
        </h2>

        {activeHabits.length === 0 ? (
          <p className="mt-4 text-[14px] italic text-ink-muted">
            No habits yet —{' '}
            <Link to="/habits" className="underline hover:text-sienna">add one</Link>.
          </p>
        ) : (
          <div className="mt-6 space-y-5">
            {activeHabits.map((habit) => {
              const completionSet = new Set(habit.completions);
              const weekHits = week.filter((d) => completionSet.has(d)).length;
              const automaticity = getHabitAutomaticity(habit);
              const doneToday = completionSet.has(today);

              return (
                <div key={habit.id} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ink">{habit.title}</span>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-muted">
                      {weekHits}/7 days · {automaticity}% auto
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    {week.map((day) => (
                      <span
                        key={day}
                        title={day}
                        className={`h-4 w-4 rounded-full border ${
                          completionSet.has(day) ? 'border-sienna bg-sienna' : 'border-rule bg-bg'
                        }`}
                      />
                    ))}
                    {doneToday ? null : (
                      <span className="ml-2 font-mono text-[10px] text-ink-muted italic">not yet today</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Blueprint pulse */}
      {goal.title && (
        <section className="rounded-[20px] border border-rule bg-paper p-7 shadow-soft">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
            goal progress
          </p>
          <h2 className="mt-2 font-display text-[32px] leading-none text-ink">{goal.title}</h2>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex-1">
              <div className="mb-1 flex justify-between font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-muted">
                <span>XP progress</span>
                <span>{goal.xpTotal} / {goal.xpTarget}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-bg">
                <div
                  className="h-full rounded-full bg-sienna"
                  style={{ width: `${Math.min(100, Math.round((goal.xpTotal / goal.xpTarget) * 100))}%` }}
                />
              </div>
            </div>
            <span className="shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-sienna">
              stage {goal.buildStage}
            </span>
          </div>
          {goal.harvestBy && (
            <p className="mt-3 text-[13px] text-ink-soft">Target: {goal.harvestBy}</p>
          )}
        </section>
      )}

      {/* Weekly note */}
      <section className="rounded-[20px] border border-rule bg-paper p-7 shadow-soft">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-sienna">
          weekly note
        </p>
        <h2 className="mt-2 font-display text-[32px] leading-none text-ink">What needs to shift?</h2>
        <p className="mt-2 text-[14px] text-ink-soft">
          One honest sentence about this week. What's working? What's getting in the way?
        </p>
        <textarea
          value={weekNote}
          onChange={(e) => { setWeekNote(e.target.value); setNoteSaved(false); }}
          placeholder="e.g. I kept getting pulled into email before deep work. Next week I'll block the first hour."
          className="mt-5 w-full min-h-28 rounded-2xl border border-rule bg-bg px-5 py-4 text-[15px] text-ink outline-none placeholder:text-ink-muted focus:border-sienna"
        />
        <button
          type="button"
          onClick={saveNote}
          className="mt-4 rounded-full border border-sienna bg-sienna px-6 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-paper transition hover:opacity-80"
        >
          {noteSaved ? 'saved ✓' : 'save note'}
        </button>
      </section>

      {parkedTasks.length > 0 && (
        <section className="rounded-[20px] border border-rule bg-paper p-7 shadow-soft opacity-60">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
            parked
          </p>
          <h2 className="mt-2 font-display text-[28px] leading-none text-ink">
            {parkedTasks.length} item{parkedTasks.length !== 1 ? 's' : ''} in the lot
          </h2>
          <ul className="mt-4 space-y-2">
            {parkedTasks.map((task) => (
              <li key={task.id} className="text-[14px] italic text-ink-soft">
                {task.title}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
