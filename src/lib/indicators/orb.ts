import type { Candle } from "@/lib/yahoo/types";

export interface ORBResult {
  high: number;
  low: number;
  rangePoints: number;
}

function toETMinutes(utcSeconds: number): number {
  const d = new Date(utcSeconds * 1000);
  const etStr = d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [h, m] = etStr.split(":").map(Number);
  return h * 60 + m;
}

export function calculateORB(candles: Candle[]): ORBResult | null {
  const ORB_START = 9 * 60 + 30; // 09:30 ET
  const ORB_END   = 9 * 60 + 45; // 09:45 ET

  const orbCandles = candles.filter((c) => {
    const min = toETMinutes(c.time);
    return min >= ORB_START && min < ORB_END;
  });

  if (orbCandles.length === 0) return null;

  const high = Math.max(...orbCandles.map((c) => c.high));
  const low  = Math.min(...orbCandles.map((c) => c.low));
  return { high, low, rangePoints: +(high - low).toFixed(2) };
}
