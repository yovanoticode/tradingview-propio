"use client";

import { useChartStore } from "@/lib/store/chart-store";
import { cn } from "@/lib/utils";
import { Database } from "lucide-react";

export function DataSourceSelector() {
  const activeSlot = useChartStore((s) => s.activeSlot);
  const slots = useChartStore((s) => s.slots);
  const setDataSource = useChartStore((s) => s.setDataSource);
  
  const slot = slots[activeSlot] ?? { dataSource: "nt8" };
  const currentSource = slot.dataSource ?? "nt8";
  
  const nt8Connected = useChartStore((s) => s.nt8Connected);
  const tradovateConnected = useChartStore((s) => s.tradovateConnected);

  const sources: { id: "nt8" | "yahoo" | "tradovate"; label: string; enabled: boolean; tooltip: string }[] = [
    { 
      id: "nt8", 
      label: "NT8", 
      enabled: nt8Connected, 
      tooltip: nt8Connected ? "Usar datos locales de NinjaTrader 8" : "NinjaTrader 8 no está conectado" 
    },
    { 
      id: "tradovate", 
      label: "Tradovate", 
      enabled: tradovateConnected, 
      tooltip: tradovateConnected ? "Usar API en tiempo real de Tradovate" : "Tradovate no está conectado" 
    },
    { 
      id: "yahoo", 
      label: "Yahoo", 
      enabled: true, 
      tooltip: "Usar Yahoo Finance (Histórico + Polling)" 
    }
  ];

  return (
    <div className="flex items-center gap-1.5 ml-1">
      <span className="text-[10px] uppercase font-semibold text-tv-text-muted flex items-center gap-1 select-none">
        <Database className="h-3 w-3 text-tv-text-muted" /> Source:
      </span>
      <div className="flex items-center gap-0.5 rounded bg-tv-bg p-0.5 border border-tv-border/40">
        {sources.map((src) => {
          const active = currentSource === src.id;
          return (
            <button
              key={src.id}
              onClick={() => setDataSource(activeSlot, src.id)}
              disabled={!src.enabled && src.id !== "yahoo"}
              title={src.tooltip}
              className={cn(
                "rounded px-2.5 py-0.5 text-[10px] font-semibold transition-all duration-150 uppercase disabled:opacity-30 disabled:cursor-not-allowed border",
                active
                  ? src.id === "nt8"
                    ? "bg-tv-blue/15 text-tv-blue border-tv-blue/30"
                    : src.id === "tradovate"
                    ? "bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30"
                    : "bg-tv-panel-hover text-tv-text border-tv-border"
                  : "text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text border-transparent"
              )}
            >
              {src.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
