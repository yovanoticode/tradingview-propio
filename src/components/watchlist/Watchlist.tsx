"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { fetchTickers24h } from "@/lib/yahoo/rest";
import { getYahooPoller } from "@/lib/yahoo/ws";
import { fetchBinanceTickers, getBinanceTickerWS, isCryptoSymbol } from "@/lib/binance/ticker";
import { useChartStore } from "@/lib/store/chart-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatPrice, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Row {
  symbol: string;
  price: number;
  pct: number;
}

export function Watchlist() {
  const watchlist = useChartStore((s) => s.watchlist);
  const symbol = useChartStore((s) => s.symbol);
  const setSymbol = useChartStore((s) => s.setSymbol);
  const removeFromWatchlist = useChartStore((s) => s.removeFromWatchlist);
  const openSymbolDialog = useChartStore((s) => s.setSymbolDialogOpen);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [flash, setFlash] = useState<Record<string, "up" | "down" | null>>({});

  useEffect(() => {
    if (watchlist.length === 0) return;
    let cancelled = false;

    const cryptoSymbols = watchlist.filter(isCryptoSymbol);
    const yahooSymbols  = watchlist.filter((s) => !isCryptoSymbol(s));

    // Snapshot — Yahoo
    if (yahooSymbols.length > 0) {
      fetchTickers24h(yahooSymbols)
        .then((tickers) => {
          if (cancelled) return;
          setRows((prev) => {
            const next = { ...prev };
            tickers.forEach((t) => { next[t.symbol] = { symbol: t.symbol, price: t.lastPrice, pct: t.priceChangePercent }; });
            return next;
          });
        })
        .catch(console.error);
    }

    // Snapshot — Binance
    if (cryptoSymbols.length > 0) {
      fetchBinanceTickers(cryptoSymbols)
        .then((tickers) => {
          if (cancelled) return;
          setRows((prev) => {
            const next = { ...prev };
            tickers.forEach((t) => { next[t.symbol] = { symbol: t.symbol, price: t.price, pct: t.pct }; });
            return next;
          });
        })
        .catch(console.error);
    }

    const applyUpdate = (symbol: string, price: number, pct: number) => {
      setRows((prev) => {
        const prevRow = prev[symbol];
        if (prevRow) {
          const dir = price > prevRow.price ? "up" : price < prevRow.price ? "down" : null;
          if (dir) {
            setFlash((f) => ({ ...f, [symbol]: dir }));
            setTimeout(() => setFlash((f) => ({ ...f, [symbol]: null })), 300);
          }
        }
        return { ...prev, [symbol]: { symbol, price, pct } };
      });
    };

    // Live — Yahoo
    const yahooUnsub = yahooSymbols.length > 0
      ? getYahooPoller().subscribeMiniTickers(yahooSymbols, (tick) => applyUpdate(tick.symbol, tick.close, tick.pct))
      : () => {};

    // Live — Binance
    const binanceUnsubs = cryptoSymbols.map((s) =>
      getBinanceTickerWS().subscribe(s, (t) => applyUpdate(t.symbol, t.price, t.pct)),
    );

    return () => {
      cancelled = true;
      yahooUnsub();
      binanceUnsubs.forEach((u) => u());
    };
  }, [watchlist]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-tv-border px-3 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-tv-text-muted">
          Watchlist
        </h2>
        <button
          onClick={() => openSymbolDialog(true)}
          className="rounded p-1 text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
          title="Agregar símbolo"
          aria-label="Agregar al watchlist"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-tv-border px-3 py-1.5 text-[10px] uppercase tracking-wider text-tv-text-dim">
        <span>Símbolo</span>
        <span className="text-right">Precio</span>
        <span className="text-right">24h</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {watchlist.map((s) => {
            const row = rows[s];
            const isActive = s === symbol;
            const f = flash[s];
            return (
              <div
                key={s}
                onClick={() => setSymbol(s)}
                className={cn(
                  "group grid cursor-pointer grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-1.5 text-xs transition-colors",
                  "hover:bg-tv-panel-hover",
                  isActive && "bg-tv-panel-hover",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-tv-text">
                    {s.includes("=") ? s.split("=")[0] : s.includes("-") ? s.split("-")[0] : s.replace(/\^/, "")}
                  </span>
                  <span className="text-[10px] text-tv-text-dim">
                    {s.includes("=F") ? "FUT" : s.startsWith("^") ? "IDX" : s.includes("-USD") ? "USDT" : ""}
                  </span>
                </div>
                <span
                  className={cn(
                    "text-right tabular-nums transition-colors",
                    f === "up" && "text-tv-green",
                    f === "down" && "text-tv-red",
                    !f && "text-tv-text",
                  )}
                >
                  {row ? formatPrice(row.price) : "—"}
                </span>
                <div className="flex items-center justify-end gap-1">
                  <span
                    className={cn(
                      "tabular-nums",
                      row
                        ? row.pct >= 0
                          ? "text-tv-green"
                          : "text-tv-red"
                        : "text-tv-text-muted",
                    )}
                  >
                    {row ? formatPct(row.pct) : "—"}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromWatchlist(s);
                    }}
                    className="invisible rounded p-0.5 text-tv-text-muted hover:bg-tv-bg hover:text-tv-red group-hover:visible"
                    aria-label={`Quitar ${s} del watchlist`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
          {watchlist.length === 0 && (
            <div className="p-4 text-center text-xs text-tv-text-muted">
              Tu watchlist está vacío
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
