import type { Candle } from "@/lib/yahoo/types";
import type { IctConfig } from "@/lib/store/chart-store";

export interface KZBox {
  session: string;
  sessionIndex: number;
  color: string;
  borderColor: string;
  startTime: number;
  endTime: number;
  high: number;
  low: number;
  mid: number;
  highLabel: string;
  lowLabel: string;
  highMitigated: boolean;
  lowMitigated: boolean;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
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

export function calculateKillzones(candles: Candle[], config: IctConfig): KZBox[] {
  const fillAlpha = (100 - config.transparency) / 100;
  const borderAlpha = Math.min(1, fillAlpha * 5);

  const activeSessions = config.sessions
    .map((s, i) => ({ ...s, originalIndex: i }))
    .filter((s) => s.enabled);

  // Group candles by (sessionName, ETdate)
  interface Group {
    candles: Candle[];
    sessionIndex: number;
    color: string;
    name: string;
  }
  const map = new Map<string, Group>();

  for (const candle of candles) {
    const etMin = getETMinutes(candle.time);
    const etDate = getETDateKey(candle.time);

    for (const sess of activeSessions) {
      if (inSession(etMin, sess.startH, sess.startM, sess.endH, sess.endM)) {
        let effectiveDate = etDate;
        const start = sess.startH * 60 + sess.startM;
        const end = sess.endH * 60 + sess.endM;
        if (start > end && etMin < end) {
          effectiveDate = getETDateKey(candle.time - 86400);
        }
        const key = `${sess.name}__${effectiveDate}`;
        if (!map.has(key)) {
          map.set(key, {
            candles: [],
            sessionIndex: sess.originalIndex,
            color: sess.color,
            name: sess.name,
          });
        }
        map.get(key)!.candles.push(candle);
        break;
      }
    }
  }

  // Build boxes (all, then apply drawing limit)
  const allBoxes: (KZBox & { _key: string })[] = [];

  for (const [key, { candles: cs, sessionIndex, color, name }] of map) {
    if (cs.length === 0) continue;
    const high = Math.max(...cs.map((c) => c.high));
    const low = Math.min(...cs.map((c) => c.low));
    const sessLabel = config.sessionLabels[sessionIndex] ?? { highLabel: "", lowLabel: "" };

    allBoxes.push({
      _key: key,
      session: name,
      sessionIndex,
      color: hexToRgba(color, fillAlpha),
      borderColor: hexToRgba(color, borderAlpha),
      startTime: cs[0].time,
      endTime: cs[cs.length - 1].time,
      high,
      low,
      mid: (high + low) / 2,
      highLabel: sessLabel.highLabel,
      lowLabel: sessLabel.lowLabel,
      highMitigated: false,
      lowMitigated: false,
    });
  }

  // Sort by startTime ascending
  allBoxes.sort((a, b) => a.startTime - b.startTime);

  // Apply session drawing limit: keep last N per session name
  const limit = Math.max(1, config.sessionDrawingLimit);
  const countBySession = new Map<string, number>();
  const limitedBoxes: typeof allBoxes = [];
  for (let i = allBoxes.length - 1; i >= 0; i--) {
    const b = allBoxes[i];
    const n = (countBySession.get(b.session) ?? 0) + 1;
    if (n <= limit) {
      countBySession.set(b.session, n);
      limitedBoxes.unshift(b);
    }
  }

  // Detect mitigated pivots: for each box, check candles strictly after endTime
  for (const box of limitedBoxes) {
    const after = candles.filter((c) => c.time > box.endTime);
    box.highMitigated = after.some((c) => c.high >= box.high);
    box.lowMitigated = after.some((c) => c.low <= box.low);
  }

  return limitedBoxes;
}
