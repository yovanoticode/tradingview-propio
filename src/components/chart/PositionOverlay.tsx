"use client";

import { X } from "lucide-react";
import { formatPrice } from "@/lib/format";
import type { PositionBox } from "@/lib/store/chart-store";

const LONG_GREEN  = "rgba(38, 166, 154, 0.18)";
const LONG_STROKE = "#26a69a";
const SHORT_RED   = "rgba(239, 83, 80, 0.18)";
const SHORT_STROKE = "#ef5350";
const FORECAST_FILL   = "rgba(100, 149, 237, 0.15)";
const FORECAST_STROKE = "#6495ed";
const STOP_FILL   = "rgba(239, 83, 80, 0.10)";

interface BoxCoords {
  box: PositionBox;
  entryY: number;
  stopY: number;
  targetY: number;
}

interface Props {
  boxes: BoxCoords[];
  draft?: {
    type: "long" | "short" | "forecast";
    entryY: number;
    stopY: number;
    targetY: number;
    entry: number;
    stop: number;
    target: number;
    rr: number;
  } | null;
  chartWidth: number;
  onRemove?: (id: string) => void;
}

function getColors(type: "long" | "short" | "forecast") {
  if (type === "long")     return { profitFill: LONG_GREEN,    profitStroke: LONG_STROKE,  stopFill: STOP_FILL,   stopStroke: SHORT_STROKE, entryStroke: LONG_STROKE };
  if (type === "short")    return { profitFill: LONG_GREEN,    profitStroke: LONG_STROKE,  stopFill: SHORT_RED,   stopStroke: SHORT_STROKE, entryStroke: SHORT_STROKE };
  return { profitFill: FORECAST_FILL, profitStroke: FORECAST_STROKE, stopFill: STOP_FILL, stopStroke: FORECAST_STROKE, entryStroke: FORECAST_STROKE };
}

function riskReward(entry: number, stop: number, target: number) {
  const risk   = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  return risk === 0 ? 0 : reward / risk;
}

function PositionShape({
  type,
  entryY,
  stopY,
  targetY,
  entry,
  stop,
  target,
  chartWidth,
  isPreview,
  onRemove,
}: {
  type: "long" | "short" | "forecast";
  entryY: number;
  stopY: number;
  targetY: number;
  entry: number;
  stop: number;
  target: number;
  chartWidth: number;
  isPreview?: boolean;
  onRemove?: () => void;
}) {
  const c = getColors(type);
  const rr = riskReward(entry, stop, target).toFixed(2);

  const profitTop    = Math.min(entryY, targetY);
  const profitBot    = Math.max(entryY, targetY);
  const stopTop      = Math.min(entryY, stopY);
  const stopBot      = Math.max(entryY, stopY);
  const labelX       = chartWidth - 8;

  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 z-20 h-full w-full"
        style={{ overflow: "visible" }}
      >
        {/* Profit zone */}
        <rect
          x={0}
          y={profitTop}
          width={chartWidth}
          height={Math.max(1, profitBot - profitTop)}
          fill={c.profitFill}
          strokeDasharray={isPreview ? "4,3" : undefined}
        />
        {/* Stop zone */}
        <rect
          x={0}
          y={stopTop}
          width={chartWidth}
          height={Math.max(1, stopBot - stopTop)}
          fill={c.stopFill}
          strokeDasharray={isPreview ? "4,3" : undefined}
        />
        {/* Entry line */}
        <line x1={0} x2={chartWidth} y1={entryY} y2={entryY} stroke={c.entryStroke} strokeWidth={1.5} strokeDasharray={isPreview ? "5,3" : undefined} />
        {/* Target line */}
        <line x1={0} x2={chartWidth} y1={targetY} y2={targetY} stroke={c.profitStroke} strokeWidth={1} strokeDasharray="3,3" />
        {/* Stop line */}
        <line x1={0} x2={chartWidth} y1={stopY} y2={stopY} stroke={c.stopStroke} strokeWidth={1} strokeDasharray="3,3" />
      </svg>

      {/* Labels */}
      <div className="pointer-events-none absolute inset-0 z-21" style={{ overflow: "visible" }}>
        {/* Target label */}
        <div
          className="absolute -translate-y-1/2 -translate-x-full whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
          style={{ top: targetY, left: labelX, backgroundColor: c.profitStroke, color: "#fff" }}
        >
          {formatPrice(target)} · TP
        </div>
        {/* Entry label */}
        <div
          className="absolute -translate-y-1/2 -translate-x-full whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
          style={{ top: entryY, left: labelX, backgroundColor: c.entryStroke, color: "#fff" }}
        >
          {formatPrice(entry)} · Entrada · R:R {rr}
        </div>
        {/* Stop label */}
        <div
          className="absolute -translate-y-1/2 -translate-x-full whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
          style={{ top: stopY, left: labelX, backgroundColor: c.stopStroke, color: "#fff" }}
        >
          {formatPrice(stop)} · SL
        </div>
        {/* Remove button (only for finalized) */}
        {!isPreview && onRemove && (
          <button
            onClick={onRemove}
            className="pointer-events-auto absolute flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-tv-panel text-tv-text-muted hover:text-tv-red"
            style={{ top: entryY, left: 4 }}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
    </>
  );
}

export function PositionOverlay({ boxes, draft, chartWidth, onRemove }: Props) {
  return (
    <>
      {boxes.map((bc) => (
        <PositionShape
          key={bc.box.id}
          type={bc.box.type}
          entryY={bc.entryY}
          stopY={bc.stopY}
          targetY={bc.targetY}
          entry={bc.box.entry}
          stop={bc.box.stop}
          target={bc.box.target}
          chartWidth={chartWidth}
          onRemove={onRemove ? () => onRemove(bc.box.id) : undefined}
        />
      ))}
      {draft && (
        <PositionShape
          type={draft.type}
          entryY={draft.entryY}
          stopY={draft.stopY}
          targetY={draft.targetY}
          entry={draft.entry}
          stop={draft.stop}
          target={draft.target}
          chartWidth={chartWidth}
          isPreview
        />
      )}
    </>
  );
}
