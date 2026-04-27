import { OneRowCard } from '../components/OneRowCard';
import { PhaseColumns } from '../components/PhaseColumns';
import { PhasePills } from '../components/PhasePills';
import { ResumeStrip } from '../components/ResumeStrip';
import { useGardenStore } from '../store/useGardenStore';

export function TodayScreen() {
  const tasks = useGardenStore((state) => state.tasks);
  const currentTaskId = useGardenStore((state) => state.currentTaskId);
  const currentTask = tasks.find((task) => task.id === currentTaskId) ?? tasks[0];

  return (
    <div className="mx-auto max-w-garden">
      <div className="space-y-6">
        <ResumeStrip />

        <section>
          <PhasePills />
          <h1 className="font-display text-[64px] leading-none tracking-[-0.02em] text-ink lg:text-[72px]">
            Good morning, Mike.
          </h1>
          <p className="mt-4 max-w-[580px] font-display text-[22px] italic leading-8 text-ink-soft">
            Dew's still on the realtime sync. One row today — the others can wait.
          </p>
        </section>

        <OneRowCard task={currentTask} />
      </div>

      <div className="mt-14">
        <PhaseColumns />
      </div>
    </div>
  );
}
