import { useState } from 'react';
import { useGardenStore } from '../store/useGardenStore';
import type { PhaseId, Task } from '../types';

const PHASE_COLOURS: Record<PhaseId, string> = {
  deep: 'bg-blue-100 text-blue-700',
  admin: 'bg-amber-100 text-amber-700',
  creative: 'bg-purple-100 text-purple-700',
  review: 'bg-green-100 text-green-700',
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function formatDayNum(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric' });
}

function TaskPill({ task, onClick }: { task: Task; onClick: () => void }) {
  const colourClass = PHASE_COLOURS[task.phaseId] ?? 'bg-paper text-ink';
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-lg px-2 py-1.5 text-left transition hover:opacity-80 ${colourClass}`}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="min-w-0 flex-1 text-[12px] font-medium leading-tight">{task.title}</span>
        {task.xpValue > 0 ? (
          <span className="shrink-0 font-mono text-[9px] font-bold opacity-70">{task.xpValue}xp</span>
        ) : (
          <span className="shrink-0 font-mono text-[9px] font-bold opacity-50">admin</span>
        )}
      </div>
      {task.scheduledTime ? (
        <span className="mt-0.5 block font-mono text-[10px] font-bold opacity-60">{task.scheduledTime}</span>
      ) : null}
      {task.status === 'done' ? (
        <span className="mt-0.5 block font-mono text-[9px] font-bold uppercase tracking-[0.1em] opacity-50 line-through">done</span>
      ) : null}
    </button>
  );
}

function WeekView({ weekStart, today, tasks, onSelectTask }: {
  weekStart: Date;
  today: string;
  tasks: Task[];
  onSelectTask: (id: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day, i) => {
        const key = toDateKey(day);
        const isToday = key === today;
        const dayTasks = tasks.filter((t) => (t.date ?? today) === key);

        return (
          <div
            key={key}
            className={`min-h-[160px] rounded-2xl border p-3 transition ${
              isToday ? 'border-sienna bg-sienna/5' : 'border-rule bg-paper'
            }`}
          >
            <div className="mb-2 flex items-baseline gap-1.5">
              <span className={`font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${isToday ? 'text-sienna' : 'text-ink-muted'}`}>
                {DAY_LABELS[i]}
              </span>
              <span className={`font-display text-[22px] leading-none ${isToday ? 'text-sienna' : 'text-ink'}`}>
                {formatDayNum(day)}
              </span>
              {isToday ? (
                <span className="ml-auto rounded-full bg-sienna px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-paper">
                  today
                </span>
              ) : null}
            </div>

            <div className="space-y-1.5">
              {dayTasks.length === 0 ? (
                <p className="py-1 text-[11px] italic text-ink-muted/60">—</p>
              ) : null}
              {dayTasks.map((task) => (
                <TaskPill key={task.id} task={task} onClick={() => onSelectTask(task.id)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WeekSummary({ weekStart, today, tasks }: { weekStart: Date; today: string; tasks: Task[] }) {
  const weekKeys = Array.from({ length: 7 }, (_, i) => toDateKey(addDays(weekStart, i)));
  const weekTasks = tasks.filter((t) => weekKeys.includes(t.date ?? today));
  const done = weekTasks.filter((t) => t.status === 'done');
  const xpEarned = done.reduce((sum, t) => sum + (t.xpValue ?? 0), 0);
  const xpAvail = weekTasks.reduce((sum, t) => sum + (t.xpValue ?? 0), 0);

  return (
    <div className="flex items-center gap-6 rounded-2xl border border-rule bg-paper px-6 py-4">
      <div>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">Tasks</p>
        <p className="font-display text-[28px] leading-none text-ink">{done.length}<span className="text-[16px] text-ink-soft">/{weekTasks.length}</span></p>
      </div>
      <div className="h-8 w-px bg-rule" />
      <div>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">XP earned</p>
        <p className="font-display text-[28px] leading-none text-sienna">{xpEarned}<span className="text-[16px] text-ink-soft">/{xpAvail}</span></p>
      </div>
      <div className="h-8 w-px bg-rule" />
      <div>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">Completion</p>
        <p className="font-display text-[28px] leading-none text-ink">
          {weekTasks.length ? Math.round((done.length / weekTasks.length) * 100) : 0}%
        </p>
      </div>
      <div className="ml-auto flex gap-3">
        {(['deep', 'admin', 'creative', 'review'] as PhaseId[]).map((phase) => {
          const count = weekTasks.filter((t) => t.phaseId === phase).length;
          if (!count) return null;
          return (
            <span key={phase} className={`rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] ${PHASE_COLOURS[phase]}`}>
              {phase} {count}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarScreen() {
  const tasks = useGardenStore((state) => state.tasks);
  const setCurrentTask = useGardenStore((state) => state.setCurrentTask);

  const todayDate = new Date();
  const todayKey = toDateKey(todayDate);

  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = addDays(getWeekStart(todayDate), weekOffset * 7);

  const weekLabel = (() => {
    const end = addDays(weekStart, 6);
    if (weekOffset === 0) return `This week — ${formatMonthYear(weekStart)}`;
    if (weekOffset === -1) return `Last week — ${formatMonthYear(weekStart)}`;
    if (weekOffset === 1) return `Next week — ${formatMonthYear(weekStart)}`;
    return `${formatMonthYear(weekStart)} · w/c ${formatDayNum(weekStart)}`;
  })();

  function handleSelectTask(taskId: string) {
    setCurrentTask(taskId);
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-sienna">✦ Calendar</p>
          <h1 className="mt-1 font-display text-[52px] leading-none tracking-[-0.02em] text-ink lg:text-[60px]">
            {weekLabel}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset((o) => o - 1)}
            className="rounded-full border border-rule px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted transition hover:border-sienna hover:text-sienna"
          >
            ← prev
          </button>
          {weekOffset !== 0 ? (
            <button
              onClick={() => setWeekOffset(0)}
              className="rounded-full border border-sienna bg-sienna px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-paper transition hover:opacity-80"
            >
              today
            </button>
          ) : null}
          <button
            onClick={() => setWeekOffset((o) => o + 1)}
            className="rounded-full border border-rule px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted transition hover:border-sienna hover:text-sienna"
          >
            next →
          </button>
        </div>
      </div>

      {/* Week summary bar */}
      <div className="mb-5">
        <WeekSummary weekStart={weekStart} today={todayKey} tasks={tasks} />
      </div>

      {/* Week grid */}
      <WeekView
        weekStart={weekStart}
        today={todayKey}
        tasks={tasks}
        onSelectTask={handleSelectTask}
      />

      {/* Legend */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">Phase key</span>
        {(['deep', 'admin', 'creative', 'review'] as PhaseId[]).map((phase) => (
          <span key={phase} className={`rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] ${PHASE_COLOURS[phase]}`}>
            {phase}
          </span>
        ))}
      </div>
    </div>
  );
}
