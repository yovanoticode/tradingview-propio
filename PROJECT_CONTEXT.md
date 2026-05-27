# TradingView Gratis — Project Context

> Prompt completo para onboarding de IA en este proyecto.
> Directorio: `C:\Users\yoban\OneDrive\QUANT\CLAUDE\TRADINGVIEW`

---

## ¿Qué es este proyecto?

Clon open-source de TradingView construido desde cero. Objetivo: reemplazar TradingView de pago con una herramienta propia con datos en tiempo real, indicadores ICT/SMC, y conexión a NinjaTrader 8.

Está en uso activo como herramienta de trading de futuros (MNQ, ES, NQ) y cripto (Binance).

---

## Stack técnico

| Tecnología | Versión | Uso |
|---|---|---|
| Next.js | 16.2.6 (Turbopack) | Framework principal |
| React | 19.2.4 | UI |
| TypeScript | latest | Todo el código |
| lightweight-charts | 5.2.0 | Gráfico de velas (oficial TradingView) |
| Zustand | 5.0.13 | Estado global con persistencia localStorage |
| Tailwind CSS | 4 | Estilos |
| shadcn/ui | latest | Componentes UI base |

**IMPORTANTE:** Next.js 16 tiene breaking changes respecto a versiones anteriores. Antes de tocar cualquier API de Next.js, leer `node_modules/next/dist/docs/`.

---

## Fuentes de datos

### 1. Binance (cripto)
- REST: `https://api.binance.com/api/v3` — sin API key
- WebSocket: `wss://stream.binance.com:9443/ws` — multiplexado, auto-reconexión
- Archivo: `src/lib/binance/klines.ts`, `src/lib/binance/ws.ts`
- Símbolo se detecta con `isCryptoSymbol()` en `src/lib/binance/ticker.ts`

### 2. NinjaTrader 8
- HTTP bridge local en `http://localhost:4001`
- REST: `fetchNT8Bars(count, timeframe, offset?)` en `src/lib/nt8/rest.ts`
- WebSocket: `getNT8WS()` singleton en `src/lib/nt8/ws.ts`
  - `subscribeTick(fn)` — cada trade (alta frecuencia, mantiene close vivo)
  - `subscribeBar(fn)` — OHLCV completo del bar 1m (para H/L exactos)
- Datos de futuros solo disponibles cuando NT8 está conectado

### 3. Yahoo Finance
- Proxy propio: `GET /api/chart/[symbol]?interval=X&range=Y`
- Archivo: `src/app/api/chart/[symbol]/route.ts`
- Se usa como fallback para watchlist (precio 24h)
- **Yahoo Finance 1M data quality es pobre** — usar NT8 para 1M futures

---

## Estructura de archivos críticos

```
src/
├── app/
│   ├── page.tsx                          # Dashboard principal — layout single/grid2x2
│   └── api/chart/[symbol]/route.ts       # Proxy Yahoo Finance
│
├── lib/
│   ├── store/chart-store.ts              # Zustand store — LEER ANTES DE TOCAR ESTADO
│   ├── yahoo/types.ts                    # Tipos base: Candle, Timeframe
│   ├── format.ts                         # formatPrice, formatVolume, formatPct
│   │
│   ├── binance/
│   │   ├── klines.ts                     # fetchBinanceKlines, getBinanceKlineWS
│   │   ├── ticker.ts                     # isCryptoSymbol, toBinanceSymbol
│   │   └── ws.ts                         # BinanceWS singleton multiplexado
│   │
│   ├── nt8/
│   │   ├── rest.ts                       # fetchNT8Bars, fetchNT8Info
│   │   └── ws.ts                         # NT8WS singleton (tick + bar)
│   │
│   └── indicators/
│       ├── index.ts                      # sma, ema, rsi, macd (puras, client-side)
│       ├── orb.ts                        # Opening Range Breakout
│       ├── vwap.ts                       # VWAP diario
│       ├── volumeProfile.ts              # Volume Profile (últimas 200 barras)
│       ├── killzones.ts                  # ICT Killzones (boxes + pivots)
│       ├── levels.ts                     # Opening prices, DWM, timestamps
│       ├── fvg.ts                        # FVG / BISI / SIBI + IFVG + CE detection
│       ├── orderBlocks.ts                # Order Blocks basados en BOS/CHoCH
│       └── marketStructure.ts            # BOS, CHoCH/MSS, swing detection
│
└── components/
    ├── chart/
    │   ├── PriceChart.tsx                # ⭐ CORE — 1500+ líneas, leer completo
    │   ├── FVGOverlay.tsx                # SVG overlay FVG/IFVG
    │   ├── FvgSettingsDialog.tsx         # Config: FVG + OB + Market Structure
    │   ├── OrderBlockOverlay.tsx         # SVG overlay Order Blocks
    │   ├── MarketStructureOverlay.tsx    # SVG overlay BOS/CHoCH/swings
    │   ├── KillzonesOverlay.tsx          # SVG overlay ICT killzones
    │   ├── LevelsOverlay.tsx             # SVG overlay DWM/Opening prices
    │   ├── IctSettingsDialog.tsx         # Config ICT (complejo, ~600 líneas)
    │   ├── MeasureOverlay.tsx            # Herramienta Regla SVG
    │   ├── PositionOverlay.tsx           # Position boxes (long/short/forecast)
    │   ├── VolumeProfileOverlay.tsx      # Volume Profile SVG
    │   ├── IndicatorPill.tsx             # Pill con eye/settings/remove
    │   ├── IndicatorMenu.tsx             # Dropdown agregar indicadores
    │   ├── IndicatorSettingsDialog.tsx   # Modal config períodos EMA/RSI/MACD
    │   ├── SymbolSelector.tsx            # Búsqueda símbolo con autocomplete
    │   ├── TimeframeSelector.tsx         # Botones TF
    │   └── ReplayBar.tsx                 # Controles replay bar-by-bar
    │
    └── layout/
        ├── Header.tsx                    # Logo + controles principales
        ├── TabBar.tsx                    # Pestañas múltiples charts
        ├── LeftSidebar.tsx               # Tools: cursor, hline, measure, alert, position
        ├── RightSidebar.tsx              # Watchlist
        └── BottomPanel.tsx               # Stats 24h en vivo
```

---

## Tipos clave

```typescript
// src/lib/yahoo/types.ts
type Timeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d" | "1w";

interface Candle {
  time: number;   // unix seconds UTC
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isFinal?: boolean;
}

// src/lib/store/chart-store.ts
type IndicatorKey =
  "ema20" | "ema50" | "ema200" | "rsi" | "macd" | "volume" |
  "orb" | "ict" | "vwap" | "volumeProfile" | "fvg";

type DrawingTool =
  "cursor" | "hline" | "measure" | "eraser" | "alert" |
  "long_position" | "short_position" | "position_forecast";

interface Tab {
  id: string;
  symbol: string;
  timeframe: Timeframe;
  indicators: Record<IndicatorKey, boolean>;  // per-tab
  hidden: Record<IndicatorKey, boolean>;       // per-tab
  config: IndicatorConfig;                     // per-tab
}
```

---

## Estado Zustand (`chart-store.ts`)

**Persistido en localStorage** (`"tv-futures-chart-state"`, versión actual: `2`):
```
tabs[], activeTabId, symbol, timeframe
indicators{}, hidden{}, config{}   ← derivados del tab activo
watchlist[]
ictConfig (IctConfig)
fvgConfig (FvgConfig)
chartTimezone
alerts[], priceLines[]
layoutMode, gridTimeframes
nt8WasConnected
```

**Efímero (no persistido):**
```
tool, positionBoxes[], symbolDialogOpen, settingsTarget
nt8Connected, nt8Instrument
replayActive, replayIndex, replayPlaying, replaySpeed
```

**Importante:** `indicators/hidden/config` del top-level del store son un **mirror del tab activo**. Los mutations (`toggleIndicator`, `setConfig`, etc.) actualizan AMBOS el top-level Y `tabs[activeTabId]`. Al `switchTab` se cargan los valores del tab destino al top-level.

---

## PriceChart.tsx — Arquitectura

El componente más crítico (~1500 líneas). Patrón central:

```
useEffect([]) → createChart() → candleSeriesRef, ema20Ref, ema50Ref... etc
useEffect([symbol, timeframe, nt8Connected]) → load() → fetchKlines → setData → WS subscribe
useEffect([indicators.rsi]) → addSeries(LineSeries, paneIndex=1)
useEffect([indicators.macd]) → addSeries(LineSeries, paneIndex=rsi?2:1)
```

**Refs importantes (evitan closures en WS listeners):**
```typescript
const toolRef = useRef(tool);          // toolRef.current = tool
const symbolRef = useRef(symbol);
const configRef = useRef(config);
const fvgConfigRef = useRef(fvgConfig);
const ictConfigRef = useRef(ictConfig);
```

**Panes:**
- Pane 0: Candles + EMAs + VWAP + Volume (overlay)
- Pane 1: RSI (si activo)
- Pane 2: MACD (si RSI activo) | Pane 1 (si RSI inactivo)

**Overlays SVG** (sobre el canvas de lightweight-charts):
```typescript
// Coordenadas pixel ↔ precio/tiempo:
ts.timeToCoordinate(time as UTCTimestamp)   // → x pixel
series.priceToCoordinate(price)             // → y pixel
series.coordinateToPrice(y)                 // ← precio desde pixel
```

**NT8 bucketing** (para TFs > 1m):
NT8 siempre envía barras 1m. El código las agrega en buckets de 5m/15m/30m/1h/4h client-side:
```typescript
const TF_SECS = { "5m": 300, "15m": 900, "30m": 1800, "1h": 3600, "4h": 14400 }
const bucketSecs = TF_SECS[timeframe]; // undefined = 1m (sin bucketing)
```

---

## Paleta de colores

```typescript
const TV_COLORS = {
  bg:        "#131722",  // fondo chart
  panel:     "#1e222d",  // header/sidebar
  border:    "#2a2e39",
  text:      "#d1d4dc",
  textMuted: "#787b86",
  green:     "#26a69a",  // alcista
  red:       "#ef5350",  // bajista
  blue:      "#2962ff",  // EMA50, MACD
  yellow:    "#ffb74d",  // EMA20
  purple:    "#ab47bc",  // EMA200, RSI
  grid:      "#1e222d",
}
// Tailwind: text-tv-text, bg-tv-bg, border-tv-border, text-tv-blue, etc.
```

---

## Indicadores ICT/SMC implementados

### FVG (`src/lib/indicators/fvg.ts`)
- Detección: patrón 3 velas (c0.high < c2.low = bull; c0.low > c2.high = bear)
- **CE (Consequent Encroachment):** wick toca el 50% del gap → `mitigation: "ce"`
- **Full Fill:** cierre más allá del borde del gap → `mitigation: "full"`, `mitigated: true`
- **IFVG:** FVG completamente llenado → invierte sesgo, `isIFVG: true`
- Multi-TF: agrega candles a TF superior y detecta FVGs en esos buckets
- Labels: "FVG ↑" / "FVG ↓"

### Order Blocks (`src/lib/indicators/orderBlocks.ts`)
- **Basados en BOS/CHoCH** (NO en ventana de N barras)
- Para cada break: busca hacia atrás desde el swing la última vela de color opuesto
- Bull BOS/CHoCH → última vela bearish antes del swing → Bullish OB (zona demanda)
- Bear BOS/CHoCH → última vela bullish antes del swing → Bearish OB (zona oferta)
- OBs de CHoCH marcados con `fromCHoCH: true` (más significativos)
- Mitigación: cierre más allá del borde → `isBreaker: true` (Breaker Block)

### Market Structure (`src/lib/indicators/marketStructure.ts`)
- Swing detection: lookback bilateral para histórico, unilateral para barras recientes
- **BOS:** ruptura en dirección del trend actual → continuación
- **CHoCH/MSS:** ruptura contra el trend → señal de reversión (naranja)
- Trend se actualiza en cada break

### ICT Killzones (`src/lib/indicators/killzones.ts`)
- Boxes por sesión: Asia (19:00-01:00), London (03:00-09:30), NY AM (09:30-11:00)
- Pivots: High/Low de cada sesión con extensión configurable
- Opening Prices, DWM (Day/Week/Month H/L/Open), Timestamps verticales

---

## Configuraciones en store

### `FvgConfig` (para FVG + OB + Market Structure)
```typescript
interface FvgConfig {
  showCE: boolean;        // FVGs CE-tocados (default: false)
  showIFVG: boolean;      // IFVGs invertidos (default: true)
  showHTF: boolean;       // FVGs de TF superior (default: true)
  maxActive: number;      // max FVGs activos (default: 5)
  minSizePts: number;     // filtro tamaño mínimo en pts (default: 0)
  showOB: boolean;        // Order Blocks (default: true)
  showBreaker: boolean;   // Breaker Blocks (default: true)
  maxOBCount: number;     // max OBs (default: 5)
  showMSB: boolean;       // BOS/CHoCH labels (default: true)
  showSwings: boolean;    // triangulos swing H/L (default: true)
  msbLookback: number;    // lookback swing detection (default: 3)
}
```

### `IctConfig`
Config extensa para killzones — ver `DEFAULT_ICT_CONFIG` en `chart-store.ts`.

---

## Reglas al escribir código en este proyecto

1. **Leer PriceChart.tsx completo** antes de tocar overlays o indicadores
2. **Usar refs** para closures en WS listeners: `const fooRef = useRef(foo); fooRef.current = foo`
3. **Pane indices** dependen de indicadores activos — RSI siempre pane 1, MACD es pane `rsi?2:1`
4. **Coordenadas SVG:** siempre chequear null de `timeToCoordinate`/`priceToCoordinate` antes de usar
5. **No modificar** `candlesRef.current` directamente desde outside del `load()` effect sin cuidado
6. **Zustand mutations** deben actualizar TANTO top-level COMO `tabs[activeTabId]`
7. **Store versión 2** — si se agregan campos a tipos persistidos, hacer migrate + bump version
8. **Next.js 16** — leer docs antes de usar APIs de routing, server components, etc.
9. **lightweight-charts v5** — breaking changes vs v4, consultar docs antes de usar APIs del chart

---

## Features pendientes (no implementados)

- Drawing tools persistentes (trend line, Fibonacci, Text annotations)
- Alertas server-side (Supabase + Telegram)
- Bot de trading (API privada Binance)
- Liquidity levels (BSL/SSL automáticos)
- Premium/Discount arrays automáticos

---

## Cómo levantar el proyecto

```bash
cd C:\Users\yoban\OneDrive\QUANT\CLAUDE\TRADINGVIEW
npm run dev
# → http://localhost:3000
```

Para futuros (MNQ, ES, etc.) se necesita NinjaTrader 8 corriendo con el bridge HTTP en puerto 4001. Para cripto (BTC-USD, ETH-USD) funciona directamente sin ninguna conexión adicional.
