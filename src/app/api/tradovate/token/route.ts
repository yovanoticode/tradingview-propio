import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { name, password, env = "live", pTicket, pCaptcha } = await req.json();
  if (!name || !password)
    return NextResponse.json({ error: "Credenciales requeridas" }, { status: 400 });

  const base =
    env === "demo"
      ? "https://demo.tradovateapi.com/v1"
      : "https://live.tradovateapi.com/v1";

  const body: Record<string, unknown> = {
    name,
    password,
    appId: "Sample App",
    appVersion: "1.0",
    cid: 8,
    sec: "2ccd1f4e-b273-4b40-8f01-1fac59a8762b",
  };

  // MFA second step — include ticket + code
  if (pTicket && pCaptcha) {
    body["p-ticket"] = pTicket;
    body["p-captcha"] = pCaptcha;
  }

  const res = await fetch(`${base}/auth/accesstokenrequest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  // MFA required — return ticket so the client can ask for the code
  if (data["p-ticket"]) {
    return NextResponse.json(
      { mfa: true, pTicket: data["p-ticket"] },
      { status: 200 },
    );
  }

  if (!data.accessToken)
    return NextResponse.json(
      { error: (data.errorText as string) ?? (data.error as string) ?? JSON.stringify(data) },
      { status: 401 },
    );

  return NextResponse.json({
    accessToken: data.accessToken,
    expirationTime: data.expirationTime,
    userId: data.userId,
  });
}
