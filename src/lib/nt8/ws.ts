import { useChartStore } from "@/lib/store/chart-store";

export interface TickMessage {
  type: "tick";
  symbol?: string;
  price: number;
}

export interface BarMessage {
  type: "bar" | "bar_close";
  symbol?: string;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type TickCallback = (msg: TickMessage) => void;
export type BarCallback = (msg: BarMessage) => void;

const NT8_WS_URL = "ws://localhost:4001";
let cachedCorr: number | null = null;

export function nt8TimestampCorrection(): number {
  if (cachedCorr !== null) return cachedCorr;
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
  const etAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), h, get("minute"), get("second"));
  const nowSecs = Math.floor(now.getTime() / 1000) * 1000;
  const etOffsetSec = Math.round((etAsUtc - nowSecs) / 1000);
  const rawCorr = (-etOffsetSec) - 18000;
  cachedCorr = Math.round(rawCorr / 1800) * 1800; // Round to nearest 30m block
  return cachedCorr;
}


export class NT8WSClient {
  private ws: WebSocket | null = null;
  private tickCbs = new Set<TickCallback>();
  private barCbs = new Set<BarCallback>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setTimeout> | null = null;
  private _connected = false;
  private _shouldConnect = false;
  private _lastEventAt = 0; // ms since last tick or bar received

  connect() {
    this._shouldConnect = true;
    this._open();
  }

  private _open() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    this.ws = new WebSocket(NT8_WS_URL);

    this.ws.onopen = () => {
      this._connected = true;
      console.log("[NT8] WebSocket conectado");
      
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send("ping");
        }
      }, 20000);
    };

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string);
        this._lastEventAt = Date.now();
        if (msg.type === "tick") {
          const price = msg.price ?? msg.Price ?? msg.p ?? msg.P ?? 0;
          if (price > 0 && !isNaN(price)) {
            this.tickCbs.forEach((cb) => cb({ ...msg, price }));
          }
        } else if (msg.type === "bar" || msg.type === "bar_close") {
          if (!(window as any).loggedNT8) {
            (window as any).loggedNT8 = true;
            fetch('/api/log', { method: 'POST', body: JSON.stringify({ source: 'nt8_ws', msg }) }).catch(console.error);
          }
          const nt8OffsetHours = useChartStore.getState().nt8OffsetHours;
          const offsetSecs = nt8OffsetHours * 3600;
          
          const open = msg.open ?? msg.Open ?? msg.o ?? msg.O ?? 0;
          const high = msg.high ?? msg.High ?? msg.h ?? msg.H ?? 0;
          const low = msg.low ?? msg.Low ?? msg.l ?? msg.L ?? 0;
          const close = msg.close ?? msg.Close ?? msg.c ?? msg.C ?? 0;
          const volume = msg.volume ?? msg.Volume ?? msg.v ?? msg.V ?? 0;
          
          if (open > 0 && high > 0 && low > 0 && close > 0 && !isNaN(open) && !isNaN(high) && !isNaN(low) && !isNaN(close)) {
            // Drop bad ticks/spikes that go to 0 and destroy chart scaling
            if (low < close * 0.5 || high > close * 1.5) return;

            // Truncate time to minute boundary to prevent each update creating a new bar
            const rawTime = msg.time ?? msg.Time ?? msg.t ?? msg.T ?? 0;
            const isMs = rawTime > 100000000000;
            const tSecs = isMs ? rawTime / 1000 : rawTime;
            const time = Math.floor(tSecs / 60) * 60 + offsetSecs;
            
            if (!isNaN(time)) {
              this.barCbs.forEach((cb) => cb({ ...msg, time, open, high, low, close, volume }));
            }
          }
        }
      } catch { /* ignore malformed */ }
    };

    this.ws.onclose = () => {
      this._connected = false;
      if (this.pingTimer) {
        clearInterval(this.pingTimer);
        this.pingTimer = null;
      }
      if (this._shouldConnect) {
        this.reconnectTimer = setTimeout(() => this._open(), 3000);
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  subscribeTick(cb: TickCallback): () => void {
    this.tickCbs.add(cb);
    return () => this.tickCbs.delete(cb);
  }

  subscribeBar(cb: BarCallback): () => void {
    this.barCbs.add(cb);
    return () => this.barCbs.delete(cb);
  }

  disconnect() {
    this._shouldConnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.ws?.close();
    this._connected = false;
  }

  get connected() {
    return this._connected;
  }

  /** ms since last received event, or Infinity if never */
  get staleness(): number {
    return this._lastEventAt === 0 ? Infinity : Date.now() - this._lastEventAt;
  }
}

let instance: NT8WSClient | null = null;

export function getNT8WS(): NT8WSClient {
  if (!instance) instance = new NT8WSClient();
  return instance;
}
