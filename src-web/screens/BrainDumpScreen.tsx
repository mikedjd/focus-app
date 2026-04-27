import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { useGardenStore } from '../store/useGardenStore';

export function BrainDumpScreen() {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const brainDumpItems = useGardenStore((state) => state.brainDumpItems);
  const addBrainDumpItem = useGardenStore((state) => state.addBrainDumpItem);
  const convertBrainDumpToTask = useGardenStore((state) => state.convertBrainDumpToTask);
  const parkBrainDumpItem = useGardenStore((state) => state.parkBrainDumpItem);
  const deleteBrainDumpItem = useGardenStore((state) => state.deleteBrainDumpItem);
  const visibleItems = useMemo(
    () => brainDumpItems.filter((item) => item.status === 'pile'),
    [brainDumpItems],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    addBrainDumpItem(draft);
    setDraft('');
  }

  return (
    <div className="mx-auto max-w-compost">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
        compost · {visibleItems.length} in the pile
      </p>
      <h1 className="mt-3 max-w-4xl font-display text-[64px] leading-none tracking-[-0.02em] text-ink lg:text-[76px]">
        Out of the head, onto the heap.
      </h1>

      <form
        onSubmit={handleSubmit}
        className="mt-9 flex items-center gap-4 rounded-[20px] border border-rule bg-paper p-5 shadow-soft"
      >
        <span className="h-3 w-3 shrink-0 rounded-full bg-leaf" />
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          autoFocus
          className="min-w-0 flex-1 bg-transparent font-display text-[26px] italic text-ink outline-none placeholder:text-ink-muted"
          placeholder="Drop the thought. We'll compost it later."
        />
        <button className="shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
          ↵ drop
        </button>
      </form>

      <section className="mt-10 flex flex-wrap items-start gap-5">
        {visibleItems.map((item, index) => (
          <article
            key={item.id}
            className={`w-full max-w-[320px] rounded-2xl border border-rule p-5 shadow-soft ${
              index % 2 === 0 ? 'bg-paper' : 'bg-[#FAEBC9]'
            }`}
            style={{ transform: `rotate(${item.tilt}deg)` }}
          >
            <p className="font-display text-[21px] leading-7 text-ink">{item.body}</p>
            <p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
              {item.caughtAt}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="ink" className="px-3 py-1.5 text-[11px]" onClick={() => convertBrainDumpToTask(item.id)}>
                → task
              </Button>
              <Button variant="ghost" className="px-3 py-1.5 text-[11px]" onClick={() => parkBrainDumpItem(item.id)}>
                → park
              </Button>
              <Button variant="ghost" className="px-3 py-1.5 text-[11px]" onClick={() => deleteBrainDumpItem(item.id)}>
                let go
              </Button>
            </div>
          </article>
        ))}
      </section>

      <p className="mt-10 font-display text-[20px] italic text-ink-soft">
        Triage takes ten minutes at the end of phase 3 — not now. Let it sit.
      </p>
    </div>
  );
}
