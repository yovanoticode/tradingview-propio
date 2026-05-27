"use client";

import { useState, useEffect } from "react";
import { Activity, Loader2, KeyRound } from "lucide-react";
import { useChartStore } from "@/lib/store/chart-store";
import { loginTradovate } from "@/lib/tradovate/rest";
import { getTradovateWS } from "@/lib/tradovate/ws";
import { cn } from "@/lib/utils";

export function TradovateConnect() {
  const tradovateToken = useChartStore((s) => s.tradovateToken);
  const tradovateEnv   = useChartStore((s) => s.tradovateEnv);
  const tradovateConnected = useChartStore((s) => s.tradovateConnected);
  const setTradovate   = useChartStore((s) => s.setTradovate);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [env, setEnv] = useState<"demo" | "live">("demo");
  const [mfa, setMfa] = useState(false);
  const [code, setCode] = useState("");
  const [pTicket, setPTicket] = useState("");
  const [error, setError] = useState("");

  // Auto-connect WS on mount if token exists
  useEffect(() => {
    if (tradovateToken && !tradovateConnected) {
      getTradovateWS().connect(tradovateToken, tradovateEnv);
      setTradovate(true);
    }
  }, [tradovateToken, tradovateEnv, tradovateConnected, setTradovate]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await loginTradovate(
        username,
        password,
        env,
        mfa ? pTicket : undefined,
        mfa ? code : undefined
      );

      if (res.mfa && res.pTicket) {
        setMfa(true);
        setPTicket(res.pTicket);
        setLoading(false);
        return;
      }

      if (res.accessToken) {
        setTradovate(true, res.accessToken, env);
        getTradovateWS().connect(res.accessToken, env);
        setOpen(false);
        setMfa(false);
        setCode("");
        setUsername("");
        setPassword("");
      } else {
        setError(res.error || "Error al autenticar");
      }
    } catch (err: any) {
      setError(err.message || "Error al conectar con el servidor");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    getTradovateWS().disconnect();
    setTradovate(false, null);
  };

  const textColor = tradovateConnected ? "text-[#f59e0b]" : "text-tv-text-muted";
  const dotColor = tradovateConnected ? "bg-[#f59e0b]" : "";
  const title = tradovateConnected
    ? `Tradovate Conectado (${tradovateEnv}) · Click para desconectar`
    : "Conectar Tradovate API";

  return (
    <>
      <button
        onClick={tradovateConnected ? handleDisconnect : () => setOpen(true)}
        className={cn(
          "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition-colors hover:bg-tv-panel-hover",
          textColor
        )}
        title={title}
      >
        {tradovateConnected ? (
          <>
            <span className={cn("inline-flex h-1.5 w-1.5 rounded-full animate-pulse", dotColor)} />
            <Activity className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Tradovate</span>
          </>
        ) : (
          <>
            <KeyRound className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Tradovate</span>
          </>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-[320px] rounded-lg border border-tv-border bg-tv-panel p-5 shadow-2xl">
            <h3 className="mb-4 text-sm font-semibold text-tv-text flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[#f59e0b]" />
              Conectar Tradovate
            </h3>
            
            <form onSubmit={handleConnect} className="space-y-4">
              {!mfa ? (
                <>
                  <div>
                    <label className="block text-[10px] uppercase text-tv-text-muted mb-1 font-semibold">Usuario</label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full rounded border border-tv-border bg-tv-bg px-2.5 py-1.5 text-xs text-tv-text outline-none focus:border-tv-blue"
                      placeholder="Usuario de Tradovate"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase text-tv-text-muted mb-1 font-semibold">Contraseña</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded border border-tv-border bg-tv-bg px-2.5 py-1.5 text-xs text-tv-text outline-none focus:border-tv-blue"
                      placeholder="Contraseña"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase text-tv-text-muted mb-1 font-semibold">Entorno</label>
                    <select
                      value={env}
                      onChange={(e) => setEnv(e.target.value as "demo" | "live")}
                      className="w-full rounded border border-tv-border bg-tv-bg px-2 py-1.5 text-xs text-tv-text outline-none focus:border-tv-blue"
                    >
                      <option value="demo">Demo / Simulación</option>
                      <option value="live">En vivo / Producción</option>
                    </select>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-[10px] uppercase text-tv-text-muted mb-1 font-semibold">Código MFA / Verificación</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full rounded border border-tv-border bg-tv-bg px-2.5 py-1.5 text-xs text-tv-text outline-none focus:border-tv-blue"
                    placeholder="Código SMS o email"
                  />
                  <p className="mt-1 text-[10px] text-tv-text-muted">Introduce el código de seguridad enviado por Tradovate.</p>
                </div>
              )}

              {error && (
                <div className="rounded bg-tv-red/10 border border-tv-red/20 p-2 text-[11px] text-tv-red">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setOpen(false); setMfa(false); setError(""); }}
                  className="rounded px-3 py-1.5 text-xs text-tv-text hover:bg-tv-panel-hover"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded bg-[#f59e0b] px-4 py-1.5 text-xs font-semibold text-black hover:bg-[#ffa726] disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    "Conectar"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
