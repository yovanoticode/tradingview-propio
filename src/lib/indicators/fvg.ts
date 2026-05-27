import type { Candle } from "@/lib/yahoo/types";
import type { Timeframe } from "@/lib/yahoo/types";
import type { FvgConfig } from "@/lib/store/chart-store";

export type FVGMitigation = "none" | "ce" | "full";

export interface FVGBox {
  id: string;
  type: "bull" | "bear";
  startTime: number;   // middle candle time (anchor for x1)
  endTime: number;     // last candle or mitigation time (anchor for x2)
  high: number;
  low: number;
  mid: number;
  label: string;       // "BISI" | "SIBI" | "1h BISI" | etc.
  mitigated: boolean;  // true only when fully filled
  mitigation: FVGMitigation;
  // IFVG: a fully-filled FVG that has inverted its bias
  // Bull FVG fully filled → bearish IFVG (resistance); Bear FVG fully filled → bullish IFVG (support)
  isIFVG: boolean;
}

// Seconds per timeframe
const TF_SECS: Record<string, number> = {
  "1m": 60, "5m": 300, "15m": 900, "30m": 1800,
  "1h": 3600, "4h": 14400, "1d": 86400, "1w": 604800,
};

// Higher TFs to compute per current TF
const HIGHER_TFS: Record<Timeframe, Timeframe[]> = {
  "1m":  [], // HTF FVGs too large/dominant on 1m — user can enable via showHTF
  "5m":  ["15m", "1h"],
  "15m": ["1h", "4h"],
  "30m": ["1h", "4h"],
  "1h":  ["4h"],
  "4h":  [],
  "1d":  [],
  "1w":  [],
};

function aggregateCandles(candles: Candle[], tfSecs: number): Candle[] {
  const buckets = new Map<number, Candle>();
  for (const c of candles) {
    const bucket = Math.floor(c.time / tfSecs) * tfSecs;
    const existing = buckets.get(bucket);
    if (!existing) {
      buckets.set(bucket, { ...c, time: bucket });
    } else {
      existing.high   = Math.max(existing.high, c.high);
      existing.low    = Math.min(existing.low, c.low);
      existing.close  = c.close;
      existing.volume += c.volume;
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
}

function makeLabel(isBull: boolean, tfLabel: string): string {
  const name = isBull ? "FVG ↑" : "FVG ↓";
  return tfLabel ? `${tfLabel} ${name}` : name;
}

function computeFVGs(candles: Candle[], tfLabel: string, maxActive = 10, maxIFVG = 5): FVGBox[] {
  if (candles.length < 3) return [];
  const lastTime = candles[candles.length - 1].time;

  const raw: FVGBox[] = [];

  for (let i = 2; i < candles.length; i++) {
    const c0 = candles[i - 2];
    const c1 = candles[i - 1]; // middle candle — FVG anchor
    const c2 = candles[i];

    // Bullish FVG (BISI): gap between high of [i-2] and low of [i]
    if (c0.high < c2.low) {
      raw.push({
        id: `bull-${c1.time}-${tfLabel}`,
        type: "bull",
        startTime: c1.time,
        endTime: lastTime,
        high: c2.low,
        low: c0.high,
        mid: (c2.low + c0.high) / 2,
        label: makeLabel(true, tfLabel),
        mitigated: false,
        mitigation: "none",
        isIFVG: false,
      });
    }

    // Bearish FVG (SIBI): gap between low of [i-2] and high of [i]
    if (c0.low > c2.high) {
      raw.push({
        id: `bear-${c1.time}-${tfLabel}`,
        type: "bear",
        startTime: c1.time,
        endTime: lastTime,
        high: c0.low,
        low: c2.high,
        mid: (c0.low + c2.high) / 2,
        label: makeLabel(false, tfLabel),
        mitigated: false,
        mitigation: "none",
        isIFVG: false,
      });
    }
  }

  // Detect mitigation level per FVG
  for (const box of raw) {
    const afterIdx = candles.findIndex((c) => c.time > box.startTime);
    if (afterIdx === -1) continue;

    for (let j = afterIdx; j < candles.length; j++) {
      const c = candles[j];

      // CE (Consequent Encroachment): any wick crosses the 50% level
      if (box.mitigation === "none") {
        const wickEntersMid = c.low <= box.mid && c.high >= box.mid;
        if (wickEntersMid) {
          box.mitigation = "ce";
          // Don't set endTime yet — keep extending until fully filled
        }
      }

      // Full Fill: candle CLOSES beyond the far edge of the gap
      // Bull FVG fully filled when close < low of gap (price closed below it)
      // Bear FVG fully filled when close > high of gap (price closed above it)
      const fullyFilled =
        (box.type === "bull" && c.close < box.low) ||
        (box.type === "bear" && c.close > box.high);

      if (fullyFilled) {
        box.mitigation = "full";
        box.mitigated = true;
        box.isIFVG = true; // Inverted FVG — flipped bias
        box.endTime = c.time;
        break;
      }
    }
  }

  const active    = raw.filter((b) => b.mitigation === "none").slice(-maxActive);
  const ceTouched = raw.filter((b) => b.mitigation === "ce").slice(-2);
  const ifvgs     = raw.filter((b) => b.isIFVG).slice(-maxIFVG);

  return [...active, ...ceTouched, ...ifvgs];
}

export function calculateFVGs(
  candles: Candle[],
  timeframe: Timeframe,
  cfg?: Partial<FvgConfig>,
): FVGBox[] {
  if (candles.length < 3) return [];

  const maxActive  = cfg?.maxActive   ?? 10;
  const minSize    = cfg?.minSizePts  ?? 0;
  const showHTF    = cfg?.showHTF     ?? true;
  const showCE     = cfg?.showCE      ?? true;
  const showIFVG   = cfg?.showIFVG    ?? true;

  const allBoxes: FVGBox[] = [];

  // Current TF
  allBoxes.push(...computeFVGs(candles, "", maxActive, 5));

  // Higher TFs
  if (showHTF) {
    const higherTFs = HIGHER_TFS[timeframe] ?? [];
    for (const htf of higherTFs) {
      const secs = TF_SECS[htf];
      if (!secs) continue;
      const aggregated = aggregateCandles(candles, secs);
      allBoxes.push(...computeFVGs(aggregated, htf, 6, 3));
    }
  }

  // Apply filters
  return allBoxes.filter((b) => {
    if (minSize > 0 && (b.high - b.low) < minSize) return false;
    if (!showCE   && b.mitigation === "ce")   return false;
    if (!showIFVG && b.isIFVG)               return false;
    return true;
  });
}
