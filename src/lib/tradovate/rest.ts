export interface TradovateAuthResponse {
  accessToken?: string;
  expirationTime?: string;
  userId?: number;
  mfa?: boolean;
  pTicket?: string;
  error?: string;
}

export async function loginTradovate(
  name: string,
  password: string,
  env: "demo" | "live" = "demo",
  pTicket?: string,
  pCaptcha?: string
): Promise<TradovateAuthResponse> {
  const res = await fetch("/api/tradovate/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, password, env, pTicket, pCaptcha }),
  });
  return res.json();
}
