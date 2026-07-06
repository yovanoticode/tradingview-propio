import type { Candle } from "@/lib/yahoo/types";
import type { IctConfig } from "@/lib/store/chart-store";

export interface HorizLevel {
  startTime: number;
  endTime: number;   // line drawn until here; extend=true overrides
  price: number;
  label: string;
  color: string;
  extend: boolean;   // extend past endTime to right edge of chart
  dash: boolean;
}

export interface VertLine {
  time: number;
  color: string;
  label?: string;    // day-of-week label
}

export interface LevelsData {
  openingPrices: HorizLevel[];
  dwm: HorizLevel[];
  timestamps: VertLine[];
}

// ── Timezone helpers ──────────────────────────────────────────────────────
function getETMinutes(utcSeconds: number): number {
  const s = new Date(utcSeconds * 1000).toLocaleString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

function getETDateKey(utcSeconds: number, cmeShift = false): string {
  const d = new Date(utcSeconds * 1000);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hour12: false
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? "0");
  const hRaw = get("hour");
  const h = hRaw === 24 ? 0 : hRaw;

  const localD = new Date(get("year"), get("month") - 1, get("day"));
  if (cmeShift && h >= 18) {
    localD.setDate(localD.getDate() + 1);
  }

  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${localD.getFullYear()}-${pad(localD.getMonth() + 1)}-${pad(localD.getDate())}`;
}

function getETWeekKey(utcSeconds: number, cmeShift = false): string {
  const dateKey = getETDateKey(utcSeconds, cmeShift);
  const [y, m, day] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, day);
  const dow = date.getDay();
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - dow);
  return sunday.toISOString().slice(0, 10);
}

function getETMonthKey(utcSeconds: number, cmeShift = false): string {
  const dateKey = getETDateKey(utcSeconds, cmeShift);
  return dateKey.slice(0, 7);
}

function getETDOW(utcSeconds: number): number {
  const s = new Date(utcSeconds * 1000).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  });
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(s);
}

// ── Opening Prices ────────────────────────────────────────────────────────
export function calculateOpeningPrices(
  candles: Candle[],
  config: IctConfig,
): HorizLevel[] {
  const levels: HorizLevel[] = [];

  for (const row of config.openingPrices) {
    if (!row.enabled) continue;
    const target = row.timeH * 60 + row.timeM;

    // Group by ET date; find candle closest to target time (>=)
    const byDate = new Map<string, Candle[]>();
    for (const c of candles) {
      const k = getETDateKey(c.time, config.dwm.cmeShift);
      byDate.set(k, [...(byDate.get(k) ?? []), c]);
    }

    const dates = [...byDate.keys()].sort();
    for (let i = 0; i < dates.length; i++) {
      if (config.openingPricesOnlyToday && i < dates.length - 1) continue;

      const dayCandles = byDate.get(dates[i])!;
      const match = dayCandles
        .filter((c) => getETMinutes(c.time) >= target)
        .sort((a, b) => getETMinutes(a.time) - getETMinutes(b.time))[0];
      if (!match) continue;

      const nextDate = dates[i + 1];
      const nextMatch = nextDate
        ? byDate
            .get(nextDate)!
            .filter((c) => getETMinutes(c.time) >= target)
            .sort((a, b) => getETMinutes(a.time) - getETMinutes(b.time))[0]
        : null;

      const isLast = !nextMatch;
      levels.push({
        startTime: match.time,
        endTime: nextMatch ? nextMatch.time : candles[candles.length - 1].time,
        price: match.open,
        label: row.name,
        color: row.color,
        extend: isLast,
        dash: false,
      });
    }
  }

  return levels;
}

// ── D / W / M levels ──────────────────────────────────────────────────────
export function calculateDWM(candles: Candle[], config: IctConfig): HorizLevel[] {
  const { dwm } = config;
  const levels: HorizLevel[] = [];
  if (!dwm.showDOpen && !dwm.showDHL && !dwm.showPDHL && !dwm.showWOpen && !dwm.showWHL && !dwm.showPWHL && !dwm.showMOpen && !dwm.showMHL && !dwm.showPMHL) {
    return levels;
  }

  interface PeriodGroup {
    candles: Candle[];
    key: string;
    nextKey?: string;
  }

  function buildGroups(keyFn: (t: number, cmeShift: boolean) => string): PeriodGroup[] {
    const map = new Map<string, Candle[]>();
    for (const c of candles) {
      const k = keyFn(c.time, dwm.cmeShift);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(c);
    }
    const keys = [...map.keys()].sort();
    return keys.map((k, i) => ({
      key: k,
      candles: map.get(k)!,
      nextKey: keys[i + 1],
    }));
  }

  function pushLevels(
    groups: PeriodGroup[],
    showOpen: boolean,
    showCurrHL: boolean,
    showPrevHL: boolean,
    color: string,
    prefix: string,
  ) {
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      if (g.candles.length === 0) continue;
      const sorted = [...g.candles].sort((a, b) => a.time - b.time);
      const open = sorted[0].open;
      const high = Math.max(...sorted.map((c) => c.high));
      const low = Math.min(...sorted.map((c) => c.low));
      const startTime = sorted[0].time;
      const endTime = sorted[sorted.length - 1].time;
      const isLast = !g.nextKey;

      if (showOpen) {
        levels.push({ startTime, endTime, price: open, label: `${prefix}O`, color, extend: isLast, dash: false });
      }
      
      if (showCurrHL) {
        levels.push({ startTime, endTime, price: high, label: `${prefix}H`, color, extend: isLast, dash: true });
        levels.push({ startTime, endTime, price: low,  label: `${prefix}L`, color, extend: isLast, dash: true });
      }

      if (showPrevHL && i > 0) {
        let prevGroup: PeriodGroup | undefined;
        
        for (let j = i - 1; j >= 0; j--) {
          const cand = groups[j];
          if (prefix === "D") {
            // Check day of week using the key (YYYY-MM-DD)
            const d = new Date(cand.key + "T12:00:00Z");
            const dow = d.getDay();
            if (dow === 0 || dow === 6) {
              continue; // Always skip weekends for Previous Daily levels
            }
          }
          prevGroup = cand;
          break;
        }

        if (prevGroup && prevGroup.candles.length > 0) {
          const prevHigh = Math.max(...prevGroup.candles.map((c) => c.high));
          const prevLow = Math.min(...prevGroup.candles.map((c) => c.low));
          
          levels.push({ startTime, endTime, price: prevHigh, label: `P${prefix}H`, color, extend: isLast, dash: true });
          levels.push({ startTime, endTime, price: prevLow,  label: `P${prefix}L`, color, extend: isLast, dash: true });
        }
      }
    }
  }

  if (dwm.showDOpen || dwm.showDHL || dwm.showPDHL) {
    pushLevels(buildGroups(getETDateKey), dwm.showDOpen, dwm.showDHL, dwm.showPDHL, dwm.dColor, "D");
  }
  if (dwm.showWOpen || dwm.showWHL || dwm.showPWHL) {
    pushLevels(buildGroups(getETWeekKey), dwm.showWOpen, dwm.showWHL, dwm.showPWHL, dwm.wColor, "W");
  }
  if (dwm.showMOpen || dwm.showMHL || dwm.showPMHL) {
    pushLevels(buildGroups(getETMonthKey), dwm.showMOpen, dwm.showMHL, dwm.showPMHL, dwm.mColor, "M");
  }

  return levels;
}

// ── Timestamps ────────────────────────────────────────────────────────────
const DOW_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function calculateTimestamps(candles: Candle[], config: IctConfig): VertLine[] {
  const lines: VertLine[] = [];
  const seen = new Set<number>();

  for (const row of config.timestamps) {
    if (!row.enabled) continue;
    const target = row.timeH * 60 + row.timeM;

    for (const c of candles) {
      if (getETMinutes(c.time) === target && !seen.has(c.time)) {
        seen.add(c.time);
        const dow = getETDOW(c.time);
        const isWeekend = dow === 0 || dow === 6;
        const showLabel =
          config.dwm.showDayLabels &&
          row.timeH === 0 &&
          row.timeM === 0 &&
          !(config.dwm.hideWeekendLabels && isWeekend);

        lines.push({
          time: c.time,
          color: row.color,
          label: showLabel ? DOW_NAMES[dow] : undefined,
        });
      }
    }
  }

  return lines;
}
