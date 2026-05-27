"use client";

import { Globe } from "lucide-react";
import { useChartStore } from "@/lib/store/chart-store";

const TZ_OPTIONS = [
  { value: "America/New_York", label: "Nueva York (ET)" },
  { value: "America/Bogota",   label: "Bogotá (COT)" },
] as const;

export function TimezoneSelector() {
  const chartTimezone   = useChartStore((s) => s.chartTimezone);
  const setChartTimezone = useChartStore((s) => s.setChartTimezone);

  const current = TZ_OPTIONS.find((o) => o.value === chartTimezone) ?? TZ_OPTIONS[0];
  const next    = TZ_OPTIONS.find((o) => o.value !== chartTimezone) ?? TZ_OPTIONS[1];

  return (
    <button
      onClick={() => setChartTimezone(next.value)}
      title={`Zona horaria: ${current.label} — click para cambiar a ${next.label}`}
      className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text transition-colors"
    >
      <Globe className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">
        {chartTimezone === "America/New_York" ? "ET" : "COT"}
      </span>
    </button>
  );
}
