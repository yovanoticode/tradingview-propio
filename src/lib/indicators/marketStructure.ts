import type { Candle } from "@/lib/yahoo/types";

export interface SwingPoint {
  time: number;
  price: number;
  type: "high" | "low";
}

export interface StructureBreak {
  id: string;
  /** BOS = trend continuation; CHoCH = reversal signal (MSS) */
  type: "bos" | "choch";
  /** Direction of the break */
  direction: "bull" | "bear";
  /** Candle that closed beyond the swing level */
  breakTime: number;
  /** Price level that was broken */
  level: number;
  /** Time of the swing that was taken out */
  swingTime: number;
}

// ── Swing detection (both-side lookback — works on historical data) ────────
function findSwingPoints(candles: Candle[], lookback: number): SwingPoint[] {
  const points: SwingPoint[] = [];
  const n = candles.length;

  for (let i = lookback; i < n - lookback; i++) {
    const c = candles[i];

    let isHigh = true, isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i - j].high >= c.high || candles[i + j].high >= c.high) isHigh = false;
      if (candles[i - j].low  <= c.low  || candles[i + j].low  <= c.low)  isLow  = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) points.push({ time: c.time, price: c.high, type: "high" });
    if (isLow)  points.push({ time: c.time, price: c.low,  type: "low"  });
  }

  // Recent bars (within lookback of right edge) — left-side only
  for (let i = Math.max(lookback, n - lookback); i < n; i++) {
    const c = candles[i];
    let isHigh = true, isLow = true;
    for (let j = 1; j <= Math.min(lookback, i); j++) {
      if (candles[i - j].high >= c.high) isHigh = false;
      if (candles[i - j].low  <= c.low)  isLow  = false;
    }
    if (isHigh) points.push({ time: c.time, price: c.high, type: "high" });
    if (isLow)  points.push({ time: c.time, price: c.low,  type: "low"  });
  }

  return points;
}

/**
 * ICT Market Structure:
 *
 * Tracks pending swing highs (SH) and swing lows (SL).
 * When a candle CLOSES beyond a pending swing:
 *   • Against current trend → CHoCH (Change of Character / MSS)
 *   • With current trend    → BOS   (Break of Structure)
 *
 * Trend starts as null and is determined by the first break.
 */
export function calculateMarketStructure(
  candles: Candle[],
  lookback = 3,
  maxBreaks = 30,
): { breaks: StructureBreak[]; swings: SwingPoint[] } {
  const swings = findSwingPoints(candles, lookback);

  const breaks: StructureBreak[] = [];
  let trend: "bull" | "bear" | null = null;

  // Pending levels that can be broken
  let pendingSH: SwingPoint | null = null;
  let pendingSL: SwingPoint | null = null;

  // Walk swings in time order, advancing candle by candle
  let swingIdx = 0;
  const sortedSwings = [...swings].sort((a, b) => a.time - b.time);

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];

    // Absorb swings that formed before the current candle
    while (swingIdx < sortedSwings.length && sortedSwings[swingIdx].time < c.time) {
      const s = sortedSwings[swingIdx];
      if (s.type === "high") pendingSH = s;
      else                   pendingSL = s;
      swingIdx++;
    }

    // Check bullish break (close above last SH)
    if (pendingSH && c.close > pendingSH.price) {
      const isCHoCH = trend === "bear";
      breaks.push({
        id: `bull-${c.time}`,
        type: isCHoCH ? "choch" : "bos",
        direction: "bull",
        breakTime: c.time,
        level: pendingSH.price,
        swingTime: pendingSH.time,
      });
      trend = "bull";
      pendingSH = null;
    }

    // Check bearish break (close below last SL)
    if (pendingSL && c.close < pendingSL.price) {
      const isCHoCH = trend === "bull";
      breaks.push({
        id: `bear-${c.time}`,
        type: isCHoCH ? "choch" : "bos",
        direction: "bear",
        breakTime: c.time,
        level: pendingSL.price,
        swingTime: pendingSL.time,
      });
      trend = "bear";
      pendingSL = null;
    }
  }

  return {
    breaks: breaks.slice(-maxBreaks),
    swings: swings.slice(-60),
  };
}
