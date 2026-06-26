import { SMA, EMA, RSI, MACD, Stochastic } from "technicalindicators";
import type { Candle } from "@/lib/binance/types";

export interface StochPoint {
  time: number;
  k: number;
  d: number;
}


export interface IndicatorPoint {
  time: number;
  value: number;
}

export interface MACDPoint {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

/** Simple Moving Average */
export function sma(candles: Candle[], period: number): IndicatorPoint[] {
  if (candles.length < period) return [];
  const values = SMA.calculate({ period, values: candles.map((c) => c.close) });
  const offset = candles.length - values.length;
  return values.map((v, i) => ({ time: candles[i + offset].time, value: v }));
}

/** Exponential Moving Average */
export function ema(candles: Candle[], period: number): IndicatorPoint[] {
  if (candles.length < period) return [];
  const values = EMA.calculate({ period, values: candles.map((c) => c.close) });
  const offset = candles.length - values.length;
  return values.map((v, i) => ({ time: candles[i + offset].time, value: v }));
}

/** RSI (Wilder) — period typically 14 */
export function rsi(candles: Candle[], period = 14): IndicatorPoint[] {
  if (candles.length <= period) return [];
  const values = RSI.calculate({ period, values: candles.map((c) => c.close) });
  const offset = candles.length - values.length;
  return values.map((v, i) => ({ time: candles[i + offset].time, value: v }));
}

/** MACD — defaults 12 / 26 / 9 */
export function macd(
  candles: Candle[],
  fast = 12,
  slow = 26,
  signal = 9,
): MACDPoint[] {
  if (candles.length < slow + signal) return [];
  const result = MACD.calculate({
    values: candles.map((c) => c.close),
    fastPeriod: fast,
    slowPeriod: slow,
    signalPeriod: signal,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const offset = candles.length - result.length;
  const out: MACDPoint[] = [];
  for (let i = 0; i < result.length; i++) {
    const r = result[i];
    if (r.MACD === undefined || r.signal === undefined || r.histogram === undefined) continue;
    out.push({
      time: candles[i + offset].time,
      macd: r.MACD,
      signal: r.signal,
      histogram: r.histogram,
    });
  }
  return out;
}

/** Stochastic Oscillator — defaults 14 / 3 */
export function stochastic(
  candles: Candle[],
  period = 14,
  signalPeriod = 3,
): StochPoint[] {
  if (candles.length < period + signalPeriod) return [];
  const result = Stochastic.calculate({
    high: candles.map((c) => c.high),
    low: candles.map((c) => c.low),
    close: candles.map((c) => c.close),
    period: period,
    signalPeriod: signalPeriod,
  });
  const offset = candles.length - result.length;
  const out: StochPoint[] = [];
  for (let i = 0; i < result.length; i++) {
    const r = result[i];
    if (r.k === undefined || r.d === undefined) continue;
    out.push({
      time: candles[i + offset].time,
      k: r.k,
      d: r.d,
    });
  }
  return out;
}
