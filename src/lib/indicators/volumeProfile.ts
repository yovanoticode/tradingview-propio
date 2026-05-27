import type { Candle } from "@/lib/yahoo/types";

export interface VPBin {
  priceLow:  number;
  priceHigh: number;
  volume:    number;
}

export interface VolumeProfile {
  bins: VPBin[];
  poc:  number;  // Point of Control — price level with max volume
  vah:  number;  // Value Area High — top of 70% volume zone
  val:  number;  // Value Area Low
  totalVolume: number;
}

/**
 * Compute volume profile from candles (typically last N bars or session).
 * Distributes each candle's volume across its price range (H-L) into bins.
 */
export function calculateVolumeProfile(
  candles: Candle[],
  numBins = 40,
  valueAreaPct = 0.70,
): VolumeProfile | null {
  if (candles.length === 0) return null;

  let priceMin = Infinity;
  let priceMax = -Infinity;
  for (const c of candles) {
    if (c.low  < priceMin) priceMin = c.low;
    if (c.high > priceMax) priceMax = c.high;
  }
  if (!isFinite(priceMin) || !isFinite(priceMax) || priceMin >= priceMax) return null;

  const range  = priceMax - priceMin;
  const binSize = range / numBins;
  const bins: VPBin[] = Array.from({ length: numBins }, (_, i) => ({
    priceLow:  priceMin + i * binSize,
    priceHigh: priceMin + (i + 1) * binSize,
    volume: 0,
  }));

  let totalVolume = 0;
  for (const c of candles) {
    const cRange = c.high - c.low;
    const vol = c.volume;
    if (cRange <= 0) {
      // Single price → assign all volume to the bin containing close
      const idx = Math.min(numBins - 1, Math.max(0, Math.floor((c.close - priceMin) / binSize)));
      bins[idx].volume += vol;
      totalVolume += vol;
      continue;
    }
    // Distribute volume proportionally across overlapping bins
    const startBin = Math.min(numBins - 1, Math.max(0, Math.floor((c.low  - priceMin) / binSize)));
    const endBin   = Math.min(numBins - 1, Math.max(0, Math.floor((c.high - priceMin) / binSize)));
    const numCells = endBin - startBin + 1;
    const volPerCell = vol / numCells;
    for (let i = startBin; i <= endBin; i++) bins[i].volume += volPerCell;
    totalVolume += vol;
  }

  // POC = bin with max volume
  let pocIdx = 0;
  for (let i = 1; i < bins.length; i++) if (bins[i].volume > bins[pocIdx].volume) pocIdx = i;
  const poc = (bins[pocIdx].priceLow + bins[pocIdx].priceHigh) / 2;

  // Value Area = 70% of total volume centered on POC, expanding outward
  const targetVol = totalVolume * valueAreaPct;
  let acc = bins[pocIdx].volume;
  let lo = pocIdx, hi = pocIdx;
  while (acc < targetVol && (lo > 0 || hi < bins.length - 1)) {
    const above = hi < bins.length - 1 ? bins[hi + 1].volume : -1;
    const below = lo > 0 ? bins[lo - 1].volume : -1;
    if (above >= below) { hi++; acc += above; }
    else                { lo--; acc += below; }
  }
  const vah = bins[hi].priceHigh;
  const val = bins[lo].priceLow;

  return { bins, poc, vah, val, totalVolume };
}
