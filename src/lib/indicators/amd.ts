import type { Candle } from "@/lib/yahoo/types";


export interface AMDPhase {
  type: "accumulation" | "manipulation" | "distribution";
  color: string;
  startTime: number;
  endTime: number;
  high: number;
  low: number;
}

export interface AMDDay {
  dateKey: string; // e.g., "2024-05-15"
  phases: AMDPhase[];
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

// A trading day starts at 18:00 EST of the previous calendar day.
function getTradingDayKey(utcSeconds: number): string {
  const d = new Date(utcSeconds * 1000);
  const tzDate = new Date(d.toLocaleString("en-US", { timeZone: "America/New_York" }));
  if (tzDate.getHours() >= 18) {
    // Add 1 day
    tzDate.setDate(tzDate.getDate() + 1);
  }
  return tzDate.toLocaleDateString("en-CA"); // YYYY-MM-DD
}

function getPhase(etMin: number): "accumulation" | "manipulation" | "distribution" | null {
  if (etMin >= 18 * 60 || etMin < 0 * 60) return "accumulation"; // 18:00 - 00:00
  if (etMin >= 0 * 60 && etMin < 8 * 60 + 30) return "manipulation"; // 00:00 - 08:30
  if (etMin >= 8 * 60 + 30 && etMin < 16 * 60) return "distribution"; // 08:30 - 16:00
  return null;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function calculateAMD(candles: Candle[], showAMD: boolean, alpha = 0.1): AMDDay[] {
  if (!showAMD || candles.length === 0) return [];

  const daysMap = new Map<string, { [key: string]: Candle[] }>();

  for (const candle of candles) {
    const etMin = getETMinutes(candle.time);
    const phase = getPhase(etMin);
    if (!phase) continue;

    const dayKey = getTradingDayKey(candle.time);
    if (!daysMap.has(dayKey)) {
      daysMap.set(dayKey, { accumulation: [], manipulation: [], distribution: [] });
    }
    daysMap.get(dayKey)![phase].push(candle);
  }

  const result: AMDDay[] = [];
  // TV_COLORS approximation since we can't import from PriceChart easily, wait we can just hardcode.
  const COLORS = {
    accumulation: hexToRgba("#2962ff", alpha), // Blue
    manipulation: hexToRgba("#ef5350", alpha), // Red
    distribution: hexToRgba("#26a69a", alpha), // Green
  };

  for (const [dateKey, phasesData] of daysMap.entries()) {
    const phases: AMDPhase[] = [];
    
    for (const type of ["accumulation", "manipulation", "distribution"] as const) {
      const cs = phasesData[type];
      if (cs.length === 0) continue;
      
      const high = Math.max(...cs.map(c => c.high));
      const low = Math.min(...cs.map(c => c.low));
      
      phases.push({
        type,
        color: COLORS[type],
        startTime: cs[0].time,
        endTime: cs[cs.length - 1].time,
        high,
        low,
      });
    }

    if (phases.length > 0) {
      result.push({ dateKey, phases });
    }
  }

  // Limit to last 5 days to avoid clutter
  return result.slice(-5);
}
