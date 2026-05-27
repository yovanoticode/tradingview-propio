"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useChartStore, DEFAULT_FVG_CONFIG, type FvgConfig } from "@/lib/store/chart-store";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
      {children}
    </p>
  );
}

function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-tv-text">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3 w-3 accent-tv-blue"
      />
      {label}
    </label>
  );
}

function NumInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="w-36 shrink-0 text-xs text-tv-text-muted">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const v = parseInt(e.target.value);
          if (!isNaN(v) && v >= min && v <= max) onChange(v);
        }}
        className="w-16 rounded border border-tv-border bg-tv-bg px-2 py-0.5 text-xs text-tv-text focus:outline-none focus:border-tv-blue"
      />
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function FvgSettingsDialog({ open, onClose }: Props) {
  const stored    = useChartStore((s) => s.fvgConfig);
  const setConfig = useChartStore((s) => s.setFvgConfig);

  const [cfg, setCfg] = useState<FvgConfig>({ ...DEFAULT_FVG_CONFIG, ...stored });

  // Sync if dialog re-opens
  function handleOpenChange(v: boolean) {
    if (v) setCfg({ ...DEFAULT_FVG_CONFIG, ...stored });
    else onClose();
  }

  function patch(p: Partial<FvgConfig>) {
    setCfg((prev) => ({ ...prev, ...p }));
  }

  function apply() {
    setConfig(cfg);
    onClose();
  }

  function reset() {
    setCfg({ ...DEFAULT_FVG_CONFIG });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-80 max-h-[90vh] overflow-y-auto border-tv-border bg-tv-panel text-tv-text">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-tv-text">
            FVG &amp; Order Blocks
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-0.5 pb-2">

          {/* ── FVG ─────────────────────────────────────────────────── */}
          <SectionLabel>Fair Value Gaps</SectionLabel>

          <div className="flex flex-col gap-1.5 pl-1">
            <Check
              checked={cfg.showCE}
              onChange={(v) => patch({ showCE: v })}
              label="Mostrar CE-tocados (visitados)"
            />
            <Check
              checked={cfg.showIFVG}
              onChange={(v) => patch({ showIFVG: v })}
              label="Mostrar IFVG (invertidos)"
            />
            <Check
              checked={cfg.showHTF}
              onChange={(v) => patch({ showHTF: v })}
              label="Mostrar FVG de TF superior"
            />
          </div>

          <div className="mt-2 space-y-0.5">
            <NumInput
              label="Máx. FVG activos"
              value={cfg.maxActive}
              min={1} max={30}
              onChange={(v) => patch({ maxActive: v })}
            />
            <NumInput
              label="Tamaño mínimo (pts)"
              value={cfg.minSizePts}
              min={0} max={10000}
              onChange={(v) => patch({ minSizePts: v })}
            />
          </div>

          {/* ── Order Blocks ─────────────────────────────────────────── */}
          <SectionLabel>Order Blocks</SectionLabel>

          <div className="flex flex-col gap-1.5 pl-1">
            <Check
              checked={cfg.showOB}
              onChange={(v) => patch({ showOB: v })}
              label="Mostrar Order Blocks"
            />
            <Check
              checked={cfg.showBreaker}
              onChange={(v) => patch({ showBreaker: v })}
              label="Mostrar Breaker Blocks"
            />
          </div>

          <div className="mt-2 space-y-0.5">
            <NumInput
              label="Máx. Order Blocks"
              value={cfg.maxOBCount}
              min={1} max={20}
              onChange={(v) => patch({ maxOBCount: v })}
            />
          </div>

          {/* ── Market Structure ─────────────────────────────────────── */}
          <SectionLabel>Market Structure (BOS / CHoCH)</SectionLabel>

          <div className="flex flex-col gap-1.5 pl-1">
            <Check
              checked={cfg.showMSB}
              onChange={(v) => patch({ showMSB: v })}
              label="Mostrar BOS / CHoCH"
            />
            <Check
              checked={cfg.showSwings}
              onChange={(v) => patch({ showSwings: v })}
              label="Mostrar swing highs / lows"
            />
          </div>

          <div className="mt-2 space-y-0.5">
            <NumInput
              label="Lookback swing (barras)"
              value={cfg.msbLookback}
              min={1} max={10}
              onChange={(v) => patch({ msbLookback: v })}
            />
          </div>

        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-tv-border">
          <Button
            variant="ghost" size="sm"
            className="text-xs text-tv-text-muted hover:text-tv-text"
            onClick={reset}
          >
            Reset
          </Button>
          <Button
            size="sm"
            className="bg-tv-blue text-xs text-white hover:bg-tv-blue/80"
            onClick={apply}
          >
            Aplicar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
