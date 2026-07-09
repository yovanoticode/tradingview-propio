import type { Candle } from "@/lib/yahoo/types";

export type DailyBias = "Bullish" | "Bearish" | "Neutral";

function getETDateKey(utcSeconds: number, cmeShift = false): string {
  const d = new Date(utcSeconds * 1000);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hour12: false
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? "0");
  const hRaw = get("hour");
  const h = hRaw === 24 ? 0 : hRaw;

  const localD = new Date(get("year"), get("month") - 1, get("day"));
  if (cmeShift && h >= 18) {
    localD.setDate(localD.getDate() + 1);
  }

  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${localD.getFullYear()}-${pad(localD.getMonth() + 1)}-${pad(localD.getDate())}`;
}

export function calculateDailyBias(candles: Candle[], cmeShift: boolean = true): DailyBias {
  if (candles.length === 0) return "Neutral";

  // 1. Group into Daily candles based on ET with CME Shift
  const map = new Map<string, Candle[]>();
  for (const c of candles) {
    const k = getETDateKey(c.time, cmeShift);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(c);
  }

  const keys = [...map.keys()].sort();
  
  // 2. Filter out weekends to avoid partial Sunday data messing up the analysis
  const validKeys = keys.filter(k => {
    const d = new Date(k + "T12:00:00Z");
    const dow = d.getDay();
    return dow !== 0 && dow !== 6;
  });

  if (validKeys.length < 3) return "Neutral"; // Need at least 2 completed valid days

  // Get the last 3 valid days (Current, Prev1, Prev2)
  const prev1Key = validKeys[validKeys.length - 2];
  const prev2Key = validKeys[validKeys.length - 3];

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

  const debug = `p1:${prev1Key} O:${p1.open} C:${p1.close} L:${p1.low} | p2:${prev2Key} L:${p2.low}`;

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
