import { FrictionChart } from '../components/FrictionChart';
import { TrailSvg } from '../components/TrailSvg';
import { useGardenStore } from '../store/useGardenStore';

export function GoalScreen() {
  const goal = useGardenStore((state) => state.goal);
  const frictionHistory = useGardenStore((state) => state.frictionHistory);

  return (
    <div className="mx-auto max-w-garden">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
        the trail · started {goal.startedAt}
      </p>
      <h1 className="mt-3 font-display text-[72px] leading-none tracking-[-0.02em] text-ink lg:text-[88px]">
        {goal.title}
      </h1>
      <p className="mt-4 font-display text-[18px] italic text-ink-soft">{goal.target}</p>

      <div className="mt-12">
        <TrailSvg goal={goal} />
      </div>

      <section className="mt-7 grid gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-[20px] border border-rule bg-paper p-8">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-leaf">
            ✦ Why it matters
          </p>
          <blockquote className="mt-4 max-w-3xl font-display text-[32px] italic leading-[1.15] text-ink">
            “{goal.whyQuote}”
          </blockquote>
          <div className="my-7 border-t border-dashed border-rule" />
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                Practical
              </p>
              <p className="mt-2 text-[14px] leading-6 text-ink-soft">{goal.practicalReason}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                Emotional
              </p>
              <p className="mt-2 text-[14px] leading-6 text-ink-soft">{goal.emotionalReason}</p>
            </div>
          </div>
        </div>

        <aside className="rounded-[20px] border border-sienna bg-sienna-soft p-7">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-sienna">
            Cost of drift
          </p>
          <p className="mt-4 font-display text-[26px] italic leading-8 text-ink">“{goal.costOfDrift}”</p>
        </aside>
      </section>

      <div className="mt-7">
        <FrictionChart history={frictionHistory} />
      </div>
    </div>
  );
}
