// Binance public ticker API — no auth required

const BASE = "https://api.binance.com/api/v3";
const WS_BASE = "wss://stream.binance.com:9443/ws";

/** Map app symbol (BTC-USD) → Binance symbol (BTCUSDT) */
export function toBinanceSymbol(symbol: string): string {
  return symbol.replace("-USD", "USDT").replace("-", "").toUpperCase();
}

export function isCryptoSymbol(symbol: string): boolean {
  return symbol.endsWith("-USD") || symbol.endsWith("USDT");
}

export interface BinanceTicker {
  symbol: string; // app symbol e.g. "BTC-USD"
  price: number;
  pct: number;    // 24h change %
}

export async function fetchBinanceTickers(symbols: string[]): Promise<BinanceTicker[]> {
  const results = await Promise.allSettled(
    symbols.map(async (s) => {
      const bs = toBinanceSymbol(s);
      const res = await fetch(`${BASE}/ticker/24hr?symbol=${bs}`);
      if (!res.ok) throw new Error(`Binance ${bs} ${res.status}`);
      const d = await res.json();
      return {
        symbol: s,
        price: parseFloat(d.lastPrice),
        pct: parseFloat(d.priceChangePercent),
      } as BinanceTicker;
    }),
  );
  return results
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((v): v is BinanceTicker => v !== null);
}

type TickerCallback = (t: BinanceTicker) => void;

class BinanceTickerWS {
  private ws: WebSocket | null = null;
  private cbs = new Map<string, Set<TickerCallback>>();
  private symbols: string[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _shouldConnect = false;

  subscribe(appSymbol: string, cb: TickerCallback): () => void {
    if (!this.cbs.has(appSymbol)) this.cbs.set(appSymbol, new Set());
    this.cbs.get(appSymbol)!.add(cb);
    this._reconnect([...this.cbs.keys()]);
    return () => {
      this.cbs.get(appSymbol)?.delete(cb);
      if (this.cbs.get(appSymbol)?.size === 0) {
        this.cbs.delete(appSymbol);
        this._reconnect([...this.cbs.keys()]);
      }
    };
  }

  private _reconnect(symbols: string[]) {
    this.symbols = symbols;
    this._shouldConnect = symbols.length > 0;
    this.ws?.close();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (symbols.length > 0) this._open();
  }

  private _open() {
    const streams = this.symbols.map((s) => `${toBinanceSymbol(s).toLowerCase()}@miniTicker`).join("/");
    this.ws = new WebSocket(`${WS_BASE}/${streams}`);

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string);
        // Combined stream wraps in { stream, data }
        const d = msg.data ?? msg;
        if (!d.s) return;
        // Map back: BTCUSDT → BTC-USD
        const appSym = [...this.cbs.keys()].find(
          (k) => toBinanceSymbol(k) === d.s,
        );
        if (!appSym) return;
        const price = parseFloat(d.c);
        const open24h = parseFloat(d.o);
        const pct = open24h === 0 ? 0 : ((price - open24h) / open24h) * 100;
        this.cbs.get(appSym)?.forEach((cb) => cb({ symbol: appSym, price, pct }));
      } catch { /* ignore */ }
    };

    this.ws.onclose = () => {
      if (this._shouldConnect) {
        this.reconnectTimer = setTimeout(() => this._open(), 3000);
      }
    };

    this.ws.onerror = () => this.ws?.close();
  }
}

let _instance: BinanceTickerWS | null = null;
export function getBinanceTickerWS(): BinanceTickerWS {
  if (!_instance) _instance = new BinanceTickerWS();
  return _instance;
}
