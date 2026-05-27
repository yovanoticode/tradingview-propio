"use client";

import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import type { StructureBreak, SwingPoint } from "@/lib/indicators/marketStructure";

interface Props {
  chart: IChartApi;
  series: ISeriesApi<"Candlestick">;
  breaks: StructureBreak[];
  swings: SwingPoint[];
  showSwings: boolean;
}

const BOS_BULL   = "#26a69a";
const BOS_BEAR   = "#ef5350";
const CHOCH_BULL = "#f59e0b";  // orange — reversal signal
const CHOCH_BEAR = "#f59e0b";

export function MarketStructureOverlay({ chart, series, breaks, swings, showSwings }: Props) {
  const ts = chart.timeScale();
  const elements: React.ReactNode[] = [];

  // ── Structure breaks ───────────────────────────────────────────────────
  for (const brk of breaks) {
    const xBreak = ts.timeToCoordinate(brk.breakTime as UTCTimestamp);
    const xSwing = ts.timeToCoordinate(brk.swingTime as UTCTimestamp);
    const y      = series.priceToCoordinate(brk.level);

    if (xBreak === null || xSwing === null || y === null) continue;

    const isCHoCH = brk.type === "choch";
    const color   = isCHoCH
      ? (brk.direction === "bull" ? CHOCH_BULL : CHOCH_BEAR)
      : (brk.direction === "bull" ? BOS_BULL   : BOS_BEAR);

    const x1 = Math.min(xSwing, xBreak);
    const x2 = Math.max(xSwing, xBreak);

    elements.push(
      <g key={brk.id}>
        {/* Horizontal line from swing to break */}
        <line
          x1={x1} x2={x2}
          y1={y}  y2={y}
          stroke={color}
          strokeWidth={isCHoCH ? 1.2 : 0.8}
          strokeDasharray={isCHoCH ? "none" : "5,3"}
          opacity={isCHoCH ? 0.9 : 0.7}
        />
        {/* Small tick at break point */}
        <line
          x1={xBreak} x2={xBreak}
          y1={y - 4}  y2={y + 4}
          stroke={color} strokeWidth={1.5} opacity={0.9}
        />
        {/* Label */}
        <text
          x={xBreak + 5}
          y={brk.direction === "bull" ? y - 4 : y + 11}
          fill={color}
          fontSize={9}
          fontFamily="var(--font-sans), Inter, system-ui, sans-serif"
          fontWeight={700}
          opacity={0.95}
        >
          {isCHoCH ? "CHoCH" : "BOS"}
        </text>
      </g>,
    );
  }

  // ── Swing highs / lows ─────────────────────────────────────────────────
  if (showSwings) {
    for (const sw of swings) {
      const x = ts.timeToCoordinate(sw.time as UTCTimestamp);
      const y = series.priceToCoordinate(sw.price);
      if (x === null || y === null) continue;

      const isHigh = sw.type === "high";
      // Small triangle pointing down for swing high, up for swing low
      const size = 4;
      const points = isHigh
        ? `${x},${y + 2} ${x - size},${y + 2 + size * 1.5} ${x + size},${y + 2 + size * 1.5}`
        : `${x},${y - 2} ${x - size},${y - 2 - size * 1.5} ${x + size},${y - 2 - size * 1.5}`;

      elements.push(
        <polygon
          key={`sw-${sw.time}-${sw.type}`}
          points={points}
          fill={isHigh ? "#ef535060" : "#26a69a60"}
          stroke={isHigh ? BOS_BEAR : BOS_BULL}
          strokeWidth={0.6}
        />,
      );
    }
  }

  if (elements.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      style={{ overflow: "visible" }}
    >
      {elements}
    </svg>
  );
}
