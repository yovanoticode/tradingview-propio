const NT8_WS_URL = "ws://localhost:4001";

/** Misma corrección que en rest.ts — Colombia (UTC-5) vs ET actual */
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
  const etAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), h, get("minute"), get("second"));
  const etOffsetSec = Math.round((etAsUtc - now.getTime()) / 1000);
  return (-etOffsetSec) - 18000; // -3600 en verano, 0 en invierno
}

type TickCallback = (tick: { price: number; symbol?: string }) => void;
type BarCallback = (bar: { type: "bar" | "bar_close"; symbol?: string; time: number; open: number; high: number; low: number; close: number; volume: number }) => void;

class NT8WSClient {
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
          this.tickCbs.forEach((cb) => cb(msg));
        } else if (msg.type === "bar" || msg.type === "bar_close") {
          const corr = nt8TimestampCorrection();
          this.barCbs.forEach((cb) => cb({ ...msg, time: msg.time + corr }));
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
