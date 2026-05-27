"use client";

import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import type { OBBox } from "@/lib/indicators/orderBlocks";

interface Props {
  chart: IChartApi;
  series: ISeriesApi<"Candlestick">;
  boxes: OBBox[];
}

// Active OBs
const BULL_FILL    = "rgba(38, 166, 154, 0.10)";
const BULL_BORDER  = "#26a69a";
const BEAR_FILL    = "rgba(239, 83, 80, 0.10)";
const BEAR_BORDER  = "#ef5350";

// Breaker Blocks (inverted color)
const BRK_BULL_FILL   = "rgba(239, 83, 80, 0.07)"; // was bear OB → now bullish breaker
const BRK_BULL_BORDER = "#ef535099";
const BRK_BEAR_FILL   = "rgba(38, 166, 154, 0.10)"; // was bull OB → now bearish breaker
const BRK_BEAR_BORDER = "#26a69a99";

export function OrderBlockOverlay({ chart, series, boxes }: Props) {
  const ts = chart.timeScale();

  const chartWidth =
    (chart as unknown as { _private__container?: HTMLElement })
      ?._private__container?.getBoundingClientRect().width ?? 800;

  const elements: React.ReactNode[] = [];

  for (const ob of boxes) {
    const x1  = ts.timeToCoordinate(ob.time as UTCTimestamp);
    const x2r = ts.timeToCoordinate(ob.endTime as UTCTimestamp);
    const yH  = series.priceToCoordinate(ob.high);
    const yL  = series.priceToCoordinate(ob.low);

    if (x1 === null || yH === null || yL === null) continue;

    // Breakers end at the mitigation candle; active OBs extend to right
    const x2 = ob.isBreaker
      ? (x2r !== null ? x2r + 40 : x1 + 100)
      : (x2r !== null ? x2r + 60 : chartWidth + 40);

    const boxLeft   = Math.min(x1, x2);
    const boxRight  = Math.max(x1, x2);
    const boxTop    = Math.min(yH, yL);
    const boxHeight = Math.max(2, Math.abs(yL - yH));
    const boxMidY   = boxTop + boxHeight / 2;

    let fill: string, stroke: string, dash = "none";
    let opacity = 1;

    if (ob.isBreaker) {
      // Breaker: inverted color + dashed
      fill   = ob.type === "bull" ? BRK_BULL_FILL   : BRK_BEAR_FILL;
      stroke = ob.type === "bull" ? BRK_BULL_BORDER : BRK_BEAR_BORDER;
      dash   = "5,3";
      opacity = 0.8;
    } else {
      fill   = ob.type === "bull" ? BULL_FILL   : BEAR_FILL;
      stroke = ob.type === "bull" ? BULL_BORDER : BEAR_BORDER;
    }

    const patternId = ob.isBreaker ? `ob-hatch-${ob.id}` : null;

    elements.push(
      <g key={ob.id} opacity={opacity}>
        {patternId && (
          <defs>
            <pattern id={patternId} patternUnits="userSpaceOnUse" width={7} height={7} patternTransform="rotate(45)">
              <line x1={0} y1={0} x2={0} y2={7} stroke={stroke} strokeWidth={1.2} opacity={0.4} />
            </pattern>
          </defs>
        )}

        {/* Zone rectangle */}
        <rect
          x={boxLeft} y={boxTop}
          width={boxRight - boxLeft} height={boxHeight}
          fill={fill} stroke={stroke} strokeWidth={0.8} strokeDasharray={dash}
        />

        {/* Breaker hatch overlay */}
        {patternId && (
          <rect
            x={boxLeft} y={boxTop}
            width={boxRight - boxLeft} height={boxHeight}
            fill={`url(#${patternId})`}
          />
        )}

        {/* Mid line */}
        <line
          x1={boxLeft} x2={boxRight}
          y1={boxMidY} y2={boxMidY}
          stroke={stroke} strokeWidth={0.5} strokeDasharray="3,4" opacity={0.45}
        />

        {/* Label */}
        <text
          x={boxRight - 4}
          y={ob.type === "bull" ? boxTop + 10 : boxTop + boxHeight - 4}
          textAnchor="end"
          fill={stroke} fontSize={9}
          fontFamily="var(--font-sans), Inter, system-ui, sans-serif"
          fontWeight={600} opacity={0.9}
        >
          {ob.isBreaker
            ? `BB ${ob.type === "bull" ? "↑" : "↓"}`
            : `${ob.fromCHoCH ? "★ " : ""}OB ${ob.type === "bull" ? "↑" : "↓"}`}
        </text>
      </g>,
    );
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
