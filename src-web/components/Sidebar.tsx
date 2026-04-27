import { useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useGardenStore } from '../store/useGardenStore';

export function Sidebar() {
  const goal = useGardenStore((state) => state.goal);
  const tasks = useGardenStore((state) => state.tasks);
  const brainDumpItems = useGardenStore((state) => state.brainDumpItems);
  const habits = useGardenStore((state) => state.habits);
  const userName = useGardenStore((state) => state.userName);
  const setUserName = useGardenStore((state) => state.setUserName);
  const resetAppData = useGardenStore((state) => state.resetAppData);
  const visibleBrainDumpCount = brainDumpItems.filter((item) => item.status === 'pile').length;
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const navItems = [
    { to: '/', label: 'Board', note: String(tasks.filter((task) => task.status !== 'done').length) },
    { to: '/goal', label: 'Blueprint', note: goal.title ? 'set' : 'empty' },
    { to: '/brain-dump', label: 'Drafts', note: visibleBrainDumpCount ? String(visibleBrainDumpCount) : 'cmd-K' },
    { to: '/habits', label: 'Habits', note: String(habits.filter((habit) => habit.status !== 'archived').length) },
    { to: '/calendar', label: 'Calendar', note: 'soon' },
    { to: '/review', label: 'Review', note: 'soon' },
  ];

  return (
    <aside className="sticky top-0 flex h-screen w-[244px] shrink-0 flex-col justify-between border-r border-rule bg-bg px-[22px] py-8">
      <div>
        <div className="mb-10">
          <div className="font-display text-4xl leading-none text-sienna">Architect</div>
          <div className="mt-1 font-display text-[12px] italic text-ink-soft">design the life you're building</div>
          <div className="mt-3">
            {editingName ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setUserName(nameDraft.trim());
                  setEditingName(false);
                }}
                className="flex items-center gap-2"
              >
                <input
                  ref={nameInputRef}
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  autoFocus
                  placeholder="Your name"
                  className="w-full rounded-full border border-rule bg-bg px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink outline-none focus:border-sienna"
                  onBlur={() => {
                    setUserName(nameDraft.trim());
                    setEditingName(false);
                  }}
                />
              </form>
            ) : (
              <button
                type="button"
                onClick={() => { setNameDraft(userName); setEditingName(true); }}
                className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted hover:text-sienna transition"
              >
                {userName ? `hi, ${userName} ↗` : '+ set your name'}
              </button>
            )}
          </div>
        </div>

        <nav className="flex flex-col gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-full px-4 py-3 transition ${
                  isActive
                    ? 'bg-sienna font-display text-[17px] text-paper'
                    : 'font-body text-[14px] font-medium text-ink hover:bg-paper'
                }`
              }
            >
              <span>{item.label}</span>
              <span className="font-display text-[11px] italic opacity-75">{item.note}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <section className="rounded-2xl border border-rule bg-paper p-5">
        <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
          Blueprint
        </p>
        <h2 className="font-display text-[22px] leading-tight text-ink">
          {goal.title || 'No blueprint set yet'}
        </h2>
        <p className="mt-3 text-[12px] leading-5 text-ink-soft">
          {goal.title ? `started ${goal.sownDaysAgo} days ago · target ${goal.harvestBy || 'not set'}` : 'Set your blueprint on the Goal screen.'}
        </p>
        <p className="mt-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-sienna">
          {(goal.xpTotal ?? 0)} / {(goal.xpTarget ?? 300)} XP
        </p>
        <button
          type="button"
          onClick={resetAppData}
          className="mt-4 rounded-full border border-rule px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted transition hover:border-sienna hover:text-sienna"
        >
          reset plan
        </button>
      </section>
    </aside>
  );
}
