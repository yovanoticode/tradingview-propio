import type { Candle, Timeframe } from "@/lib/yahoo/types";

const NT8_BASE = "http://localhost:4001";

/**
 * NT8 corre en Colombia (UTC-5) y trata los tiempos ET de las barras
 * como hora local colombiana. Esto añade 5h en vez de 4h (EDT) al UTC,
 * dejando los timestamps 1 hora adelantados en verano.
 * Corrección dinámica: descuenta la diferencia (Colombia - ET en el momento actual).
 */
function nt8TimestampCorrection(): number {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? "0");
  const h = get("hour") === 24 ? 0 : get("hour");
  // epoch que ET vería si sus horas locales fueran UTC
  const etAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), h, get("minute"), get("second"));
  // offset de ET respecto a UTC en segundos (p.ej. -14400 en EDT)
  const etOffsetSec = Math.round((etAsUtc - now.getTime()) / 1000);
  // Colombia siempre UTC-5 = -18000s
  // correction = abs(ET offset) - abs(Colombia offset) = (-etOffsetSec) - 18000
  // EDT: 14400 - 18000 = -3600  (restar 1h en verano)
  // EST: 18000 - 18000 = 0      (sin cambio en invierno)
  return (-etOffsetSec) - 18000;
}

export async function fetchNT8Bars(symbol: string, count = 1000, tf: Timeframe = "1m", offset = 0): Promise<Candle[]> {
  const res = await fetch(`${NT8_BASE}/bars?symbol=${encodeURIComponent(symbol)}&count=${count}&tf=${tf}&offset=${offset}`);
  if (!res.ok) throw new Error("NT8 no responde");
  // Fix: some Windows locales send numbers with ',' as decimal separator
  const text = (await res.text()).replace(/:\s*(-?\d+),(\d+)/g, ":$1.$2");
  const data: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }> =
    JSON.parse(text);
  const corr = nt8TimestampCorrection();
  return data
    .filter((b) => b.close > 0 && b.open > 0 && b.high > 0 && b.low > 0)
    .map((b) => ({ ...b, time: b.time + corr }))
    .sort((a, b) => a.time - b.time);
}

export async function fetchNT8Info(): Promise<{ instrument: string; timeframe: string; bars: number }> {
  const res = await fetch(`${NT8_BASE}/info`);
  if (!res.ok) throw new Error("NT8 no responde");
  return res.json();
}

export async function pingNT8(): Promise<boolean> {
  try {
    const res = await fetch(`${NT8_BASE}/info`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchNT8Instruments(): Promise<string[]> {
  const res = await fetch(`${NT8_BASE}/instruments`);
  if (!res.ok) throw new Error("NT8 no responde");
  return res.json();
}
