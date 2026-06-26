import type { Candle, Timeframe } from "@/lib/yahoo/types";



import { useChartStore } from "@/lib/store/chart-store";

const NT8_BASE = "http://localhost:4001";

export async function fetchNT8Bars(symbol: string, count = 1000, tf: Timeframe = "1m", offset = 0): Promise<Candle[]> {
  const nt8Symbol = symbol.split(/[=-]/)[0];
  const timestamp = Date.now();
  const res = await fetch(
    `${NT8_BASE}/bars?symbol=${encodeURIComponent(nt8Symbol)}&count=${count}&tf=${tf}&offset=${offset}&_t=${timestamp}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("NT8 no responde");
  // Fix: some Windows locales send numbers with ',' as decimal separator
  const text = (await res.text()).replace(/:\s*(-?\d+),(\d+)/g, ":$1.$2");
  const data: Array<any> = JSON.parse(text);
  if (typeof window !== "undefined") {
    setTimeout(() => {
       fetch('/api/log', { method: 'POST', body: JSON.stringify({ source: 'nt8_rest_final', tf, data: Array.from(bucketed.values()).slice(-20) }) }).catch(console.error);
    }, 1000);
  }
  
  const nt8OffsetHours = useChartStore.getState().nt8OffsetHours;
  const offsetSecs = nt8OffsetHours * 3600;

  const rawBars = data.filter((b: any) => {
    const o = b.open ?? b.Open ?? b.o ?? b.O ?? 0;
    const h = b.high ?? b.High ?? b.h ?? b.H ?? 0;
    const l = b.low ?? b.Low ?? b.l ?? b.L ?? 0;
    const c = b.close ?? b.Close ?? b.c ?? b.C ?? 0;
    if (o <= 0 || h <= 0 || l <= 0 || c <= 0) return false;
    // Evitar que velas corruptas de NT8 ("que van a cero") dañen la escala del gráfico
    if (l < c * 0.5 || h > c * 1.5) return false;
    return true;
  });

  if (rawBars.length < 5) {
    throw new Error("NinjaTrader aún está conectando al broker o sin datos históricos. Espere unos segundos.");
  }

  const bucketed = new Map<number, any>();

  const TF_SECS: Record<string, number> = {
    "1m": 60, "5m": 300, "15m": 900, "30m": 1800, "1h": 3600, "4h": 14400,
  };
  const bucketSecs = TF_SECS[tf] || 60;

  for (const b of rawBars) {
    const rawTime = b.time ?? b.Time ?? b.t ?? b.T ?? 0;
    const isMs = rawTime > 100000000000;
    const tSecs = isMs ? rawTime / 1000 : rawTime;
    const time = Math.floor(tSecs / bucketSecs) * bucketSecs + offsetSecs;

    if (isNaN(time)) continue;

    const open = b.open ?? b.Open ?? b.o ?? b.O ?? 0;
    const high = b.high ?? b.High ?? b.h ?? b.H ?? 0;
    const low = b.low ?? b.Low ?? b.l ?? b.L ?? 0;
    const close = b.close ?? b.Close ?? b.c ?? b.C ?? 0;
    const volume = b.volume ?? b.Volume ?? b.v ?? b.V ?? 0;

    if (!bucketed.has(time)) {
      bucketed.set(time, { time, open, high, low, close, volume });
    } else {
      const existing = bucketed.get(time);
      existing.high = Math.max(existing.high, high);
      existing.low = Math.min(existing.low, low);
      existing.close = close;
      existing.volume += volume;
    }
  }

  const result = Array.from(bucketed.values()).sort((a, b) => a.time - b.time);
  return result;
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
