export function StubScreen({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-garden">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">future wing</p>
      <h1 className="mt-3 font-display text-[76px] leading-none tracking-[-0.02em] text-ink">{title}</h1>
      <p className="mt-4 max-w-xl font-display text-[22px] italic text-ink-soft">
        This wing is marked for v2. Board, Blueprint, Focus, and Drafts are ready.
      </p>
    </div>
  );
}
