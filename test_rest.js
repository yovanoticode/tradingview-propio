const fs = require('fs');
const http = require('http');

http.get('http://localhost:4001/bars?symbol=MNQ&count=10&tf=1m&offset=0', (res) => {
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        try {
            const text = rawData.replace(/:\s*(-?\d+),(\d+)/g, ":$1.$2");
            const data = JSON.parse(text);
            const corr = 0; // Ignore corr for now to see relative spacing
            
            const rawBars = data.filter((b) => (b.close ?? b.c ?? 0) > 0);
            const bucketed = new Map();
            for (const b of rawBars) {
                const rawTime = b.time ?? b.Time ?? b.t ?? b.T ?? 0;
                const isMs = rawTime > 100000000000;
                const tSecs = isMs ? rawTime / 1000 : rawTime;
                const time = Math.floor(tSecs / 60) * 60 + corr;
                
                const open = b.open ?? b.o ?? 0;
                const close = b.close ?? b.c ?? 0;
                
                if (!bucketed.has(time)) {
                    bucketed.set(time, { time, open, close });
                } else {
                    const existing = bucketed.get(time);
                    existing.close = close;
                }
            }
            const arr = Array.from(bucketed.values()).sort((a,b)=>a.time - b.time);
            console.log(JSON.stringify(arr, null, 2));
        } catch (e) {
            console.error(e.message);
        }
    });
}).on('error', (e) => {
    console.error(`Got error: ${e.message}`);
});
