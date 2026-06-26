import { NextResponse } from 'next/server';
import fs from 'fs';

export async function POST(req: Request) {
  const body = await req.json();
  fs.appendFileSync('debug_log.json', JSON.stringify({ ...body, timestamp: new Date().toISOString() }) + '\n');
  return NextResponse.json({ ok: true });
}


