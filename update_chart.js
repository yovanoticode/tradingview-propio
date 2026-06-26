const fs = require('fs');
let code = fs.readFileSync('src/components/chart/PriceChart.tsx', 'utf8');

code = code.replace(/import \{ ema, rsi, macd \} from "@\/lib\/indicators";/g, 'import { ema, rsi, macd, stochastic } from "@/lib/indicators";');
code = code.replace(/macdHist\?: number;\n  volume\?: number;\n\}/, 'macdHist?: number;\n  stochK?: number;\n  stochD?: number;\n  volume?: number;\n}');

code = code.replace(/const macdHistRef = useRef<ISeriesApi<"Histogram"> \| null>\(null\);/, 
`const macdHistRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const stochKRef = useRef<ISeriesApi<"Line"> | null>(null);
  const stochDRef = useRef<ISeriesApi<"Line"> | null>(null);
  const stoch20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const stoch80Ref = useRef<ISeriesApi<"Line"> | null>(null);`);

code = code.replace(/macdHistRef\.current = null;\n    \};\n  \}, \[\]\);/g,
`macdHistRef.current = null;
      stochKRef.current = null;
      stochDRef.current = null;
      stoch20Ref.current = null;
      stoch80Ref.current = null;
    };
  }, []);`);

code = code.replace(/const macdPaneIdx = indicators\.rsi \? 2 : 1;/g,
`const macdPaneIdx = indicators.rsi ? 2 : 1;
  const stochPaneIdx = (indicators.rsi ? 1 : 0) + (indicators.macd ? 1 : 0) + 1;`);

const stochUseEffect = `
  // Stochastic pane
  useEffect(() => {
    if (!chartRef.current) return;
    if (indicators.stoch && !stochKRef.current) {
      const paneIndex = (indicators.rsi ? 1 : 0) + (indicators.macd ? 1 : 0) + 1;
      const k = chartRef.current.addSeries(LineSeries, { color: INDICATOR_COLORS.stoch, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, paneIndex);
      const d = chartRef.current.addSeries(LineSeries, { color: TV_COLORS.yellow, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, paneIndex);
      const s20 = chartRef.current.addSeries(LineSeries, { color: TV_COLORS.textMuted, lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false }, paneIndex);
      const s80 = chartRef.current.addSeries(LineSeries, { color: TV_COLORS.textMuted, lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false }, paneIndex);
      stochKRef.current = k;
      stochDRef.current = d;
      stoch20Ref.current = s20;
      stoch80Ref.current = s80;
      try {
        chartRef.current.panes()[paneIndex]?.setStretchFactor(1);
        chartRef.current.panes()[0]?.setStretchFactor(3);
      } catch {}
      updateStoch();
    } else if (!indicators.stoch && stochKRef.current && chartRef.current) {
      if (stochKRef.current) chartRef.current.removeSeries(stochKRef.current);
      if (stochDRef.current) chartRef.current.removeSeries(stochDRef.current);
      if (stoch20Ref.current) chartRef.current.removeSeries(stoch20Ref.current);
      if (stoch80Ref.current) chartRef.current.removeSeries(stoch80Ref.current);
      stochKRef.current = null;
      stochDRef.current = null;
      stoch20Ref.current = null;
      stoch80Ref.current = null;
    }
    requestAnimationFrame(() => recomputePaneOffsets());
  }, [indicators.stoch, indicators.rsi, indicators.macd]);
`;

code = code.replace(/\/\/ Visibility — eye toggle/, stochUseEffect + '\n  // Visibility — eye toggle');

const updateStochMethod = `
  function updateStoch() {
    const c = candlesRef.current;
    if (c.length === 0 || !stochKRef.current) return;
    const cfg = configRef.current;
    const s = stochastic(c, cfg.stochK, cfg.stochD);
    stochKRef.current.setData(s.map((p) => ({ time: p.time as UTCTimestamp, value: p.k })));
    stochDRef.current?.setData(s.map((p) => ({ time: p.time as UTCTimestamp, value: p.d })));
    stoch20Ref.current?.setData([{ time: c[0].time as UTCTimestamp, value: 20 }, { time: c[c.length - 1].time as UTCTimestamp, value: 20 }]);
    stoch80Ref.current?.setData([{ time: c[0].time as UTCTimestamp, value: 80 }, { time: c[c.length - 1].time as UTCTimestamp, value: 80 }]);
    const last = s.at(-1);
    setLastValues((prev) => ({ ...prev, stochK: last?.k, stochD: last?.d }));
  }
`;

code = code.replace(/function updateMACD\(\) \{/, updateStochMethod + '\n  function updateMACD() {');

code = code.replace(/updateMACD\(\);\n  \}, \[config\.macdFast, config\.macdSlow, config\.macdSignal\]\);/g, 
`updateMACD();
  }, [config.macdFast, config.macdSlow, config.macdSignal]);

  useEffect(() => {
    updateStoch();
  }, [config.stochK, config.stochD]);`);

code = code.replace(/if \(macdHistRef\.current\) macdHistRef\.current\.applyOptions\(\{ visible: v\("macd"\) \}\);/g, 
`if (macdHistRef.current) macdHistRef.current.applyOptions({ visible: v("macd") });
    if (stochKRef.current) stochKRef.current.applyOptions({ visible: v("stoch") });
    if (stochDRef.current) stochDRef.current.applyOptions({ visible: v("stoch") });
    if (stoch20Ref.current) stoch20Ref.current.applyOptions({ visible: v("stoch") });
    if (stoch80Ref.current) stoch80Ref.current.applyOptions({ visible: v("stoch") });`);

code = code.replace(/updateMACD\(\);/g, 'updateMACD();\n    updateStoch();');

const stochPill = `
      {/* Stochastic pane label */}
      {indicators.stoch && paneOffsets[stochPaneIdx] && (
        <div
          style={{ top: paneOffsets[stochPaneIdx].top + 6, left: 12 }}
          className="pointer-events-none absolute z-10"
        >
          <IndicatorPill
            name="Stochastic"
            values={[
              { label: "%K", val: lastValues.stochK?.toFixed(2) ?? "-", color: INDICATOR_COLORS.stoch },
              { label: "%D", val: lastValues.stochD?.toFixed(2) ?? "-", color: TV_COLORS.yellow },
            ]}
            onHide={() => toggleHidden("stoch", slotIndex)}
            onRemove={() => removeIndicator("stoch", slotIndex)}
            onSettings={() => setSettingsTarget({ type: "stoch", slotIndex })}
            hidden={hidden.stoch}
          />
        </div>
      )}
`;

code = code.replace(/\{indicators\.volume && paneOffsets\[0\] && \(/, stochPill + '\n      {indicators.volume && paneOffsets[0] && (');

fs.writeFileSync('src/components/chart/PriceChart.tsx', code);
console.log("Done");
