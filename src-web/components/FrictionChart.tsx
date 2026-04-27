import type { FrictionHistory } from '../types';

interface FrictionChartProps {
  history: FrictionHistory;
}

export function FrictionChart({ history }: FrictionChartProps) {
  const width = 1180;
  const height = 200;
  const max = Math.max(...history, 60);
  const min = Math.min(...history, 0);
  const points = history.map((value, index) => {
    const x = (index / (history.length - 1)) * width;
    const y = height - ((value - min) / (max - min)) * 150 - 24;
    return { x, y, value };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `0,${height} ${line} ${width},${height}`;
  const first = points[0];
  const last = points.at(-1) ?? first;

  return (
    <section className="rounded-[20px] border border-rule bg-paper p-7">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-leaf">
            ✦ Friction floor
          </p>
          <div className="mt-2 flex items-baseline gap-4">
            <span className="font-display text-[64px] leading-none text-sienna">{history.at(-1)}</span>
            <span className="font-display text-xl italic text-ink-soft">minutes the chair holds you</span>
          </div>
        </div>
        <div className="max-w-md text-right">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
            21 days · sown Apr 9
          </p>
          <p className="mt-2 font-display text-[17px] italic text-ink-soft">
            Started at 18 minutes. Today the climb is visible.
          </p>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height + 32}`} className="h-[232px] w-full overflow-visible" role="img">
        <defs>
          <linearGradient id="hillFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#A8552A" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#A8552A" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1="0"
            x2={width}
            y1={height * ratio}
            y2={height * ratio}
            stroke="#D4C49E"
            strokeDasharray="8 10"
          />
        ))}
        <polygon points={area} fill="url(#hillFill)" />
        <polyline points={line} fill="none" stroke="#A8552A" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
        <circle cx={first.x} cy={first.y} r="7" fill="#F2EBDD" stroke="#9A8A6B" strokeWidth="1.5" />
        <circle cx={last.x} cy={last.y} r="11" fill="#FAF5E9" stroke="#A8552A" strokeWidth="2.5" />
        <circle cx={last.x} cy={last.y} r="2.5" fill="#A8552A" />
        <text x="0" y={height + 24} fontFamily="Instrument Serif" fontSize="11" fontStyle="italic" fill="#6B5E45">
          day 1 · {history[0]} min
        </text>
        <text x={width * 0.32} y={height + 24} fontFamily="Instrument Serif" fontSize="11" fontStyle="italic" fill="#6B5E45">
          day 7
        </text>
        <text x={width * 0.64} y={height + 24} fontFamily="Instrument Serif" fontSize="11" fontStyle="italic" fill="#6B5E45">
          day 14
        </text>
        <text
          x={width}
          y={height + 24}
          textAnchor="end"
          fontFamily="JetBrains Mono"
          fontSize="11"
          fontWeight="700"
          fill="#A8552A"
        >
          TODAY · {history.at(-1)} MIN ↑
        </text>
      </svg>
    </section>
  );
}
