"use client";

import { useEffect, useMemo, useState } from "react";
import * as d3 from "d3-hierarchy";
import { NASDAQ_100, type HeatmapItem } from "@/lib/heatmap/data";
import { cn } from "@/lib/utils";

interface QuoteData {
  symbol: string;
  marketCap: number;
  regularMarketChangePercent: number;
  regularMarketPrice: number;
}

interface HierarchyNode {
  name: string;
  children?: HierarchyNode[];
  item?: HeatmapItem;
  quote?: QuoteData;
  value?: number;
}

export function Heatmap() {
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
  const [loading, setLoading] = useState(true);

  // Poll data
  useEffect(() => {
    let mounted = true;

    const fetchQuotes = async () => {
      try {
        const symbols = NASDAQ_100.map((i) => i.symbol).join(",");
        const res = await fetch(`/api/quote?symbols=${symbols}`);
        if (!res.ok) return;
        const data = await res.json();
        const results = data.quoteResponse?.result || [];
        
        const newQuotes: Record<string, QuoteData> = {};
        for (const r of results) {
          newQuotes[r.symbol] = {
            symbol: r.symbol,
            marketCap: r.marketCap || 0,
            regularMarketChangePercent: r.regularMarketChangePercent || 0,
            regularMarketPrice: r.regularMarketPrice || 0,
          };
        }
        if (mounted) {
          setQuotes(newQuotes);
          setLoading(false);
        }
      } catch (e) {
        console.error("Heatmap fetch error:", e);
      }
    };

    fetchQuotes();
    const id = setInterval(fetchQuotes, 5000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  // Build Hierarchy
  const root = useMemo(() => {
    const sectors = new Map<string, HierarchyNode[]>();
    
    // Group by sector
    for (const item of NASDAQ_100) {
      if (!sectors.has(item.sector)) sectors.set(item.sector, []);
      const q = quotes[item.symbol];
      sectors.get(item.sector)!.push({
        name: item.symbol,
        item,
        quote: q,
        value: item.weight,
      });
    }

    const sectorNodes: HierarchyNode[] = Array.from(sectors.entries()).map(([sector, children]) => ({
      name: sector,
      children,
    }));

    return {
      name: "Root",
      children: sectorNodes,
    } as HierarchyNode;
  }, [quotes]);

  // Compute Treemap layout
  const leaves = useMemo(() => {
    // We assume the container takes full width/height. We'll use percentages for CSS.
    // D3 Treemap works with fixed dimensions, so we use 1000x1000 and output %
    const W = 1000;
    const H = 1000;

    const hierarchy = d3
      .hierarchy(root)
      .sum((d) => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const treemap = d3
      .treemap<HierarchyNode>()
      .size([W, H])
      .paddingTop(20) // space for sector title
      .paddingInner(2)
      .paddingOuter(2);

    treemap(hierarchy);

    return hierarchy.leaves() as d3.HierarchyRectangularNode<HierarchyNode>[];
  }, [root]);

  // Get color based on pct change
  const getColor = (pct: number) => {
    if (pct >= 2) return "bg-tv-green"; // dark green
    if (pct > 0) return "bg-tv-green/70"; // medium green
    if (pct <= -2) return "bg-tv-red"; // dark red
    if (pct < 0) return "bg-tv-red/70"; // medium red
    return "bg-tv-panel"; // gray
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-tv-bg text-tv-text-muted">
        Cargando mapa de calor...
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-[#131722] overflow-hidden p-1 select-none">
      {/* Render Sector Labels first */}
      {(() => {
        const hierarchy = d3
          .hierarchy(root)
          .sum((d) => d.value || 0)
          .sort((a, b) => (b.value || 0) - (a.value || 0));
        
        d3.treemap<HierarchyNode>().size([100, 100]).paddingTop(2).paddingInner(0.2).paddingOuter(0.2)(hierarchy);
        
        return hierarchy.children?.map((child) => {
          const sector = child as d3.HierarchyRectangularNode<HierarchyNode>;
          if (!sector.children || sector.children.length === 0) return null;
          return (
            <div
              key={`sector-${sector.data.name}`}
              className="absolute text-[#b2b5be] text-[10px] sm:text-xs font-semibold px-1 py-0.5 truncate pointer-events-none"
              style={{
                top: `${sector.y0}%`,
                left: `${sector.x0}%`,
                width: `${sector.x1 - sector.x0}%`,
              }}
            >
              {sector.data.name}
            </div>
          );
        });
      })()}

      {/* Render Ticker Leaves */}
      {leaves.map((leaf) => {
        const { x0, y0, x1, y1, data } = leaf;
        const q = data.quote;
        const pct = q?.regularMarketChangePercent || 0;
        
        // Convert the 1000x1000 coordinates to percentages
        const t = (y0 / 1000) * 100;
        const l = (x0 / 1000) * 100;
        const w = ((x1 - x0) / 1000) * 100;
        const h = ((y1 - y0) / 1000) * 100;

        return (
          <div
            key={`leaf-${data.name}`}
            className={cn(
              "absolute flex flex-col items-center justify-center overflow-hidden border border-[#2a2e39] text-white transition-colors duration-300",
              getColor(pct)
            )}
            style={{
              top: `${t}%`,
              left: `${l}%`,
              width: `${w}%`,
              height: `${h}%`,
            }}
            title={`${data.item?.name}\nPrecio: $${q?.regularMarketPrice?.toFixed(2)}\nCambio: ${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`}
          >
            {/* Hide text if the box is too small */}
            {w > 2 && h > 3 && (
              <>
                <span className={cn("font-bold tracking-tight", h < 8 ? "text-[9px]" : "text-sm sm:text-base")}>
                  {data.name}
                </span>
                {h > 5 && (
                  <span className={cn("mt-0.5", h < 8 ? "text-[8px]" : "text-xs sm:text-sm")}>
                    {pct > 0 ? "+" : ""}
                    {pct.toFixed(2)}%
                  </span>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
