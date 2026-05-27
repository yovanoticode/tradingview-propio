"use client";

import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import type { FVGBox } from "@/lib/indicators/fvg";

interface Props {
  chart: IChartApi;
  series: ISeriesApi<"Candlestick">;
  boxes: FVGBox[];
  paneHeight: number;
}

// Active zones
const BULL_FILL    = "rgba(38, 166, 154, 0.10)";
const BULL_BORDER  = "#26a69a";
const BEAR_FILL    = "rgba(239, 83, 80, 0.10)";
const BEAR_BORDER  = "#ef5350";

// CE-touched
const BULL_CE_FILL   = "rgba(38, 166, 154, 0.05)";
const BEAR_CE_FILL   = "rgba(239, 83, 80, 0.05)";

// IFVG
const IFVG_BULL_FILL   = "rgba(239, 83, 80, 0.08)";
const IFVG_BULL_BORDER = "#ef535088";
const IFVG_BEAR_FILL   = "rgba(38, 166, 154, 0.08)";
const IFVG_BEAR_BORDER = "#26a69a88";

export function FVGOverlay({ chart, series, boxes }: Props) {
  const ts = chart.timeScale();

  const chartWidth = (chart as unknown as { _private__container?: HTMLElement })
    ?._private__container?.getBoundingClientRect().width ?? 800;

  const elements: React.ReactNode[] = [];

  for (const box of boxes) {
    const x1 = ts.timeToCoordinate(box.startTime as UTCTimestamp);
    const x2raw = ts.timeToCoordinate(box.endTime as UTCTimestamp);
    const yH = series.priceToCoordinate(box.high);
    const yL = series.priceToCoordinate(box.low);

    if (x1 === null || yH === null || yL === null) continue;

    // Unmitigated / CE-touched: extend to right edge
    // IFVG: ends at mitigation candle (fixed width)
    const x2 = box.isIFVG
      ? (x2raw !== null ? x2raw + 48 : x1 + 120)
      : (x2raw !== null ? x2raw + 60 : chartWidth + 40);

    const boxLeft   = Math.min(x1, x2);
    const boxRight  = Math.max(x1, x2);
    const boxTop    = Math.min(yH, yL);
    const boxHeight = Math.max(2, Math.abs(yL - yH));
    const boxMidY   = boxTop + boxHeight / 2;

    // Style per state
    let fill: string;
    let stroke: string;
    let borderDash = "none";
    let midOpacity = 0.5;
    let overallOpacity = 1;

    if (box.isIFVG) {
      // IFVG: inverted color — bull FVG filled becomes bearish IFVG, bear becomes bullish
      fill   = box.type === "bull" ? IFVG_BULL_FILL   : IFVG_BEAR_FILL;
      stroke = box.type === "bull" ? IFVG_BULL_BORDER : IFVG_BEAR_BORDER;
      borderDash = "4,3";
      midOpacity = 0.4;
    } else if (box.mitigation === "ce") {
      // CE-touched: faded, dashed — visited but not invalidated
      fill   = box.type === "bull" ? BULL_CE_FILL : BEAR_CE_FILL;
      stroke = box.type === "bull" ? BULL_BORDER  : BEAR_BORDER;
      borderDash = "3,4";
      midOpacity = 0.25;
      overallOpacity = 0.7;
    } else {
      // Active — full opacity
      fill   = box.type === "bull" ? BULL_FILL   : BEAR_FILL;
      stroke = box.type === "bull" ? BULL_BORDER : BEAR_BORDER;
    }

    const patternId = `ifvg-hatch-${box.id}`;

    elements.push(
      <g key={box.id} opacity={overallOpacity}>
        {/* IFVG hatch pattern def */}
        {box.isIFVG && (
          <defs>
            <pattern id={patternId} patternUnits="userSpaceOnUse" width={8} height={8} patternTransform="rotate(45)">
              <line x1={0} y1={0} x2={0} y2={8} stroke={stroke} strokeWidth={1.5} opacity={0.35} />
            </pattern>
          </defs>
        )}

        {/* Gap zone — solid fill */}
        <rect
          x={boxLeft}
          y={boxTop}
          width={boxRight - boxLeft}
          height={boxHeight}
          fill={fill}
          stroke={stroke}
          strokeWidth={0.6}
          strokeDasharray={borderDash}
        />

        {/* IFVG hatch overlay */}
        {box.isIFVG && (
          <rect
            x={boxLeft}
            y={boxTop}
            width={boxRight - boxLeft}
            height={boxHeight}
            fill={`url(#${patternId})`}
          />
        )}

        {/* CE line (Consequent Encroachment — 50%) */}
        <line
          x1={boxLeft}
          x2={boxRight}
          y1={boxMidY}
          y2={boxMidY}
          stroke={stroke}
          strokeWidth={0.6}
          strokeDasharray="4,4"
          opacity={midOpacity}
        />

        {/* Label */}
        <text
          x={boxRight - 4}
          y={box.type === "bull" ? boxTop + 10 : boxTop + boxHeight - 4}
          textAnchor="end"
          fill={stroke}
          fontSize={9}
          fontFamily="var(--font-sans), Inter, system-ui, sans-serif"
          fontWeight={600}
          opacity={box.isIFVG ? 0.7 : 0.9}
        >
          {box.isIFVG ? `IFVG ${box.label}` : box.label}
          {box.mitigation === "ce" && !box.isIFVG ? " ⚡" : ""}
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
