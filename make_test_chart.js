const fs = require('fs');
const data = JSON.parse(fs.readFileSync('debug_log.json')).data;
let html = `<!DOCTYPE html>
<html>
<head>
  <script src='https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js'></script>
</head>
<body>
  <div id='chart' style='width: 800px; height: 600px;'></div>
  <script>
    const chart = LightweightCharts.createChart(document.getElementById('chart'));
    const s = chart.addCandlestickSeries();
    s.setData(${JSON.stringify(data)});
  </script>
</body>
</html>`;
fs.writeFileSync('test_chart.html', html);
