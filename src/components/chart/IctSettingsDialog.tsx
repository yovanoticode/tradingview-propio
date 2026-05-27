"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  useChartStore,
  DEFAULT_ICT_CONFIG,
  type IctConfig,
  type IctSessionConfig,
  type OpeningPriceRow,
  type TimestampRow,
} from "@/lib/store/chart-store";

// ── helpers ──────────────────────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, "0"); }
function toTime(h: number, m: number) { return `${pad(h)}:${pad(m)}`; }
function fromTime(s: string) {
  const [h, m] = s.split(":").map(Number);
  return { h: isNaN(h) ? 0 : h, m: isNaN(m) ? 0 : m };
}

// ── sub-components ────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
      {children}
    </p>
  );
}

function Row({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      {label && <span className="w-32 shrink-0 text-xs text-tv-text-muted">{label}</span>}
      {children}
    </div>
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
        className="h-3.5 w-3.5 accent-tv-blue"
      />
      {label}
    </label>
  );
}

function SessionRow({
  sess,
  onChange,
}: {
  sess: IctSessionConfig;
  onChange: (s: IctSessionConfig) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <input
        type="checkbox"
        checked={sess.enabled}
        onChange={(e) => onChange({ ...sess, enabled: e.target.checked })}
        className="h-3.5 w-3.5 shrink-0 accent-tv-blue"
      />
      <input
        value={sess.name}
        onChange={(e) => onChange({ ...sess, name: e.target.value })}
        className="w-20 rounded border border-tv-border bg-tv-bg px-1.5 py-0.5 text-xs text-tv-text"
        maxLength={14}
      />
      <input
        type="time"
        value={toTime(sess.startH, sess.startM)}
        onChange={(e) => {
          const { h, m } = fromTime(e.target.value);
          onChange({ ...sess, startH: h, startM: m });
        }}
        className="w-[72px] rounded border border-tv-border bg-tv-bg px-1 py-0.5 text-xs text-tv-text"
      />
      <span className="text-xs text-tv-text-muted">–</span>
      <input
        type="time"
        value={toTime(sess.endH, sess.endM)}
        onChange={(e) => {
          const { h, m } = fromTime(e.target.value);
          onChange({ ...sess, endH: h, endM: m });
        }}
        className="w-[72px] rounded border border-tv-border bg-tv-bg px-1 py-0.5 text-xs text-tv-text"
      />
      <input
        type="color"
        value={sess.color}
        onChange={(e) => onChange({ ...sess, color: e.target.value })}
        className="h-6 w-6 cursor-pointer rounded border border-tv-border bg-transparent p-0"
      />
    </div>
  );
}

function OpeningRow({
  row,
  onChange,
}: {
  row: OpeningPriceRow;
  onChange: (r: OpeningPriceRow) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <input type="checkbox" checked={row.enabled} onChange={(e) => onChange({ ...row, enabled: e.target.checked })} className="h-3.5 w-3.5 shrink-0 accent-tv-blue" />
      <input value={row.name} onChange={(e) => onChange({ ...row, name: e.target.value })} placeholder="Nombre" className="w-20 rounded border border-tv-border bg-tv-bg px-1.5 py-0.5 text-xs text-tv-text" maxLength={14} />
      <input type="time" value={toTime(row.timeH, row.timeM)} onChange={(e) => { const { h, m } = fromTime(e.target.value); onChange({ ...row, timeH: h, timeM: m }); }} className="w-[72px] rounded border border-tv-border bg-tv-bg px-1 py-0.5 text-xs text-tv-text" />
      <input type="color" value={row.color} onChange={(e) => onChange({ ...row, color: e.target.value })} className="h-6 w-6 cursor-pointer rounded border border-tv-border bg-transparent p-0" />
    </div>
  );
}

function TimestampRowComp({
  row,
  onChange,
}: {
  row: TimestampRow;
  onChange: (r: TimestampRow) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <input type="checkbox" checked={row.enabled} onChange={(e) => onChange({ ...row, enabled: e.target.checked })} className="h-3.5 w-3.5 shrink-0 accent-tv-blue" />
      <input type="time" value={toTime(row.timeH, row.timeM)} onChange={(e) => { const { h, m } = fromTime(e.target.value); onChange({ ...row, timeH: h, timeM: m }); }} className="w-[72px] rounded border border-tv-border bg-tv-bg px-1 py-0.5 text-xs text-tv-text" />
      <input type="color" value={row.color} onChange={(e) => onChange({ ...row, color: e.target.value })} className="h-6 w-6 cursor-pointer rounded border border-tv-border bg-transparent p-0" />
    </div>
  );
}

function LabelsRow({
  idx,
  high,
  low,
  onHigh,
  onLow,
}: {
  idx: number;
  high: string;
  low: string;
  onHigh: (v: string) => void;
  onLow: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <span className="w-24 shrink-0 text-xs text-tv-text-muted">KZ {idx + 1} Labels</span>
      <input
        value={high}
        onChange={(e) => onHigh(e.target.value)}
        placeholder="High label"
        className="flex-1 rounded border border-tv-border bg-tv-bg px-1.5 py-0.5 text-xs text-tv-text"
        maxLength={16}
      />
      <input
        value={low}
        onChange={(e) => onLow(e.target.value)}
        placeholder="Low label"
        className="flex-1 rounded border border-tv-border bg-tv-bg px-1.5 py-0.5 text-xs text-tv-text"
        maxLength={16}
      />
    </div>
  );
}

// ── Main dialog ───────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onClose: () => void;
}

export function IctSettingsDialog({ open, onClose }: Props) {
  const ictConfig = useChartStore((s) => s.ictConfig);
  const setIctConfig = useChartStore((s) => s.setIctConfig);
  const [d, setD] = useState<IctConfig>(ictConfig);

  function handleOpen(v: boolean) {
    if (v) setD(ictConfig);
    else onClose();
  }

  function updateSession(i: number, s: IctSessionConfig) {
    setD((prev) => {
      const sessions = [...prev.sessions];
      sessions[i] = s;
      return { ...prev, sessions };
    });
  }

  function updateOpeningRow(i: number, r: OpeningPriceRow) {
    setD((prev) => {
      const openingPrices = [...prev.openingPrices];
      openingPrices[i] = r;
      return { ...prev, openingPrices };
    });
  }

  function updateTimestampRow(i: number, r: TimestampRow) {
    setD((prev) => {
      const timestamps = [...prev.timestamps];
      timestamps[i] = r;
      return { ...prev, timestamps };
    });
  }

  function updateLabel(i: number, field: "highLabel" | "lowLabel", val: string) {
    setD((prev) => {
      const sessionLabels = [...prev.sessionLabels];
      sessionLabels[i] = { ...sessionLabels[i], [field]: val };
      return { ...prev, sessionLabels };
    });
  }

  function apply() {
    setIctConfig(d);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-md bg-tv-panel">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium">ICT Killzones — Configuración</DialogTitle>
        </DialogHeader>

        <div className="max-h-[75vh] overflow-y-auto pr-1">

          {/* ── CONFIGURACIÓN ─────────────────────────────── */}
          <SectionLabel>Configuración</SectionLabel>

          <Row label="Session Drawing Limit">
            <input
              type="number"
              min={1}
              max={20}
              value={d.sessionDrawingLimit}
              onChange={(e) => setD((p) => ({ ...p, sessionDrawingLimit: Math.max(1, Number(e.target.value)) }))}
              className="w-16 rounded border border-tv-border bg-tv-bg px-2 py-0.5 text-xs text-tv-text"
            />
          </Row>

          <Row label="Label Size">
            <select
              value={d.labelSize}
              onChange={(e) => setD((p) => ({ ...p, labelSize: e.target.value as "small" | "medium" | "large" }))}
              className="rounded border border-tv-border bg-tv-bg px-2 py-0.5 text-xs text-tv-text"
            >
              <option value="small">Pequeño</option>
              <option value="medium">Mediano</option>
              <option value="large">Grande</option>
            </select>
          </Row>

          <Row label="Text Color">
            <input
              type="color"
              value={d.textColor}
              onChange={(e) => setD((p) => ({ ...p, textColor: e.target.value }))}
              className="h-6 w-8 cursor-pointer rounded border border-tv-border bg-transparent p-0"
            />
          </Row>

          <Row>
            <Check
              checked={d.cutoffEnabled}
              onChange={(v) => setD((p) => ({ ...p, cutoffEnabled: v }))}
              label="Drawing Cutoff Time"
            />
            <input
              type="time"
              value={toTime(d.cutoffH, d.cutoffM)}
              disabled={!d.cutoffEnabled}
              onChange={(e) => {
                const { h, m } = fromTime(e.target.value);
                setD((p) => ({ ...p, cutoffH: h, cutoffM: m }));
              }}
              className="w-[72px] rounded border border-tv-border bg-tv-bg px-1 py-0.5 text-xs text-tv-text disabled:opacity-40"
            />
          </Row>

          {/* ── KILLZONE RANGE ─────────────────────────────── */}
          <SectionLabel>Killzone Range</SectionLabel>

          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Check checked={d.showBoxes} onChange={(v) => setD((p) => ({ ...p, showBoxes: v }))} label="Show Killzone Boxes" />
            <Check checked={d.showBoxLabels} onChange={(v) => setD((p) => ({ ...p, showBoxLabels: v }))} label="Display Text" />
            <Check checked={d.showAverage} onChange={(v) => setD((p) => ({ ...p, showAverage: v }))} label="Show Average" />
          </div>

          <div className="mt-2 divide-y divide-tv-border/40">
            {d.sessions.map((sess, i) => (
              <SessionRow key={i} sess={sess} onChange={(s) => updateSession(i, s)} />
            ))}
          </div>

          <Row label="Transparencia">
            <input
              type="range"
              min={50}
              max={99}
              value={d.transparency}
              onChange={(e) => setD((p) => ({ ...p, transparency: Number(e.target.value) }))}
              className="flex-1 accent-tv-blue"
            />
            <span className="w-8 text-right text-xs tabular-nums text-tv-text">{d.transparency}</span>
          </Row>

          {/* ── KILLZONE PIVOTS ────────────────────────────── */}
          <SectionLabel>Killzone Pivots</SectionLabel>

          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Check checked={d.showPivots} onChange={(v) => setD((p) => ({ ...p, showPivots: v }))} label="Mostrar pivotes" />
            <Check checked={d.stopOnceMitigated} onChange={(v) => setD((p) => ({ ...p, stopOnceMitigated: v }))} label="Stop Once Mitigated" />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
            <Check checked={d.showPivotMidpoints} onChange={(v) => setD((p) => ({ ...p, showPivotMidpoints: v }))} label="Show Pivot Midpoints" />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
            <Check checked={d.showPivotLabels} onChange={(v) => setD((p) => ({ ...p, showPivotLabels: v }))} label="Show Pivot Labels" />
            <Check checked={d.pivotDisplayPrice} onChange={(v) => setD((p) => ({ ...p, pivotDisplayPrice: v }))} label="Display Price" />
            <Check checked={d.pivotRightSide} onChange={(v) => setD((p) => ({ ...p, pivotRightSide: v }))} label="Right Side" />
          </div>

          <Row label="Extend Pivots…">
            <select
              value={d.pivotExtend}
              onChange={(e) => setD((p) => ({ ...p, pivotExtend: e.target.value as "mitigated" | "always" | "none" }))}
              className="rounded border border-tv-border bg-tv-bg px-2 py-0.5 text-xs text-tv-text"
            >
              <option value="mitigated">Until Mitigated</option>
              <option value="always">Always</option>
              <option value="none">Don&apos;t Extend</option>
            </select>
          </Row>

          <div className="mt-2 divide-y divide-tv-border/40">
            {d.sessions.map((_, i) => (
              <LabelsRow
                key={i}
                idx={i}
                high={d.sessionLabels[i]?.highLabel ?? ""}
                low={d.sessionLabels[i]?.lowLabel ?? ""}
                onHigh={(v) => updateLabel(i, "highLabel", v)}
                onLow={(v) => updateLabel(i, "lowLabel", v)}
              />
            ))}
          </div>

          {/* ── OPENING PRICES ────────────────────────────── */}
          <SectionLabel>Opening Prices</SectionLabel>
          <div className="divide-y divide-tv-border/40">
            {d.openingPrices.map((row, i) => (
              <OpeningRow key={i} row={row} onChange={(r) => updateOpeningRow(i, r)} />
            ))}
          </div>

          {/* ── TIMESTAMPS ───────────────────────────────── */}
          <SectionLabel>Timestamps</SectionLabel>
          <div className="divide-y divide-tv-border/40">
            {d.timestamps.map((row, i) => (
              <TimestampRowComp key={i} row={row} onChange={(r) => updateTimestampRow(i, r)} />
            ))}
          </div>

          {/* ── DAY / WEEK / MONTH ───────────────────────── */}
          <SectionLabel>Day · Week · Month</SectionLabel>
          <div className="flex flex-col gap-1">
            {(
              [
                { label: "D Open", openKey: "showDOpen", hlKey: "showDHL", colorKey: "dColor" },
                { label: "W Open", openKey: "showWOpen", hlKey: "showWHL", colorKey: "wColor" },
                { label: "M Open", openKey: "showMOpen", hlKey: "showMHL", colorKey: "mColor" },
              ] as const
            ).map(({ label, openKey, hlKey, colorKey }) => (
              <div key={label} className="flex items-center gap-3 py-0.5">
                <Check
                  checked={d.dwm[openKey]}
                  onChange={(v) => setD((p) => ({ ...p, dwm: { ...p.dwm, [openKey]: v } }))}
                  label={label}
                />
                <Check
                  checked={d.dwm[hlKey]}
                  onChange={(v) => setD((p) => ({ ...p, dwm: { ...p.dwm, [hlKey]: v } }))}
                  label="High/Low"
                />
                <input
                  type="color"
                  value={d.dwm[colorKey]}
                  onChange={(e) => setD((p) => ({ ...p, dwm: { ...p.dwm, [colorKey]: e.target.value } }))}
                  className="ml-auto h-6 w-6 cursor-pointer rounded border border-tv-border bg-transparent p-0"
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <Check
              checked={d.dwm.showDayLabels}
              onChange={(v) => setD((p) => ({ ...p, dwm: { ...p.dwm, showDayLabels: v } }))}
              label="Day of Week Labels"
            />
            <Check
              checked={d.dwm.hideWeekendLabels}
              onChange={(v) => setD((p) => ({ ...p, dwm: { ...p.dwm, hideWeekendLabels: v } }))}
              label="Hide Weekend Labels"
            />
          </div>

        </div>

        {/* ── Footer ───────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setD(DEFAULT_ICT_CONFIG)}
            className="text-xs text-tv-text-muted hover:text-tv-text"
          >
            Restablecer
          </button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} className="h-7 px-3 text-xs">
              Cancelar
            </Button>
            <Button onClick={apply} className="h-7 bg-tv-blue px-3 text-xs text-white hover:bg-tv-blue/80">
              Aplicar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
