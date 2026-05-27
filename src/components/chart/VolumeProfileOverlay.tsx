"use client";

import { useEffect, useState } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import type { VolumeProfile } from "@/lib/indicators/volumeProfile";

interface Props {
  chart:    IChartApi;
  series:   ISeriesApi<"Candlestick">;
  profile:  VolumeProfile;
  paneHeight: number;
}

export function VolumeProfileOverlay({ chart, series, profile, paneHeight }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = chart.timeScale();
    const handler = () => setTick((n) => n + 1);
    t.subscribeVisibleLogicalRangeChange(handler);
    return () => t.unsubscribeVisibleLogicalRangeChange(handler);
  }, [chart]);
  void tick; // re-render trigger

  if (!profile || profile.bins.length === 0) return null;

  const maxVol = Math.max(...profile.bins.map((b) => b.volume));
  if (maxVol === 0) return null;

  const PROFILE_WIDTH_PX = 120; // width of histogram from right edge

  // Compute pixel coords for each bin
  const rects = profile.bins
    .map((b) => {
      const yLow  = series.priceToCoordinate(b.priceLow);
      const yHigh = series.priceToCoordinate(b.priceHigh);
      if (yLow === null || yHigh === null) return null;
      const top    = Math.min(yLow, yHigh);
      const height = Math.max(1, Math.abs(yLow - yHigh));
      const width  = (b.volume / maxVol) * PROFILE_WIDTH_PX;
      return { top, height, width, volume: b.volume };
    })
    .filter((r): r is { top: number; height: number; width: number; volume: number } => r !== null);

  const pocY = series.priceToCoordinate(profile.poc);
  const vahY = series.priceToCoordinate(profile.vah);
  const valY = series.priceToCoordinate(profile.val);

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      style={{ width: "100%", height: paneHeight }}
    >
      {rects.map((r, i) => (
        <rect
          key={i}
          x={0}
          y={r.top}
          width={r.width}
          height={r.height - 0.5}
          fill="#60a5fa"
          fillOpacity={0.25}
          stroke="#60a5fa"
          strokeOpacity={0.45}
          strokeWidth={0.5}
        />
      ))}
      {pocY !== null && (
        <>
          <line x1={0} y1={pocY} x2={PROFILE_WIDTH_PX} y2={pocY} stroke="#fbbf24" strokeWidth={1.5} />
          <text x={PROFILE_WIDTH_PX + 4} y={pocY + 3} fill="#fbbf24" fontSize={10} fontWeight={600}>POC {profile.poc.toFixed(2)}</text>
        </>
      )}
      {vahY !== null && (
        <line x1={0} y1={vahY} x2={PROFILE_WIDTH_PX} y2={vahY} stroke="#a78bfa" strokeWidth={1} strokeDasharray="3,3" />
      )}
      {valY !== null && (
        <line x1={0} y1={valY} x2={PROFILE_WIDTH_PX} y2={valY} stroke="#a78bfa" strokeWidth={1} strokeDasharray="3,3" />
      )}
    </svg>
  );
}
