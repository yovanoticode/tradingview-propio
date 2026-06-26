"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Timeframe } from "@/lib/yahoo/types";

export type IndicatorKey =
  | "ema20"
  | "ema50"
  | "ema200"
  | "rsi"
  | "macd"
  | "volume"
  | "orb"
  | "ict"
  | "vwap"
  | "volumeProfile"
  | "fvg"
  | "stoch"
  | "ictMacros";

export type DrawingTool = "cursor" | "hline" | "measure" | "eraser" | "alert" | "long_position" | "short_position" | "position_forecast";

export type LayoutMode =
  | "single"
  | "split-v"
  | "split-h"
  | "three-v"
  | "three-h"
  | "three-l-2r"
  | "three-r-2l"
  | "three-t-2b"
  | "three-b-2t"
  | "grid2x2";

export interface PositionBox {
  id: string;
  symbol: string;
  type: "long" | "short" | "forecast";
  entry: number;
  stop: number;
  target: number;
}

export interface PriceLine {
  id: string;
  symbol: string;
  price: number;
}

export interface PriceAlert {
  id: string;
  symbol: string;
  price: number;
  triggered: boolean;
  createdPrice: number; // reference price at creation (to detect cross direction)
}

export interface IndicatorConfig {
  ema20: number;
  ema50: number;
  ema200: number;
  rsi: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  stochK: number;
  stochD: number;
  stochKVisible: boolean;
  stochDVisible: boolean;
  stochKColor: string;
  stochDColor: string;
}

export interface Tab {
  id: string;
  type?: "chart" | "heatmap";
  symbol: string;
  timeframe: Timeframe;
  indicators: Record<IndicatorKey, boolean>;
  hidden: Record<IndicatorKey, boolean>;
  config: IndicatorConfig;
}

export interface IctSessionConfig {
  enabled: boolean;
  name: string;
  startH: number;
  startM: number;
  endH: number;
  endM: number;
  color: string;
}

export interface OpeningPriceRow {
  enabled: boolean;
  name: string;
  timeH: number;
  timeM: number;
  color: string;
}

export interface TimestampRow {
  enabled: boolean;
  timeH: number;
  timeM: number;
  color: string;
}

export interface DWMConfig {
  showDOpen: boolean; showDHL: boolean; showPDHL: boolean; dColor: string;
  showWOpen: boolean; showWHL: boolean; showPWHL: boolean; wColor: string;
  showMOpen: boolean; showMHL: boolean; showPMHL: boolean; mColor: string;
  showDayLabels: boolean;
  hideWeekendLabels: boolean;
  cmeShift: boolean;
}

export interface IctSessionLabelConfig {
  highLabel: string;
  lowLabel: string;
}

// ── FVG + Order Block config ──────────────────────────────────────────────
export interface FvgConfig {
  // FVG display
  showCE: boolean;       // show CE-touched (visited) FVGs
  showIFVG: boolean;     // show inverted FVGs (fully filled → flipped)
  showHTF: boolean;      // show higher timeframe FVGs
  maxActive: number;     // max active FVGs to display
  minSizePts: number;    // min gap size in price points (0 = no filter)
  // Order Blocks
  showOB: boolean;       // show order blocks
  showBreaker: boolean;  // show breaker blocks (mitigated OBs)
  maxOBCount: number;    // max OBs to display
  // Market Structure
  showMSB: boolean;      // show BOS / CHoCH labels
  showSwings: boolean;   // show swing highs/lows markers
  msbLookback: number;   // swing detection lookback in bars (default 3)
  // OTE
  showOTE: boolean;      // show Optimal Trade Entry fib levels on latest swing
}

export const DEFAULT_FVG_CONFIG: FvgConfig = {
  showCE: false,
  showIFVG: true,
  showHTF: true,
  maxActive: 5,
  minSizePts: 0,
  showOB: true,
  showBreaker: false,
  maxOBCount: 5,
  showMSB: true,
  showSwings: false,
  msbLookback: 3,
  showOTE: true,
};

export interface IctMacroConfig {
  name: string;
  startH: number;
  startM: number;
  endH: number;
  endM: number;
  enabled: boolean;
  color: string;
}

export const DEFAULT_MACROS_CONFIG: IctMacroConfig[] = [
  { name: "02:33 AM - 03:00", startH: 2, startM: 33, endH: 3, endM: 0, enabled: false, color: "#8b5cf6" },
  { name: "04:03 AM - 04:30", startH: 4, startM: 3, endH: 4, endM: 30, enabled: false, color: "#8b5cf6" },
  { name: "08:50 AM - 09:10", startH: 8, startM: 50, endH: 9, endM: 10, enabled: false, color: "#8b5cf6" },
  { name: "09:50 AM - 10:10", startH: 9, startM: 50, endH: 10, endM: 10, enabled: true, color: "#8b5cf6" },
  { name: "10:50 AM - 11:10", startH: 10, startM: 50, endH: 11, endM: 10, enabled: true, color: "#8b5cf6" },
  { name: "11:50 AM - 12:10", startH: 11, startM: 50, endH: 12, endM: 10, enabled: false, color: "#8b5cf6" },
  { name: "13:10 PM - 13:40", startH: 13, startM: 10, endH: 13, endM: 40, enabled: true, color: "#8b5cf6" },
  { name: "15:15 PM - 15:45", startH: 15, startM: 15, endH: 15, endM: 45, enabled: true, color: "#8b5cf6" },
];

export type PivotExtend = "mitigated" | "always" | "none";
export type LabelSize = "small" | "medium" | "large";

export interface IctConfig {
  // Killzone Range (boxes)
  showBoxes: boolean;
  sessions: IctSessionConfig[];
  transparency: number;
  showBoxLabels: boolean;
  showAverage: boolean;

  // Killzone Pivots
  showPivots: boolean;
  showPivotMidpoints: boolean;
  showPivotLabels: boolean;
  pivotDisplayPrice: boolean;
  pivotRightSide: boolean;
  pivotExtend: PivotExtend;
  stopOnceMitigated: boolean;
  sessionLabels: IctSessionLabelConfig[];
  showAMD: boolean; // AMD / PO3

  // Opening Prices
  openingPrices: OpeningPriceRow[];
  openingPricesOnlyToday: boolean;

  // Timestamps
  timestamps: TimestampRow[];

  // Day / Week / Month
  dwm: DWMConfig;

  // Configuración
  timeframeLimit: number; // in minutes
  sessionDrawingLimit: number;
  textColor: string;
  labelSize: LabelSize;
  cutoffEnabled: boolean;
  cutoffH: number;
  cutoffM: number;
}

export const DEFAULT_ICT_CONFIG: IctConfig = {
  showBoxes: true,
  sessions: [
    { enabled: true,  name: "Asia",     startH: 19, startM: 0,  endH: 1,  endM: 0,  color: "#3b82f6" },
    { enabled: true,  name: "London",   startH: 3,  startM: 0,  endH: 9,  endM: 30, color: "#f59e0b" },
    { enabled: true,  name: "NY AM",    startH: 9,  startM: 30, endH: 11, endM: 0,  color: "#22c55e" },
    { enabled: false, name: "NY Lunch", startH: 12, startM: 0,  endH: 13, endM: 0,  color: "#f59e0b" },
    { enabled: false, name: "NY PM",    startH: 13, startM: 30, endH: 16, endM: 0,  color: "#a855f7" },
  ],
  transparency: 90,
  showBoxLabels: true,
  showAverage: false,

  showPivots: true,
  showPivotMidpoints: false,
  showPivotLabels: true,
  pivotDisplayPrice: false,
  pivotRightSide: true,
  pivotExtend: "mitigated",
  stopOnceMitigated: false,
  sessionLabels: [
    { highLabel: "AS.H",         lowLabel: "AS.L" },
    { highLabel: "HIGH LONDON",  lowLabel: "LOW LONDON" },
    { highLabel: "",             lowLabel: "" },
    { highLabel: "NYL.H",        lowLabel: "NYL.L" },
    { highLabel: "NYPM.H",       lowLabel: "NYPM.L" },
  ],
  showAMD: true,

  openingPrices: [
    { enabled: true,  name: "Medianoche", timeH: 0,  timeM: 0,  color: "#ffffff" },
    { enabled: true,  name: "Apertura NY", timeH: 8,  timeM: 30, color: "#a855f7" },
    { enabled: true,  name: "INDICES",    timeH: 9,  timeM: 30, color: "#7c3aed" },
    { enabled: false, name: "14:00",      timeH: 14, timeM: 0,  color: "#787b86" },
    { enabled: false, name: "",           timeH: 0,  timeM: 0,  color: "#787b86" },
    { enabled: false, name: "",           timeH: 0,  timeM: 0,  color: "#787b86" },
    { enabled: false, name: "",           timeH: 0,  timeM: 0,  color: "#787b86" },
    { enabled: false, name: "",           timeH: 0,  timeM: 0,  color: "#787b86" },
  ],
  openingPricesOnlyToday: true,

  timestamps: [
    { enabled: false, timeH: 8, timeM: 30, color: "#a855f7", label: "8:30" },
    { enabled: false, timeH: 9, timeM: 30, color: "#7c3aed", label: "9:30" },
  ],

  dwm: {
    showDOpen: true, showDHL: true, showPDHL: true, dColor: "#facc15",
    showWOpen: false, showWHL: false, showPWHL: false, wColor: "#38bdf8",
    showMOpen: false, showMHL: false, showPMHL: false, mColor: "#a78bfa",
    showDayLabels: true,
    hideWeekendLabels: true,
    cmeShift: true,
  },

  timeframeLimit: 1440,
  sessionDrawingLimit: 3,
  textColor: "#d1d5db",
  labelSize: "small",
  cutoffEnabled: true,
  cutoffH: 16,
  cutoffM: 0,
};

export const DEFAULT_INDICATORS: Record<IndicatorKey, boolean> = {
  ema20: true, ema50: true, ema200: false, rsi: true, macd: false,
  volume: true, orb: true, ict: false, vwap: false, volumeProfile: false, fvg: false, stoch: false, ictMacros: false,
};

export const DEFAULT_HIDDEN: Record<IndicatorKey, boolean> = {
  ema20: false, ema50: false, ema200: false, rsi: false, macd: false,
  volume: false, orb: false, ict: false, vwap: false, volumeProfile: false, fvg: false, stoch: false, ictMacros: false,
};

export const DEFAULT_CONFIG: IndicatorConfig = {
  ema20: 20,
  ema50: 50,
  ema200: 200,
  rsi: 14,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  stochK: 14,
  stochD: 3,
  stochKVisible: true,
  stochDVisible: true,
  stochKColor: "#2196f3",
  stochDColor: "#ff9800",
};

export const INDICATOR_COLORS: Record<IndicatorKey, string> = {
  ema20: "#ffb74d",
  ema50: "#2962ff",
  ema200: "#ab47bc",
  rsi: "#ab47bc",
  macd: "#2962ff",
  volume: "#787b86",
  orb: "#f59e0b",
  ict: "#22d3ee",
  vwap: "#fbbf24",
  volumeProfile: "#60a5fa",
  fvg: "#26a69a",
  stoch: "#ff9800",
  ictMacros: "#8b5cf6",
};

export const DEFAULT_WATCHLIST = [
  "MNQ=F",
  "NQ=F",
  "MES=F",
  "ES=F",
  "MYM=F",
  "YM=F",
  "CL=F",
  "GC=F",
  "^VIX",
  "^NDX",
  "BTC-USD",
];

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

interface ChartState {
  // Per-tab state
  tabs: Tab[];
  activeTabId: string;
  // Active tab's symbol/timeframe — kept at top level for backward compat
  symbol: string;
  timeframe: Timeframe;

  // Global indicator state (shared across all tabs)
  indicators: Record<IndicatorKey, boolean>;
  hidden: Record<IndicatorKey, boolean>;
  config: IndicatorConfig;
  watchlist: string[];

  // FVG + Order Block config
  fvgConfig: FvgConfig;
  setFvgConfig: (c: FvgConfig) => void;

  macrosConfig: IctMacroConfig[];
  setMacrosConfig: (c: IctMacroConfig[]) => void;

  // ICT Killzones config
  ictConfig: IctConfig;
  setIctConfig: (c: IctConfig) => void;

  // Chart timezone
  chartTimezone: "America/New_York" | "America/Bogota";
  setChartTimezone: (tz: "America/New_York" | "America/Bogota") => void;

  // Layout
  layoutMode: LayoutMode;
  setLayoutMode: (m: LayoutMode) => void;
  rightSidebarVisible: boolean;
  toggleRightSidebar: () => void;
  activeSlot: number;
  setActiveSlot: (slot: number) => void;
  slots: { symbol: string; timeframe: Timeframe; dataSource?: "nt8" | "yahoo" | "tradovate" }[];
  gridTimeframes: [Timeframe, Timeframe, Timeframe, Timeframe];
  setGridTimeframe: (slot: 0 | 1 | 2 | 3, tf: Timeframe) => void;
  setDataSource: (slotIndex: number, source: "nt8" | "yahoo" | "tradovate") => void;

  // Replay mode — bar-by-bar playback for backtesting setups
  replayActive: boolean;
  replayIndex: number; // index in candlesRef (last bar to show)
  replayPlaying: boolean;
  replaySpeed: number; // bars per second
  setReplay: (patch: Partial<{ active: boolean; index: number; playing: boolean; speed: number }>) => void;

  // NT8 connection (ephemeral)
  nt8Connected: boolean;
  nt8Instrument: string | null;
  nt8Instruments: string[];
  nt8WasConnected: boolean; // persisted — triggers auto-reconnect on load
  nt8OffsetHours: number;
  setNT8: (connected: boolean, instrument?: string | null) => void;
  setNT8Instruments: (instruments: string[]) => void;
  setNt8OffsetHours: (h: number) => void;

  // Tradovate connection (ephemeral / persisted token)
  tradovateToken: string | null;
  tradovateEnv: "demo" | "live";
  tradovateConnected: boolean;
  setTradovate: (connected: boolean, token?: string | null, env?: "demo" | "live") => void;



  // Ephemeral UI state (not persisted)
  tool: DrawingTool;
  priceLines: PriceLine[];
  alerts: PriceAlert[];
  positionBoxes: PositionBox[];
  addPositionBox: (entry: number, stop: number, target: number, symbol: string, type: "long" | "short" | "forecast") => void;
  removePositionBox: (id: string) => void;
  clearPositionBoxes: (symbol?: string) => void;
  symbolDialogOpen: boolean;
  settingsTarget: IndicatorKey | null;

  // Tab actions
  addTab: (symbol?: string, timeframe?: Timeframe, type?: "chart" | "heatmap") => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;

  // Chart actions
  setSymbol: (s: string) => void;
  setTimeframe: (t: Timeframe) => void;
  toggleIndicator: (key: IndicatorKey) => void;
  removeIndicator: (key: IndicatorKey) => void;
  toggleHidden: (key: IndicatorKey) => void;
  setConfig: (patch: Partial<IndicatorConfig>) => void;
  addToWatchlist: (s: string) => void;
  removeFromWatchlist: (s: string) => void;
  setTool: (t: DrawingTool) => void;
  addPriceLine: (price: number, symbol: string) => void;
  clearPriceLines: (symbol?: string) => void;
  addAlert: (price: number, symbol: string, currentPrice: number) => void;
  removeAlert: (id: string) => void;
  triggerAlert: (id: string) => void;
  setSymbolDialogOpen: (v: boolean) => void;
  setSettingsTarget: (k: IndicatorKey | null) => void;
}

export const useChartStore = create<ChartState>()(
  persist(
    (set) => ({
      tabs: [{ id: "tab-1", symbol: "MNQ=F", timeframe: "15m", indicators: { ...DEFAULT_INDICATORS }, hidden: { ...DEFAULT_HIDDEN }, config: { ...DEFAULT_CONFIG } }],
      activeTabId: "tab-1",
      symbol: "MNQ=F",
      timeframe: "15m" as Timeframe,
      indicators: { ...DEFAULT_INDICATORS },
      hidden: { ...DEFAULT_HIDDEN },
      config: { ...DEFAULT_CONFIG },
      watchlist: DEFAULT_WATCHLIST,
      fvgConfig: { ...DEFAULT_FVG_CONFIG }, // always merged with defaults on hydration below
      setFvgConfig: (fvgConfig) => set({ fvgConfig }),

      macrosConfig: [...DEFAULT_MACROS_CONFIG],
      setMacrosConfig: (macrosConfig) => set({ macrosConfig }),

      ictConfig: DEFAULT_ICT_CONFIG,
      setIctConfig: (ictConfig) => set({ ictConfig }),

      chartTimezone: "America/New_York",
      setChartTimezone: (chartTimezone) => set({ chartTimezone }),

      layoutMode: "single",
      setLayoutMode: (layoutMode) => set({ layoutMode }),
      rightSidebarVisible: true,
      toggleRightSidebar: () => set((s) => ({ rightSidebarVisible: !s.rightSidebarVisible })),
      activeSlot: 0,
      setActiveSlot: (activeSlot) =>
        set((s) => {
          const slot = s.slots[activeSlot];
          if (!slot) return { activeSlot };
          return {
            activeSlot,
            symbol: slot.symbol,
            timeframe: slot.timeframe,
          };
        }),
      slots: [
        { symbol: "MNQ=F", timeframe: "15m", dataSource: "nt8" },
        { symbol: "NQ=F", timeframe: "5m", dataSource: "nt8" },
        { symbol: "ES=F", timeframe: "1m", dataSource: "nt8" },
        { symbol: "YM=F", timeframe: "1h", dataSource: "nt8" },
      ],
      gridTimeframes: ["1m", "5m", "15m", "1h"],
      setGridTimeframe: (slot, tf) =>
        set((s) => {
          const arr = [...s.gridTimeframes] as [Timeframe, Timeframe, Timeframe, Timeframe];
          arr[slot] = tf;
          return { gridTimeframes: arr };
        }),
      setDataSource: (slotIndex, source) =>
        set((s) => {
          const arr = [...s.slots];
          if (arr[slotIndex]) {
            arr[slotIndex] = { ...arr[slotIndex], dataSource: source };
          }
          return { slots: arr };
        }),

      replayActive: false,
      replayIndex: 0,
      replayPlaying: false,
      replaySpeed: 1,
      setReplay: (patch) =>
        set((s) => ({
          replayActive:  patch.active  ?? s.replayActive,
          replayIndex:   patch.index   ?? s.replayIndex,
          replayPlaying: patch.playing ?? s.replayPlaying,
          replaySpeed:   patch.speed   ?? s.replaySpeed,
        })),

      nt8Connected: false,
      nt8Instrument: null,
      nt8Instruments: [],
      nt8WasConnected: false,
      nt8OffsetHours: -1, // Default to -1 as requested/identified
      setNT8: (connected, instrument = null) =>
        set((s) => ({
          nt8Connected: connected,
          nt8Instrument: instrument,
          // Once user has connected, remember it forever (until explicit reset)
          nt8WasConnected: connected || s.nt8WasConnected,
        })),
      setNT8Instruments: (nt8Instruments) => set({ nt8Instruments }),
      setNt8OffsetHours: (h) => set({ nt8OffsetHours: h }),

      tradovateToken: null,
      tradovateEnv: "demo",
      tradovateConnected: false,
      setTradovate: (connected, token = null, env = "demo") =>
        set((s) => ({
          tradovateConnected: connected,
          tradovateToken: token ?? s.tradovateToken,
          tradovateEnv: env ?? s.tradovateEnv,
        })),



      tool: "cursor",
      priceLines: [],
      alerts: [],
      positionBoxes: [],
      addPositionBox: (entry, stop, target, symbol, type) =>
        set((s) => ({ positionBoxes: [...s.positionBoxes, { id: newId(), symbol, type, entry, stop, target }] })),
      removePositionBox: (id) =>
        set((s) => ({ positionBoxes: s.positionBoxes.filter((b) => b.id !== id) })),
      clearPositionBoxes: (symbol) =>
        set((s) => ({ positionBoxes: symbol ? s.positionBoxes.filter((b) => b.symbol !== symbol) : [] })),
      symbolDialogOpen: false,
      settingsTarget: null,

      addTab: (symbol, timeframe, type = "chart") =>
        set((s) => {
          const id = newId();
          const sym = symbol ?? (type === "heatmap" ? "NQ100" : s.symbol);
          const tf = timeframe ?? s.timeframe;
          const newTab: Tab = {
            id, type, symbol: sym, timeframe: tf,
            indicators: { ...s.indicators },
            hidden: { ...s.hidden },
            config: { ...s.config },
          };
          return {
            tabs: [...s.tabs, newTab],
            activeTabId: id,
            symbol: sym,
            timeframe: tf,
            indicators: { ...s.indicators },
            hidden: { ...s.hidden },
            config: { ...s.config },
          };
        }),

      closeTab: (id) =>
        set((s) => {
          if (s.tabs.length <= 1) return s;
          const newTabs = s.tabs.filter((t) => t.id !== id);
          if (s.activeTabId !== id) return { tabs: newTabs };
          const idx = s.tabs.findIndex((t) => t.id === id);
          const next = newTabs[Math.min(idx, newTabs.length - 1)];
          return {
            tabs: newTabs,
            activeTabId: next.id,
            symbol: next.symbol,
            timeframe: next.timeframe,
            indicators: { ...next.indicators },
            hidden: { ...next.hidden },
            config: { ...next.config },
          };
        }),

      switchTab: (id) =>
        set((s) => {
          const tab = s.tabs.find((t) => t.id === id);
          if (!tab || tab.id === s.activeTabId) return s;
          const newSlots = [...s.slots];
          if (newSlots[0]) {
            newSlots[0] = { symbol: tab.symbol, timeframe: tab.timeframe };
          }
          return {
            activeTabId: id,
            activeSlot: 0,
            symbol: tab.symbol,
            timeframe: tab.timeframe,
            indicators: { ...tab.indicators },
            hidden: { ...tab.hidden },
            config: { ...tab.config },
            slots: newSlots,
          };
        }),

      setSymbol: (symbol) =>
        set((s) => {
          const newSlots = [...s.slots];
          if (newSlots[s.activeSlot]) {
            newSlots[s.activeSlot] = { ...newSlots[s.activeSlot], symbol };
          }
          return {
            symbol,
            slots: newSlots,
            tabs: s.tabs.map((t) =>
              t.id === s.activeTabId ? { ...t, symbol } : t,
            ),
          };
        }),

      setTimeframe: (timeframe) =>
        set((s) => {
          const newSlots = [...s.slots];
          if (newSlots[s.activeSlot]) {
            newSlots[s.activeSlot] = { ...newSlots[s.activeSlot], timeframe };
          }
          return {
            timeframe,
            slots: newSlots,
            tabs: s.tabs.map((t) =>
              t.id === s.activeTabId ? { ...t, timeframe } : t,
            ),
          };
        }),

      toggleIndicator: (key) =>
        set((s) => {
          const newIndicators = { ...s.indicators, [key]: !s.indicators[key] };
          const newHidden = !s.indicators[key] ? { ...s.hidden, [key]: false } : s.hidden;
          return {
            indicators: newIndicators,
            hidden: newHidden,
            tabs: s.tabs.map((t) =>
              t.id === s.activeTabId ? { ...t, indicators: newIndicators, hidden: newHidden } : t
            ),
          };
        }),
      removeIndicator: (key) =>
        set((s) => {
          const newIndicators = { ...s.indicators, [key]: false };
          const newHidden = { ...s.hidden, [key]: false };
          return {
            indicators: newIndicators,
            hidden: newHidden,
            tabs: s.tabs.map((t) =>
              t.id === s.activeTabId ? { ...t, indicators: newIndicators, hidden: newHidden } : t
            ),
          };
        }),
      toggleHidden: (key) =>
        set((s) => {
          const newHidden = { ...s.hidden, [key]: !s.hidden[key] };
          return {
            hidden: newHidden,
            tabs: s.tabs.map((t) =>
              t.id === s.activeTabId ? { ...t, hidden: newHidden } : t
            ),
          };
        }),
      setConfig: (patch) =>
        set((s) => {
          const newConfig = { ...s.config, ...patch };
          return {
            config: newConfig,
            tabs: s.tabs.map((t) =>
              t.id === s.activeTabId ? { ...t, config: newConfig } : t
            ),
          };
        }),
      addToWatchlist: (s) =>
        set((state) => ({
          watchlist: state.watchlist.includes(s)
            ? state.watchlist
            : [...state.watchlist, s],
        })),
      removeFromWatchlist: (s) =>
        set((state) => ({
          watchlist: state.watchlist.filter((x) => x !== s),
        })),
      setTool: (tool) => set({ tool }),
      addPriceLine: (price, symbol) =>
        set((state) => ({
          priceLines: [
            ...state.priceLines,
            { id: newId(), symbol, price },
          ],
        })),
      clearPriceLines: (symbol) =>
        set((state) => ({
          priceLines: symbol
            ? state.priceLines.filter((p) => p.symbol !== symbol)
            : [],
        })),
      addAlert: (price, symbol, currentPrice) =>
        set((state) => ({
          alerts: [
            ...state.alerts,
            { id: newId(), symbol, price, triggered: false, createdPrice: currentPrice },
          ],
        })),
      removeAlert: (id) =>
        set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) })),
      triggerAlert: (id) =>
        set((state) => ({
          alerts: state.alerts.map((a) => (a.id === id ? { ...a, triggered: true } : a)),
        })),
      setSymbolDialogOpen: (symbolDialogOpen) => set({ symbolDialogOpen }),
      setSettingsTarget: (settingsTarget) => set({ settingsTarget }),
    }),
    {
      name: "tv-futures-chart-state",
      version: 5,
      migrate: (persisted: unknown, version: number) => {
        const s = persisted as Record<string, any>;
        if (version === 0) {
          // Upgrade: inject per-tab indicator state from global state
          const ind = (s.indicators as Record<IndicatorKey, boolean> | undefined) ?? { ...DEFAULT_INDICATORS };
          const hid = (s.hidden as Record<IndicatorKey, boolean> | undefined) ?? { ...DEFAULT_HIDDEN };
          const cfg = (s.config as IndicatorConfig | undefined) ?? { ...DEFAULT_CONFIG };
          // Reset fvgConfig to new defaults (version bump clears old showCE=true)
          s.fvgConfig = { ...DEFAULT_FVG_CONFIG };
          s.tabs = ((s.tabs as Tab[] | undefined) ?? []).map((t) => ({
            ...t,
            indicators: t.indicators ?? { ...ind },
            hidden: t.hidden ?? { ...hid },
            config: t.config ?? { ...cfg },
          }));
        }
        if (version < 3) {
          s.layoutMode = "single";
          s.activeSlot = 0;
          s.slots = [
            { symbol: (s.symbol as string) || "MNQ=F", timeframe: (s.timeframe as string) || "15m" },
            { symbol: "NQ=F", timeframe: "5m" },
            { symbol: "ES=F", timeframe: "1m" },
            { symbol: "YM=F", timeframe: "1h" },
          ];
        }
        if (version < 4) {
          s.slots = (s.slots ?? []).map((slot: any) => ({
            ...slot,
            dataSource: slot.dataSource ?? "nt8",
          }));
          s.tradovateToken = s.tradovateToken ?? null;
          s.tradovateEnv = s.tradovateEnv ?? "demo";
        }
        if (version < 5) {
          s.macrosConfig = s.macrosConfig || [...DEFAULT_MACROS_CONFIG];
          s.indicators = { ...DEFAULT_INDICATORS, ...s.indicators };
          s.hidden = { ...DEFAULT_HIDDEN, ...s.hidden };
          s.tabs = (s.tabs ?? []).map((t: any) => ({
            ...t,
            indicators: { ...DEFAULT_INDICATORS, ...t.indicators },
            hidden: { ...DEFAULT_HIDDEN, ...t.hidden },
          }));
        }
        return s;
      },
      partialize: (s) => ({
        tabs: s.tabs,
        activeTabId: s.activeTabId,
        symbol: s.symbol,
        timeframe: s.timeframe,
        indicators: s.indicators,
        hidden: s.hidden,
        config: s.config,
        watchlist: s.watchlist,
        fvgConfig: s.fvgConfig,
        macrosConfig: s.macrosConfig,
        ictConfig: s.ictConfig,
        chartTimezone: s.chartTimezone,
        alerts: s.alerts,
        priceLines: s.priceLines,
        layoutMode: s.layoutMode,
        activeSlot: s.activeSlot,
        slots: s.slots,
        gridTimeframes: s.gridTimeframes,
        nt8WasConnected: s.nt8WasConnected,
        tradovateToken: s.tradovateToken,
        tradovateEnv: s.tradovateEnv,
      }),
    },
  ),
);
