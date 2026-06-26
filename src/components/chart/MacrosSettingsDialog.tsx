"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useChartStore, type IctMacroConfig } from "@/lib/store/chart-store";

// ── helpers ──────────────────────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, "0"); }
function toTime(h: number, m: number) { return `${pad(h)}:${pad(m)}`; }
function fromTime(s: string) {
  const [h, m] = s.split(":").map(Number);
  return { h: isNaN(h) ? 0 : h, m: isNaN(m) ? 0 : m };
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function MacrosSettingsDialog({ open, onClose }: Props) {
  const macrosConfig = useChartStore((s) => s.macrosConfig);
  const setMacrosConfig = useChartStore((s) => s.setMacrosConfig);
  const [draft, setDraft] = useState<IctMacroConfig[]>(macrosConfig);

  function handleOpen(v: boolean) {
    if (v) setDraft(macrosConfig);
    else onClose();
  }

  function updateMacro(i: number, patch: Partial<IctMacroConfig>) {
    setDraft((prev) => {
      const copy = [...prev];
      copy[i] = { ...copy[i], ...patch };
      return copy;
    });
  }

  function apply() {
    setMacrosConfig(draft);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-md bg-tv-panel">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium">ICT Macros — Configuración</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto pr-1 divide-y divide-tv-border/40">
          <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
            <span className="w-6 shrink-0">Act</span>
            <span className="w-36 shrink-0">Nombre</span>
            <span className="w-[72px] shrink-0">Inicio</span>
            <span className="w-[72px] shrink-0">Fin</span>
            <span className="w-8 shrink-0 text-right">Color</span>
          </div>

          {draft.map((macro, i) => (
            <div key={i} className="flex items-center gap-1.5 py-1.5">
              {/* Enabled Checkbox */}
              <input
                type="checkbox"
                checked={macro.enabled}
                onChange={(e) => updateMacro(i, { enabled: e.target.checked })}
                className="h-3.5 w-3.5 shrink-0 accent-tv-blue"
              />

              {/* Name Input */}
              <input
                value={macro.name}
                onChange={(e) => updateMacro(i, { name: e.target.value })}
                className="w-36 shrink-0 rounded border border-tv-border bg-tv-bg px-1.5 py-0.5 text-xs text-tv-text"
                maxLength={24}
              />

              {/* Start Time Input */}
              <input
                type="time"
                value={toTime(macro.startH, macro.startM)}
                onChange={(e) => {
                  const { h, m } = fromTime(e.target.value);
                  updateMacro(i, { startH: h, startM: m });
                }}
                className="w-[72px] shrink-0 rounded border border-tv-border bg-tv-bg px-1 py-0.5 text-xs text-tv-text"
              />

              <span className="text-xs text-tv-text-muted shrink-0">–</span>

              {/* End Time Input */}
              <input
                type="time"
                value={toTime(macro.endH, macro.endM)}
                onChange={(e) => {
                  const { h, m } = fromTime(e.target.value);
                  updateMacro(i, { endH: h, endM: m });
                }}
                className="w-[72px] shrink-0 rounded border border-tv-border bg-tv-bg px-1 py-0.5 text-xs text-tv-text"
              />

              {/* Color Picker */}
              <input
                type="color"
                value={macro.color}
                onChange={(e) => updateMacro(i, { color: e.target.value })}
                className="ml-auto h-6 w-6 cursor-pointer rounded border border-tv-border bg-transparent p-0 shrink-0"
              />
            </div>
          ))}
        </div>

        {/* ── Footer ───────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-tv-border/40">
          <Button variant="ghost" onClick={onClose} className="h-7 px-3 text-xs">
            Cancelar
          </Button>
          <Button onClick={apply} className="h-7 bg-tv-blue px-3 text-xs text-white hover:bg-tv-blue/80">
            Aplicar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
