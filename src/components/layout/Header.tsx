"use client";

import { useState, useRef, useEffect } from "react";
import { Code2, Zap, History } from "lucide-react";
import { useChartStore, type LayoutMode } from "@/lib/store/chart-store";
import { SymbolSelector } from "@/components/chart/SymbolSelector";
import { TimeframeSelector } from "@/components/chart/TimeframeSelector";
import { DataSourceSelector } from "@/components/chart/DataSourceSelector";
import { IndicatorMenu } from "@/components/chart/IndicatorMenu";
import { TimezoneSelector } from "@/components/chart/TimezoneSelector";
import { NT8Connect } from "@/components/nt8/NT8Connect";
import { TradovateConnect } from "@/components/tradovate/TradovateConnect";
import { Separator } from "@/components/ui/separator";

function renderLayoutIcon(mode: LayoutMode, sizeClass = "w-4 h-4") {
  const base = `border border-current rounded flex overflow-hidden ${sizeClass}`;
  switch (mode) {
    case "single":
      return (
        <div className={base}>
          <div className="flex-1" />
        </div>
      );
    case "split-v":
      return (
        <div className={base}>
          <div className="w-1/2 border-r border-current h-full" />
          <div className="w-1/2 h-full" />
        </div>
      );
    case "split-h":
      return (
        <div className={`${base} flex-col`}>
          <div className="h-1/2 border-b border-current w-full" />
          <div className="h-1/2 w-full" />
        </div>
      );
    case "three-v":
      return (
        <div className={base}>
          <div className="w-1/3 border-r border-current h-full" />
          <div className="w-1/3 border-r border-current h-full" />
          <div className="w-1/3 h-full" />
        </div>
      );
    case "three-h":
      return (
        <div className={`${base} flex-col`}>
          <div className="h-1/3 border-b border-current w-full" />
          <div className="h-1/3 border-b border-current w-full" />
          <div className="h-1/3 w-full" />
        </div>
      );
    case "three-l-2r":
      return (
        <div className={base}>
          <div className="w-1/2 border-r border-current h-full" />
          <div className="w-1/2 h-full flex flex-col">
            <div className="h-1/2 border-b border-current w-full" />
            <div className="h-1/2 w-full" />
          </div>
        </div>
      );
    case "three-r-2l":
      return (
        <div className={base}>
          <div className="w-1/2 h-full flex flex-col border-r border-current">
            <div className="h-1/2 border-b border-current w-full" />
            <div className="h-1/2 w-full" />
          </div>
          <div className="w-1/2 h-full" />
        </div>
      );
    case "three-t-2b":
      return (
        <div className={`${base} flex-col`}>
          <div className="h-1/2 border-b border-current w-full" />
          <div className="h-1/2 w-full flex">
            <div className="w-1/2 border-r border-current h-full" />
            <div className="w-1/2 h-full" />
          </div>
        </div>
      );
    case "three-b-2t":
      return (
        <div className={`${base} flex-col`}>
          <div className="h-1/2 border-b border-current w-full flex">
            <div className="w-1/2 border-r border-current h-full" />
            <div className="w-1/2 h-full" />
          </div>
          <div className="h-1/2 w-full" />
        </div>
      );
    case "grid2x2":
      return (
        <div className={`${base} flex-wrap`}>
          <div className="w-1/2 h-1/2 border-r border-b border-current" />
          <div className="w-1/2 h-1/2 border-b border-current" />
          <div className="w-1/2 h-1/2 border-r border-current" />
          <div className="w-1/2 h-1/2" />
        </div>
      );
    default:
      return null;
  }
}

export function Header() {
  const layoutMode    = useChartStore((s) => s.layoutMode);
  const setLayoutMode = useChartStore((s) => s.setLayoutMode);
  const replayActive  = useChartStore((s) => s.replayActive);
  const setReplay     = useChartStore((s) => s.setReplay);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  return (
    <header className="flex h-12 items-center justify-between border-b border-tv-border bg-tv-panel px-3">
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-2 pr-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-tv-blue/20">
            <Zap className="h-4 w-4 text-tv-blue" />
          </div>
          <span className="text-sm font-semibold text-tv-text">
            TradingView <span className="text-tv-text-muted">Gratis</span>
          </span>
        </div>
        <Separator orientation="vertical" className="h-6 bg-tv-border" />
        <SymbolSelector />
        <Separator orientation="vertical" className="h-6 bg-tv-border" />
        <TimeframeSelector />
        <Separator orientation="vertical" className="mx-1 h-6 bg-tv-border" />
        <DataSourceSelector />
        <Separator orientation="vertical" className="mx-1 h-6 bg-tv-border" />
        <IndicatorMenu />
        <Separator orientation="vertical" className="mx-1 h-6 bg-tv-border" />
        <TimezoneSelector />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setReplay({ active: !replayActive, playing: false, index: 0 })}
          title={replayActive ? "Salir de replay" : "Iniciar replay mode"}
          className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition-colors ${
            replayActive ? "text-tv-yellow bg-tv-yellow/10" : "text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
          }`}
        >
          <History className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Replay</span>
        </button>
        <Separator orientation="vertical" className="h-6 bg-tv-border" />
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            title="Seleccionar diseño de gráfico"
            className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text transition-colors"
          >
            {renderLayoutIcon(layoutMode, "w-4 h-4")}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 rounded-md border border-tv-border bg-tv-panel p-3 shadow-xl flex flex-col gap-2 min-w-[220px]">
              {/* Row 1 */}
              <div className="flex items-center gap-3">
                <span className="w-3 text-xs font-semibold text-tv-text-muted text-right">1</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => { setLayoutMode("single"); setMenuOpen(false); }}
                    className={`p-1 rounded hover:bg-tv-panel-hover hover:text-tv-text transition-colors border ${layoutMode === "single" ? "text-tv-blue bg-tv-blue/10 border-tv-blue" : "text-tv-text-muted border-transparent"}`}
                    title="Gráfico único"
                  >
                    {renderLayoutIcon("single", "w-5 h-5")}
                  </button>
                </div>
              </div>

              {/* Row 2 */}
              <div className="flex items-center gap-3 border-t border-tv-border/30 pt-2">
                <span className="w-3 text-xs font-semibold text-tv-text-muted text-right">2</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => { setLayoutMode("split-v"); setMenuOpen(false); }}
                    className={`p-1 rounded hover:bg-tv-panel-hover hover:text-tv-text transition-colors border ${layoutMode === "split-v" ? "text-tv-blue bg-tv-blue/10 border-tv-blue" : "text-tv-text-muted border-transparent"}`}
                    title="Dividir verticalmente"
                  >
                    {renderLayoutIcon("split-v", "w-5 h-5")}
                  </button>
                  <button
                    onClick={() => { setLayoutMode("split-h"); setMenuOpen(false); }}
                    className={`p-1 rounded hover:bg-tv-panel-hover hover:text-tv-text transition-colors border ${layoutMode === "split-h" ? "text-tv-blue bg-tv-blue/10 border-tv-blue" : "text-tv-text-muted border-transparent"}`}
                    title="Dividir horizontalmente"
                  >
                    {renderLayoutIcon("split-h", "w-5 h-5")}
                  </button>
                </div>
              </div>

              {/* Row 3 */}
              <div className="flex items-start gap-3 border-t border-tv-border/30 pt-2">
                <span className="w-3 text-xs font-semibold text-tv-text-muted text-right mt-1.5">3</span>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    onClick={() => { setLayoutMode("three-v"); setMenuOpen(false); }}
                    className={`p-1 rounded hover:bg-tv-panel-hover hover:text-tv-text transition-colors border ${layoutMode === "three-v" ? "text-tv-blue bg-tv-blue/10 border-tv-blue" : "text-tv-text-muted border-transparent"}`}
                    title="3 columnas verticales"
                  >
                    {renderLayoutIcon("three-v", "w-5 h-5")}
                  </button>
                  <button
                    onClick={() => { setLayoutMode("three-h"); setMenuOpen(false); }}
                    className={`p-1 rounded hover:bg-tv-panel-hover hover:text-tv-text transition-colors border ${layoutMode === "three-h" ? "text-tv-blue bg-tv-blue/10 border-tv-blue" : "text-tv-text-muted border-transparent"}`}
                    title="3 filas horizontales"
                  >
                    {renderLayoutIcon("three-h", "w-5 h-5")}
                  </button>
                  <button
                    onClick={() => { setLayoutMode("three-l-2r"); setMenuOpen(false); }}
                    className={`p-1 rounded hover:bg-tv-panel-hover hover:text-tv-text transition-colors border ${layoutMode === "three-l-2r" ? "text-tv-blue bg-tv-blue/10 border-tv-blue" : "text-tv-text-muted border-transparent"}`}
                    title="Izquierda completa, 2 derecha"
                  >
                    {renderLayoutIcon("three-l-2r", "w-5 h-5")}
                  </button>
                  <button
                    onClick={() => { setLayoutMode("three-r-2l"); setMenuOpen(false); }}
                    className={`p-1 rounded hover:bg-tv-panel-hover hover:text-tv-text transition-colors border ${layoutMode === "three-r-2l" ? "text-tv-blue bg-tv-blue/10 border-tv-blue" : "text-tv-text-muted border-transparent"}`}
                    title="Derecha completa, 2 izquierda"
                  >
                    {renderLayoutIcon("three-r-2l", "w-5 h-5")}
                  </button>
                  <button
                    onClick={() => { setLayoutMode("three-t-2b"); setMenuOpen(false); }}
                    className={`p-1 rounded hover:bg-tv-panel-hover hover:text-tv-text transition-colors border ${layoutMode === "three-t-2b" ? "text-tv-blue bg-tv-blue/10 border-tv-blue" : "text-tv-text-muted border-transparent"}`}
                    title="Arriba completa, 2 abajo"
                  >
                    {renderLayoutIcon("three-t-2b", "w-5 h-5")}
                  </button>
                  <button
                    onClick={() => { setLayoutMode("three-b-2t"); setMenuOpen(false); }}
                    className={`p-1 rounded hover:bg-tv-panel-hover hover:text-tv-text transition-colors border ${layoutMode === "three-b-2t" ? "text-tv-blue bg-tv-blue/10 border-tv-blue" : "text-tv-text-muted border-transparent"}`}
                    title="Abajo completa, 2 arriba"
                  >
                    {renderLayoutIcon("three-b-2t", "w-5 h-5")}
                  </button>
                </div>
              </div>

              {/* Row 4 */}
              <div className="flex items-center gap-3 border-t border-tv-border/30 pt-2">
                <span className="w-3 text-xs font-semibold text-tv-text-muted text-right">4</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => { setLayoutMode("grid2x2"); setMenuOpen(false); }}
                    className={`p-1 rounded hover:bg-tv-panel-hover hover:text-tv-text transition-colors border ${layoutMode === "grid2x2" ? "text-tv-blue bg-tv-blue/10 border-tv-blue" : "text-tv-text-muted border-transparent"}`}
                    title="Cuadrícula 2x2"
                  >
                    {renderLayoutIcon("grid2x2", "w-5 h-5")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        <Separator orientation="vertical" className="h-6 bg-tv-border" />
        <NT8Connect />
        <Separator orientation="vertical" className="h-6 bg-tv-border" />
        <TradovateConnect />
        <Separator orientation="vertical" className="h-6 bg-tv-border" />
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
        >
          <Code2 className="h-3.5 w-3.5" />
          <span>Source</span>
        </a>
      </div>
    </header>
  );
}
