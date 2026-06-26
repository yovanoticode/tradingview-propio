import type { Candle } from "@/lib/yahoo/types";
import type { IctMacroConfig } from "@/lib/store/chart-store";

export interface MacroBox {
  name: string;
  startTime: number;
  endTime: number;
  high: number;
  low: number;
  mid: number;
  color: string;
}

function getETMinutes(utcSeconds: number): number {
  const s = new Date(utcSeconds * 1000).toLocaleString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

function getETDateKey(utcSeconds: number): string {
  return new Date(utcSeconds * 1000).toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
}

function inSession(etMin: number, startH: number, startM: number, endH: number, endM: number): boolean {
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;
  if (end === 0) return etMin >= start;
  if (start > end) return etMin >= start || etMin < end;
  return etMin >= start && etMin < end;
}

export function calculateMacros(candles: Candle[], configs: IctMacroConfig[]): MacroBox[] {
  const activeConfigs = configs.filter((c) => c.enabled);
  if (activeConfigs.length === 0) return [];

  interface Group {
    candles: Candle[];
    config: IctMacroConfig;
  }
  const map = new Map<string, Group>();

  for (const candle of candles) {
    const etMin = getETMinutes(candle.time);
    const etDate = getETDateKey(candle.time);

    for (const cfg of activeConfigs) {
      if (inSession(etMin, cfg.startH, cfg.startM, cfg.endH, cfg.endM)) {
        const key = `${cfg.name}__${etDate}`;
        if (!map.has(key)) {
          map.set(key, { candles: [], config: cfg });
        }
        map.get(key)!.candles.push(candle);
        break;
      }
    }
  }

  const boxes: MacroBox[] = [];
  for (const [key, { candles: cs, config }] of map) {
    if (cs.length === 0) continue;
    const high = Math.max(...cs.map((c) => c.high));
    const low = Math.min(...cs.map((c) => c.low));
    
    boxes.push({
      name: config.name,
      startTime: cs[0].time,
      endTime: cs[cs.length - 1].time,
      high,
      low,
      mid: (high + low) / 2,
      color: config.color,
    });
  }

  boxes.sort((a, b) => a.startTime - b.startTime);
  return boxes;
}
