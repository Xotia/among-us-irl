import { useState, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Home } from "./pages/Home";
import { AdminLogin } from "./pages/AdminLogin";
import { GuestJoin } from "./pages/GuestJoin";
import { CreateGame } from "./pages/CreateGame";
import { GameConfig } from "./pages/GameConfig";
import { Lobby } from "./pages/Lobby";
import { Game } from "./pages/Game";
import { AuthContext, loadAuth, clearAuth } from "./lib/auth";
import type { AuthState } from "./lib/auth";
import { UserRole } from "@among-us-irl/shared";

function AdminGuard({ children }: { children: React.ReactNode }) {
  const auth = loadAuth();
  if (!auth || auth.role !== UserRole.ADMIN) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function AdminDashboard() {
  const auth = loadAuth();
  const navigate = useNavigate();
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState("");
  const handleLogout = useCallback(() => {
    clearAuth();
    window.location.href = "/";
  }, []);

  const handleReset = useCallback(async () => {
    if (!auth?.token) return;
    if (!window.confirm("Supprimer toutes les parties et déconnecter tous les joueurs ?")) return;
    setResetting(true);
    setResetMsg("");
    try {
      const res = await fetch("/api/games/reset", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setResetMsg(data.error ?? "Erreur");
      } else {
        setResetMsg(`${data.deleted} partie(s) supprimée(s)`);
      }
    } catch {
      setResetMsg("Erreur réseau");
    } finally {
      setResetting(false);
    }
  }, [auth]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold mb-4">Tableau de bord Admin</h1>
      <p className="text-gray-400 mb-6">Bienvenue, {auth?.username}</p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={() => navigate("/admin/create")}
          className="bg-accent hover:bg-accent/80 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Créer une partie
        </button>
        <button
          onClick={handleReset}
          disabled={resetting}
          className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          {resetting ? "Suppression…" : "Supprimer toutes les parties"}
        </button>
        {resetMsg && (
          <p className="text-sm text-center text-gray-300">{resetMsg}</p>
        )}
        <button
          onClick={handleLogout}
          className="bg-surface hover:bg-surface/80 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(loadAuth);

  const logout = useCallback(() => {
    clearAuth();
    setAuth(null);
  }, []);

  return (
    <AuthContext.Provider value={{ auth, setAuth, logout }}>
      <BrowserRouter>
        <div className="min-h-screen bg-primary text-white flex flex-col">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<AdminLogin />} />
            <Route path="/join" element={<GuestJoin />} />
            <Route path="/lobby/:code" element={<Lobby />} />
            <Route path="/game/:code" element={<Game />} />
            <Route
              path="/admin"
              element={
                <AdminGuard>
                  <AdminDashboard />
                </AdminGuard>
              }
            />
            <Route
              path="/admin/create"
              element={
                <AdminGuard>
                  <CreateGame />
                </AdminGuard>
              }
            />
            <Route
              path="/admin/games/:id"
              element={
                <AdminGuard>
                  <GameConfig />
                </AdminGuard>
              }
            />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
