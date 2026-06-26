const http = require('http');

http.get('http://localhost:4001/bars?symbol=MNQ&count=1000&tf=1m&offset=0', (res) => {
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        try {
            const text = rawData.replace(/:\s*(-?\d+),(\d+)/g, ":$1.$2");
            const data = JSON.parse(text);
            
            const rawBars = data.filter((b) => (b.close ?? b.c ?? 0) > 0);
            const bucketed = new Map();
            for (const b of rawBars) {
                const rawTime = b.time ?? b.Time ?? b.t ?? b.T ?? 0;
                const isMs = rawTime > 100000000000;
                const tSecs = isMs ? rawTime / 1000 : rawTime;
                const time = Math.floor(tSecs / 60) * 60;
                
                const open = b.open ?? b.o ?? 0;
                const close = b.close ?? b.c ?? 0;
                
                if (!bucketed.has(time)) {
                    bucketed.set(time, { time, open, close });
                } else {
                    bucketed.get(time).close = close;
                }
            }
            const arr = Array.from(bucketed.values()).sort((a,b)=>a.time - b.time);
            
            let duplicates = 0;
            let flatGaps = 0;
            for (let i = 1; i < arr.length; i++) {
                if (arr[i].time === arr[i-1].time) duplicates++;
                if (arr[i].open === arr[i-1].open && arr[i].close === arr[i-1].close) flatGaps++;
            }
            
            console.log("Total bars: " + arr.length);
            console.log("Duplicates: " + duplicates);
            console.log("Flat periods: " + flatGaps);
            if (arr.length > 0) {
               console.log("First time:", arr[0].time, "Last time:", arr[arr.length - 1].time);
            }
        } catch (e) {
            console.error(e.message);
        }
    });
});
