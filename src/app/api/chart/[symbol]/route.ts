import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const interval = req.nextUrl.searchParams.get("interval") ?? "15m";
  const range = req.nextUrl.searchParams.get("range") ?? "5d";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
  });
  if (!res.ok)
    return NextResponse.json({ error: "upstream error" }, { status: res.status });
  const data = await res.json();
  return NextResponse.json(data);
}
