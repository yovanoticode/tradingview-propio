import { X } from "lucide-react";

interface Props {
  aX: number;
  aY: number;
  bX: number;
  bY: number;
  priceA: number;
  priceB: number;
  paneWidth: number;
  isPreview?: boolean;
  onRemove?: () => void;
}

const LEVELS = [
  { value: 0, color: "#787b86" },
  { value: 0.236, color: "#f44336" },
  { value: 0.382, color: "#81c784" },
  { value: 0.5, color: "#f44336" },
  { value: 0.618, color: "#009688" },
  { value: 0.786, color: "#64b5f6" },
  { value: 1, color: "#787b86" },
];

export function FibonacciOverlay({ aX, aY, bX, bY, priceA, priceB, paneWidth, isPreview, onRemove }: Props) {
  const left = Math.min(aX, bX);
  const right = paneWidth;

  return (
    <>
      <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" style={{ overflow: "visible" }}>
        <line
          x1={aX}
          y1={aY}
          x2={bX}
          y2={bY}
          stroke="#787b86"
          strokeWidth={1}
          strokeDasharray="4,4"
          opacity={isPreview ? 0.5 : 0.8}
        />
        {LEVELS.map((lvl) => {
          const y = bY + (aY - bY) * lvl.value;
          return (
            <g key={`fib-${lvl.value}`}>
              <line
                x1={left}
                x2={right}
                y1={y}
                y2={y}
                stroke={lvl.color}
                strokeWidth={1}
                opacity={isPreview ? 0.5 : 0.8}
              />
              <text
                x={right - 75}
                y={y - 4}
                fill={lvl.color}
                fontSize={10}
                textAnchor="end"
                fontFamily="sans-serif"
              >
                {lvl.value.toFixed(3)}
              </text>
            </g>
          );
        })}
      </svg>
      {!isPreview && onRemove && (
        <button
          onClick={onRemove}
          className="pointer-events-auto absolute flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-tv-panel text-tv-text-muted hover:text-tv-red z-20"
          style={{ top: aY, left: Math.max(left - 20, 4) }}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </>
  );
}
