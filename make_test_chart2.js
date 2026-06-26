const fs = require('fs');
const data = JSON.parse(fs.readFileSync('debug_log.json')).data;
let html = `<!DOCTYPE html>
<html>
<head>
  <script src='https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js'></script>
  <style>body { background: #131722; color: #d1d4dc; }</style>
</head>
<body>
  <div id='chart' style='width: 800px; height: 600px;'></div>
  <script>
    const chart = LightweightCharts.createChart(document.getElementById('chart'), {
      layout: { background: { color: '#131722' }, textColor: '#d1d4dc' }
    });
    const s = chart.addCandlestickSeries({
      upColor: '#26a69a', downColor: '#ef5350', borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350'
    });
    s.setData(${JSON.stringify(data)});
    
    const v = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      color: '#787b86',
    });
    v.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    v.setData(${JSON.stringify(data.map(k => ({
      time: k.time,
      value: k.volume,
      color: k.close >= k.open ? '#26a69a66' : '#ef535066'
    })))});
  </script>
</body>
</html>`;
fs.writeFileSync('test_chart_with_volume.html', html);
