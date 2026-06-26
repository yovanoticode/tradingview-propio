"use client";

import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import type { KZBox } from "@/lib/indicators/killzones";
import type { IctConfig, LabelSize } from "@/lib/store/chart-store";
import { formatPrice } from "@/lib/format";

interface Props {
  chart: IChartApi;
  series: ISeriesApi<"Candlestick">;
  boxes: KZBox[];
  config: IctConfig;
}

const FONT_SIZE: Record<LabelSize, number> = { small: 9, medium: 11, large: 13 };
export function KillzonesOverlay({ chart, series, boxes, config }: Props) {
  const ts = chart.timeScale();
  const paneWidth = ts.width();
  const fs = FONT_SIZE[config.labelSize];

  const elements: React.ReactNode[] = [];

  for (const box of boxes) {
    const x1 = ts.timeToCoordinate(box.startTime as UTCTimestamp);
    const x2raw = ts.timeToCoordinate(box.endTime as UTCTimestamp);
    const yH = series.priceToCoordinate(box.high);
    const yL = series.priceToCoordinate(box.low);
    const yM = series.priceToCoordinate(box.mid);

    if (x1 === null || x2raw === null || yH === null || yL === null || yM === null) continue;

    const boxRight = x2raw + 4;
    const boxTop = Math.min(yH, yL);
    const boxH = Math.max(2, Math.abs(yL - yH));

    // ── Killzone Range box ──────────────────────────────────────────────
    if (config.showBoxes) {
      elements.push(
        <rect
          key={`box-${box.session}-${box.startTime}`}
          x={x1}
          y={boxTop}
          width={boxRight - x1}
          height={boxH}
          fill={box.color}
          stroke={box.borderColor}
          strokeWidth={0.5}
        />,
      );

      if (config.showBoxLabels) {
        elements.push(
          <text
            key={`boxlabel-${box.session}-${box.startTime}`}
            x={x1 + 3}
            y={boxTop + fs + 1}
            fontSize={fs}
            fill={config.textColor}
            style={{ userSelect: "none", fontFamily: "system-ui, sans-serif" }}
          >
            {box.session}
          </text>,
        );
      }

      // Average midline inside box
      if (config.showAverage) {
        elements.push(
          <line
            key={`avg-${box.session}-${box.startTime}`}
            x1={x1}
            x2={boxRight}
            y1={yM}
            y2={yM}
            stroke={box.borderColor}
            strokeWidth={1}
            strokeDasharray="3,2"
          />,
        );
      }
    }

    // ── Killzone Pivots ─────────────────────────────────────────────────
    if (config.showPivots) {
      const levels: Array<{
        y: number | null;
        label: string;
        mitigated: boolean;
        color: string;
        dash?: string;
      }> = [];

      if (yH !== null) {
        levels.push({
          y: yH,
          label: box.highLabel,
          mitigated: box.highMitigated,
          color: box.borderColor,
        });
      }
      if (yL !== null) {
        levels.push({
          y: yL,
          label: box.lowLabel,
          mitigated: box.lowMitigated,
          color: box.borderColor,
        });
      }
      if (config.showPivotMidpoints && yM !== null) {
        levels.push({
          y: yM,
          label: "",
          mitigated: box.highMitigated && box.lowMitigated,
          color: box.borderColor,
          dash: "4,3",
        });
      }

      for (const lvl of levels) {
        if (lvl.y === null) continue;

        // Determine right edge of pivot line
        let lineX2: number;
        if (config.pivotExtend === "none") {
          lineX2 = boxRight;
        } else if (config.pivotExtend === "always") {
          lineX2 = paneWidth;
        } else {
          // "mitigated": extend until mitigated, then stop at box right
          lineX2 = lvl.mitigated ? boxRight : paneWidth;
        }

        const stopDraw = config.stopOnceMitigated && lvl.mitigated;
        if (stopDraw) lineX2 = boxRight;

        elements.push(
          <line
            key={`pivot-${box.session}-${box.startTime}-${lvl.label}-${lvl.y}`}
            x1={x1}
            x2={lineX2}
            y1={lvl.y}
            y2={lvl.y}
            stroke={box.borderColor}
            strokeWidth={1}
            strokeDasharray={lvl.dash}
            opacity={lvl.mitigated ? 0.4 : 1}
          />,
        );

        if (config.showPivotLabels && lvl.label) {
          const labelX = config.pivotRightSide ? lineX2 : x1;
          const anchor = config.pivotRightSide ? "end" : "start";
          // If anchored to the right edge of the pane, give a slightly larger margin so it doesn't touch the scale
          const isAtRightEdge = config.pivotRightSide && lineX2 === paneWidth;
          const offsetX = isAtRightEdge ? -6 : config.pivotRightSide ? -3 : 3;

          const priceStr = config.pivotDisplayPrice
            ? ` ${formatPrice(lvl.y === yH ? box.high : lvl.y === yL ? box.low : box.mid)}`
            : "";

          elements.push(
            <text
              key={`plabel-${box.session}-${box.startTime}-${lvl.label}`}
              x={labelX + offsetX}
              y={lvl.y - 4}
              fontSize={fs}
              fill={config.textColor}
              textAnchor={anchor}
              opacity={lvl.mitigated ? 0.4 : 1}
              style={{ userSelect: "none", fontFamily: "system-ui, sans-serif" }}
            >
              {lvl.label}{priceStr}
            </text>,
          );
        }
      }
    }
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
