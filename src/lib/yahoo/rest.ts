import type { Candle, SymbolInfo, Ticker24h, Timeframe } from "./types";

const TF_MAP: Record<Timeframe, { interval: string; range: string }> = {
  "1m":  { interval: "1m",  range: "7d"  },
  "5m":  { interval: "5m",  range: "5d"  },
  "15m": { interval: "15m", range: "5d"  },
  "30m": { interval: "30m", range: "30d" },
  "1h":  { interval: "60m", range: "60d" },
  "4h":  { interval: "60m", range: "60d" }, // Yahoo no tiene 4h — se agrega client-side desde 1h
  "1d":  { interval: "1d",  range: "1y"  },
  "1w":  { interval: "1wk", range: "5y"  },
};

export async function fetchKlines(
  symbol: string,
  timeframe: Timeframe,
  _limit = 1000,
): Promise<Candle[]> {
  const { interval, range } = TF_MAP[timeframe];
  const res = await fetch(
    `/api/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`chart ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error("No chart data");
  const timestamps: number[] = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const opens: number[] = quote.open ?? [];
  const highs: number[] = quote.high ?? [];
  const lows: number[] = quote.low ?? [];
  const closes: number[] = quote.close ?? [];
  const volumes: number[] = quote.volume ?? [];
  const seen = new Set<number>();
  const candles: Candle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i];
    const c = closes[i];
    if (c == null || !isFinite(c) || c <= 0 || seen.has(t)) continue;
    const o = opens[i] ?? c;
    const h = highs[i] ?? c;
    const l = lows[i] ?? c;
    if (!isFinite(o) || !isFinite(h) || !isFinite(l)) continue;
    if (o <= 0 || h <= 0 || l <= 0) continue;
    // Sanity: high must be the highest, low must be the lowest
    const realH = Math.max(o, h, c);
    const realL = Math.min(o, l, c);
    seen.add(t);
    candles.push({
      time: t,
      open: o,
      high: realH,
      low: realL,
      close: c,
      volume: volumes[i] ?? 0,
      isFinal: true,
    });
  }
  return candles.sort((a, b) => a.time - b.time);
}

async function fetchChartMeta(symbol: string): Promise<Ticker24h | null> {
  try {
    const res = await fetch(
      `/api/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const last = meta.regularMarketPrice ?? 0;
    const prev = meta.chartPreviousClose ?? meta.previousClose ?? last;
    return {
      symbol,
      lastPrice: last,
      priceChange: last - prev,
      priceChangePercent: prev === 0 ? 0 : ((last - prev) / prev) * 100,
      highPrice: meta.regularMarketDayHigh ?? 0,
      lowPrice: meta.regularMarketDayLow ?? 0,
      volume: meta.regularMarketVolume ?? 0,
      quoteVolume: 0,
    };
  } catch {
    return null;
  }
}

export async function fetchTicker24h(symbol: string): Promise<Ticker24h> {
  const data = await fetchChartMeta(symbol);
  if (!data) throw new Error(`No data for ${symbol}`);
  return data;
}

export async function fetchTickers24h(symbols: string[]): Promise<Ticker24h[]> {
  if (symbols.length === 0) return [];
  const results = await Promise.allSettled(symbols.map(fetchChartMeta));
  return results
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((v): v is Ticker24h => v !== null);
}

export const FUTURES_SYMBOLS: SymbolInfo[] = [
  { symbol: "MNQ=F",  name: "Micro E-mini NASDAQ-100",  type: "Futures" },
  { symbol: "NQ=F",   name: "E-mini NASDAQ-100",         type: "Futures" },
  { symbol: "MES=F",  name: "Micro E-mini S&P 500",      type: "Futures" },
  { symbol: "ES=F",   name: "E-mini S&P 500",            type: "Futures" },
  { symbol: "MYM=F",  name: "Micro E-mini Dow Jones",    type: "Futures" },
  { symbol: "YM=F",   name: "E-mini Dow Jones",          type: "Futures" },
  { symbol: "M2K=F",  name: "Micro E-mini Russell 2000", type: "Futures" },
  { symbol: "RTY=F",  name: "E-mini Russell 2000",       type: "Futures" },
  { symbol: "CL=F",   name: "Crude Oil",                 type: "Futures" },
  { symbol: "NG=F",   name: "Natural Gas",               type: "Futures" },
  { symbol: "GC=F",   name: "Gold",                      type: "Futures" },
  { symbol: "MGC=F",  name: "Micro Gold",                type: "Futures" },
  { symbol: "SI=F",   name: "Silver",                    type: "Futures" },
  { symbol: "6E=F",   name: "Euro FX",                   type: "Futures" },
  { symbol: "6J=F",   name: "Japanese Yen",              type: "Futures" },
  { symbol: "ZN=F",   name: "10-Year T-Note",            type: "Futures" },
  { symbol: "ZB=F",   name: "30-Year T-Bond",            type: "Futures" },
  { symbol: "VX=F",   name: "VIX Futures",               type: "Futures" },
  { symbol: "^NDX",   name: "NASDAQ-100 Index",          type: "Index"   },
  { symbol: "^GSPC",  name: "S&P 500 Index",             type: "Index"   },
  { symbol: "^VIX",   name: "VIX Index",                 type: "Index"   },
  { symbol: "BTC-USD", name: "Bitcoin / USDT",            type: "Crypto"  },
  { symbol: "ETH-USD", name: "Ethereum / USDT",          type: "Crypto"  },
  { symbol: "SOL-USD", name: "Solana / USDT",            type: "Crypto"  },
];
