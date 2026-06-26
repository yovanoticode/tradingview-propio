"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useChartStore,
  DEFAULT_CONFIG,
  type IndicatorKey,
} from "@/lib/store/chart-store";

const TITLES: Record<IndicatorKey, string> = {
  ema20: "EMA — Slot 1",
  ema50: "EMA — Slot 2",
  ema200: "EMA — Slot 3",
  rsi: "RSI",
  macd: "MACD",
  volume: "Volumen",
  orb: "ORB",
  ict: "ICT Killzones",
  vwap: "VWAP",
  volumeProfile: "Volume Profile",
  fvg: "Fair Value Gaps",
  stoch: "Estocástico",
  ictMacros: "ICT Macros",
};

export function IndicatorSettingsDialog() {
  const target = useChartStore((s) => s.settingsTarget);
  const setTarget = useChartStore((s) => s.setSettingsTarget);
  const config = useChartStore((s) => s.config);
  const setConfig = useChartStore((s) => s.setConfig);

  const open = target !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setTarget(null);
      }}
    >
      <DialogContent className="max-w-sm bg-tv-panel">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {target ? TITLES[target] : ""} — Configuración
          </DialogTitle>
        </DialogHeader>
        {target && (
          <SettingsForm
            target={target}
            config={config}
            onSave={(patch) => {
              setConfig(patch);
              setTarget(null);
            }}
            onReset={() => {
              setConfig(DEFAULT_CONFIG);
              setTarget(null);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface FormProps {
  target: IndicatorKey;
  config: typeof DEFAULT_CONFIG;
  onSave: (patch: Partial<typeof DEFAULT_CONFIG>) => void;
  onReset: () => void;
}

function SettingsForm({ target, config, onSave, onReset }: FormProps) {
  // Local draft state to avoid recalculating chart on every keystroke
  const [draft, setDraft] = useState({
    ema20: config.ema20,
    ema50: config.ema50,
    ema200: config.ema200,
    rsi: config.rsi,
    macdFast: config.macdFast,
    macdSlow: config.macdSlow,
    macdSignal: config.macdSignal,
    stochK: config.stochK,
    stochD: config.stochD,
    stochKVisible: config.stochKVisible ?? true,
    stochDVisible: config.stochDVisible ?? true,
    stochKColor: config.stochKColor || "#2196f3",
    stochDColor: config.stochDColor || "#ffa726",
  });

  useEffect(() => {
    setDraft({
      ema20: config.ema20,
      ema50: config.ema50,
      ema200: config.ema200,
      rsi: config.rsi,
      macdFast: config.macdFast,
      macdSlow: config.macdSlow,
      macdSignal: config.macdSignal,
      stochK: config.stochK,
      stochD: config.stochD,
      stochKVisible: config.stochKVisible ?? true,
      stochDVisible: config.stochDVisible ?? true,
      stochKColor: config.stochKColor || "#2196f3",
      stochDColor: config.stochDColor || "#ffa726",
    });
  }, [config, target]);

  function save() {
    if (target === "ema20") onSave({ ema20: clamp(draft.ema20, 2, 500) });
    else if (target === "ema50") onSave({ ema50: clamp(draft.ema50, 2, 500) });
    else if (target === "ema200") onSave({ ema200: clamp(draft.ema200, 2, 500) });
    else if (target === "rsi") onSave({ rsi: clamp(draft.rsi, 2, 100) });
    else if (target === "macd")
      onSave({
        macdFast: clamp(draft.macdFast, 2, 100),
        macdSlow: clamp(draft.macdSlow, 2, 200),
        macdSignal: clamp(draft.macdSignal, 2, 100),
      });
    else if (target === "stoch")
      onSave({
        stochK: clamp(draft.stochK, 2, 100),
        stochD: clamp(draft.stochD, 2, 100),
        stochKVisible: draft.stochKVisible,
        stochDVisible: draft.stochDVisible,
        stochKColor: draft.stochKColor,
        stochDColor: draft.stochDColor,
      });
    else if (target === "volume") onSave({});
  }

  return (
    <div className="flex flex-col gap-3">
      {(target === "ema20" || target === "ema50" || target === "ema200") && (
        <Field
          label="Período"
          value={draft[target]}
          onChange={(n) => setDraft((d) => ({ ...d, [target]: n }))}
        />
      )}
      {target === "rsi" && (
        <Field
          label="Período"
          value={draft.rsi}
          onChange={(n) => setDraft((d) => ({ ...d, rsi: n }))}
        />
      )}
      {target === "macd" && (
        <div className="grid grid-cols-3 gap-2">
          <Field
            label="Rápida"
            value={draft.macdFast}
            onChange={(n) => setDraft((d) => ({ ...d, macdFast: n }))}
          />
          <Field
            label="Lenta"
            value={draft.macdSlow}
            onChange={(n) => setDraft((d) => ({ ...d, macdSlow: n }))}
          />
          <Field
            label="Señal"
            value={draft.macdSignal}
            onChange={(n) => setDraft((d) => ({ ...d, macdSignal: n }))}
          />
        </div>
      )}
      {target === "stoch" && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-tv-border bg-tv-bg focus:ring-tv-blue"
                checked={draft.stochKVisible}
                onChange={(e) => setDraft((d) => ({ ...d, stochKVisible: e.target.checked }))}
              />
              <Field
                label="%K (Longitud)"
                value={draft.stochK}
                onChange={(n) => setDraft((d) => ({ ...d, stochK: n }))}
              />
            </div>
            <div className="flex gap-2 pl-8">
              {["#2196f3", "#ffa726", "#ef4444", "#22c55e", "#a855f7", "#ffffff", "#eab308"].map((c) => (
                <button
                  key={c}
                  onClick={() => setDraft((d) => ({ ...d, stochKColor: c }))}
                  className={`h-5 w-5 rounded-full border border-tv-border ${
                    draft.stochKColor === c ? "ring-2 ring-white ring-offset-1 ring-offset-tv-bg" : ""
                  }`}
                  style={{ backgroundColor: c }}
                  type="button"
                />
              ))}
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-tv-border bg-tv-bg focus:ring-tv-blue"
                checked={draft.stochDVisible}
                onChange={(e) => setDraft((d) => ({ ...d, stochDVisible: e.target.checked }))}
              />
              <Field
                label="%D (Suavizado)"
                value={draft.stochD}
                onChange={(n) => setDraft((d) => ({ ...d, stochD: n }))}
              />
            </div>
            <div className="flex gap-2 pl-8">
              {["#2196f3", "#ffa726", "#ef4444", "#22c55e", "#a855f7", "#ffffff", "#eab308"].map((c) => (
                <button
                  key={c}
                  onClick={() => setDraft((d) => ({ ...d, stochDColor: c }))}
                  className={`h-5 w-5 rounded-full border border-tv-border ${
                    draft.stochDColor === c ? "ring-2 ring-white ring-offset-1 ring-offset-tv-bg" : ""
                  }`}
                  style={{ backgroundColor: c }}
                  type="button"
                />
              ))}
            </div>
          </div>
        </div>
      )}
      {target === "volume" && (
        <p className="text-xs text-tv-text-muted">
          El indicador de volumen no tiene parámetros configurables en esta
          versión.
        </p>
      )}

      <div className="mt-2 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="text-tv-text-muted hover:text-tv-text"
        >
          Reset defaults
        </Button>
        <Button size="sm" onClick={save} className="bg-tv-blue hover:bg-tv-blue/90">
          Aplicar
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
        {label}
      </span>
      <Input
        type="number"
        min={2}
        max={500}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!isNaN(n)) onChange(n);
        }}
        className="bg-tv-bg tabular-nums"
      />
    </label>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
