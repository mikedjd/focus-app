import { FormEvent, useState } from 'react';
import { BuildXpPanel } from '../components/BuildXpPanel';
import { Button } from '../components/Button';
import { FrictionChart } from '../components/FrictionChart';
import { TrailSvg } from '../components/TrailSvg';
import { useGardenStore } from '../store/useGardenStore';
import { DEFAULT_XP_TARGET } from '../lib/xp';

function GoalSetupForm() {
  const updateGoal = useGardenStore((state) => state.updateGoal);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [harvestBy, setHarvestBy] = useState('');
  const [whyQuote, setWhyQuote] = useState('');
  const [practicalReason, setPracticalReason] = useState('');
  const [emotionalReason, setEmotionalReason] = useState('');
  const [costOfDrift, setCostOfDrift] = useState('');
  const [xpTarget, setXpTarget] = useState(DEFAULT_XP_TARGET);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;

    updateGoal({
      title,
      target,
      harvestBy,
      whyQuote,
      practicalReason,
      emotionalReason,
      costOfDrift,
      xpTarget,
    });
  }

  return (
    <div className="mx-auto max-w-compost">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
        goal · not set
      </p>
      <h1 className="mt-3 font-display text-[72px] leading-none tracking-[-0.02em] text-ink lg:text-[88px]">
        Set your goal.
      </h1>
      <p className="mt-4 max-w-2xl font-display text-[20px] italic leading-8 text-ink-soft">
        What are you working toward? You can update this at any time.
      </p>

      <form onSubmit={handleSubmit} className="mt-9 grid gap-4 rounded-[20px] border border-rule bg-paper p-7 shadow-soft">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="rounded-2xl border border-rule bg-bg px-5 py-4 text-[16px] text-ink outline-none placeholder:text-ink-muted focus:border-sienna"
          placeholder="Goal title"
        />
        <input
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          className="rounded-2xl border border-rule bg-bg px-5 py-4 text-[15px] text-ink outline-none placeholder:text-ink-muted focus:border-sienna"
          placeholder="What does success look like?"
        />
        <input
          value={harvestBy}
          onChange={(event) => setHarvestBy(event.target.value)}
          className="rounded-2xl border border-rule bg-bg px-5 py-4 text-[15px] text-ink outline-none placeholder:text-ink-muted focus:border-sienna"
          placeholder="Target date"
        />
        <label className="rounded-2xl border border-rule bg-bg px-5 py-4 text-[15px] text-ink focus-within:border-sienna">
          <span className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
            XP target
          </span>
          <input
            type="number"
            min="1"
            value={xpTarget}
            onChange={(event) => setXpTarget(Number(event.target.value) || DEFAULT_XP_TARGET)}
            className="w-full bg-transparent text-[16px] outline-none"
          />
        </label>
        <textarea
          value={whyQuote}
          onChange={(event) => setWhyQuote(event.target.value)}
          className="min-h-24 rounded-2xl border border-rule bg-bg px-5 py-4 text-[15px] text-ink outline-none placeholder:text-ink-muted focus:border-sienna"
          placeholder="Why this matters, in your own words"
        />
        <div className="grid gap-4 md:grid-cols-2">
          <textarea
            value={practicalReason}
            onChange={(event) => setPracticalReason(event.target.value)}
            className="min-h-24 rounded-2xl border border-rule bg-bg px-5 py-4 text-[15px] text-ink outline-none placeholder:text-ink-muted focus:border-sienna"
            placeholder="Practical reason"
          />
          <textarea
            value={emotionalReason}
            onChange={(event) => setEmotionalReason(event.target.value)}
            className="min-h-24 rounded-2xl border border-rule bg-bg px-5 py-4 text-[15px] text-ink outline-none placeholder:text-ink-muted focus:border-sienna"
            placeholder="Emotional reason"
          />
        </div>
        <textarea
          value={costOfDrift}
          onChange={(event) => setCostOfDrift(event.target.value)}
          className="min-h-24 rounded-2xl border border-rule bg-bg px-5 py-4 text-[15px] text-ink outline-none placeholder:text-ink-muted focus:border-sienna"
          placeholder="Cost of drift"
        />
        <Button type="submit" className="mt-2 w-fit">
          Save goal
        </Button>
      </form>
    </div>
  );
}

export function GoalScreen() {
  const goal = useGardenStore((state) => state.goal);
  const frictionHistory = useGardenStore((state) => state.frictionHistory);

  if (!goal.title) {
    return <GoalSetupForm />;
  }

  return (
    <div className="mx-auto max-w-garden">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
        goal · started {goal.startedAt}
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
          {goal.whyQuote ? (
            <blockquote className="mt-4 max-w-3xl font-display text-[32px] italic leading-[1.15] text-ink">
              “{goal.whyQuote}”
            </blockquote>
          ) : (
            <p className="mt-4 text-[15px] leading-7 text-ink-soft">Add a note on why this matters when motivation dips.</p>
          )}
          <div className="my-7 border-t border-dashed border-rule" />
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                Practical
              </p>
              <p className="mt-2 text-[14px] leading-6 text-ink-soft">{goal.practicalReason || 'Not filled yet.'}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                Emotional
              </p>
              <p className="mt-2 text-[14px] leading-6 text-ink-soft">{goal.emotionalReason || 'Not filled yet.'}</p>
            </div>
          </div>
        </div>

        <aside className="rounded-[20px] border border-sienna bg-sienna-soft p-7">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-sienna">
            Cost of drift
          </p>
          <p className="mt-4 font-display text-[26px] italic leading-8 text-ink">
            “{goal.costOfDrift || 'Name what happens if this keeps drifting.'}”
          </p>
        </aside>
      </section>

      <div className="mt-7">
        <BuildXpPanel goal={goal} />
      </div>

      <div className="mt-7">
        <FrictionChart history={frictionHistory} startedAt={goal.startedAt} />
      </div>
    </div>
  );
}
