import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const symbols = req.nextUrl.searchParams.get("symbols") ?? "";
  const url = `https://query2.finance.yahoo.com/v8/finance/quote?symbols=${encodeURIComponent(symbols)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
  });
  if (!res.ok)
    return NextResponse.json({ quoteResponse: { result: [] } }, { status: 200 });
  const data = await res.json();
  return NextResponse.json(data);
}
