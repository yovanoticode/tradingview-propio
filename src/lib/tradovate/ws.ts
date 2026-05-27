import type { Candle, Timeframe } from "@/lib/yahoo/types";

export interface TradovateWSMessage {
  e: string; // event type, e.g. "chart"
  d: any;    // data
}

type ChartCallback = (bars: Candle[], isRealtime: boolean) => void;

class TradovateWebSocketClient {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private env: "demo" | "live" = "demo";
  private seqId = 0;
  private pendingRequests = new Map<number, (res: any) => void>();
  private activeSubscriptions = new Map<string, { subscriptionId: number; callback: ChartCallback; bars: Candle[] }>();
  private heartbeatTimer: any = null;
  private isConnecting = false;

  public connect(token: string, env: "demo" | "live" = "demo") {
    if (this.ws && this.token === token && this.env === env) return;
    this.token = token;
    this.env = env;
    this.disconnect();
    this.isConnecting = true;

    const url = env === "demo"
      ? "wss://demo.tradovateapi.com/v1/websocket"
      : "wss://live.tradovateapi.com/v1/websocket";

    try {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => {
        this.isConnecting = false;
        console.log(`[TradovateWS] Conectado a ${env}`);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = () => {
        console.log("[TradovateWS] Conexión cerrada");
        this.cleanup();
      };

      this.ws.onerror = (err) => {
        console.error("[TradovateWS] Error:", err);
      };
    } catch (e) {
      console.error("[TradovateWS] Error creando socket:", e);
      this.isConnecting = false;
    }
  }

  public disconnect() {
    this.cleanup();
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
  }

  private cleanup() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.pendingRequests.clear();
    this.activeSubscriptions.clear();
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Send SockJS heartbeat frame or dummy payload to keep alive
        this.ws.send("[]");
      }
    }, 2500);
  }

  private sendRequest(path: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error("WebSocket not open"));
      }
      const id = ++this.seqId;
      this.pendingRequests.set(id, (res) => {
        if (res.s === 200) resolve(res.d);
        else reject(new Error(res.d?.errorText || `Error ${res.s}`));
      });
      const body = payload ? `\n\n${JSON.stringify(payload)}` : "";
      this.ws.send(`${path}\n${id}${body}`);
    });
  }

  private handleMessage(data: string) {
    if (!data) return;
    const prefix = data[0];
    
    // SockJS Frame Handling
    if (prefix === "o") {
      // Open frame — authorize immediately
      if (this.token) {
        this.ws?.send(`authorize\n1\n\n${this.token}`);
      }
      this.startHeartbeat();
    } else if (prefix === "h") {
      // Heartbeat frame — ignore
    } else if (prefix === "a") {
      try {
        const payloadStr = data.substring(1);
        const list = JSON.parse(payloadStr);
        if (Array.isArray(list)) {
          for (const msg of list) {
            this.processFrame(msg);
          }
        }
      } catch (e) {
        console.error("[TradovateWS] Error al decodificar SockJS frame:", e);
      }
    }
  }

  private processFrame(msg: any) {
    // Response to a request (contains sequence ID `i` and status `s`)
    if (msg.i && msg.s) {
      const handler = this.pendingRequests.get(msg.i);
      if (handler) {
        this.pendingRequests.delete(msg.i);
        handler(msg);
      }
      return;
    }

    // Event notification (contains event `e` and data `d`)
    if (msg.e === "chart" && msg.d && msg.d.charts) {
      for (const chart of msg.d.charts) {
        this.handleChartData(chart);
      }
    }
  }

  private handleChartData(chart: any) {
    const subId = chart.id;
    // Find active subscription by ID
    let foundKey = "";
    let sub: any = null;
    for (const [key, val] of this.activeSubscriptions.entries()) {
      if (val.subscriptionId === subId) {
        foundKey = key;
        sub = val;
        break;
      }
    }

    if (!sub) return;

    if (chart.bars && Array.isArray(chart.bars)) {
      const newCandles: Candle[] = chart.bars.map((bar: any) => ({
        time: Math.round(Date.parse(bar.t) / 1000),
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v,
      }));

      // Collect and merge bars by timestamp to prevent duplicates
      const merged = [...sub.bars];
      for (const nc of newCandles) {
        const idx = merged.findIndex((b) => b.time === nc.time);
        if (idx !== -1) {
          merged[idx] = nc;
        } else {
          merged.push(nc);
        }
      }
      merged.sort((a, b) => a.time - b.time);
      sub.bars = merged;

      // Propagate updates
      sub.callback(sub.bars, false);
    }

    if (chart.eoh) {
      // Transition to realtime
      sub.callback(sub.bars, true);
    }
  }

  public async subscribeChart(
    symbol: string,
    timeframe: Timeframe,
    callback: ChartCallback
  ): Promise<string> {
    const key = `${symbol}:${timeframe}`;
    
    // Unsubscribe existing if any
    await this.unsubscribeChart(symbol, timeframe);

    const mappedSymbol = symbol.replace("=F", "").replace(/^/, "@");
    const tfMap: Record<Timeframe, { underlyingType: string; elementSize: number }> = {
      "1m":  { underlyingType: "MinuteBar", elementSize: 1 },
      "5m":  { underlyingType: "MinuteBar", elementSize: 5 },
      "15m": { underlyingType: "MinuteBar", elementSize: 15 },
      "30m": { underlyingType: "MinuteBar", elementSize: 30 },
      "1h":  { underlyingType: "MinuteBar", elementSize: 60 },
      "4h":  { underlyingType: "MinuteBar", elementSize: 240 },
      "1d":  { underlyingType: "DailyBar",  elementSize: 1 },
      "1w":  { underlyingType: "DailyBar",  elementSize: 7 },
    };

    const config = tfMap[timeframe] || tfMap["1m"];
    const payload = {
      symbol: mappedSymbol,
      chartDescription: {
        underlyingType: config.underlyingType,
        elementSize: config.elementSize,
        elementSizeUnit: "UnderlyingUnits",
        withHistogram: true,
      },
      timeRange: {
        asMuchAsElements: 500,
      },
    };

    try {
      const res = await this.sendRequest("md/getChart", payload);
      const subscriptionId = res.subscriptionId;
      this.activeSubscriptions.set(key, { subscriptionId, callback, bars: [] });
      console.log(`[TradovateWS] Suscrito a chart ${key} con ID: ${subscriptionId}`);
      return key;
    } catch (e) {
      console.error(`[TradovateWS] Error al suscribir a chart ${key}:`, e);
      throw e;
    }
  }

  public async unsubscribeChart(symbol: string, timeframe: Timeframe) {
    const key = `${symbol}:${timeframe}`;
    const sub = this.activeSubscriptions.get(key);
    if (!sub) return;

    this.activeSubscriptions.delete(key);
    try {
      await this.sendRequest("md/cancelChart", { subscriptionId: sub.subscriptionId });
      console.log(`[TradovateWS] Desuscrito de chart ${key}`);
    } catch (e) {
      console.error(`[TradovateWS] Error al desuscribir de chart ${key}:`, e);
    }
  }
}

export const getTradovateWS = (() => {
  let instance: TradovateWebSocketClient | null = null;
  return () => {
    if (!instance) {
      instance = new TradovateWebSocketClient();
    }
    return instance;
  };
})();
