const fs = require('fs');
let code = fs.readFileSync('src/components/chart/PriceChart.tsx', 'utf8');

const newLogic = `        // Helper: apply a price update to the current candle
        const applyLivePrice = (tick: { price: number; symbol?: string; time?: number; volume?: number }) => {
          if (!candleSeriesRef.current) return;
          if (useChartStore.getState().replayActive) return; // pause during replay
          if (tick.symbol) {
            const symPrefix = symbol.split(/[=-]/)[0].toUpperCase();
            const nt8Prefix = tick.symbol.split(/\\s/)[0].toUpperCase();
            if (symPrefix !== nt8Prefix) return;
          }
          const price = tick.price;
          const arr = candlesRef.current;
          if (arr.length === 0) return;

          // Bucket determination
          let tickTime = tick.time ?? (Date.now() / 1000);
          if (tickTime > 100000000000) tickTime = tickTime / 1000;
          const tickMinute = Math.floor(tickTime / 60) * 60 + nt8TimestampCorrection();
          
          const TF_SECS: Partial<Record<Timeframe, number>> = {
            "5m": 300, "15m": 900, "30m": 1800, "1h": 3600, "4h": 14400,
          };
          const bucketSecs = TF_SECS[timeframe];
          const bucketTime = bucketSecs ? Math.floor(tickMinute / bucketSecs) * bucketSecs : tickMinute;

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

          let last = arr[arr.length - 1];
          if (bucketTime > (last.time as number)) {
            // New bucket!
            last = { time: bucketTime, open: price, high: price, low: price, close: price, volume: tick.volume ?? 0 };
            arr.push(last);
          } else {
            // Update current
            last.close = price;
            last.high = Math.max(last.high, price);
            last.low = Math.min(last.low, price);
            if (tick.volume) last.volume += tick.volume;
          }

          candleSeriesRef.current.update({
            time: last.time as UTCTimestamp,
            open: last.open,
            high: last.high,
            low: last.low,
            close: last.close,
          });

          updateEMAs();
          updateRSI();
          updateMACD();
          updateStoch();
          const prev = arr[arr.length - 2] ?? last;
          setLastPrice({
            value: price,
            pct: prev && prev.close !== 0 ? ((price - prev.close) / prev.close) * 100 : 0,
          });
        };

        const applyFullBar = (b: { type: "bar" | "bar_close"; symbol?: string; time: number; open: number; high: number; low: number; close: number; volume: number }) => {
          if (!candleSeriesRef.current) return;
          if (useChartStore.getState().replayActive) return; // pause during replay
          
          if (b.type === "bar_close") {
            const arr = candlesRef.current;
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
        };`;

const lines = code.split('\\n');
const startLine = lines.findIndex(l => l.includes('const applyLivePrice = (tick: { price: number; symbol?: string }) => {'));
const endLine = lines.findIndex((l, i) => i > startLine && l.includes('const prev = arr[arr.length - 2];') && lines[i+1].includes('setLastPrice({'));

if (startLine === -1 || endLine === -1) {
    console.log("Could not find start or end line");
    console.log("start", startLine, "end", endLine);
} else {
    // Find the end of applyFullBar which is after the setLastPrice block
    let actualEnd = endLine;
    while(actualEnd < lines.length && !lines[actualEnd].includes('};')) {
        actualEnd++;
    }
    const before = lines.slice(0, startLine - 1).join('\\n'); // include the comment
    const after = lines.slice(actualEnd + 1).join('\\n');
    fs.writeFileSync('src/components/chart/PriceChart.tsx', before + '\\n' + newLogic + '\\n' + after);
    console.log("Success");
}
