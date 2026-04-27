import type { Goal } from '../types';

interface TrailSvgProps {
  goal: Goal;
}

const points = [
  { x: 88, y: 230 },
  { x: 270, y: 122 },
  { x: 505, y: 196 },
  { x: 742, y: 92 },
  { x: 1010, y: 168 },
];

export function TrailSvg({ goal }: TrailSvgProps) {
  const activeIndex = goal.milestones.findIndex((milestone) => milestone.state === 'up-next');
  const progressWidth = activeIndex <= 0 ? 255 : 520;

  return (
    <div className="overflow-hidden rounded-[20px] border border-rule bg-paper p-4">
      <svg viewBox="0 0 1100 340" className="h-[360px] w-full" role="img" aria-label="Goal trail">
        <path
          d="M 88 230 C 190 45, 305 74, 270 122 C 223 196, 390 294, 505 196 C 642 78, 681 38, 742 92 C 822 162, 912 237, 1010 168"
          fill="none"
          stroke="#A8552A"
          strokeLinecap="round"
          strokeWidth="3"
          opacity="0.85"
        />
        <path
          d="M 88 230 C 190 45, 305 74, 270 122 C 223 196, 390 294, 505 196"
          fill="none"
          stroke="#A8552A"
          strokeLinecap="round"
          strokeWidth="6"
          strokeDasharray={`${progressWidth} 1000`}
        />

        {goal.milestones.map((milestone, index) => {
          const point = points[index];
          const isDone = milestone.state === 'done';
          const isUpNext = milestone.state === 'up-next';

          return (
            <g key={milestone.id}>
              {isUpNext ? <circle cx={point.x} cy={point.y} r="32" fill="#A8552A" opacity="0.15" /> : null}
              <circle
                cx={point.x}
                cy={point.y}
                r="22"
                fill={isDone ? '#A8552A' : isUpNext ? '#FAF5E9' : '#F2EBDD'}
                stroke="#A8552A"
                strokeWidth={isUpNext ? 4 : 2}
              />
              <text
                x={point.x}
                y={point.y + 6}
                textAnchor="middle"
                fontFamily="Inter"
                fontSize="16"
                fontWeight="700"
                fill={isDone ? '#FAF5E9' : '#A8552A'}
              >
                {isDone ? '✓' : index + 1}
              </text>
              <text
                x={point.x}
                y={point.y + 58}
                textAnchor="middle"
                fontFamily="Inter"
                fontSize="13"
                fontWeight="600"
                fill={isDone ? '#9A8A6B' : '#2A2418'}
                textDecoration={isDone ? 'line-through' : 'none'}
              >
                {milestone.label}
              </text>
              {isUpNext ? (
                <text
                  x={point.x}
                  y={point.y + 78}
                  textAnchor="middle"
                  fontFamily="JetBrains Mono"
                  fontSize="10"
                  fontWeight="700"
                  fill="#A8552A"
                >
                  ↑ UP NEXT
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
