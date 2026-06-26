"use client";

import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import type { OTELevels } from "@/lib/indicators/ote";
import type { LabelSize } from "@/lib/store/chart-store";
const TV_YELLOW = "#ffb74d";

interface OTEProps {
  chart: IChartApi;
  series: ISeriesApi<"Candlestick">;
  ote: OTELevels | null;
  textColor: string;
  labelSize: LabelSize;
}

const FS: Record<LabelSize, number> = { small: 9, medium: 11, large: 13 };
const EXTEND_X = 9999;

export function OTEOverlay({ chart, series, ote, textColor, labelSize }: OTEProps) {
  if (!ote) return null;

  const ts = chart.timeScale();
  const fs = FS[labelSize];
  const elements: React.ReactNode[] = [];

  const startX = ts.timeToCoordinate(ote.swingStart.time as UTCTimestamp);
  const endX = ts.timeToCoordinate(ote.swingEnd.time as UTCTimestamp);

  if (startX === null || endX === null) return null;

  const minX = Math.min(startX, endX);

  for (const lvl of ote.levels) {
    const y = series.priceToCoordinate(lvl.price);
    if (y === null) continue;

    const isOTE = lvl.level === 0.62 || lvl.level === 0.705 || lvl.level === 0.79;
    const color = isOTE ? TV_YELLOW : textColor;
    const opacity = isOTE ? 0.9 : 0.5;

    elements.push(
      <line
        key={`ote-line-${lvl.level}`}
        x1={minX} x2={EXTEND_X}
        y1={y} y2={y}
        stroke={color}
        strokeWidth={isOTE ? 1.5 : 1}
        strokeDasharray={isOTE ? "none" : "4,4"}
        opacity={opacity}
      />,
    );

    elements.push(
      <text
        key={`ote-label-${lvl.level}`}
        x={minX + 5}
        y={y - 4}
        fontSize={fs}
        fill={color}
        textAnchor="start"
        style={{ userSelect: "none", fontFamily: "system-ui, sans-serif" }}
        opacity={opacity}
      >
        {`${lvl.level.toFixed(3)} (${lvl.price.toFixed(2)})`}
      </text>,
    );
  }

  // Draw the main trendline for the impulse
  const startY = series.priceToCoordinate(ote.swingStart.price);
  const endY = series.priceToCoordinate(ote.swingEnd.price);
  if (startY !== null && endY !== null) {
    elements.push(
      <line
        key="ote-trend"
        x1={startX} y1={startY}
        x2={endX} y2={endY}
        stroke={textColor}
        strokeWidth={1}
        strokeDasharray="2,2"
        opacity={0.3}
      />
    );
  }

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      overflow="hidden"
    >
      {elements}
    </svg>
  );
}
