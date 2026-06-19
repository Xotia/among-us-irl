import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";
import { useAuth, saveAuth } from "../lib/auth";
import { UserRole } from "@among-us-irl/shared";
import type { GuestJoinResponse } from "@among-us-irl/shared";

export function GuestJoin() {
  const [searchParams] = useSearchParams();
  const [pseudo, setPseudo] = useState(() => localStorage.getItem("guest_pseudo") ?? "");
  const [gameCode, setGameCode] = useState(searchParams.get("code")?.toUpperCase() ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setAuth } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await apiFetch<GuestJoinResponse>("/auth/guest", {
        method: "POST",
        body: JSON.stringify({ pseudo, gameCode: gameCode.toUpperCase() }),
      });

      const authState = {
        token: res.token,
        role: UserRole.GUEST,
        sessionId: res.sessionId,
        pseudo: res.pseudo,
        gameId: res.gameId,
        gameCode: res.gameCode,
        reconnectToken: res.reconnectToken,
      };
      saveAuth(authState);
      setAuth(authState);
      localStorage.setItem("guest_pseudo", pseudo);
      navigate(`/lobby/${res.gameCode}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold mb-6">Rejoindre une partie</h1>
      <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-4">
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 rounded-lg px-4 py-2 text-sm">
            {error}
          </div>
        )}
        <input
          type="text"
          placeholder="Ton pseudo"
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          className="bg-surface text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-accent"
          required
          minLength={2}
          maxLength={30}
          autoComplete="off"
        />
        <input
          type="text"
          placeholder="Code de la partie"
          value={gameCode}
          onChange={(e) => setGameCode(e.target.value.toUpperCase())}
          className="bg-surface text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-accent uppercase tracking-widest text-center text-xl font-mono"
          required
          minLength={6}
          maxLength={6}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-accent hover:bg-accent/80 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {loading ? "Connexion…" : "Rejoindre"}
        </button>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          ← Retour
        </button>
      </form>
    </div>
  );
}
