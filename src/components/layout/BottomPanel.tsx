"use client";

import { useEffect, useState } from "react";
import { useChartStore } from "@/lib/store/chart-store";
import { fetchTicker24h } from "@/lib/yahoo/rest";
import type { Ticker24h } from "@/lib/yahoo/types";
import { formatPrice, formatPct, formatVolume } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TimezoneSelector } from "@/components/chart/TimezoneSelector";

export function BottomPanel() {
  const symbol = useChartStore((s) => s.symbol);
  const [t, setT] = useState<Ticker24h | null>(null);

  useEffect(() => {
    let cancelled = false;
    setT(null);
    const load = () => {
      if (symbol === "NQ100") return;
      fetchTicker24h(symbol)
        .then((x) => {
          if (!cancelled) setT(x);
        })
        .catch((err) => {
          // silently ignore in UI to avoid Next.js dev overlay, but log as warn
          console.warn(err.message);
        });
    };
    load();
    const id = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbol]);

  const upClass = (n: number) => (n >= 0 ? "text-tv-green" : "text-tv-red");

  return (
    <div className="flex h-9 items-center gap-0 border-t border-tv-border bg-tv-panel px-3 text-xs">
      <Stat label="Símbolo" value={symbol} />
      <Stat
        label="24h Cambio"
        value={t ? formatPct(t.priceChangePercent) : "—"}
        valueClass={t ? upClass(t.priceChangePercent) : ""}
      />
      <Stat
        label="24h Alto"
        value={t ? formatPrice(t.highPrice) : "—"}
        valueClass="text-tv-green"
      />
      <Stat
        label="24h Bajo"
        value={t ? formatPrice(t.lowPrice) : "—"}
        valueClass="text-tv-red"
      />
      <Stat
        label="24h Vol (base)"
        value={t ? formatVolume(t.volume) : "—"}
      />
      <Stat
        label="24h Vol (USDT)"
        value={t ? formatVolume(t.quoteVolume) : "—"}
      />
      <div className="ml-auto flex items-center gap-3 text-xs text-tv-text-dim px-3">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-tv-green" />
          <span>Datos en vivo</span>
        </div>
        <Clock />
        <TimezoneSelector />
      </div>
    </div>
  );
}

function Clock() {
  const [time, setTime] = useState<Date | null>(null);
  const chartTimezone = useChartStore((s) => s.chartTimezone);

  useEffect(() => {
    setTime(new Date());
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!time) return null;

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: chartTimezone,
      timeZoneName: "shortOffset",
    });

    const formatted = formatter.format(time).replace("GMT", "UTC");

    return (
      <div className="font-medium tabular-nums text-tv-text">
        {formatted}
      </div>
    );
  } catch (e) {
    return <div className="font-medium tabular-nums text-tv-text">{time.toLocaleTimeString()}</div>;
  }
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 border-r border-tv-border px-3">
      <span className="text-tv-text-dim">{label}</span>
      <span className={cn("font-medium tabular-nums", valueClass ?? "text-tv-text")}>
        {value}
      </span>
    </div>
  );
}
