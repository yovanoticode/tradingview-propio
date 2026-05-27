import type { Candle } from "@/lib/yahoo/types";
import type { IndicatorPoint } from ".";

/**
 * Session VWAP — typical price weighted by volume, reset each ET day.
 * Formula: Σ((H+L+C)/3 × V) / Σ V, restart at 00:00 ET.
 */
export function calculateVWAP(candles: Candle[]): IndicatorPoint[] {
  if (candles.length === 0) return [];
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
  });

  const out: IndicatorPoint[] = [];
  let curDay = "";
  let cumPV = 0;
  let cumV  = 0;

  for (const c of candles) {
    const day = fmt.format(new Date(c.time * 1000)); // "YYYY-MM-DD"
    if (day !== curDay) {
      curDay = day;
      cumPV = 0;
      cumV  = 0;
    }
    const typical = (c.high + c.low + c.close) / 3;
    cumPV += typical * c.volume;
    cumV  += c.volume;
    if (cumV > 0) out.push({ time: c.time, value: cumPV / cumV });
  }
  return out;
}
