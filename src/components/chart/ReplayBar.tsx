"use client";

import { Play, Pause, SkipForward, Square, FastForward } from "lucide-react";
import { useChartStore } from "@/lib/store/chart-store";
import { cn } from "@/lib/utils";

const SPEEDS = [1, 2, 5, 10];

export function ReplayBar() {
  const active   = useChartStore((s) => s.replayActive);
  const playing  = useChartStore((s) => s.replayPlaying);
  const speed    = useChartStore((s) => s.replaySpeed);
  const index    = useChartStore((s) => s.replayIndex);
  const setReplay = useChartStore((s) => s.setReplay);

  if (!active) return null;

  return (
    <div className="absolute top-2 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-md border border-tv-border bg-tv-panel/95 px-2 py-1.5 backdrop-blur shadow-lg">
      <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-tv-yellow">REPLAY</span>
      <span className="px-1 text-[10px] text-tv-text-muted">bar #{index}</span>
      <div className="mx-1 h-4 w-px bg-tv-border" />
      <button
        onClick={() => setReplay({ playing: !playing })}
        title={playing ? "Pausa" : "Play"}
        className="rounded p-1 text-tv-text hover:bg-tv-panel-hover"
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={() => setReplay({ index: index + 1 })}
        title="Avanzar 1 bar"
        className="rounded p-1 text-tv-text hover:bg-tv-panel-hover"
      >
        <SkipForward className="h-3.5 w-3.5" />
      </button>
      <div className="mx-1 h-4 w-px bg-tv-border" />
      <FastForward className="h-3 w-3 text-tv-text-muted" />
      {SPEEDS.map((sp) => (
        <button
          key={sp}
          onClick={() => setReplay({ speed: sp })}
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px]",
            sp === speed ? "bg-tv-blue/20 text-tv-blue" : "text-tv-text-muted hover:text-tv-text",
          )}
        >
          {sp}x
        </button>
      ))}
      <div className="mx-1 h-4 w-px bg-tv-border" />
      <button
        onClick={() => setReplay({ active: false, playing: false, index: 0 })}
        title="Detener replay"
        className="rounded p-1 text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-red"
      >
        <Square className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
