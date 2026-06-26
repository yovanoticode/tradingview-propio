"use client";

import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import type { MacroBox } from "@/lib/indicators/ict-macros";

interface Props {
  chart: IChartApi;
  series: ISeriesApi<"Candlestick">;
  boxes: MacroBox[];
  paneHeight: number;
}

export function IctMacrosOverlay({ chart, series, boxes, paneHeight }: Props) {
  const ts = chart.timeScale();
  const elements: React.ReactNode[] = [];

  for (const box of boxes) {
    const x1 = ts.timeToCoordinate(box.startTime as UTCTimestamp);
    const x2 = ts.timeToCoordinate(box.endTime as UTCTimestamp);
    const yH = series.priceToCoordinate(box.high);
    const yL = series.priceToCoordinate(box.low);

    if (x1 === null || x2 === null || yH === null || yL === null) continue;

    const width = Math.max(4, x2 - x1);

    // 1. Shaded vertical background band (full pane height)
    elements.push(
      <rect
        key={`macro-bg-${box.startTime}`}
        x={x1}
        y={0}
        width={width}
        height={paneHeight}
        fill={box.color}
        opacity={0.07}
        className="transition-opacity duration-300"
      />
    );

    // 2. Fine dashed border lines on the sides of the macro band
    elements.push(
      <line
        key={`macro-line-left-${box.startTime}`}
        x1={x1}
        x2={x1}
        y1={0}
        y2={paneHeight}
        stroke={box.color}
        strokeWidth={1}
        strokeDasharray="2,3"
        opacity={0.3}
      />,
      <line
        key={`macro-line-right-${box.startTime}`}
        x1={x2}
        x2={x2}
        y1={0}
        y2={paneHeight}
        stroke={box.color}
        strokeWidth={1}
        strokeDasharray="2,3"
        opacity={0.3}
      />
    );

    // 3. High & Low horizontal bounds reached during the macro
    elements.push(
      <line
        key={`macro-high-${box.startTime}`}
        x1={x1}
        x2={x2}
        y1={yH}
        y2={yH}
        stroke={box.color}
        strokeWidth={1.5}
        opacity={0.7}
      />,
      <line
        key={`macro-low-${box.startTime}`}
        x1={x1}
        x2={x2}
        y1={yL}
        y2={yL}
        stroke={box.color}
        strokeWidth={1.5}
        opacity={0.7}
      />
    );

    // 4. Label at the top of the band
    elements.push(
      <text
        key={`macro-label-${box.startTime}`}
        x={x1 + 4}
        y={20}
        fontSize={9}
        fontWeight="bold"
        fill={box.color}
        opacity={0.8}
        style={{ userSelect: "none", fontFamily: "var(--font-sans), Inter, sans-serif" }}
      >
        {box.name}
      </text>
    );
  }

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
