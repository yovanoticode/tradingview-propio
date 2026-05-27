"use client";

import { Plus, X } from "lucide-react";
import { useChartStore } from "@/lib/store/chart-store";
import { cn } from "@/lib/utils";

export function TabBar() {
  const tabs = useChartStore((s) => s.tabs);
  const activeTabId = useChartStore((s) => s.activeTabId);
  const switchTab = useChartStore((s) => s.switchTab);
  const closeTab = useChartStore((s) => s.closeTab);
  const addTab = useChartStore((s) => s.addTab);

  return (
    <div className="flex h-8 items-center gap-0 border-b border-tv-border bg-tv-bg">
      <div className="flex min-w-0 flex-1 items-center overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={cn(
                "group flex h-full min-w-[100px] max-w-[180px] cursor-pointer items-center gap-1.5 border-r border-tv-border px-3 text-xs transition-colors",
                isActive
                  ? "border-t border-t-tv-blue bg-tv-panel text-tv-text"
                  : "text-tv-text-muted hover:bg-tv-panel hover:text-tv-text",
              )}
            >
              <span className="truncate font-medium">{tab.symbol}</span>
              <span className="text-[10px] uppercase text-tv-text-dim opacity-70">
                {tab.timeframe}
              </span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="ml-auto shrink-0 rounded p-0.5 text-tv-text-dim opacity-0 transition-opacity hover:text-tv-red group-hover:opacity-100"
                  aria-label={`Cerrar ${tab.symbol}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => addTab()}
        className="flex h-full items-center px-3 text-tv-text-muted hover:bg-tv-panel hover:text-tv-text"
        title="Nueva pestaña"
        aria-label="Nueva pestaña"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
