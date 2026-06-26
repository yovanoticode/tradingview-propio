import type { Candle } from "@/lib/yahoo/types";

export type DailyBias = "Bullish" | "Bearish" | "Neutral";

function getETDateKey(utcSeconds: number): string {
  return new Date(utcSeconds * 1000).toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
}

export function calculateDailyBias(candles: Candle[]): DailyBias {
  if (candles.length === 0) return "Neutral";

  // 1. Group into Daily candles based on ET
  const map = new Map<string, Candle[]>();
  for (const c of candles) {
    const k = getETDateKey(c.time);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(c);
  }

  const keys = [...map.keys()].sort();
  if (keys.length < 3) return "Neutral"; // Need at least 2 completed days

  // Get the last 3 days (Current, Prev1, Prev2)
  // Usually, Current is still forming. So we use Prev1 and Prev2 to bias Current.
  const prev1Key = keys[keys.length - 2];
  const prev2Key = keys[keys.length - 3];

  const p1Candles = map.get(prev1Key)!;
  const p2Candles = map.get(prev2Key)!;

  const p1 = {
    open: p1Candles[0].open,
    close: p1Candles[p1Candles.length - 1].close,
    high: Math.max(...p1Candles.map(c => c.high)),
    low: Math.min(...p1Candles.map(c => c.low)),
  };

  const p2 = {
    open: p2Candles[0].open,
    close: p2Candles[p2Candles.length - 1].close,
    high: Math.max(...p2Candles.map(c => c.high)),
    low: Math.min(...p2Candles.map(c => c.low)),
  };

  const p1Green = p1.close > p1.open;
  const p1Red = p1.close < p1.open;

  // Bullish: Prev day was green AND made a higher high
  if (p1Green && p1.high > p2.high) {
    return "Bullish";
  }

  // Bearish: Prev day was red AND made a lower low
  if (p1Red && p1.low < p2.low) {
    return "Bearish";
  }

  return "Neutral";
}
