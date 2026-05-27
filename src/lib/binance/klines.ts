import type { Candle, Timeframe } from "@/lib/yahoo/types";
import { toBinanceSymbol } from "./ticker";

const BASE = "https://api.binance.com/api/v3";
const WS_BASE = "wss://stream.binance.com:9443/ws";

const TF_MAP: Record<Timeframe, string> = {
  "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m", "1h": "1h", "4h": "4h", "1d": "1d", "1w": "1w",
};

/** Fetch historical klines from Binance public REST. */
export async function fetchBinanceKlines(
  appSymbol: string,
  tf: Timeframe,
  limit = 500,
): Promise<Candle[]> {
  const bs = toBinanceSymbol(appSymbol);
  const interval = TF_MAP[tf];
  const res = await fetch(`${BASE}/klines?symbol=${bs}&interval=${interval}&limit=${limit}`);
  if (!res.ok) throw new Error(`Binance klines ${bs} ${res.status}`);
  const raw: Array<[number, string, string, string, string, string, ...unknown[]]> = await res.json();
  return raw.map((r) => ({
    time: Math.floor(r[0] / 1000), // ms → s
    open:   parseFloat(r[1]),
    high:   parseFloat(r[2]),
    low:    parseFloat(r[3]),
    close:  parseFloat(r[4]),
    volume: parseFloat(r[5]),
  }));
}

type KlineCallback = (candle: Candle & { isFinal: boolean }) => void;

class BinanceKlineWS {
  private ws: WebSocket | null = null;
  private currentKey: string | null = null;
  private cb: KlineCallback | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _shouldConnect = false;

  subscribe(appSymbol: string, tf: Timeframe, cb: KlineCallback): () => void {
    const key = `${toBinanceSymbol(appSymbol).toLowerCase()}@kline_${TF_MAP[tf]}`;
    this.cb = cb;
    this.currentKey = key;
    this._shouldConnect = true;
    this._open();
    return () => {
      this._shouldConnect = false;
      this.cb = null;
      this.currentKey = null;
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.ws?.close();
    };
  }

  private _open() {
    if (!this.currentKey) return;
    if (this.ws) this.ws.close();
    this.ws = new WebSocket(`${WS_BASE}/${this.currentKey}`);

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string);
        const k = msg.k;
        if (!k || !this.cb) return;
        this.cb({
          time:   Math.floor(k.t / 1000),
          open:   parseFloat(k.o),
          high:   parseFloat(k.h),
          low:    parseFloat(k.l),
          close:  parseFloat(k.c),
          volume: parseFloat(k.v),
          isFinal: !!k.x,
        });
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

let _instance: BinanceKlineWS | null = null;
export function getBinanceKlineWS(): BinanceKlineWS {
  if (!_instance) _instance = new BinanceKlineWS();
  return _instance;
}
