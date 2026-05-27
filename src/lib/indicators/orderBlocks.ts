import type { Candle } from "@/lib/yahoo/types";
import type { StructureBreak } from "./marketStructure";

export interface OBBox {
  id: string;
  type: "bull" | "bear";
  time: number;
  endTime: number;
  high: number;
  low: number;
  mid: number;
  mitigated: boolean;
  isBreaker: boolean;
  fromCHoCH: boolean; // OBs from CHoCH are structurally more significant
}

/**
 * ICT Order Block detection — BOS/CHoCH driven.
 *
 * For each structure break (BOS or CHoCH):
 *   Bullish break → find the last BEARISH candle (close < open) at or before
 *                   the swing that was broken → Bullish OB (demand zone)
 *   Bearish break → find the last BULLISH candle (close > open) at or before
 *                   the swing → Bearish OB (supply zone)
 *
 * Mitigation: a candle CLOSES beyond the far edge of the OB zone.
 * Mitigated OB → Breaker Block (inverted bias).
 */
export function calculateOrderBlocks(
  candles: Candle[],
  breaks: StructureBreak[],
  maxCount = 5,
): OBBox[] {
  if (candles.length === 0 || breaks.length === 0) return [];

  const lastTime = candles[candles.length - 1].time;
  const raw: OBBox[] = [];
  const seen = new Set<string>();

  for (const brk of breaks) {
    // Find the candle at the swing point that was broken
    const swingIdx = candles.findIndex((c) => c.time >= brk.swingTime);
    if (swingIdx === -1) continue;

    // Walk back from the swing to find the last opposite-direction candle
    // Bullish break → last bearish candle (close < open)
    // Bearish break → last bullish candle (close > open)
    const isOpposite =
      brk.direction === "bull"
        ? (c: Candle) => c.close < c.open
        : (c: Candle) => c.close > c.open;

    let obCandle: Candle | null = null;
    for (let j = swingIdx; j >= Math.max(0, swingIdx - 15); j--) {
      if (isOpposite(candles[j])) {
        obCandle = candles[j];
        break;
      }
    }

    if (!obCandle) continue;

    const id = `${brk.direction}-ob-${obCandle.time}`;
    if (seen.has(id)) continue;
    seen.add(id);

    raw.push({
      id,
      type: brk.direction,
      time: obCandle.time,
      endTime: lastTime,
      high: obCandle.high,
      low: obCandle.low,
      mid: (obCandle.high + obCandle.low) / 2,
      mitigated: false,
      isBreaker: false,
      fromCHoCH: brk.type === "choch",
    });
  }

  // Detect mitigation — close beyond far edge → Breaker Block
  for (const ob of raw) {
    const afterIdx = candles.findIndex((c) => c.time > ob.time);
    if (afterIdx === -1) continue;

    for (let j = afterIdx; j < candles.length; j++) {
      const c = candles[j];
      const mitigated =
        (ob.type === "bull" && c.close < ob.low) ||
        (ob.type === "bear" && c.close > ob.high);

      if (mitigated) {
        ob.mitigated  = true;
        ob.isBreaker  = true;
        ob.endTime    = c.time;
        break;
      }
    }
  }

  const active   = raw.filter((ob) => !ob.mitigated).slice(-maxCount);
  const breakers = raw.filter((ob) => ob.isBreaker).slice(-Math.ceil(maxCount / 2));
  return [...active, ...breakers];
}
