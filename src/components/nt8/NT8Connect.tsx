"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Activity, Loader2 } from "lucide-react";
import { useChartStore } from "@/lib/store/chart-store";
import type { Timeframe } from "@/lib/yahoo/types";
import { getNT8WS } from "@/lib/nt8/ws";
import { pingNT8, fetchNT8Info, fetchNT8Instruments } from "@/lib/nt8/rest";
import { cn } from "@/lib/utils";

function nt8TfToApp(tf: string): Timeframe {
  const map: Record<string, Timeframe> = {
    "1Minute": "1m",  "2Minute": "1m",  "3Minute": "5m",
    "5Minute": "5m",  "10Minute": "15m","15Minute": "15m",
    "30Minute": "30m","60Minute": "1h", "1Hour": "1h",
    "1Day": "1d",     "1Week": "1w",
  };
  return map[tf] ?? "1m";
}

// Health thresholds for staleness in ms
const STALE_WARN = 30_000; // 30s without ticks → yellow
const STALE_DEAD = 90_000; // 90s without ticks → red

type Health = "ok" | "warn" | "dead";

export function NT8Connect() {
  const nt8Connected    = useChartStore((s) => s.nt8Connected);
  const nt8Instrument   = useChartStore((s) => s.nt8Instrument);
  const nt8WasConnected = useChartStore((s) => s.nt8WasConnected);
  const setNT8          = useChartStore((s) => s.setNT8);
  const setTimeframe    = useChartStore((s) => s.setTimeframe);
  const [loading, setLoading] = useState(false);
  const [health,  setHealth]  = useState<Health>("ok");
  const autoTriedRef = useRef(false);

  const connect = useCallback(async (silent = false) => {
    setLoading(true);
    try {
      const alive = await pingNT8();
      if (!alive) {
        if (!silent) alert("NT8 no responde. Abrí NinjaTrader y asegurate que la estrategia TradingViewBridge esté activa y corriendo.");
        return false;
      }
      const info = await fetchNT8Info();
      const appTf = nt8TfToApp(info.timeframe);
      let activeInstruments: string[] = [];
      try {
        activeInstruments = await fetchNT8Instruments();
      } catch (err) {
        console.error("Error fetching active instruments:", err);
      }
      getNT8WS().connect();
      setNT8(true, info.instrument);
      useChartStore.getState().setNT8Instruments(activeInstruments);
      setTimeframe(appTf);
      console.log(`[NT8] Conectado: ${info.instrument} · ${info.timeframe} → ${appTf} · ${info.bars} barras`);
      return true;
    } catch (e) {
      if (!silent) alert(`Error conectando a NT8: ${e}`);
      return false;
    } finally {
      setLoading(false);
    }
  }, [setNT8, setTimeframe]);

  const disconnect = useCallback(() => {
    getNT8WS().disconnect();
    setNT8(false, null);
  }, [setNT8]);

  // Auto-reconnect on mount if user was connected before
  useEffect(() => {
    if (nt8WasConnected && !nt8Connected && !autoTriedRef.current) {
      autoTriedRef.current = true;
      void connect(true); // silent — no alert if NT8 isn't running
    }
  }, [nt8WasConnected, nt8Connected, connect]);

  // Background polling — when disconnected but user had used NT8 before,
  // poll every 10s and auto-reconnect when NT8 comes back online
  useEffect(() => {
    if (nt8Connected || !nt8WasConnected) return;
    const id = setInterval(async () => {
      const alive = await pingNT8();
      if (alive) void connect(true);
    }, 10_000);
    return () => clearInterval(id);
  }, [nt8Connected, nt8WasConnected, connect]);

  // Health monitor — track WS staleness while connected
  useEffect(() => {
    if (!nt8Connected) { setHealth("ok"); return; }
    const id = setInterval(() => {
      const s = getNT8WS().staleness;
      if (s > STALE_DEAD)      setHealth("dead");
      else if (s > STALE_WARN) setHealth("warn");
      else                     setHealth("ok");
    }, 2_000);
    return () => clearInterval(id);
  }, [nt8Connected]);

  // Instrument monitor — poll active instruments from NT8
  useEffect(() => {
    if (!nt8Connected) return;
    const id = setInterval(async () => {
      try {
        const instruments = await fetchNT8Instruments();
        useChartStore.getState().setNT8Instruments(instruments);
        if (instruments.length > 0 && (!nt8Instrument || !instruments.includes(nt8Instrument))) {
          setNT8(true, instruments[0]);
        }
      } catch {
        // ignore errors during background polling
      }
    }, 5000);
    return () => clearInterval(id);
  }, [nt8Connected, nt8Instrument, setNT8]);

  // Hotkey: Ctrl+Shift+N → toggle NT8
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "N" || e.key === "n")) {
        e.preventDefault();
        if (nt8Connected) disconnect();
        else void connect(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [nt8Connected, connect, disconnect]);

  const dotColor = !nt8Connected ? "" : health === "ok" ? "bg-[#22d3ee]" : health === "warn" ? "bg-tv-yellow" : "bg-tv-red";
  const textColor = !nt8Connected ? "text-tv-text-muted" : health === "dead" ? "text-tv-red" : health === "warn" ? "text-tv-yellow" : "text-[#22d3ee]";
  const title = nt8Connected
    ? `NT8 · ${nt8Instrument}${health === "warn" ? " · sin ticks recientes" : health === "dead" ? " · conexión muerta" : ""} · Ctrl+Shift+N para desconectar`
    : "Conectar NinjaTrader 8 (Ctrl+Shift+N)";

  const nt8OffsetHours = useChartStore((s) => s.nt8OffsetHours);
  const setNt8OffsetHours = useChartStore((s) => s.setNt8OffsetHours);

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={nt8Connected ? disconnect : () => connect(false)}
        disabled={loading}
        className={cn("flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition-colors hover:bg-tv-panel-hover", textColor)}
        title={title}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : nt8Connected ? (
          <>
            <span className={cn("inline-flex h-1.5 w-1.5 rounded-full", dotColor, health === "ok" && "animate-pulse")} />
            <Activity className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{nt8Instrument ?? "NT8"}</span>
          </>
        ) : (
          <>
            <Activity className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">NT8</span>
          </>
        )}
      </button>

      {nt8Connected && (
        <div className="flex items-center rounded bg-tv-panel-hover text-xs text-tv-text-muted">
          <button
            onClick={() => setNt8OffsetHours(nt8OffsetHours - 1)}
            className="px-1.5 py-1 hover:text-tv-text transition-colors"
            title="Reducir desfase horario"
          >
            -
          </button>
          <span className="min-w-[1.5rem] text-center" title="Desfase horario actual de NT8 (horas)">
            {nt8OffsetHours > 0 ? `+${nt8OffsetHours}` : nt8OffsetHours}
          </span>
          <button
            onClick={() => setNt8OffsetHours(nt8OffsetHours + 1)}
            className="px-1.5 py-1 hover:text-tv-text transition-colors"
            title="Aumentar desfase horario"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
