"use client";

import { Header } from "@/components/layout/Header";
import { TabBar } from "@/components/layout/TabBar";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { BottomPanel } from "@/components/layout/BottomPanel";
import { PriceChart } from "@/components/chart/PriceChart";
import { ReplayBar } from "@/components/chart/ReplayBar";
import { IndicatorSettingsDialog } from "@/components/chart/IndicatorSettingsDialog";
import { useChartStore } from "@/lib/store/chart-store";
import { cn } from "@/lib/utils";

import { Heatmap } from "@/components/heatmap/Heatmap";

export default function HomePage() {
  const tabs = useChartStore((s) => s.tabs);
  const activeTabId = useChartStore((s) => s.activeTabId);
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const layoutMode = useChartStore((s) => s.layoutMode);
  const activeSlot = useChartStore((s) => s.activeSlot);
  const setActiveSlot = useChartStore((s) => s.setActiveSlot);
  const slots = useChartStore((s) => s.slots);

  const renderChart = (index: number, extraClass = "") => {
    // Determine what to render based on the active tab for this slot if it's the active one
    // But wait, tabs array contains all tabs.
    // The slot mapping is not 1:1 with tabs in this simple version, but activeTab has the type.
    // Actually, in our current setup, if there are multiple layouts, it might be complex.
    // Let's render Heatmap if the current slot's active tab is heatmap.
    // Wait, the slot doesn't store type. The slot corresponds to tabs? No, activeTab is global.
    // Let's just check if the activeTab is a heatmap for the primary view.
    const slot = slots[index] || { symbol: "MNQ=F", timeframe: "15m" };
    // Find if the tab for this slot is a heatmap? We only have one active tab globally in the simple UI.
    const isHeatmap = activeTab?.type === "heatmap" && index === activeSlot;
    // Actually, if activeTab is heatmap, we should probably just render the heatmap full screen instead of the grid?
    // Let's just render Heatmap if the current slot is the active one and it's a heatmap.
    
    // Wait, the tabs are tied to slots? No, tabs are global. 
    // Let's render Heatmap inside the slot if the activeTab is heatmap.
    
    const isActive = activeSlot === index;
    return (
      <div
        onMouseDownCapture={() => setActiveSlot(index)}
        className={cn(
          "relative bg-tv-bg overflow-hidden h-full w-full transition-all duration-150",
          extraClass,
          isActive ? "ring-2 ring-tv-blue z-10" : "ring-1 ring-tv-border/30"
        )}
      >
        {isActive && activeTab?.type === "heatmap" ? (
          <Heatmap />
        ) : slot.symbol === "NQ100" ? (
          <div className="flex h-full items-center justify-center text-tv-text-dim text-xs">
             Mapa de Calor (Haz clic para activar)
          </div>
        ) : (
          <PriceChart
            key={`chart-${index}-${slot.symbol}-${slot.timeframe}`}
            symbol={slot.symbol}
            timeframe={slot.timeframe}
            slotIndex={index}
          />
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-tv-bg">
      <Header />
      <TabBar />
      <div className="flex min-h-0 flex-1">
        <LeftSidebar />
        <main className="relative flex min-h-0 flex-1 flex-col">
          <ReplayBar />
          <div className="min-h-0 flex-1">
            {activeTab && (
              <div className="h-full w-full">
                {layoutMode === "single" && renderChart(0)}
                
                {layoutMode === "split-v" && (
                  <div className="grid h-full w-full grid-cols-2 gap-px bg-tv-border">
                    {renderChart(0)}
                    {renderChart(1)}
                  </div>
                )}
                
                {layoutMode === "split-h" && (
                  <div className="grid h-full w-full grid-rows-2 gap-px bg-tv-border">
                    {renderChart(0)}
                    {renderChart(1)}
                  </div>
                )}
                
                {layoutMode === "three-v" && (
                  <div className="grid h-full w-full grid-cols-3 gap-px bg-tv-border">
                    {renderChart(0)}
                    {renderChart(1)}
                    {renderChart(2)}
                  </div>
                )}
                
                {layoutMode === "three-h" && (
                  <div className="grid h-full w-full grid-rows-3 gap-px bg-tv-border">
                    {renderChart(0)}
                    {renderChart(1)}
                    {renderChart(2)}
                  </div>
                )}
                
                {layoutMode === "three-l-2r" && (
                  <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-tv-border">
                    {renderChart(0, "row-span-2 col-span-1")}
                    {renderChart(1, "row-span-1 col-span-1")}
                    {renderChart(2, "row-span-1 col-span-1")}
                  </div>
                )}
                
                {layoutMode === "three-r-2l" && (
                  <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-tv-border">
                    {renderChart(0, "row-span-1 col-span-1")}
                    {renderChart(1, "row-span-1 col-span-1")}
                    {renderChart(2, "row-span-2 col-span-1")}
                  </div>
                )}
                
                {layoutMode === "three-t-2b" && (
                  <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-tv-border">
                    {renderChart(0, "row-span-1 col-span-2")}
                    {renderChart(1, "row-span-1 col-span-1")}
                    {renderChart(2, "row-span-1 col-span-1")}
                  </div>
                )}
                
                {layoutMode === "three-b-2t" && (
                  <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-tv-border">
                    {renderChart(0, "row-span-1 col-span-1")}
                    {renderChart(1, "row-span-1 col-span-1")}
                    {renderChart(2, "row-span-1 col-span-2")}
                  </div>
                )}
                
                {layoutMode === "grid2x2" && (
                  <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-tv-border">
                    {renderChart(0)}
                    {renderChart(1)}
                    {renderChart(2)}
                    {renderChart(3)}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
        <RightSidebar />
      </div>
      <BottomPanel />
      <IndicatorSettingsDialog />
    </div>
  );
}
