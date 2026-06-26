const fs = require('fs');
let code = fs.readFileSync('src/components/chart/PriceChart.tsx', 'utf8');
code = code.replace('import { useChartStore } from', 'import { nt8TimestampCorrection } from "@/lib/nt8/ws";\nimport { useChartStore } from');
fs.writeFileSync('src/components/chart/PriceChart.tsx', code);
