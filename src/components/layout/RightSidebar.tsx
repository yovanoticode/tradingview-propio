"use client";

import { Watchlist } from "@/components/watchlist/Watchlist";
import { useChartStore } from "@/lib/store/chart-store";
import { ListCollapse, ListTodo } from "lucide-react";

export function RightSidebar() {
  const visible = useChartStore((s) => s.rightSidebarVisible);
  const toggle = useChartStore((s) => s.toggleRightSidebar);

  return (
    <div className="flex h-full bg-tv-panel border-l border-tv-border">
      {/* Sidebar Content (Watchlist) */}
      {visible && (
        <aside className="flex w-64 flex-col border-r border-tv-border">
          <Watchlist />
        </aside>
      )}
      
      {/* Thin Icon Strip */}
      <div className="w-12 flex flex-col items-center py-3 gap-4 shrink-0">
        <button
          onClick={toggle}
          className={`p-2 rounded text-tv-text-muted hover:text-tv-text hover:bg-tv-panel-hover transition-colors ${visible ? "text-tv-blue" : ""}`}
          title={visible ? "Ocultar Watchlist" : "Mostrar Watchlist"}
        >
          {visible ? <ListCollapse size={20} /> : <ListTodo size={20} />}
        </button>
      </div>
    </div>
  );
}
