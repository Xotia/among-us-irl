import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";
import { useAuth, saveAuth } from "../lib/auth";
import { UserRole } from "@among-us-irl/shared";
import type { LoginResponse } from "@among-us-irl/shared";

export function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setAuth } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      const authState = {
        token: res.token,
        role: UserRole.ADMIN,
        userId: res.user.id,
        username: res.user.username,
      };
      saveAuth(authState);
      setAuth(authState);
      navigate("/admin");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold mb-6">Connexion Admin</h1>
      <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-4">
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 rounded-lg px-4 py-2 text-sm">
            {error}
          </div>
        )}
        <input
          type="text"
          placeholder="Nom d'utilisateur"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="bg-surface text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-accent"
          required
          minLength={3}
          autoComplete="username"
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-surface text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-accent"
          required
          minLength={6}
          autoComplete="current-password"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-accent hover:bg-accent/80 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {loading ? "Connexion…" : "Se connecter"}
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
