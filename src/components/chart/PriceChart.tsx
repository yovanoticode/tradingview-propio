"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  CrosshairMode,
  TickMarkType,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
} from "lightweight-charts";
import { fetchNT8Bars } from "@/lib/nt8/rest";
import { fetchBinanceKlines, getBinanceKlineWS } from "@/lib/binance/klines";
import { isCryptoSymbol } from "@/lib/binance/ticker";
import { getNT8WS } from "@/lib/nt8/ws";
import { fetchKlines } from "@/lib/yahoo/rest";
import { getYahooPoller } from "@/lib/yahoo/ws";
import { getTradovateWS } from "@/lib/tradovate/ws";
import { ema, rsi, macd } from "@/lib/indicators";
import { calculateORB, type ORBResult } from "@/lib/indicators/orb";
import { calculateVWAP } from "@/lib/indicators/vwap";
import { calculateVolumeProfile, type VolumeProfile } from "@/lib/indicators/volumeProfile";
import { VolumeProfileOverlay } from "./VolumeProfileOverlay";
import { calculateKillzones, type KZBox } from "@/lib/indicators/killzones";
import { calculateFVGs, type FVGBox } from "@/lib/indicators/fvg";
import { calculateOrderBlocks, type OBBox } from "@/lib/indicators/orderBlocks";
import { calculateMarketStructure, type StructureBreak, type SwingPoint } from "@/lib/indicators/marketStructure";
import { FVGOverlay } from "./FVGOverlay";
import { OrderBlockOverlay } from "./OrderBlockOverlay";
import { MarketStructureOverlay } from "./MarketStructureOverlay";
import { FvgSettingsDialog } from "./FvgSettingsDialog";
import { KillzonesOverlay } from "./KillzonesOverlay";
import { LevelsOverlay } from "./LevelsOverlay";
import { IctSettingsDialog } from "./IctSettingsDialog";
import {
  calculateOpeningPrices,
  calculateDWM,
  calculateTimestamps,
  type HorizLevel,
  type VertLine,
} from "@/lib/indicators/levels";
import type { Candle, Timeframe } from "@/lib/yahoo/types";
import {
  INDICATOR_COLORS,
  useChartStore,
  type IndicatorKey,
  type PositionBox,
} from "@/lib/store/chart-store";
import { formatPrice, formatVolume } from "@/lib/format";
import { IndicatorPill } from "./IndicatorPill";
import { MeasureOverlay } from "./MeasureOverlay";
import { PositionOverlay } from "./PositionOverlay";

interface MeasurePoint {
  time: number;
  price: number;
}
interface MeasureState {
  phase: "idle" | "placing" | "done";
  a: MeasurePoint | null;
  b: MeasurePoint | null;
}
const INITIAL_MEASURE: MeasureState = { phase: "idle", a: null, b: null };

function durationLabel(aTime: number, bTime: number): string {
  const diff = Math.abs(bTime - aTime);
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

interface Props {
  symbol: string;
  timeframe: Timeframe;
  slotIndex?: number;
}

const TV_COLORS = {
  bg: "#131722",
  panel: "#1e222d",
  border: "#2a2e39",
  text: "#d1d4dc",
  textMuted: "#787b86",
  green: "#26a69a",
  red: "#ef5350",
  blue: "#2962ff",
  yellow: "#ffb74d",
  purple: "#ab47bc",
  grid: "#1e222d",
};

interface HoverInfo {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  time: number;
  pct: number;
}

interface LastValues {
  ema20?: number;
  ema50?: number;
  ema200?: number;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  macdHist?: number;
  volume?: number;
}

interface PaneOffset {
  top: number;
  height: number;
}

export function PriceChart({ symbol, timeframe, slotIndex = 0 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema200Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsi30Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rsi70Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const macdRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSignalRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdHistRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const priceLinesMapRef = useRef<Map<string, IPriceLine>>(new Map());
  const alertLinesMapRef = useRef<Map<string, IPriceLine>>(new Map());

  const ictConfig = useChartStore((s) => s.ictConfig);
  const fvgConfig = useChartStore((s) => s.fvgConfig);
  const fvgConfigRef = useRef(fvgConfig);
  fvgConfigRef.current = fvgConfig;
  const chartTimezone = useChartStore((s) => s.chartTimezone);
  const nt8Connected   = useChartStore((s) => s.nt8Connected);
  const nt8Instrument  = useChartStore((s) => s.nt8Instrument);
  const nt8Instruments = useChartStore((s) => s.nt8Instruments) || [];
  const tradovateConnected = useChartStore((s) => s.tradovateConnected);
  const slots = useChartStore((s) => s.slots);
  
  const slot = slots[slotIndex] ?? { symbol, timeframe, dataSource: "nt8" };
  const dataSource = slot.dataSource ?? "nt8";

  const isCrypto = isCryptoSymbol(symbol);
  const useTradovate = !isCrypto && tradovateConnected && dataSource === "tradovate";
  const useNT8 = !isCrypto && !useTradovate && nt8Connected && (() => {
    const symPrefix = symbol.split(/[=-]/)[0].toUpperCase();
    return nt8Instruments.some(
      (inst) => inst.split(/\s/)[0].toUpperCase() === symPrefix
    );
  })();

  const matchingInstrument = (() => {
    const symPrefix = symbol.split(/[=-]/)[0].toUpperCase();
    return nt8Instruments.find(
      (inst) => inst.split(/\s/)[0].toUpperCase() === symPrefix
    ) || nt8Instrument;
  })();
  const indicators = useChartStore((s) => s.indicators);
  const hidden = useChartStore((s) => s.hidden);
  const config = useChartStore((s) => s.config);
  const tool = useChartStore((s) => s.tool);
  const priceLines = useChartStore((s) => s.priceLines);
  const addPriceLine = useChartStore((s) => s.addPriceLine);
  const alerts = useChartStore((s) => s.alerts);
  const replayActive  = useChartStore((s) => s.replayActive);
  const replayIndex   = useChartStore((s) => s.replayIndex);
  const replayPlaying = useChartStore((s) => s.replayPlaying);
  const replaySpeed   = useChartStore((s) => s.replaySpeed);
  const setReplay     = useChartStore((s) => s.setReplay);
  const addAlert = useChartStore((s) => s.addAlert);
  const triggerAlert = useChartStore((s) => s.triggerAlert);
  const removeAlert = useChartStore((s) => s.removeAlert);
  const removeIndicator = useChartStore((s) => s.removeIndicator);
  const toggleHidden = useChartStore((s) => s.toggleHidden);
  const setSettingsTarget = useChartStore((s) => s.setSettingsTarget);
  const positionBoxes = useChartStore((s) => s.positionBoxes);
  const addPositionBox = useChartStore((s) => s.addPositionBox);
  const removePositionBox = useChartStore((s) => s.removePositionBox);

  // Refs to avoid recreating subscribeClick on every tool change
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const addPriceLineRef = useRef(addPriceLine);
  addPriceLineRef.current = addPriceLine;
  const addAlertRef = useRef(addAlert);
  addAlertRef.current = addAlert;
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;
  const triggerAlertRef = useRef(triggerAlert);
  triggerAlertRef.current = triggerAlert;
  const lastPriceForAlertsRef = useRef<number | null>(null);
  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;
  const configRef = useRef(config);
  configRef.current = config;
  const ictConfigRef = useRef(ictConfig);
  ictConfigRef.current = ictConfig;

  const orbHighLineRef = useRef<IPriceLine | null>(null);
  const orbLowLineRef = useRef<IPriceLine | null>(null);

  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [lastPrice, setLastPrice] = useState<{ value: number; pct: number } | null>(null);
  const [lastValues, setLastValues] = useState<LastValues>({});
  const [orbResult, setOrbResult] = useState<ORBResult | null>(null);
  const [kzBoxes, setKzBoxes] = useState<KZBox[]>([]);
  const [fvgBoxes, setFvgBoxes] = useState<FVGBox[]>([]);
  const [obBoxes,  setObBoxes]  = useState<OBBox[]>([]);
  const [msbBreaks, setMsbBreaks] = useState<StructureBreak[]>([]);
  const [msbSwings, setMsbSwings] = useState<SwingPoint[]>([]);
  const [fvgSettingsOpen, setFvgSettingsOpen] = useState(false);
  const [opLevels, setOpLevels] = useState<HorizLevel[]>([]);
  const [dwmLevels, setDwmLevels] = useState<HorizLevel[]>([]);
  const [tsList, setTsList] = useState<VertLine[]>([]);
  const [vProfile, setVProfile] = useState<VolumeProfile | null>(null);
  const [ictSettingsOpen, setIctSettingsOpen] = useState(false);
  const [paneOffsets, setPaneOffsets] = useState<PaneOffset[]>([]);
  // Pagination tracking — count of historical bars loaded so server knows offset
  const loadedOffsetRef = useRef<number>(0);
  const loadingMoreRef  = useRef<boolean>(false);

  const [measure, setMeasure] = useState<MeasureState>(INITIAL_MEASURE);
  const [renderTick, setRenderTick] = useState(0);
  const measureRef = useRef(measure);
  measureRef.current = measure;

  interface PositionDraft {
    phase: "idle" | "placing";
    type: "long" | "short" | "forecast";
    entry: number | null;
    mouse: number | null;
  }
  const [positionDraft, setPositionDraft] = useState<PositionDraft>({ phase: "idle", type: "long", entry: null, mouse: null });
  const positionDraftRef = useRef(positionDraft);
  positionDraftRef.current = positionDraft;
  const addPositionBoxRef = useRef(addPositionBox);
  addPositionBoxRef.current = addPositionBox;

  // Helper — compute pane top offsets from chart layout
  function recomputePaneOffsets() {
    if (!chartRef.current) return;
    const panes = chartRef.current.panes();
    let top = 0;
    const offsets: PaneOffset[] = panes.map((p) => {
      const h = p.getHeight();
      const o = { top, height: h };
      top += h;
      return o;
    });
    setPaneOffsets(offsets);
  }

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: TV_COLORS.bg },
        textColor: TV_COLORS.text,
        fontFamily: "var(--font-sans), Inter, system-ui, sans-serif",
        fontSize: 11,
        panes: { separatorColor: TV_COLORS.border, separatorHoverColor: TV_COLORS.border },
      },
      grid: {
        vertLines: { color: TV_COLORS.grid },
        horzLines: { color: TV_COLORS.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: TV_COLORS.textMuted, width: 1, style: 3, labelBackgroundColor: TV_COLORS.panel },
        horzLine: { color: TV_COLORS.textMuted, width: 1, style: 3, labelBackgroundColor: TV_COLORS.panel },
      },
      rightPriceScale: {
        borderColor: TV_COLORS.border,
        textColor: TV_COLORS.textMuted,
      },
      timeScale: {
        borderColor: TV_COLORS.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 8,
      },
      autoSize: true,
    });

    // PANE 0 — Candles + EMAs
    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: TV_COLORS.green,
      downColor: TV_COLORS.red,
      borderUpColor: TV_COLORS.green,
      borderDownColor: TV_COLORS.red,
      wickUpColor: TV_COLORS.green,
      wickDownColor: TV_COLORS.red,
      priceLineColor: TV_COLORS.textMuted,
      priceLineStyle: 2,
    });

    ema20Ref.current = chart.addSeries(LineSeries, {
      color: INDICATOR_COLORS.ema20,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ema50Ref.current = chart.addSeries(LineSeries, {
      color: INDICATOR_COLORS.ema50,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ema200Ref.current = chart.addSeries(LineSeries, {
      color: INDICATOR_COLORS.ema200,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    vwapRef.current = chart.addSeries(LineSeries, {
      color: INDICATOR_COLORS.vwap,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      visible: false,
    });

    chartRef.current = chart;

    // Click handler — add horizontal price line when hline tool is active
    chart.subscribeClick((param) => {
      if (!param.point || !candleSeriesRef.current) return;
      const price = candleSeriesRef.current.coordinateToPrice(param.point.y);
      if (price === null || !isFinite(price)) return;

      if (toolRef.current === "hline") {
        addPriceLineRef.current(price, symbolRef.current);
        return;
      }

      if (toolRef.current === "alert") {
        const cur = lastPriceForAlertsRef.current ?? price;
        addAlertRef.current(price, symbolRef.current, cur);
        return;
      }

      if (toolRef.current === "measure") {
        if (!param.time) return;
        const time = Number(param.time);
        const current = measureRef.current;
        if (current.phase === "idle") {
          setMeasure({ phase: "placing", a: { time, price }, b: { time, price } });
        } else if (current.phase === "placing") {
          setMeasure({ phase: "done", a: current.a, b: { time, price } });
        } else {
          setMeasure({ phase: "placing", a: { time, price }, b: { time, price } });
        }
      }

      if (toolRef.current === "long_position" || toolRef.current === "short_position" || toolRef.current === "position_forecast") {
        const posType = toolRef.current === "long_position" ? "long" : toolRef.current === "short_position" ? "short" : "forecast";
        const draft = positionDraftRef.current;
        if (draft.phase === "idle") {
          setPositionDraft({ phase: "placing", type: posType, entry: price, mouse: price });
        } else if (draft.entry !== null) {
          const entry = draft.entry;
          const stop  = price;
          const risk  = Math.abs(entry - stop);
          const target = posType === "long"
            ? entry + risk * 2
            : posType === "short"
            ? entry - risk * 2
            : price > entry ? entry + risk * 2 : entry - risk * 2;
          addPositionBoxRef.current(entry, stop, target, symbolRef.current, posType);
          setPositionDraft({ phase: "idle", type: posType, entry: null, mouse: null });
        }
      }
    });

    // Crosshair handler
    chart.subscribeCrosshairMove((param) => {
      if (
        toolRef.current === "measure" &&
        measureRef.current.phase === "placing" &&
        param.point &&
        param.time &&
        candleSeriesRef.current
      ) {
        const price = candleSeriesRef.current.coordinateToPrice(param.point.y);
        if (price !== null && isFinite(price)) {
          const time = Number(param.time);
          setMeasure((prev) =>
            prev.phase === "placing" ? { ...prev, b: { time, price } } : prev,
          );
        }
      }

      if (
        (toolRef.current === "long_position" || toolRef.current === "short_position" || toolRef.current === "position_forecast") &&
        positionDraftRef.current.phase === "placing" &&
        param.point &&
        candleSeriesRef.current
      ) {
        const price = candleSeriesRef.current.coordinateToPrice(param.point.y);
        if (price !== null && isFinite(price)) {
          setPositionDraft((prev) => prev.phase === "placing" ? { ...prev, mouse: price } : prev);
        }
      }

      if (!param.time || !candleSeriesRef.current) {
        setHover(null);
        return;
      }
      const data = param.seriesData.get(candleSeriesRef.current);
      const vol = volumeSeriesRef.current
        ? param.seriesData.get(volumeSeriesRef.current)
        : null;
      if (data && "open" in data) {
        const o = data.open as number;
        const c = data.close as number;
        setHover({
          o,
          h: data.high as number,
          l: data.low as number,
          c,
          v: vol && "value" in vol ? (vol.value as number) : 0,
          time: Number(param.time),
          pct: o === 0 ? 0 : ((c - o) / o) * 100,
        });
      }
    });

    // Re-render measure overlay on pan / zoom so pixel coords stay in sync
    const tsRangeHandler = () => setRenderTick((t) => t + 1);
    chart.timeScale().subscribeVisibleTimeRangeChange(tsRangeHandler);
    const logicalRangeHandler = () => {
      setRenderTick((t) => t + 1);
      // Pagination: load more historical bars when user scrolls to the left edge
      const range = chart.timeScale().getVisibleLogicalRange();
      if (!range || loadingMoreRef.current) return;
      if (range.from < 10 && loadedOffsetRef.current > 0 && useNT8) {
        loadingMoreRef.current = true;
        const tf = useChartStore.getState().timeframe;
        fetchNT8Bars(symbol, 500, tf, loadedOffsetRef.current)
          .then((older) => {
            if (older.length === 0) return;
            const existing = candlesRef.current;
            const existingTimes = new Set(existing.map((c) => c.time));
            const merged = [...older.filter((b) => !existingTimes.has(b.time)), ...existing];
            merged.sort((a, b) => a.time - b.time);
            candlesRef.current = merged;
            loadedOffsetRef.current += older.length;
            candleSeriesRef.current?.setData(merged.map((k) => ({
              time: k.time as UTCTimestamp,
              open: k.open, high: k.high, low: k.low, close: k.close,
            })));
            if (volumeSeriesRef.current) {
              volumeSeriesRef.current.setData(merged.map((k) => ({
                time: k.time as UTCTimestamp,
                value: k.volume,
                color: k.close >= k.open ? `${TV_COLORS.green}66` : `${TV_COLORS.red}66`,
              })));
            }
          })
          .catch((e) => console.error("Pagination fetch failed:", e))
          .finally(() => { loadingMoreRef.current = false; });
      }
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(logicalRangeHandler);

    // ResizeObserver — recompute pane offsets when chart container resizes
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => recomputePaneOffsets());
    });
    ro.observe(containerRef.current);
    recomputePaneOffsets();

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(tsRangeHandler);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(logicalRangeHandler);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLinesMapRef.current.clear();
      ema20Ref.current = null;
      ema50Ref.current = null;
      ema200Ref.current = null;
      vwapRef.current = null;
      rsiRef.current = null;
      rsi30Ref.current = null;
      rsi70Ref.current = null;
      macdRef.current = null;
      macdSignalRef.current = null;
      macdHistRef.current = null;
    };
  }, []);

  // Timezone formatter
  useEffect(() => {
    if (!chartRef.current) return;
    const fmtTime = new Intl.DateTimeFormat("en-US", {
      timeZone: chartTimezone, hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const fmtDate = new Intl.DateTimeFormat("en-US", {
      timeZone: chartTimezone, month: "short", day: "numeric",
    });
    const fmtDateTime = new Intl.DateTimeFormat("en-US", {
      timeZone: chartTimezone, month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
    chartRef.current.applyOptions({
      localization: {
        timeFormatter: (t: number) => fmtDateTime.format(new Date(t * 1000)),
      },
      timeScale: {
        tickMarkFormatter: (t: number, type: TickMarkType) => {
          const d = new Date(t * 1000);
          if (type === TickMarkType.Time || type === TickMarkType.TimeWithSeconds)
            return fmtTime.format(d);
          return fmtDate.format(d);
        },
      },
    });
  }, [chartTimezone]);

  // Manage volume — overlay at the bottom of the main pane
  useEffect(() => {
    if (!chartRef.current) return;
    if (indicators.volume && !volumeSeriesRef.current) {
      const v = chartRef.current.addSeries(
        HistogramSeries,
        {
          priceFormat: { type: "volume" },
          priceScaleId: "volume",
          color: TV_COLORS.textMuted,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        0,
      );
      v.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      volumeSeriesRef.current = v;
      const data = candlesRef.current.map((k) => ({
        time: k.time as UTCTimestamp,
        value: k.volume,
        color: k.close >= k.open ? `${TV_COLORS.green}66` : `${TV_COLORS.red}66`,
      }));
      v.setData(data);
    } else if (!indicators.volume && volumeSeriesRef.current && chartRef.current) {
      chartRef.current.removeSeries(volumeSeriesRef.current);
      volumeSeriesRef.current = null;
    }
    requestAnimationFrame(() => recomputePaneOffsets());
  }, [indicators.volume]);

  // RSI pane
  useEffect(() => {
    if (!chartRef.current) return;
    if (indicators.rsi && !rsiRef.current) {
      const paneIndex = 1;
      const r = chartRef.current.addSeries(
        LineSeries,
        {
          color: INDICATOR_COLORS.rsi,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const r30 = chartRef.current.addSeries(
        LineSeries,
        {
          color: TV_COLORS.textMuted,
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const r70 = chartRef.current.addSeries(
        LineSeries,
        {
          color: TV_COLORS.textMuted,
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      rsiRef.current = r;
      rsi30Ref.current = r30;
      rsi70Ref.current = r70;
      try {
        chartRef.current.panes()[1]?.setStretchFactor(1);
        chartRef.current.panes()[0]?.setStretchFactor(3);
      } catch {}
      updateRSI();
    } else if (!indicators.rsi && rsiRef.current && chartRef.current) {
      chartRef.current.removeSeries(rsiRef.current);
      if (rsi30Ref.current) chartRef.current.removeSeries(rsi30Ref.current);
      if (rsi70Ref.current) chartRef.current.removeSeries(rsi70Ref.current);
      rsiRef.current = null;
      rsi30Ref.current = null;
      rsi70Ref.current = null;
    }
    requestAnimationFrame(() => recomputePaneOffsets());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.rsi]);

  // MACD pane
  useEffect(() => {
    if (!chartRef.current) return;
    if (indicators.macd && !macdRef.current) {
      const paneIndex = indicators.rsi ? 2 : 1;
      const m = chartRef.current.addSeries(
        LineSeries,
        {
          color: INDICATOR_COLORS.macd,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const s = chartRef.current.addSeries(
        LineSeries,
        {
          color: TV_COLORS.yellow,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const h = chartRef.current.addSeries(
        HistogramSeries,
        { priceLineVisible: false, lastValueVisible: false },
        paneIndex,
      );
      macdRef.current = m;
      macdSignalRef.current = s;
      macdHistRef.current = h;
      try {
        chartRef.current.panes()[paneIndex]?.setStretchFactor(1);
        chartRef.current.panes()[0]?.setStretchFactor(3);
      } catch {}
      updateMACD();
    } else if (!indicators.macd && macdRef.current && chartRef.current) {
      if (macdRef.current) chartRef.current.removeSeries(macdRef.current);
      if (macdSignalRef.current) chartRef.current.removeSeries(macdSignalRef.current);
      if (macdHistRef.current) chartRef.current.removeSeries(macdHistRef.current);
      macdRef.current = null;
      macdSignalRef.current = null;
      macdHistRef.current = null;
    }
    requestAnimationFrame(() => recomputePaneOffsets());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.macd, indicators.rsi]);

  // Visibility — eye toggle (hidden state) + enabled state combined
  useEffect(() => {
    const v = (key: IndicatorKey) => indicators[key] && !hidden[key];
    ema20Ref.current?.applyOptions({ visible: v("ema20") });
    ema50Ref.current?.applyOptions({ visible: v("ema50") });
    ema200Ref.current?.applyOptions({ visible: v("ema200") });
    vwapRef.current?.applyOptions({ visible: v("vwap") });
    if (rsiRef.current) rsiRef.current.applyOptions({ visible: v("rsi") });
    if (rsi30Ref.current) rsi30Ref.current.applyOptions({ visible: v("rsi") });
    if (rsi70Ref.current) rsi70Ref.current.applyOptions({ visible: v("rsi") });
    if (macdRef.current) macdRef.current.applyOptions({ visible: v("macd") });
    if (macdSignalRef.current) macdSignalRef.current.applyOptions({ visible: v("macd") });
    if (macdHistRef.current) macdHistRef.current.applyOptions({ visible: v("macd") });
    if (volumeSeriesRef.current) volumeSeriesRef.current.applyOptions({ visible: v("volume") });
  }, [indicators, hidden]);

  // Recompute indicators when config changes (periods)
  useEffect(() => {
    updateEMAs();
  }, [config.ema20, config.ema50, config.ema200]);

  useEffect(() => {
    updateRSI();
  }, [config.rsi]);

  useEffect(() => {
    updateMACD();
  }, [config.macdFast, config.macdSlow, config.macdSignal]);

  // Sync price lines from store to the candle series
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;
    const map = priceLinesMapRef.current;
    const linesForThisSymbol = priceLines.filter((p) => p.symbol === symbol);
    const activeIds = new Set(linesForThisSymbol.map((p) => p.id));

    for (const [id, apiLine] of map.entries()) {
      if (!activeIds.has(id)) {
        try {
          series.removePriceLine(apiLine);
        } catch {}
        map.delete(id);
      }
    }
    for (const pl of linesForThisSymbol) {
      if (!map.has(pl.id)) {
        const apiLine = series.createPriceLine({
          price: pl.price,
          color: TV_COLORS.blue,
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "",
        });
        map.set(pl.id, apiLine);
      }
    }
  }, [priceLines, symbol]);

  // Sync alerts to candle series — dashed orange lines with bell icon
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;
    const map = alertLinesMapRef.current;
    const alertsForSymbol = alerts.filter((a) => a.symbol === symbol);
    const activeIds = new Set(alertsForSymbol.map((a) => a.id));

    for (const [id, apiLine] of map.entries()) {
      if (!activeIds.has(id)) {
        try { series.removePriceLine(apiLine); } catch {}
        map.delete(id);
      }
    }
    for (const a of alertsForSymbol) {
      if (!map.has(a.id)) {
        const apiLine = series.createPriceLine({
          price: a.price,
          color: a.triggered ? TV_COLORS.textMuted : "#ffa726",
          lineWidth: 1,
          lineStyle: 1, // dashed
          axisLabelVisible: true,
          title: a.triggered ? "🔕" : "🔔",
        });
        map.set(a.id, apiLine);
      } else {
        const apiLine = map.get(a.id);
        apiLine?.applyOptions({
          color: a.triggered ? TV_COLORS.textMuted : "#ffa726",
          title: a.triggered ? "🔕" : "🔔",
        });
      }
    }
  }, [alerts, symbol]);

  // Recompute all ICT levels when config changes
  useEffect(() => {
    const c = candlesRef.current;
    if (c.length === 0) return;
    setKzBoxes(calculateKillzones(c, ictConfig));
    setOpLevels(calculateOpeningPrices(c, ictConfig));
    setDwmLevels(calculateDWM(c, ictConfig));
    setTsList(calculateTimestamps(c, ictConfig));
  }, [ictConfig]);

  // Recompute FVGs + MSB + OBs when fvgConfig changes
  useEffect(() => {
    const c = candlesRef.current;
    if (c.length === 0 || !indicators.fvg) return;
    setFvgBoxes(calculateFVGs(c, timeframe, fvgConfig));
    const { breaks, swings } = calculateMarketStructure(c, fvgConfig.msbLookback);
    setMsbBreaks(fvgConfig.showMSB ? breaks : []);
    setMsbSwings(fvgConfig.showMSB ? swings : []);
    if (fvgConfig.showOB) {
      const obs = calculateOrderBlocks(c, breaks, fvgConfig.maxOBCount);
      setObBoxes(fvgConfig.showBreaker ? obs : obs.filter((ob) => !ob.isBreaker));
    } else {
      setObBoxes([]);
    }
  }, [fvgConfig, indicators.fvg, timeframe]);

  // Restore full data when exiting replay
  useEffect(() => {
    if (replayActive) return;
    const c = candlesRef.current;
    if (c.length === 0 || !candleSeriesRef.current) return;
    candleSeriesRef.current.setData(c.map((k) => ({
      time: k.time as UTCTimestamp, open: k.open, high: k.high, low: k.low, close: k.close,
    })));
    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.setData(c.map((k) => ({
        time: k.time as UTCTimestamp, value: k.volume,
        color: k.close >= k.open ? `${TV_COLORS.green}66` : `${TV_COLORS.red}66`,
      })));
    }
    updateEMAs(); updateRSI(); updateMACD();
  }, [replayActive]);

  // Replay mode — when active, freeze chart at replayIndex; play advances index
  useEffect(() => {
    if (!replayActive) return;
    const c = candlesRef.current;
    if (c.length === 0) return;

    // On first activation: position at ~80% through history
    if (replayIndex === 0) {
      setReplay({ index: Math.max(50, Math.floor(c.length * 0.8)) });
      return;
    }

    const sliced = c.slice(0, replayIndex + 1);
    candleSeriesRef.current?.setData(sliced.map((k) => ({
      time: k.time as UTCTimestamp, open: k.open, high: k.high, low: k.low, close: k.close,
    })));
    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.setData(sliced.map((k) => ({
        time: k.time as UTCTimestamp, value: k.volume,
        color: k.close >= k.open ? `${TV_COLORS.green}66` : `${TV_COLORS.red}66`,
      })));
    }
    // Update indicators using the sliced view (swap ref temporarily)
    const original = candlesRef.current;
    candlesRef.current = sliced;
    updateEMAs();
    updateRSI();
    updateMACD();
    candlesRef.current = original;
  }, [replayActive, replayIndex, setReplay]);

  // Replay auto-play interval
  useEffect(() => {
    if (!replayActive || !replayPlaying) return;
    const ms = 1000 / replaySpeed;
    const id = setInterval(() => {
      const state = useChartStore.getState();
      if (state.replayIndex >= candlesRef.current.length - 1) {
        setReplay({ playing: false });
        return;
      }
      setReplay({ index: state.replayIndex + 1 });
    }, ms);
    return () => clearInterval(id);
  }, [replayActive, replayPlaying, replaySpeed, setReplay]);

  // Volume Profile — recompute when indicator toggles or candles change
  useEffect(() => {
    if (!indicators.volumeProfile || hidden.volumeProfile) {
      setVProfile(null);
      return;
    }
    // Compute over last 200 bars (visible range approximation)
    const c = candlesRef.current;
    if (c.length === 0) return;
    const recent = c.slice(-200);
    setVProfile(calculateVolumeProfile(recent));
  }, [indicators.volumeProfile, hidden.volumeProfile, renderTick]);

  // ORB price lines — create/remove/show based on orbResult + indicator state
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;
    if (orbHighLineRef.current) {
      try { series.removePriceLine(orbHighLineRef.current); } catch {}
      orbHighLineRef.current = null;
    }
    if (orbLowLineRef.current) {
      try { series.removePriceLine(orbLowLineRef.current); } catch {}
      orbLowLineRef.current = null;
    }
    if (!indicators.orb || hidden.orb || !orbResult) return;
    orbHighLineRef.current = series.createPriceLine({
      price: orbResult.high,
      color: INDICATOR_COLORS.orb,
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "ORB H",
    });
    orbLowLineRef.current = series.createPriceLine({
      price: orbResult.low,
      color: INDICATOR_COLORS.orb,
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "ORB L",
    });
  }, [orbResult, indicators.orb, hidden.orb]);

  // Cursor style when drawing tools are active + reset measure on tool change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.cursor =
        tool === "hline" || tool === "measure" ? "crosshair" : "";
    }
    if (tool !== "measure") setMeasure(INITIAL_MEASURE);
  }, [tool]);

  function updateEMAs() {
    const c = candlesRef.current;
    if (c.length === 0) return;
    const cfg = configRef.current;
    let last20: number | undefined;
    let last50: number | undefined;
    let last200: number | undefined;

    if (ema20Ref.current) {
      const data = ema(c, cfg.ema20);
      ema20Ref.current.setData(
        data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
      last20 = data.at(-1)?.value;
    }
    if (ema50Ref.current) {
      const data = ema(c, cfg.ema50);
      ema50Ref.current.setData(
        data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
      last50 = data.at(-1)?.value;
    }
    if (ema200Ref.current) {
      const data = ema(c, cfg.ema200);
      ema200Ref.current.setData(
        data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
      last200 = data.at(-1)?.value;
    }
    if (vwapRef.current) {
      const data = calculateVWAP(c);
      vwapRef.current.setData(
        data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
    }
    const lastVol = c.at(-1)?.volume;
    setLastValues((prev) => ({
      ...prev,
      ema20: last20,
      ema50: last50,
      ema200: last200,
      volume: lastVol,
    }));
  }

  function updateRSI() {
    const c = candlesRef.current;
    if (c.length === 0 || !rsiRef.current) return;
    const cfg = configRef.current;
    const data = rsi(c, cfg.rsi).map((p) => ({
      time: p.time as UTCTimestamp,
      value: p.value,
    }));
    rsiRef.current.setData(data);
    if (rsi30Ref.current && data.length > 0)
      rsi30Ref.current.setData([
        { time: data[0].time, value: 30 },
        { time: data[data.length - 1].time, value: 30 },
      ]);
    if (rsi70Ref.current && data.length > 0)
      rsi70Ref.current.setData([
        { time: data[0].time, value: 70 },
        { time: data[data.length - 1].time, value: 70 },
      ]);
    setLastValues((prev) => ({ ...prev, rsi: data.at(-1)?.value }));
  }

  function updateMACD() {
    const c = candlesRef.current;
    if (c.length === 0 || !macdRef.current) return;
    const cfg = configRef.current;
    const m = macd(c, cfg.macdFast, cfg.macdSlow, cfg.macdSignal);
    macdRef.current.setData(
      m.map((p) => ({ time: p.time as UTCTimestamp, value: p.macd })),
    );
    macdSignalRef.current?.setData(
      m.map((p) => ({ time: p.time as UTCTimestamp, value: p.signal })),
    );
    macdHistRef.current?.setData(
      m.map((p) => ({
        time: p.time as UTCTimestamp,
        value: p.histogram,
        color: p.histogram >= 0 ? `${TV_COLORS.green}80` : `${TV_COLORS.red}80`,
      })),
    );
    const last = m.at(-1);
    setLastValues((prev) => ({
      ...prev,
      macd: last?.macd,
      macdSignal: last?.signal,
      macdHist: last?.histogram,
    }));
  }

  // Load historical data + subscribe live
  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;

    async function load() {
      setLoading(true);
      if (useTradovate) {
        const tvWS = getTradovateWS();
        let initialized = false;
        try {
          const subKey = await tvWS.subscribeChart(symbol, timeframe, (bars, isRealtime) => {
            if (cancelled) return;
            candlesRef.current = bars;
            if (candleSeriesRef.current) {
              candleSeriesRef.current.setData(
                bars.map((k) => ({
                  time: k.time as UTCTimestamp,
                  open: k.open,
                  high: k.high,
                  low: k.low,
                  close: k.close,
                }))
              );
            }
            if (volumeSeriesRef.current) {
              volumeSeriesRef.current.setData(
                bars.map((k) => ({
                  time: k.time as UTCTimestamp,
                  value: k.volume,
                  color: k.close >= k.open ? `${TV_COLORS.green}66` : `${TV_COLORS.red}66`,
                }))
              );
            }
            updateEMAs();
            updateRSI();
            updateMACD();
            
            if (bars.length > 0) {
              const last = bars[bars.length - 1];
              const prev = bars[bars.length - 2] ?? last;
              setLastPrice({
                value: last.close,
                pct: prev.close === 0 ? 0 : ((last.close - prev.close) / prev.close) * 100,
              });

              // Handle alerts cross detection on realtime tick
              if (isRealtime && lastPriceForAlertsRef.current !== null) {
                const price = last.close;
                const sym = symbolRef.current;
                const prevP = lastPriceForAlertsRef.current;
                for (const a of alertsRef.current) {
                  if (a.triggered || a.symbol !== sym) continue;
                  const crossed = (prevP < a.price && price >= a.price) || (prevP > a.price && price <= a.price);
                  if (crossed) {
                    triggerAlertRef.current(a.id);
                    void import("@/lib/alerts/beep").then((m) => m.playAlertBeep());
                  }
                }
              }
              lastPriceForAlertsRef.current = last.close;
            }

            if (!initialized && isRealtime) {
              initialized = true;
              setLoading(false);
              chartRef.current?.timeScale().applyOptions({ barSpacing: 8 });
              chartRef.current?.timeScale().scrollToPosition(0, false);
              requestAnimationFrame(() => recomputePaneOffsets());

              if (bars.length > 0) {
                setOrbResult(calculateORB(bars));
                const cfg = ictConfigRef.current;
                setKzBoxes(calculateKillzones(bars, cfg));
                setOpLevels(calculateOpeningPrices(bars, cfg));
                setDwmLevels(calculateDWM(bars, cfg));
                setTsList(calculateTimestamps(bars, cfg));
                setFvgBoxes(calculateFVGs(bars, timeframe, fvgConfigRef.current));
                const { breaks: msbBrks, swings: msbSws } = calculateMarketStructure(bars, fvgConfigRef.current.msbLookback);
                setMsbBreaks(fvgConfigRef.current.showMSB ? msbBrks : []);
                setMsbSwings(fvgConfigRef.current.showMSB ? msbSws  : []);
                if (fvgConfigRef.current.showOB) {
                  const obs = calculateOrderBlocks(bars, msbBrks, fvgConfigRef.current.maxOBCount);
                  setObBoxes(fvgConfigRef.current.showBreaker ? obs : obs.filter((ob) => !ob.isBreaker));
                }
              }
            }
          });
          unsub = () => {
            void tvWS.unsubscribeChart(symbol, timeframe);
          };
        } catch (e) {
          console.error("Tradovate subscription failed:", e);
          setLoading(false);
        }
        return;
      }

      try {
        const klines = isCrypto
          ? await fetchBinanceKlines(symbol, timeframe, 500)
          : useNT8
          ? await fetchNT8Bars(symbol, 500, timeframe)
          : await fetchKlines(symbol, timeframe, 500);
        loadedOffsetRef.current = klines.length;
        if (cancelled) return;
        candlesRef.current = klines;
        if (candleSeriesRef.current) {
          candleSeriesRef.current.setData(
            klines.map((k) => ({
              time: k.time as UTCTimestamp,
              open: k.open,
              high: k.high,
              low: k.low,
              close: k.close,
            })),
          );
        }
        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.setData(
            klines.map((k) => ({
              time: k.time as UTCTimestamp,
              value: k.volume,
              color: k.close >= k.open ? `${TV_COLORS.green}66` : `${TV_COLORS.red}66`,
            })),
          );
        }
        updateEMAs();
        updateRSI();
        updateMACD();
        chartRef.current?.timeScale().applyOptions({ barSpacing: 8 });
        chartRef.current?.timeScale().scrollToPosition(0, false);
        requestAnimationFrame(() => recomputePaneOffsets());

        if (klines.length > 0) {
          const last = klines[klines.length - 1];
          const prev = klines[klines.length - 2] ?? last;
          setLastPrice({
            value: last.close,
            pct: prev.close === 0 ? 0 : ((last.close - prev.close) / prev.close) * 100,
          });
        }

        setOrbResult(calculateORB(klines));
        const cfg = ictConfigRef.current;
        setKzBoxes(calculateKillzones(klines, cfg));
        setOpLevels(calculateOpeningPrices(klines, cfg));
        setDwmLevels(calculateDWM(klines, cfg));
        setTsList(calculateTimestamps(klines, cfg));
        setFvgBoxes(calculateFVGs(klines, timeframe, fvgConfigRef.current));
        const { breaks: msbBrks, swings: msbSws } = calculateMarketStructure(klines, fvgConfigRef.current.msbLookback);
        setMsbBreaks(fvgConfigRef.current.showMSB ? msbBrks : []);
        setMsbSwings(fvgConfigRef.current.showMSB ? msbSws  : []);
        if (fvgConfigRef.current.showOB) {
          const obs = calculateOrderBlocks(klines, msbBrks, fvgConfigRef.current.maxOBCount);
          setObBoxes(fvgConfigRef.current.showBreaker ? obs : obs.filter((ob) => !ob.isBreaker));
        }

        // Helper: apply a price update to the current candle
        const applyLivePrice = (tick: { price: number; symbol?: string }) => {
          if (!candleSeriesRef.current) return;
          if (useChartStore.getState().replayActive) return; // pause during replay
          if (tick.symbol) {
            const symPrefix = symbol.split(/[=-]/)[0].toUpperCase();
            const nt8Prefix = tick.symbol.split(/\s/)[0].toUpperCase();
            if (symPrefix !== nt8Prefix) return;
          }
          const price = tick.price;
          const arr = candlesRef.current;
          if (arr.length === 0) return;
          // Check alerts
          const sym = symbolRef.current;
          const prevP = lastPriceForAlertsRef.current;
          if (prevP !== null) {
            for (const a of alertsRef.current) {
              if (a.triggered || a.symbol !== sym) continue;
              const crossed = (prevP < a.price && price >= a.price) || (prevP > a.price && price <= a.price);
              if (crossed) {
                triggerAlertRef.current(a.id);
                void import("@/lib/alerts/beep").then((m) => m.playAlertBeep());
              }
            }
          }
          lastPriceForAlertsRef.current = price;
          const last = arr[arr.length - 1];
          const updated = {
            ...last,
            high: Math.max(last.high, price),
            low: Math.min(last.low, price),
            close: price,
          };
          arr[arr.length - 1] = updated;
          candleSeriesRef.current.update({
            time: last.time as UTCTimestamp,
            open: updated.open,
            high: updated.high,
            low: updated.low,
            close: updated.close,
          });
          updateEMAs();
          updateRSI();
          updateMACD();
          const prev = arr[arr.length - 2] ?? last;
          setLastPrice({
            value: price,
            pct: prev.close !== 0 ? ((price - prev.close) / prev.close) * 100 : 0,
          });
        };

        const TF_SECS: Partial<Record<Timeframe, number>> = {
          "5m": 300, "15m": 900, "30m": 1800, "1h": 3600, "4h": 14400,
        };
        const bucketSecs = TF_SECS[timeframe]; // undefined = 1m (no aggregation)

        // Track last 1m bar to compute incremental volume for aggregated buckets
        let lastBarTime = -1;
        let lastBarVolume = 0;

        const applyFullBar = (b: { type: "bar" | "bar_close"; symbol?: string; time: number; open: number; high: number; low: number; close: number; volume: number }) => {
          if (!candleSeriesRef.current) return;
          if (useChartStore.getState().replayActive) return; // pause during replay
          if (b.symbol) {
            const symPrefix = symbol.split(/[=-]/)[0].toUpperCase();
            const nt8Prefix = b.symbol.split(/\s/)[0].toUpperCase();
            if (symPrefix !== nt8Prefix) return;
          }
          const arr = candlesRef.current;

          if (!bucketSecs) {
            // ── 1m: use NT8 values directly, no aggregation ──────────────
            const last = arr[arr.length - 1];
            if (last && last.time === b.time) {
              // NT8 already tracks running H/L/volume — just SET
              last.open   = b.open;
              last.high   = b.high;
              last.low    = b.low;
              last.close  = b.close;
              last.volume = b.volume;
            } else if (b.time > (last?.time ?? 0)) {
              arr.push({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume });
            }
          } else {
            // ── Aggregated (5m, 15m…): bucket 1m bars ────────────────────
            const bucketTime = Math.floor(b.time / bucketSecs) * bucketSecs;
            const last = arr[arr.length - 1];

            // Incremental volume: NT8 sends cumulative within the 1m bar
            const isNewBar = b.time !== lastBarTime;
            const volDelta = isNewBar ? b.volume : b.volume - lastBarVolume;
            lastBarTime   = b.time;
            lastBarVolume = b.volume;

            if (last && last.time === bucketTime) {
              last.high   = Math.max(last.high, b.high);
              last.low    = Math.min(last.low, b.low);
              last.close  = b.close;
              last.volume += volDelta;
            } else if (bucketTime > (last?.time ?? 0)) {
              arr.push({ time: bucketTime, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume });
            }
          }

          const cur = arr[arr.length - 1];
          candleSeriesRef.current.update({ time: cur.time as UTCTimestamp, open: cur.open, high: cur.high, low: cur.low, close: cur.close });
          updateEMAs();
          updateRSI();
          updateMACD();
          if (b.type === "bar_close") {
            const cfg = fvgConfigRef.current;
            setFvgBoxes(calculateFVGs(arr, timeframe, cfg));
            const { breaks: msbBrks2, swings: msbSws2 } = calculateMarketStructure(arr, cfg.msbLookback);
            setMsbBreaks(cfg.showMSB ? msbBrks2 : []);
            setMsbSwings(cfg.showMSB ? msbSws2  : []);
            if (cfg.showOB) {
              const obs = calculateOrderBlocks(arr, msbBrks2, cfg.maxOBCount);
              setObBoxes(cfg.showBreaker ? obs : obs.filter((ob) => !ob.isBreaker));
            }
          }
          const prev = arr[arr.length - 2];
          setLastPrice({
            value: b.close,
            pct: prev && prev.close !== 0 ? ((b.close - prev.close) / prev.close) * 100 : 0,
          });
        };

        if (isCrypto) {
          // Binance kline WS — sends candle at display TF directly, no bucketing needed
          const bws = getBinanceKlineWS();
          unsub = bws.subscribe(symbol, timeframe, (k) => {
            if (!candleSeriesRef.current) return;
            if (useChartStore.getState().replayActive) return;
            const arr = candlesRef.current;
            const last = arr[arr.length - 1];
            if (last && last.time === k.time) {
              last.open = k.open; last.high = k.high; last.low = k.low; last.close = k.close; last.volume = k.volume;
            } else if (k.time > (last?.time ?? 0)) {
              arr.push({ time: k.time, open: k.open, high: k.high, low: k.low, close: k.close, volume: k.volume });
            }
            const cur = arr[arr.length - 1];
            candleSeriesRef.current.update({ time: cur.time as UTCTimestamp, open: cur.open, high: cur.high, low: cur.low, close: cur.close });
            updateEMAs(); updateRSI(); updateMACD();
            const prev = arr[arr.length - 2];
            setLastPrice({
              value: k.close,
              pct: prev && prev.close !== 0 ? ((k.close - prev.close) / prev.close) * 100 : 0,
            });
          });
        } else if (useNT8) {
          const nt8ws = getNT8WS();
          // tick = precio en cada trade (frecuencia alta, mantiene close vivo)
          // bar  = OHLCV completo del bar 1m (necesario para H/L exactos)
          const u1 = nt8ws.subscribeTick(applyLivePrice);
          const u2 = nt8ws.subscribeBar(applyFullBar);
          unsub = () => { u1(); u2(); };
        } else {
          // Fallback to Yahoo Finance Poller
          const poller = getYahooPoller();
          unsub = poller.subscribeKline({
            symbol,
            interval: timeframe,
            onCandle: (k) => {
              if (!candleSeriesRef.current) return;
              if (useChartStore.getState().replayActive) return;
              const arr = candlesRef.current;
              const last = arr[arr.length - 1];
              if (last && last.time === k.time) {
                last.open = k.open; last.high = k.high; last.low = k.low; last.close = k.close; last.volume = k.volume;
              } else if (k.time > (last?.time ?? 0)) {
                arr.push({ time: k.time, open: k.open, high: k.high, low: k.low, close: k.close, volume: k.volume });
              }
              const cur = arr[arr.length - 1];
              candleSeriesRef.current.update({ time: cur.time as UTCTimestamp, open: cur.open, high: cur.high, low: cur.low, close: cur.close });
              updateEMAs(); updateRSI(); updateMACD();
              const prev = arr[arr.length - 2];
              setLastPrice({
                value: k.close,
                pct: prev && prev.close !== 0 ? ((k.close - prev.close) / prev.close) * 100 : 0,
              });
            }
          });
        }
      } catch (e) {
        console.error("Failed to load chart data:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [symbol, timeframe, useNT8, useTradovate]);

  const greenOrRed = (n: number) =>
    n >= 0 ? "text-tv-green" : "text-tv-red";

  // Helpers for pill rendering
  const isShown = (key: IndicatorKey) =>
    indicators[key] && (key === "volume" || true); // always renderable if enabled
  void isShown;

  // Determine which pane each indicator lives in (based on current layout)
  const rsiPaneIdx = 1;
  const macdPaneIdx = indicators.rsi ? 2 : 1;

  // Position boxes render
  let positionRender: React.ReactNode = null;
  if (chartRef.current && candleSeriesRef.current && containerRef.current) {
    const series = candleSeriesRef.current;
    const containerW = containerRef.current.getBoundingClientRect().width;

    const toY = (p: number) => series.priceToCoordinate(p);

    const boxCoords = positionBoxes
      .filter((b) => b.symbol === symbol)
      .flatMap((b) => {
        const entryY = toY(b.entry);
        const stopY  = toY(b.stop);
        const targetY = toY(b.target);
        if (entryY === null || stopY === null || targetY === null) return [];
        return [{ box: b, entryY, stopY, targetY }];
      });

    let draftCoords: Parameters<typeof PositionOverlay>[0]["draft"] = null;
    if (positionDraft.phase === "placing" && positionDraft.entry !== null && positionDraft.mouse !== null) {
      const entry  = positionDraft.entry;
      const stop   = positionDraft.mouse;
      const risk   = Math.abs(entry - stop);
      const type   = positionDraft.type;
      const target = type === "long"
        ? entry + risk * 2
        : type === "short"
        ? entry - risk * 2
        : stop > entry ? entry + risk * 2 : entry - risk * 2;
      const entryY  = toY(entry);
      const stopY   = toY(stop);
      const targetY = toY(target);
      if (entryY !== null && stopY !== null && targetY !== null) {
        draftCoords = { type, entryY, stopY, targetY, entry, stop, target, rr: risk === 0 ? 0 : risk * 2 / risk };
      }
    }

    if (boxCoords.length > 0 || draftCoords) {
      positionRender = (
        <PositionOverlay
          boxes={boxCoords}
          draft={draftCoords}
          chartWidth={containerW}
          onRemove={removePositionBox}
        />
      );
    }
  }

  let measureRender: React.ReactNode = null;
  if (
    measure.a &&
    measure.b &&
    chartRef.current &&
    candleSeriesRef.current
  ) {
    const ts = chartRef.current.timeScale();
    const aX = ts.timeToCoordinate(measure.a.time as UTCTimestamp);
    const bX = ts.timeToCoordinate(measure.b.time as UTCTimestamp);
    const aY = candleSeriesRef.current.priceToCoordinate(measure.a.price);
    const bY = candleSeriesRef.current.priceToCoordinate(measure.b.price);

    if (aX !== null && bX !== null && aY !== null && bY !== null) {
      const priceDiff = measure.b.price - measure.a.price;
      const pctChange =
        measure.a.price === 0 ? 0 : (priceDiff / measure.a.price) * 100;
      const isUp = priceDiff >= 0;
      const start = Math.min(measure.a.time, measure.b.time);
      const end = Math.max(measure.a.time, measure.b.time);
      const inRange = candlesRef.current.filter(
        (c) => c.time >= start && c.time <= end,
      );
      const bars = inRange.length;
      const volume = inRange.reduce((s, c) => s + c.volume, 0);
      const dur = durationLabel(measure.a.time, measure.b.time);

      measureRender = (
        <MeasureOverlay
          aX={aX}
          aY={aY}
          bX={bX}
          bY={bY}
          priceDiff={priceDiff}
          pctChange={pctChange}
          bars={bars}
          volume={volume}
          durationText={dur}
          isUp={isUp}
          isPreview={measure.phase === "placing"}
        />
      );
    }
  }
  void renderTick;

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#131722]/70 z-50">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-tv-blue border-t-transparent" />
            <span className="text-xs text-tv-text-muted">Cargando barras…</span>
          </div>
        </div>
      )}
      {candlesRef.current.length === 0 && !loading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="text-2xl">📡</span>
            <span className="text-sm font-medium text-tv-text-muted">Sin datos de cotización</span>
            <span className="text-xs text-tv-text-muted/60">Verifica la conexión a internet o NinjaTrader 8</span>
          </div>
        </div>
      )}
      {indicators.volumeProfile && !hidden.volumeProfile && vProfile && chartRef.current && candleSeriesRef.current && (
        <VolumeProfileOverlay
          chart={chartRef.current}
          series={candleSeriesRef.current}
          profile={vProfile}
          paneHeight={paneOffsets[0]?.height ?? 400}
        />
      )}
      {indicators.fvg && !hidden.fvg && chartRef.current && candleSeriesRef.current && fvgBoxes.length > 0 && (
        <FVGOverlay
          chart={chartRef.current}
          series={candleSeriesRef.current}
          boxes={fvgBoxes}
          paneHeight={paneOffsets[0]?.height ?? 400}
        />
      )}
      {indicators.fvg && !hidden.fvg && fvgConfig.showOB && chartRef.current && candleSeriesRef.current && obBoxes.length > 0 && (
        <OrderBlockOverlay
          chart={chartRef.current}
          series={candleSeriesRef.current}
          boxes={obBoxes}
        />
      )}
      {indicators.fvg && !hidden.fvg && fvgConfig.showMSB && chartRef.current && candleSeriesRef.current && (
        <MarketStructureOverlay
          chart={chartRef.current}
          series={candleSeriesRef.current}
          breaks={msbBreaks}
          swings={msbSwings}
          showSwings={fvgConfig.showSwings}
        />
      )}
      <FvgSettingsDialog open={fvgSettingsOpen} onClose={() => setFvgSettingsOpen(false)} />
      {indicators.ict && !hidden.ict && chartRef.current && candleSeriesRef.current && kzBoxes.length > 0 && (
        <KillzonesOverlay
          chart={chartRef.current}
          series={candleSeriesRef.current}
          boxes={kzBoxes}
          config={ictConfig}
        />
      )}
      <IctSettingsDialog open={ictSettingsOpen} onClose={() => setIctSettingsOpen(false)} />
      {indicators.ict && !hidden.ict && chartRef.current && candleSeriesRef.current && (
        <LevelsOverlay
          chart={chartRef.current}
          series={candleSeriesRef.current}
          openingPrices={opLevels}
          dwm={dwmLevels}
          timestamps={tsList}
          textColor={ictConfig.textColor}
          labelSize={ictConfig.labelSize}
          paneHeight={paneOffsets[0]?.height ?? 400}
        />
      )}
      {positionRender}
      {measureRender}

      {/* Top-left of main pane: symbol info + OHLC + Volume pill + EMA pills */}
      <div
        style={{ top: (paneOffsets[0]?.top ?? 0) + 12, left: 12 }}
        className="pointer-events-none absolute z-10 flex flex-col gap-1 text-xs tabular-nums"
      >
        {/* Row 1: symbol info + OHLC stats inline on hover (fixed height, never wraps) */}
        <div className="flex h-5 flex-nowrap items-center gap-x-3 overflow-hidden whitespace-nowrap">
          <div className="flex shrink-0 items-center gap-2 text-[13px] font-semibold">
            <span className="text-tv-text">{symbol}</span>
            <span className="text-tv-text-muted">·</span>
            <span className="uppercase text-tv-text-muted">{timeframe}</span>
            <span className="text-tv-text-muted">·</span>
            <span className="text-tv-text-muted">
              {isCrypto
                ? `Binance · ${symbol.replace("-USD", "USDT")}`
                : useTradovate ? "Tradovate"
                : useNT8 ? `NT8 · ${matchingInstrument}`
                : "Yahoo Finance"}
            </span>
          </div>
          {hover && (
            <div className="flex items-center gap-x-3 text-[11px]">
              <span className="text-tv-text-muted">
                O <span className={greenOrRed(hover.c - hover.o)}>{formatPrice(hover.o)}</span>
              </span>
              <span className="text-tv-text-muted">
                H <span className={greenOrRed(hover.c - hover.o)}>{formatPrice(hover.h)}</span>
              </span>
              <span className="text-tv-text-muted">
                L <span className={greenOrRed(hover.c - hover.o)}>{formatPrice(hover.l)}</span>
              </span>
              <span className="text-tv-text-muted">
                C <span className={greenOrRed(hover.c - hover.o)}>{formatPrice(hover.c)}</span>
              </span>
              <span className={greenOrRed(hover.pct)}>
                {hover.pct >= 0 ? "+" : ""}
                {hover.pct.toFixed(2)}%
              </span>
              <span className="text-tv-text-muted">
                Vol <span className="text-tv-text">{formatVolume(hover.v)}</span>
              </span>
            </div>
          )}
        </div>

        {/* Row 2: big live price (always present — reserves space even while loading) */}
        <div className="flex h-7 items-center gap-2">
          {lastPrice ? (
            <>
              <span className={`text-lg font-semibold tabular-nums ${greenOrRed(lastPrice.pct)}`}>
                {formatPrice(lastPrice.value)}
              </span>
              <span className={`text-xs ${greenOrRed(lastPrice.pct)}`}>
                {lastPrice.pct >= 0 ? "+" : ""}
                {lastPrice.pct.toFixed(2)}%
              </span>
            </>
          ) : (
            <span className="text-xs text-tv-text-muted">Cargando…</span>
          )}
        </div>

        {/* Indicator pills for the main pane (fixed position below price) */}
        <div className="mt-1 flex flex-col items-start gap-1">
          {indicators.ema20 && (
            <IndicatorPill
              name={`EMA ${config.ema20}`}
              value={lastValues.ema20 !== undefined ? formatPrice(lastValues.ema20) : undefined}
              color={INDICATOR_COLORS.ema20}
              hidden={hidden.ema20}
              onToggleHide={() => toggleHidden("ema20")}
              onSettings={() => setSettingsTarget("ema20")}
              onRemove={() => removeIndicator("ema20")}
            />
          )}
          {indicators.ema50 && (
            <IndicatorPill
              name={`EMA ${config.ema50}`}
              value={lastValues.ema50 !== undefined ? formatPrice(lastValues.ema50) : undefined}
              color={INDICATOR_COLORS.ema50}
              hidden={hidden.ema50}
              onToggleHide={() => toggleHidden("ema50")}
              onSettings={() => setSettingsTarget("ema50")}
              onRemove={() => removeIndicator("ema50")}
            />
          )}
          {indicators.ema200 && (
            <IndicatorPill
              name={`EMA ${config.ema200}`}
              value={lastValues.ema200 !== undefined ? formatPrice(lastValues.ema200) : undefined}
              color={INDICATOR_COLORS.ema200}
              hidden={hidden.ema200}
              onToggleHide={() => toggleHidden("ema200")}
              onSettings={() => setSettingsTarget("ema200")}
              onRemove={() => removeIndicator("ema200")}
            />
          )}
          {indicators.volume && (
            <IndicatorPill
              name="Vol"
              value={lastValues.volume !== undefined ? formatVolume(lastValues.volume) : undefined}
              color={INDICATOR_COLORS.volume}
              hidden={hidden.volume}
              onToggleHide={() => toggleHidden("volume")}
              onSettings={() => setSettingsTarget("volume")}
              onRemove={() => removeIndicator("volume")}
            />
          )}
          {indicators.orb && (
            <IndicatorPill
              name="ORB"
              value={orbResult ? `${orbResult.rangePoints.toFixed(0)} pts` : undefined}
              color={INDICATOR_COLORS.orb}
              hidden={hidden.orb}
              onToggleHide={() => toggleHidden("orb")}
              onSettings={() => {}}
              onRemove={() => removeIndicator("orb")}
            />
          )}
          {indicators.ict && (
            <IndicatorPill
              name="ICT KZ"
              value={kzBoxes.length > 0 ? `${kzBoxes.length} sess` : undefined}
              color={INDICATOR_COLORS.ict}
              hidden={hidden.ict}
              onToggleHide={() => toggleHidden("ict")}
              onSettings={() => setIctSettingsOpen(true)}
              onRemove={() => removeIndicator("ict")}
            />
          )}
          {indicators.fvg && (
            <IndicatorPill
              name="FVG / OB"
              value={`${fvgBoxes.filter((b) => b.mitigation === "none").length} activos`}
              color={INDICATOR_COLORS.fvg}
              hidden={hidden.fvg}
              onToggleHide={() => toggleHidden("fvg")}
              onSettings={() => setFvgSettingsOpen(true)}
              onRemove={() => removeIndicator("fvg")}
            />
          )}
        </div>
      </div>

      {/* RSI pane label */}
      {indicators.rsi && paneOffsets[rsiPaneIdx] && (
        <div
          style={{ top: paneOffsets[rsiPaneIdx].top + 6, left: 12 }}
          className="pointer-events-none absolute z-10"
        >
          <IndicatorPill
            name={`RSI ${config.rsi}`}
            value={lastValues.rsi !== undefined ? lastValues.rsi.toFixed(2) : undefined}
            color={INDICATOR_COLORS.rsi}
            hidden={hidden.rsi}
            onToggleHide={() => toggleHidden("rsi")}
            onSettings={() => setSettingsTarget("rsi")}
            onRemove={() => removeIndicator("rsi")}
          />
        </div>
      )}

      {/* MACD pane label */}
      {indicators.macd && paneOffsets[macdPaneIdx] && (
        <div
          style={{ top: paneOffsets[macdPaneIdx].top + 6, left: 12 }}
          className="pointer-events-none absolute z-10"
        >
          <IndicatorPill
            name={`MACD ${config.macdFast}, ${config.macdSlow}, ${config.macdSignal}`}
            value={
              lastValues.macd !== undefined
                ? `${lastValues.macd.toFixed(2)} / ${(lastValues.macdSignal ?? 0).toFixed(2)}`
                : undefined
            }
            color={INDICATOR_COLORS.macd}
            hidden={hidden.macd}
            onToggleHide={() => toggleHidden("macd")}
            onSettings={() => setSettingsTarget("macd")}
            onRemove={() => removeIndicator("macd")}
          />
        </div>
      )}
    </div>
  );
}
