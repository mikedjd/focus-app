import { NavLink } from 'react-router-dom';
import { useGardenStore } from '../store/useGardenStore';

const navItems = [
  { to: '/', label: 'Today', note: '5' },
  { to: '/goal', label: 'Goal', note: '1/3' },
  { to: '/brain-dump', label: 'Brain dump', note: 'cmd-K' },
  { to: '/habits', label: 'Habits', note: 'due' },
  { to: '/calendar', label: 'Calendar', note: 'soon' },
  { to: '/review', label: 'Review', note: 'Fri' },
];

export function Sidebar() {
  const goal = useGardenStore((state) => state.goal);

  return (
    <aside className="sticky top-0 flex h-screen w-[244px] shrink-0 flex-col justify-between border-r border-rule bg-bg px-[22px] py-8">
      <div>
        <div className="mb-10">
          <div className="font-display text-4xl leading-none text-sienna">Plot</div>
          <div className="mt-1 font-display text-[12px] italic text-ink-soft">tend the patch you've got</div>
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
          The patch
        </p>
        <h2 className="font-display text-[22px] leading-tight text-ink">{goal.title}</h2>
        <p className="mt-3 text-[12px] leading-5 text-ink-soft">
          sown {goal.sownDaysAgo} days ago · harvest by {goal.harvestBy}
        </p>
      </section>
    </aside>
  );
}
