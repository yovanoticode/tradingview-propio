"use client";

import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import type { HorizLevel, VertLine } from "@/lib/indicators/levels";
import type { LabelSize } from "@/lib/store/chart-store";

interface Props {
  chart: IChartApi;
  series: ISeriesApi<"Candlestick">;
  openingPrices: HorizLevel[];
  dwm: HorizLevel[];
  timestamps: VertLine[];
  textColor: string;
  labelSize: LabelSize;
  paneHeight: number;
}

const FS: Record<LabelSize, number> = { small: 9, medium: 11, large: 13 };
const EXTEND_X = 9999;

export function LevelsOverlay({
  chart,
  series,
  openingPrices,
  dwm,
  timestamps,
  textColor,
  labelSize,
  paneHeight,
}: Props) {
  const ts = chart.timeScale();
  const fs = FS[labelSize];
  const elements: React.ReactNode[] = [];

  // ── Timestamps (vertical lines) ──────────────────────────────
  for (const vl of timestamps) {
    const x = ts.timeToCoordinate(vl.time as UTCTimestamp);
    if (x === null) continue;

    elements.push(
      <line
        key={`ts-${vl.time}`}
        x1={x} x2={x}
        y1={0} y2={paneHeight}
        stroke={vl.color}
        strokeWidth={1}
        strokeDasharray="3,3"
        opacity={0.5}
      />,
    );

    if (vl.label) {
      elements.push(
        <text
          key={`ts-label-${vl.time}`}
          x={x + 3}
          y={paneHeight - 6}
          fontSize={fs}
          fill={textColor}
          style={{ userSelect: "none", fontFamily: "system-ui, sans-serif" }}
        >
          {vl.label}
        </text>,
      );
    }
  }

  // ── Horizontal level renderer ─────────────────────────────────
  function renderHorizLevels(levels: HorizLevel[]) {
    const paneWidth = ts.width();
    
    for (const lvl of levels) {
      const x1 = ts.timeToCoordinate(lvl.startTime as UTCTimestamp);
      if (x1 === null) continue;
      const y = series.priceToCoordinate(lvl.price);
      if (y === null) continue;

      const x2 = lvl.extend ? paneWidth : (ts.timeToCoordinate(lvl.endTime as UTCTimestamp) ?? paneWidth);

      elements.push(
        <line
          key={`hl-${lvl.startTime}-${lvl.price}-${lvl.label}`}
          x1={x1} x2={x2}
          y1={y} y2={y}
          stroke={lvl.color}
          strokeWidth={1}
          strokeDasharray={lvl.dash ? "5,3" : undefined}
          opacity={0.85}
        />,
      );

      if (lvl.label) {
        elements.push(
          <text
            key={`hl-label-${lvl.startTime}-${lvl.price}-${lvl.label}`}
            x={lvl.extend ? paneWidth - 6 : x2 - 3}
            y={y - 4}
            fontSize={fs}
            fill={lvl.color}
            textAnchor="end"
            style={{ userSelect: "none", fontFamily: "system-ui, sans-serif", fontWeight: 600 }}
          >
            {lvl.label}
          </text>,
        );
      }
    }
  }

  renderHorizLevels(openingPrices);
  renderHorizLevels(dwm);

  if (elements.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      overflow="hidden"
    >
      {elements}
    </svg>
  );
}
