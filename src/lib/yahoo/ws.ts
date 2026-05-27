import type { Candle, Timeframe } from "./types";

const INTERVAL_SECS: Record<Timeframe, number> = {
  "1m":  60,
  "5m":  300,
  "15m": 900,
  "30m": 1800,
  "1h":  3600,
  "4h":  14400,
  "1d":  86400,
  "1w":  604800,
};

export interface KlineSubscription {
  symbol: string;
  interval: Timeframe;
  onCandle: (c: Candle) => void;
}

export class YahooPoller {
  private klinePollers = new Map<string, ReturnType<typeof setInterval>>();
  private tickerTimer: ReturnType<typeof setInterval> | null = null;
  private tickerSymbols: string[] = [];
  private tickerCallback: ((s: { symbol: string; close: number; open: number; pct: number }) => void) | null = null;

  subscribeKline(sub: KlineSubscription): () => void {
    const key = `${sub.symbol}_${sub.interval}`;
    const ivSecs = INTERVAL_SECS[sub.interval];

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/chart/${encodeURIComponent(sub.symbol)}?interval=1d&range=2d`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const json = await res.json();
        const meta = json?.chart?.result?.[0]?.meta;
        if (!meta?.regularMarketPrice) return;
        const price: number = meta.regularMarketPrice;
        const snapTime = Math.floor(Date.now() / 1000 / ivSecs) * ivSecs;
        sub.onCandle({
          time: snapTime,
          open: meta.regularMarketOpen ?? price,
          high: meta.regularMarketDayHigh ?? price,
          low: meta.regularMarketDayLow ?? price,
          close: price,
          volume: meta.regularMarketVolume ?? 0,
          isFinal: false,
        });
      } catch {
        // ignore
      }
    };

    const id = setInterval(poll, 5000);
    this.klinePollers.set(key, id);

    return () => {
      clearInterval(id);
      this.klinePollers.delete(key);
    };
  }

  subscribeMiniTickers(
    symbols: string[],
    onTick: (s: { symbol: string; close: number; open: number; pct: number }) => void,
  ): () => void {
    this.tickerSymbols = symbols;
    this.tickerCallback = onTick;

    const poll = async () => {
      if (this.tickerSymbols.length === 0) return;
      await Promise.allSettled(
        this.tickerSymbols.map(async (sym) => {
          try {
            const res = await fetch(
              `/api/chart/${encodeURIComponent(sym)}?interval=1d&range=2d`,
              { cache: "no-store" },
            );
            if (!res.ok) return;
            const json = await res.json();
            const meta = json?.chart?.result?.[0]?.meta;
            if (!meta?.regularMarketPrice) return;
            const close = Number(meta.regularMarketPrice) || 0;
            const prev = Number(meta.chartPreviousClose ?? meta.previousClose) || close;
            this.tickerCallback?.({
              symbol: sym,
              close,
              open: prev,
              pct: prev === 0 ? 0 : ((close - prev) / prev) * 100,
            });
          } catch {
            // ignore
          }
        }),
      );
    };

    if (this.tickerTimer) clearInterval(this.tickerTimer);
    this.tickerTimer = setInterval(poll, 5000);
    poll();

    return () => {
      if (this.tickerTimer) {
        clearInterval(this.tickerTimer);
        this.tickerTimer = null;
      }
      this.tickerSymbols = [];
      this.tickerCallback = null;
    };
  }

  close() {
    this.klinePollers.forEach((id) => clearInterval(id));
    this.klinePollers.clear();
    if (this.tickerTimer) clearInterval(this.tickerTimer);
  }
}

let singleton: YahooPoller | null = null;
export function getYahooPoller(): YahooPoller {
  if (typeof window === "undefined") return new YahooPoller();
  if (!singleton) singleton = new YahooPoller();
  return singleton;
}
