import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, loadAuth, saveAuth } from "../lib/auth";
import { UserRole } from "@among-us-irl/shared";
import type { ReconnectResponse } from "@among-us-irl/shared";

export function Home() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    const auth = loadAuth();
    if (!auth) return;

    if (auth.gameCode) {
      if (auth.role === UserRole.GUEST && auth.reconnectToken) {
        setReconnecting(true);
        fetch("/api/auth/reconnect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reconnectToken: auth.reconnectToken }),
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data: ReconnectResponse | null) => {
            if (!data) {
              setReconnecting(false);
              return;
            }
            const newAuth = {
              token: data.token,
              role: UserRole.GUEST as const,
              sessionId: data.sessionId,
              pseudo: data.pseudo,
              gameId: data.gameId,
              gameCode: data.gameCode,
              reconnectToken: auth.reconnectToken,
            };
            saveAuth(newAuth);
            setAuth(newAuth);
            const target = data.gameStatus === "RUNNING"
              ? `/game/${data.gameCode}`
              : `/lobby/${data.gameCode}`;
            navigate(target, { replace: true });
          })
          .catch(() => setReconnecting(false));
      } else if (auth.role === UserRole.ADMIN) {
        navigate(`/lobby/${auth.gameCode}`, { replace: true });
      }
    }
  }, [navigate, setAuth]);

  if (reconnecting) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-400">Reconnexion en cours…</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <h1 className="text-4xl font-bold mb-4">Among Us IRL</h1>
      <p className="text-lg text-gray-400 mb-8">
        Jouez à Among Us dans la vraie vie
      </p>
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button
          onClick={() => navigate("/join")}
          className="bg-accent hover:bg-accent/80 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Rejoindre une partie
        </button>
        <button
          onClick={() => navigate("/login")}
          className="bg-surface hover:bg-surface/80 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Connexion Admin
        </button>
      </div>
    </div>
  );
}
