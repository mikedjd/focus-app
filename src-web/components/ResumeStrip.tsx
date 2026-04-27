import { useNavigate } from 'react-router-dom';
import { Button } from './Button';
import { useGardenStore } from '../store/useGardenStore';

export function ResumeStrip() {
  const resumeState = useGardenStore((state) => state.resumeState);
  const resumeLastTask = useGardenStore((state) => state.resumeLastTask);
  const navigate = useNavigate();

  if (!resumeState) return null;

  return (
    <section className="-rotate-[0.3deg] rounded-2xl border border-sienna bg-sienna-soft px-6 py-4 shadow-soft">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="text-[14px] text-ink">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-sienna">
            ↪ Resume
          </span>{' '}
          — "{resumeState.note}" — {resumeState.timestampLabel}
        </p>
        <Button
          className="shrink-0 py-2.5"
          onClick={() => {
            resumeLastTask();
            navigate('/focus');
          }}
        >
          Pick it up →
        </Button>
      </div>
    </section>
  );
}
