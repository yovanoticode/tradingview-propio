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
import { getNT8WS, nt8TimestampCorrection } from "@/lib/nt8/ws";
import { fetchKlines } from "@/lib/yahoo/rest";
import { getYahooPoller } from "@/lib/yahoo/ws";
import { getTradovateWS } from "@/lib/tradovate/ws";
import { ema, rsi, macd, stochastic } from "@/lib/indicators";
import { calculateORB, type ORBResult } from "@/lib/indicators/orb";
import { calculateVWAP } from "@/lib/indicators/vwap";
import { Minus, Plus, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { calculateVolumeProfile, type VolumeProfile } from "@/lib/indicators/volumeProfile";
import { VolumeProfileOverlay } from "./VolumeProfileOverlay";
import { calculateKillzones, type KZBox } from "@/lib/indicators/killzones";
import { calculateMacros, type MacroBox } from "@/lib/indicators/ict-macros";
import { calculateFVGs, type FVGBox } from "@/lib/indicators/fvg";
import { calculateOrderBlocks, type OBBox } from "@/lib/indicators/orderBlocks";
import { calculateMarketStructure, type StructureBreak, type SwingPoint } from "@/lib/indicators/marketStructure";
import { calculateOTE, type OTELevels } from "@/lib/indicators/ote";
import { OTEOverlay } from "./OTEOverlay";
import { FVGOverlay } from "./FVGOverlay";
import { OrderBlockOverlay } from "./OrderBlockOverlay";
import { MarketStructureOverlay } from "./MarketStructureOverlay";
import { FvgSettingsDialog } from "./FvgSettingsDialog";
import { KillzonesOverlay } from "./KillzonesOverlay";
import { IctMacrosOverlay } from "./ICTMacrosOverlay";
import { AMDOverlay } from "./AMDOverlay";
import { LevelsOverlay } from "./LevelsOverlay";
import { calculateAMD, type AMDDay } from "@/lib/indicators/amd";
import { calculateDailyBias, type DailyBias } from "@/lib/indicators/bias";
import { IctSettingsDialog } from "./IctSettingsDialog";
import { MacrosSettingsDialog } from "./MacrosSettingsDialog";
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
import { FibonacciOverlay } from "./FibonacciOverlay";
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
  ema9?: number;
  ema20?: number;
  ema21?: number;
  ema50?: number;
  ema200?: number;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  macdHist?: number;
  stochK?: number;
  stochD?: number;
  volume?: number;
}

interface PaneOffset {
  top: number;
  height: number;
  width: number;
}

export function PriceChart({ symbol, timeframe, slotIndex = 0 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema9Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema21Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema200Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsi30Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rsi70Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const macdRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSignalRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdHistRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const stochKRef = useRef<ISeriesApi<"Line"> | null>(null);
  const stochDRef = useRef<ISeriesApi<"Line"> | null>(null);
  const stoch20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const stoch80Ref = useRef<ISeriesApi<"Line"> | null>(null);

  const candlesRef = useRef<Candle[]>([]);
  const priceLinesMapRef = useRef<Map<string, IPriceLine>>(new Map());
  const alertLinesMapRef = useRef<Map<string, IPriceLine>>(new Map());

  const ictConfig = useChartStore((s) => s.ictConfig);
  const macrosConfig = useChartStore((s) => s.macrosConfig);
  const macrosConfigRef = useRef(macrosConfig);
  macrosConfigRef.current = macrosConfig;
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
  const nt8Pos = useChartStore((s) => s.nt8Position);

  // Sync state between config / items / drawings
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
  const fibonaccis = useChartStore((s) => s.fibonaccis);
  const addFibonacci = useChartStore((s) => s.addFibonacci);
  const removeFibonacci = useChartStore((s) => s.removeFibonacci);
  const addPositionBox = useChartStore((s) => s.addPositionBox);
  const removePositionBox = useChartStore((s) => s.removePositionBox);
  const removePriceLine = useChartStore((s) => s.removePriceLine);

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
  const configRef = useRef(config);
  const ictConfigRef = useRef(ictConfig);
  const priceLinesRef = useRef(priceLines);
  const positionBoxesRef = useRef(positionBoxes);
  const fibonaccisRef = useRef(fibonaccis);
  const removePriceLineRef = useRef(removePriceLine);
  const removeAlertRef = useRef(removeAlert);
  const removePositionBoxRef = useRef(removePositionBox);
  const removeFibonacciRef = useRef(removeFibonacci);

  symbolRef.current = symbol;
  configRef.current = config;
  ictConfigRef.current = ictConfig;
  priceLinesRef.current = priceLines;
  positionBoxesRef.current = positionBoxes;
  fibonaccisRef.current = fibonaccis;
  removePriceLineRef.current = removePriceLine;
  removeAlertRef.current = removeAlert;
  removePositionBoxRef.current = removePositionBox;
  removeFibonacciRef.current = removeFibonacci;

  const orbHighLineRef = useRef<IPriceLine | null>(null);
  const orbLowLineRef = useRef<IPriceLine | null>(null);

  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [lastPrice, setLastPrice] = useState<{ value: number; pct: number } | null>(null);
  const [lastValues, setLastValues] = useState<LastValues>({});
  const [orbResult, setOrbResult] = useState<ORBResult | null>(null);
  const [kzBoxes, setKzBoxes] = useState<KZBox[]>([]);
  const [amdDays, setAmdDays] = useState<AMDDay[]>([]);
  const [dailyBias, setDailyBias] = useState<DailyBias>("Neutral");
  const [macroBoxes, setMacroBoxes] = useState<MacroBox[]>([]);
  const [fvgBoxes, setFvgBoxes] = useState<FVGBox[]>([]);
  const [obBoxes,  setObBoxes]  = useState<OBBox[]>([]);
  const [msbBreaks, setMsbBreaks] = useState<StructureBreak[]>([]);
  const [msbSwings, setMsbSwings] = useState<SwingPoint[]>([]);
  const [oteData, setOteData] = useState<OTELevels | null>(null);
  const [fvgSettingsOpen, setFvgSettingsOpen] = useState(false);
  const [opLevels, setOpLevels] = useState<HorizLevel[]>([]);
  const [dwmLevels, setDwmLevels] = useState<HorizLevel[]>([]);
  const [tsList, setTsList] = useState<VertLine[]>([]);
  const [vProfile, setVProfile] = useState<VolumeProfile | null>(null);
  const [ictSettingsOpen, setIctSettingsOpen] = useState(false);
  const [macrosSettingsOpen, setMacrosSettingsOpen] = useState(false);
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

  interface FibonacciDraft {
    phase: "idle" | "placing";
    a: { time: number; price: number };
    b: { time: number; price: number };
  }
  const [fiboDraft, setFiboDraft] = useState<FibonacciDraft>({ phase: "idle", a: { time: 0, price: 0 }, b: { time: 0, price: 0 } });
  const fiboDraftRef = useRef(fiboDraft);
  fiboDraftRef.current = fiboDraft;
  const addFibonacciRef = useRef(addFibonacci);
  addFibonacciRef.current = addFibonacci;

  // Helper — compute pane top offsets from chart layout
  function recomputePaneOffsets() {
    if (!chartRef.current || !containerRef.current) return;
    const panes = chartRef.current.panes();
    const containerW = containerRef.current.clientWidth;
    let top = 0;
    const offsets: PaneOffset[] = panes.map((p) => {
      const h = p.getHeight();
      const o = { top, height: h, width: containerW };
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

    ema9Ref.current = chart.addSeries(LineSeries, {
      color: INDICATOR_COLORS.ema9,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ema20Ref.current = chart.addSeries(LineSeries, {
      color: INDICATOR_COLORS.ema20,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ema21Ref.current = chart.addSeries(LineSeries, {
      color: INDICATOR_COLORS.ema21,
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

      if (toolRef.current === "eraser") {
        const clickY = param.point.y;
        let removed = false;

        // 1. priceLines
        for (const pl of priceLinesRef.current) {
          if (pl.symbol !== symbolRef.current) continue;
          const y = candleSeriesRef.current.priceToCoordinate(pl.price);
          if (y !== null && Math.abs(y - clickY) < 15) {
            removePriceLineRef.current(pl.id);
            removed = true;
            break;
          }
        }
        if (removed) return;

        // 2. alerts
        for (const al of alertsRef.current) {
          if (al.symbol !== symbolRef.current) continue;
          const y = candleSeriesRef.current.priceToCoordinate(al.price);
          if (y !== null && Math.abs(y - clickY) < 15) {
            removeAlertRef.current(al.id);
            removed = true;
            break;
          }
        }
        if (removed) return;

        // 3. fibonaccis
        for (const fb of fibonaccisRef.current) {
          if (fb.symbol !== symbolRef.current) continue;
          const yA = candleSeriesRef.current.priceToCoordinate(fb.priceA);
          const yB = candleSeriesRef.current.priceToCoordinate(fb.priceB);
          if (yA !== null && yB !== null) {
            const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
            for (const lvl of levels) {
              const y = yB + (yA - yB) * lvl;
              if (Math.abs(y - clickY) < 15) {
                removeFibonacciRef.current(fb.id);
                removed = true;
                break;
              }
            }
            if (removed) break;
          }
        }
        if (removed) return;

        // 4. positionBoxes
        for (const pb of positionBoxesRef.current) {
          if (pb.symbol !== symbolRef.current) continue;
          const yE = candleSeriesRef.current.priceToCoordinate(pb.entry);
          const yS = candleSeriesRef.current.priceToCoordinate(pb.stop);
          const yT = candleSeriesRef.current.priceToCoordinate(pb.target);
          if (yE !== null && yS !== null && yT !== null) {
            const minY = Math.min(yE, yS, yT);
            const maxY = Math.max(yE, yS, yT);
            if (clickY >= minY - 5 && clickY <= maxY + 5) {
              removePositionBoxRef.current(pb.id);
              removed = true;
              break;
            }
          }
        }
        if (removed) return;
        return;
      }

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

      if (toolRef.current === "fibonacci") {
        if (!param.time) return;
        const time = Number(param.time);
        const current = fiboDraftRef.current;
        if (current.phase === "idle") {
          setFiboDraft({ phase: "placing", a: { time, price }, b: { time, price } });
        } else if (current.phase === "placing") {
          addFibonacciRef.current({
            symbol: symbolRef.current,
            timeA: current.a.time,
            priceA: current.a.price,
            timeB: time,
            priceB: price,
          });
          setFiboDraft({ phase: "idle", a: { time: 0, price: 0 }, b: { time: 0, price: 0 } });
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
        toolRef.current === "fibonacci" &&
        fiboDraftRef.current.phase === "placing" &&
        param.point &&
        param.time &&
        candleSeriesRef.current
      ) {
        const price = candleSeriesRef.current.coordinateToPrice(param.point.y);
        if (price !== null && isFinite(price)) {
          const time = Number(param.time);
          setFiboDraft((prev) =>
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
      ema9Ref.current = null;
      ema20Ref.current = null;
      ema21Ref.current = null;
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
      try { chartRef.current.removeSeries(volumeSeriesRef.current); } catch {}
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
      try { chartRef.current.removeSeries(rsiRef.current); } catch {}
      try { if (rsi30Ref.current) chartRef.current.removeSeries(rsi30Ref.current); } catch {}
      try { if (rsi70Ref.current) chartRef.current.removeSeries(rsi70Ref.current); } catch {}
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
      try { if (macdRef.current) chartRef.current.removeSeries(macdRef.current); } catch {}
      try { if (macdSignalRef.current) chartRef.current.removeSeries(macdSignalRef.current); } catch {}
      try { if (macdHistRef.current) chartRef.current.removeSeries(macdHistRef.current); } catch {}
      macdRef.current = null;
      macdSignalRef.current = null;
      macdHistRef.current = null;
    }
    requestAnimationFrame(() => recomputePaneOffsets());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.macd, indicators.rsi]);

  // Stoch pane
  useEffect(() => {
    if (!chartRef.current) return;
    const v = (k: IndicatorKey) => !hidden[k];

    if (indicators.stoch && !stochKRef.current) {
      const paneIndex = (indicators.rsi ? 1 : 0) + (indicators.macd ? 1 : 0) + 1;
      const kColor = config.stochKColor || INDICATOR_COLORS.stoch || "#2196f3";
      
      const kSeries = chartRef.current.addSeries(
        LineSeries,
        { color: kColor, lineWidth: 2, priceLineVisible: false, lastValueVisible: false },
        paneIndex,
      );
      const dSeries = chartRef.current.addSeries(
        LineSeries,
        { color: config.stochDColor || "#ffa726", lineWidth: 2, priceLineVisible: false, lastValueVisible: false },
        paneIndex,
      );
      const s20 = chartRef.current.addSeries(
        LineSeries,
        { color: `${TV_COLORS.textMuted}40`, lineWidth: 1, lineStyle: 2, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false },
        paneIndex,
      );
      const s80 = chartRef.current.addSeries(
        LineSeries,
        { color: `${TV_COLORS.textMuted}40`, lineWidth: 1, lineStyle: 2, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false },
        paneIndex,
      );

      stochKRef.current = kSeries;
      stochDRef.current = dSeries;
      stoch20Ref.current = s20;
      stoch80Ref.current = s80;

      stochKRef.current.applyOptions({ visible: v("stoch") && config.stochKVisible });
      stochDRef.current.applyOptions({ visible: v("stoch") && config.stochDVisible });
      stoch20Ref.current.applyOptions({ visible: v("stoch") });
      stoch80Ref.current.applyOptions({ visible: v("stoch") });

      updateStoch();
    } else if (!indicators.stoch && stochKRef.current && chartRef.current) {
      try { chartRef.current.removeSeries(stochKRef.current); } catch {}
      try { if (stochDRef.current) chartRef.current.removeSeries(stochDRef.current); } catch {}
      try { if (stoch20Ref.current) chartRef.current.removeSeries(stoch20Ref.current); } catch {}
      try { if (stoch80Ref.current) chartRef.current.removeSeries(stoch80Ref.current); } catch {}
      stochKRef.current = null;
      stochDRef.current = null;
      stoch20Ref.current = null;
      stoch80Ref.current = null;
    }
    requestAnimationFrame(() => recomputePaneOffsets());
  }, [indicators.stoch, indicators.rsi, indicators.macd]);

  // Visibility — eye toggle (hidden state) + enabled state combined
  useEffect(() => {
    const v = (key: IndicatorKey) => indicators[key] && !hidden[key];
    ema9Ref.current?.applyOptions({ visible: v("ema9") });
    ema20Ref.current?.applyOptions({ visible: v("ema20") });
    ema21Ref.current?.applyOptions({ visible: v("ema21") });
    ema50Ref.current?.applyOptions({ visible: v("ema50") });
    ema200Ref.current?.applyOptions({ visible: v("ema200") });
    vwapRef.current?.applyOptions({ visible: v("vwap") });
    if (rsiRef.current) rsiRef.current.applyOptions({ visible: v("rsi") });
    if (rsi30Ref.current) rsi30Ref.current.applyOptions({ visible: v("rsi") });
    if (rsi70Ref.current) rsi70Ref.current.applyOptions({ visible: v("rsi") });
    if (macdRef.current) macdRef.current.applyOptions({ visible: v("macd") });
    if (macdSignalRef.current) macdSignalRef.current.applyOptions({ visible: v("macd") });
    if (macdHistRef.current) macdHistRef.current.applyOptions({ visible: v("macd") });
    if (stochKRef.current) stochKRef.current.applyOptions({ visible: v("stoch") && config.stochKVisible });
    if (stochDRef.current) stochDRef.current.applyOptions({ visible: v("stoch") && config.stochDVisible });
    if (stoch20Ref.current) stoch20Ref.current.applyOptions({ visible: v("stoch") });
    if (stoch80Ref.current) stoch80Ref.current.applyOptions({ visible: v("stoch") });
    if (volumeSeriesRef.current) volumeSeriesRef.current.applyOptions({ visible: v("volume") });
  }, [indicators, hidden, config.stochKVisible, config.stochDVisible]);

  // Recompute indicators when config changes (periods)
  useEffect(() => {
    updateEMAs();
  }, [config.ema9, config.ema20, config.ema21, config.ema50, config.ema200]);

  useEffect(() => {
    updateRSI();
  }, [config.rsi]);

  useEffect(() => {
    updateMACD();
  }, [config.macdFast, config.macdSlow, config.macdSignal]);

  useEffect(() => {
    updateStoch();
    if (stochKRef.current) stochKRef.current.applyOptions({ color: config.stochKColor || "#2196f3" });
    if (stochDRef.current) stochDRef.current.applyOptions({ color: config.stochDColor || "#ffa726" });
  }, [config.stochK, config.stochD, config.stochKColor, config.stochDColor]);

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
    if (c.length === 0 || !indicators.ict) return;
    setKzBoxes(calculateKillzones(c, ictConfig));
    setAmdDays(calculateAMD(c, ictConfig.showAMD));
    const cmeShift = useChartStore.getState().ictConfig.dwm.cmeShift;
    setDailyBias(calculateDailyBias(c, cmeShift));
    setOpLevels(calculateOpeningPrices(c, ictConfig));
    setDwmLevels(calculateDWM(c, ictConfig));
    setTsList(calculateTimestamps(c, ictConfig));
  }, [ictConfig]);

  // Recompute all ICT macros when config changes
  useEffect(() => {
    const c = candlesRef.current;
    if (c.length === 0) return;
    setMacroBoxes(calculateMacros(c, macrosConfig));
  }, [macrosConfig]);

  // Recompute FVGs + MSB + OBs when fvgConfig changes
  useEffect(() => {
    const c = candlesRef.current;
    if (c.length === 0 || !indicators.fvg) return;
    setFvgBoxes(calculateFVGs(c, timeframe, fvgConfig));
    const { breaks, swings } = calculateMarketStructure(c, fvgConfig.msbLookback);
    setMsbBreaks(fvgConfig.showMSB ? breaks : []);
    setMsbSwings(fvgConfig.showMSB ? swings : []);
    setOteData(fvgConfig.showOTE ? calculateOTE(swings) : null);
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
    updateEMAs(); updateRSI(); updateMACD(); updateStoch();
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
    updateMACD(); updateStoch();
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
        tool === "hline" || tool === "measure" || tool === "fibonacci" ? "crosshair" : "";
    }
    if (tool !== "measure") setMeasure(INITIAL_MEASURE);
    if (tool !== "long_position" && tool !== "short_position" && tool !== "position_forecast") {
      setPositionDraft({ phase: "idle", type: "long", entry: null, mouse: null });
    }
    if (tool !== "fibonacci") {
      setFiboDraft({ phase: "idle", a: { time: 0, price: 0 }, b: { time: 0, price: 0 } });
    }
  }, [tool]);

  function updateEMAs() {
    const c = candlesRef.current;
    if (c.length === 0) return;
    const cfg = configRef.current;
    let last9: number | undefined;
    let last20: number | undefined;
    let last21: number | undefined;
    let last50: number | undefined;
    let last200: number | undefined;

    if (ema9Ref.current) {
      const data = ema(c, cfg.ema9);
      ema9Ref.current.setData(
        data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
      last9 = data.at(-1)?.value;
    }
    if (ema20Ref.current) {
      const data = ema(c, cfg.ema20);
      ema20Ref.current.setData(
        data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
      last20 = data.at(-1)?.value;
    }
    if (ema21Ref.current) {
      const data = ema(c, cfg.ema21);
      ema21Ref.current.setData(
        data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
      last21 = data.at(-1)?.value;
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
      ema9: last9,
      ema20: last20,
      ema21: last21,
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

  function updateStoch() {
    const c = candlesRef.current;
    if (c.length === 0 || !stochKRef.current) return;
    const cfg = configRef.current;
    const s = stochastic(c, cfg.stochK, cfg.stochD);
    
    if (s.length > 0) {
      stochKRef.current.setData(s.map((p) => ({ time: p.time as UTCTimestamp, value: p.k })));
      stochDRef.current?.setData(s.map((p) => ({ time: p.time as UTCTimestamp, value: p.d })));
      
      if (stoch20Ref.current) {
        stoch20Ref.current.setData([
          { time: s[0].time as UTCTimestamp, value: 20 },
          { time: s[s.length - 1].time as UTCTimestamp, value: 20 },
        ]);
      }
      if (stoch80Ref.current) {
        stoch80Ref.current.setData([
          { time: s[0].time as UTCTimestamp, value: 80 },
          { time: s[s.length - 1].time as UTCTimestamp, value: 80 },
        ]);
      }
    }
      
    const last = s.at(-1);
    setLastValues((prev) => ({
      ...prev,
      stochK: last?.k,
      stochD: last?.d,
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
            updateMACD(); updateStoch();
            
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
                setKzBoxes(calculateKillzones(bars, ictConfigRef.current));
                setAmdDays(calculateAMD(bars, ictConfigRef.current.showAMD));
                const cmeShift = useChartStore.getState().ictConfig.dwm.cmeShift;
                setDailyBias(calculateDailyBias(bars, cmeShift));
                setOpLevels(calculateOpeningPrices(bars, ictConfigRef.current));
                setDwmLevels(calculateDWM(bars, ictConfigRef.current));
                setTsList(calculateTimestamps(bars, ictConfigRef.current));
                setFvgBoxes(calculateFVGs(bars, timeframe, fvgConfigRef.current));
                const { breaks: msbBrks, swings: msbSws } = calculateMarketStructure(bars, fvgConfigRef.current.msbLookback);
                setMsbBreaks(fvgConfigRef.current.showMSB ? msbBrks : []);
                setMsbSwings(fvgConfigRef.current.showMSB ? msbSws  : []);
                setOteData(fvgConfigRef.current.showOTE ? calculateOTE(msbSws) : null);
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
          ? await fetchNT8Bars(symbol, 5000, timeframe)
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
        updateMACD(); updateStoch();
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
        setKzBoxes(calculateKillzones(klines, ictConfigRef.current));
        setAmdDays(calculateAMD(klines, ictConfigRef.current.showAMD));
        const cmeShift = useChartStore.getState().ictConfig.dwm.cmeShift;
        setDailyBias(calculateDailyBias(klines, cmeShift));
        setOpLevels(calculateOpeningPrices(klines, ictConfigRef.current));
        setDwmLevels(calculateDWM(klines, ictConfigRef.current));
        setTsList(calculateTimestamps(klines, ictConfigRef.current));
        setFvgBoxes(calculateFVGs(klines, timeframe, fvgConfigRef.current));
        const { breaks: msbBrks, swings: msbSws } = calculateMarketStructure(klines, fvgConfigRef.current.msbLookback);
        setMsbBreaks(fvgConfigRef.current.showMSB ? msbBrks : []);
        setMsbSwings(fvgConfigRef.current.showMSB ? msbSws  : []);
        setOteData(fvgConfigRef.current.showOTE ? calculateOTE(msbSws) : null);
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
          if (!price || price <= 0 || isNaN(price)) return;
          
          const arr = candlesRef.current;
          if (arr.length === 0) return;
          
          const last = arr[arr.length - 1];
          if (price < last.close * 0.5 || price > last.close * 1.5) return; // Drop bad ticks/spikes
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
          updateMACD(); updateStoch();
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
          if (!b.open || b.open <= 0 || !b.high || b.high <= 0 || !b.low || b.low <= 0 || !b.close || b.close <= 0 || isNaN(b.open) || isNaN(b.high) || isNaN(b.low) || isNaN(b.close) || isNaN(b.time)) return;

          const arr = candlesRef.current;
          // Wait for historical data to load before processing live bars
          if (arr.length === 0) return;

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
          if (volumeSeriesRef.current) {
            volumeSeriesRef.current.update({
              time: cur.time as UTCTimestamp,
              value: cur.volume,
              color: cur.close >= cur.open ? `${TV_COLORS.green}66` : `${TV_COLORS.red}66`,
            });
          }
          updateEMAs();
          updateRSI();
          updateMACD(); updateStoch();
          if (b.type === "bar_close") {
            const cfg = fvgConfigRef.current;
            setFvgBoxes(calculateFVGs(arr, timeframe, cfg));
            const { breaks: msbBrks2, swings: msbSws2 } = calculateMarketStructure(arr, cfg.msbLookback);
            setMsbBreaks(cfg.showMSB ? msbBrks2 : []);
            setMsbSwings(cfg.showMSB ? msbSws2  : []);
            setOteData(cfg.showOTE ? calculateOTE(msbSws2) : null);
            if (cfg.showOB) {
              const obs = calculateOrderBlocks(arr, msbBrks2, cfg.maxOBCount);
              setObBoxes(cfg.showBreaker ? obs : obs.filter((ob) => !ob.isBreaker));
            }
            setMacroBoxes(calculateMacros(arr, macrosConfigRef.current));
            const cmeShift = useChartStore.getState().ictConfig.dwm.cmeShift;
            setDailyBias(calculateDailyBias(arr, cmeShift));
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
            updateEMAs(); updateRSI(); updateMACD(); updateStoch();
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
          const u3 = nt8ws.subscribePosition((msg) => {
            const symPrefix = symbol.split(/[=\s-]/)[0].toUpperCase();
            const nt8Prefix = msg.symbol?.split(/[\s-]/)[0].toUpperCase() ?? "";
            if (symPrefix === nt8Prefix || msg.symbol === symbol) {
              useChartStore.getState().setNT8Position(msg.position !== 0 ? {
                qty: msg.position,
                averagePrice: msg.averagePrice,
                symbol: msg.symbol || ""
              } : null);
            }
          });
          unsub = () => { u1(); u2(); u3(); };
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
              updateEMAs(); updateRSI(); updateMACD(); updateStoch();
              const prev = arr[arr.length - 2];
              setLastPrice({
                value: k.close,
                pct: prev && prev.close !== 0 ? ((k.close - prev.close) / prev.close) * 100 : 0,
              });
            }
          });
        }
      } catch (e) {
        console.warn("Failed to load chart data:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [symbol, timeframe, useNT8, useTradovate, useChartStore.getState().nt8OffsetHours]);

  const greenOrRed = (n: number) =>
    n >= 0 ? "text-tv-green" : "text-tv-red";

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

  // --- Render Fibonacci Draft ---
  let fiboDraftRender = null;
  if (
    fiboDraft.phase === "placing" &&
    candleSeriesRef.current &&
    paneOffsets.length > 0 &&
    candlesRef.current.length > 0
  ) {
    const aX = chartRef.current!.timeScale().timeToCoordinate(fiboDraft.a.time as any);
    const aY = candleSeriesRef.current.priceToCoordinate(fiboDraft.a.price);
    const bX = chartRef.current!.timeScale().timeToCoordinate(fiboDraft.b.time as any);
    const bY = candleSeriesRef.current.priceToCoordinate(fiboDraft.b.price);

    if (aX !== null && bX !== null && aY !== null && bY !== null) {
      fiboDraftRender = (
        <FibonacciOverlay
          aX={aX}
          aY={aY}
          bX={bX}
          bY={bY}
          priceA={fiboDraft.a.price}
          priceB={fiboDraft.b.price}
          paneWidth={paneOffsets[0].width}
          isPreview={true}
        />
      );
    }
  }

  // --- Render Persisted Fibonaccis ---

  const fiboRenders = fibonaccis
    .filter((f) => f.symbol === symbol)
    .map((f) => {
      if (!candleSeriesRef.current || !chartRef.current || paneOffsets.length === 0) return null;
      const aX = chartRef.current.timeScale().timeToCoordinate(f.timeA as any);
      const aY = candleSeriesRef.current.priceToCoordinate(f.priceA);
      const bX = chartRef.current.timeScale().timeToCoordinate(f.timeB as any);
      const bY = candleSeriesRef.current.priceToCoordinate(f.priceB);

      if (aX === null || aY === null || bX === null || bY === null) return null;

      return (
        <FibonacciOverlay
          key={f.id}
          aX={aX}
          aY={aY}
          bX={bX}
          bY={bY}
          priceA={f.priceA}
          priceB={f.priceB}
          paneWidth={paneOffsets[0].width}
          isPreview={false}
          onRemove={() => removeFibonacci(f.id)}
        />
      );
    });

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

  const handleZoom = (direction: 1 | -1) => {
    if (!chartRef.current) return;
    const ts = chartRef.current.timeScale();
    const range = ts.getVisibleLogicalRange();
    if (!range) return;
    const delta = (range.to - range.from) * 0.1 * direction;
    ts.setVisibleLogicalRange({ from: range.from + delta, to: range.to - delta });
  };

  const handleScroll = (direction: 1 | -1) => {
    if (!chartRef.current) return;
    const ts = chartRef.current.timeScale();
    const range = ts.getVisibleLogicalRange();
    if (!range) return;
    const delta = (range.to - range.from) * 0.1 * direction;
    ts.setVisibleLogicalRange({ from: range.from + delta, to: range.to + delta });
  };

  const handleReset = () => {
    if (!chartRef.current) return;
    const ts = chartRef.current.timeScale();
    ts.scrollToPosition(0, true);
    // Let autoScale handle the Y axis
  };

  const tfToMinutes = (tf: string) => {
    if (tf === "D") return 1440;
    if (tf === "W") return 10080;
    if (tf === "M") return 43200;
    return parseInt(tf, 10) || 1440;
  };
  const isKzTimeframeOk = tfToMinutes(timeframe) <= ictConfig.timeframeLimit;

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
      {indicators.fvg && !hidden.fvg && fvgConfig.showOTE && chartRef.current && candleSeriesRef.current && oteData && (
        <OTEOverlay
          chart={chartRef.current}
          series={candleSeriesRef.current}
          ote={oteData}
          textColor={ictConfig.textColor}
          labelSize={ictConfig.labelSize}
        />
      )}
      <FvgSettingsDialog open={fvgSettingsOpen} onClose={() => setFvgSettingsOpen(false)} />
      {indicators.ict && !hidden.ict && isKzTimeframeOk && chartRef.current && candleSeriesRef.current && kzBoxes.length > 0 && (
        <KillzonesOverlay
          chart={chartRef.current}
          series={candleSeriesRef.current}
          boxes={kzBoxes}
          config={ictConfig}
        />
      )}
      {indicators.ict && !hidden.ict && isKzTimeframeOk && chartRef.current && candleSeriesRef.current && amdDays.length > 0 && (
        <AMDOverlay
          chart={chartRef.current}
          series={candleSeriesRef.current}
          days={amdDays}
          textColor={ictConfig.textColor}
          labelSize={ictConfig.labelSize}
        />
      )}
      {indicators.ictMacros && !hidden.ictMacros && isKzTimeframeOk && chartRef.current && candleSeriesRef.current && macroBoxes.length > 0 && (
        <IctMacrosOverlay
          chart={chartRef.current}
          series={candleSeriesRef.current}
          boxes={macroBoxes}
          paneHeight={paneOffsets[0]?.height ?? 400}
        />
      )}
      <IctSettingsDialog open={ictSettingsOpen} onClose={() => setIctSettingsOpen(false)} />
      <MacrosSettingsDialog open={macrosSettingsOpen} onClose={() => setMacrosSettingsOpen(false)} />
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
      {fiboDraftRender}
      {fiboRenders}

      {/* NT8 Real-time Position Render */}
      {useNT8 && nt8Pos && nt8Pos.qty !== 0 && candleSeriesRef.current && paneOffsets[0] && (
        <div className="pointer-events-none absolute left-0 top-0 h-full w-full overflow-hidden" style={{ zIndex: 15 }}>
          {(() => {
            const y = candleSeriesRef.current.priceToCoordinate(nt8Pos.averagePrice);
            if (y === null) return null;
            const isLong = nt8Pos.qty > 0;
            const color = isLong ? TV_COLORS.green : TV_COLORS.red;
            const label = `${isLong ? "Long" : "Short"} ${Math.abs(nt8Pos.qty)} @ ${nt8Pos.averagePrice}`;
            return (
              <>
                <svg width={containerRef.current?.clientWidth || 0} height={paneOffsets[0].height}>
                  <line x1={0} y1={y} x2={containerRef.current?.clientWidth || 0} y2={y} stroke={color} strokeWidth={2} strokeDasharray="4,4" />
                </svg>
                <div
                  className="absolute rounded px-2 py-0.5 text-[11px] font-bold tabular-nums text-white opacity-90 backdrop-blur"
                  style={{
                    top: y - 10,
                    left: Math.max(10, (containerRef.current?.clientWidth || 0) - 150),
                    backgroundColor: color,
                  }}
                >
                  {label}
                </div>
              </>
            );
          })()}
        </div>
      )}

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
          {indicators.ema9 && (
            <IndicatorPill
              name={`EMA ${config.ema9}`}
              value={lastValues.ema9 !== undefined ? formatPrice(lastValues.ema9) : undefined}
              color={INDICATOR_COLORS.ema9}
              hidden={hidden.ema9}
              onToggleHide={() => toggleHidden("ema9")}
              onSettings={() => setSettingsTarget("ema9")}
              onRemove={() => removeIndicator("ema9")}
            />
          )}
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
          {indicators.ema21 && (
            <IndicatorPill
              name={`EMA ${config.ema21}`}
              value={lastValues.ema21 !== undefined ? formatPrice(lastValues.ema21) : undefined}
              color={INDICATOR_COLORS.ema21}
              hidden={hidden.ema21}
              onToggleHide={() => toggleHidden("ema21")}
              onSettings={() => setSettingsTarget("ema21")}
              onRemove={() => removeIndicator("ema21")}
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
            <>
              <IndicatorPill
                name="SMC / ICT"
                value={kzBoxes.length > 0 ? `${kzBoxes.length} sess` : undefined}
                color={INDICATOR_COLORS.ict}
                hidden={hidden.ict}
                onToggleHide={() => toggleHidden("ict")}
                onSettings={() => setIctSettingsOpen(true)}
                onRemove={() => removeIndicator("ict")}
              />
              {!hidden.ict && (
                <IndicatorPill
                  name="Daily Bias"
                  value={dailyBias === "Bullish" ? "Alcista 🟢" : dailyBias === "Bearish" ? "Bajista 🔴" : "Neutral ⚪"}
                  color={dailyBias === "Bullish" ? TV_COLORS.green : dailyBias === "Bearish" ? TV_COLORS.red : TV_COLORS.text}
                />
              )}
            </>
          )}
          {indicators.ictMacros && (
            <IndicatorPill
              name="ICT Macros"
              value={macroBoxes.length > 0 ? `${macroBoxes.length} macros` : undefined}
              color={INDICATOR_COLORS.ictMacros}
              hidden={hidden.ictMacros}
              onToggleHide={() => toggleHidden("ictMacros")}
              onSettings={() => setMacrosSettingsOpen(true)}
              onRemove={() => removeIndicator("ictMacros")}
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

      {/* Stochastic pane label */}
      {indicators.stoch && paneOffsets[(indicators.rsi ? 1 : 0) + (indicators.macd ? 1 : 0) + 1] && (
        <div
          style={{ top: paneOffsets[(indicators.rsi ? 1 : 0) + (indicators.macd ? 1 : 0) + 1].top + 6, left: 12 }}
          className="pointer-events-none absolute z-10"
        >
          <IndicatorPill
            name={`Stoch ${config.stochK}, ${config.stochD}`}
            value={
              lastValues.stochK !== undefined
                ? `${lastValues.stochK.toFixed(2)} / ${(lastValues.stochD ?? 0).toFixed(2)}`
                : undefined
            }
            color={INDICATOR_COLORS.stoch || "#2196f3"}
            hidden={hidden.stoch}
            onToggleHide={() => toggleHidden("stoch")}
            onSettings={() => setSettingsTarget("stoch")}
            onRemove={() => removeIndicator("stoch")}
          />
        </div>
      )}
      {/* Chart Navigation Toolbar */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center gap-1 rounded-md border border-tv-border bg-tv-bg p-1 opacity-20 transition-opacity duration-200 hover:opacity-100">
        <button
          onClick={() => handleZoom(-1)}
          className="flex h-8 w-8 items-center justify-center rounded text-tv-text-muted hover:bg-tv-hover hover:text-tv-text"
          title="Alejar"
        >
          <Minus size={18} />
        </button>
        <button
          onClick={() => handleZoom(1)}
          className="flex h-8 w-8 items-center justify-center rounded text-tv-text-muted hover:bg-tv-hover hover:text-tv-text"
          title="Acercar"
        >
          <Plus size={18} />
        </button>
        <button
          onClick={() => handleScroll(-1)}
          className="flex h-8 w-8 items-center justify-center rounded text-tv-text-muted hover:bg-tv-hover hover:text-tv-text"
          title="Mover Izquierda"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={() => handleScroll(1)}
          className="flex h-8 w-8 items-center justify-center rounded text-tv-text-muted hover:bg-tv-hover hover:text-tv-text"
          title="Mover Derecha"
        >
          <ChevronRight size={18} />
        </button>
        <button
          onClick={handleReset}
          className="flex h-8 w-8 items-center justify-center rounded text-tv-text-muted hover:bg-tv-hover hover:text-tv-text"
          title="Reiniciar Vista"
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );
}
