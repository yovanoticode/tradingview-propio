"use client";

import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import type { AMDDay } from "@/lib/indicators/amd";
import type { LabelSize } from "@/lib/store/chart-store";

interface AMDProps {
  chart: IChartApi;
  series: ISeriesApi<"Candlestick">;
  days: AMDDay[];
  textColor: string;
  labelSize: LabelSize;
}

const FS: Record<LabelSize, number> = { small: 9, medium: 11, large: 13 };

export function AMDOverlay({ chart, series, days, textColor, labelSize }: AMDProps) {
  if (days.length === 0) return null;

  const ts = chart.timeScale();
  const fs = FS[labelSize];
  const elements: React.ReactNode[] = [];

  for (const day of days) {
    for (const phase of day.phases) {
      const x1 = ts.timeToCoordinate(phase.startTime as UTCTimestamp);
      const x2 = ts.timeToCoordinate(phase.endTime as UTCTimestamp);
      const y1 = series.priceToCoordinate(phase.high);
      const y2 = series.priceToCoordinate(phase.low);

      if (x1 === null || x2 === null || y1 === null || y2 === null) continue;

      const top = Math.min(y1, y2);
      const bottom = Math.max(y1, y2);
      const left = Math.min(x1, x2);
      const right = Math.max(x1, x2);
      const width = Math.max(right - left, 2);
      const height = Math.max(bottom - top, 2);

      // Main phase box
      elements.push(
        <rect
          key={`amd-box-${day.dateKey}-${phase.type}`}
          x={left}
          y={top}
          width={width}
          height={height}
          fill={phase.color}
          stroke={phase.color.replace(/[\d.]+\)$/, "0.5)")}
          strokeWidth={1}
        />
      );

      // Label at the top
      elements.push(
        <text
          key={`amd-label-${day.dateKey}-${phase.type}`}
          x={left + 2}
          y={top - 4}
          fontSize={fs}
          fill={textColor}
          style={{ userSelect: "none", fontFamily: "system-ui, sans-serif" }}
          opacity={0.7}
        >
          {phase.type === "accumulation" ? "A" : phase.type === "manipulation" ? "M" : "D"}
        </text>
      );
    }
  }

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[5] h-full w-full"
      overflow="hidden"
    >
      {elements}
    </svg>
  );
}
