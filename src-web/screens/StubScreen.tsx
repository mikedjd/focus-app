export function StubScreen({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-garden">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">reserved bed</p>
      <h1 className="mt-3 font-display text-[76px] leading-none tracking-[-0.02em] text-ink">{title}</h1>
      <p className="mt-4 max-w-xl font-display text-[22px] italic text-ink-soft">
        This patch is marked for v2. Today, Goal, Focus, and Brain dump are ready to tend.
      </p>
    </div>
  );
}
