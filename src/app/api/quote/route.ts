import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols") ?? "";
  const allSymbols = symbolsParam.split(",").filter(Boolean);
  if (allSymbols.length === 0) return NextResponse.json({ quoteResponse: { result: [] } }, { status: 200 });

  // Yahoo spark API limits to 20 symbols per request
  const chunkSize = 20;
  const chunks = [];
  for (let i = 0; i < allSymbols.length; i += chunkSize) {
    chunks.push(allSymbols.slice(i, i + chunkSize));
  }

  const results: any[] = [];

  await Promise.allSettled(
    chunks.map(async (chunk) => {
      const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(chunk.join(","))}&range=1d&interval=1m`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      
      const chunkResult = (data.spark?.result || []).map((r: any) => {
        const meta = r.response[0]?.meta || {};
        const price = meta.regularMarketPrice || 0;
        const prev = meta.previousClose || price;
        const pct = prev > 0 ? ((price - prev) / prev) * 100 : 0;
        return {
          symbol: r.symbol,
          regularMarketPrice: price,
          regularMarketChangePercent: pct,
          marketCap: 0,
        };
      });
      results.push(...chunkResult);
    })
  );

  return NextResponse.json({ quoteResponse: { result: results } });
}
