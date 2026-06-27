import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth, saveAuth } from "../lib/auth";
import { connectSocket } from "../lib/socket";
import { playMusic, stopMusic } from "../lib/audio";
import { UserRole } from "@among-us-irl/shared";
import type { LobbyPlayerDTO } from "@among-us-irl/shared";

export function Lobby() {
  const { code } = useParams<{ code: string }>();
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<LobbyPlayerDTO[]>([]);
  const [connected, setConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canStart, setCanStart] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [manualRoles, setManualRoles] = useState<Record<string, "CREWMATE" | "IMPOSTOR">>({});

  useEffect(() => {
    if (!auth?.token || !code) {
      navigate("/");
      return;
    }

    if (!auth.gameCode || auth.gameCode !== code) {
      const updated = { ...auth, gameCode: code };
      saveAuth(updated);
    }

    const socket = connectSocket(auth.token, code);
    playMusic("/menu-music.mp3");

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("lobby:update", (updatedPlayers) => {
      setPlayers(updatedPlayers);
    });

    socket.on("player:joined", () => {});
    socket.on("player:left", () => {});

    socket.on("game:started", () => {
      navigate(`/game/${code}`);
    });

    socket.on("connection:sync", (state) => {
      if (state.gameStatus === "RUNNING") {
        navigate(`/game/${code}`);
      }
    });

    return () => {
      stopMusic();
      socket.off("connect");
      socket.off("disconnect");
      socket.off("lobby:update");
      socket.off("player:joined");
      socket.off("player:left");
      socket.off("game:started");
      socket.off("connection:sync");
    };
  }, [auth, code, navigate]);

  useEffect(() => {
    const connectedCount = players.filter((p) => p.isConnected).length;
    setCanStart(connectedCount >= 4);
  }, [players]);

  const copyCode = useCallback(async () => {
    if (!code) return;
    const url = `${window.location.origin}/join?code=${code}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const saveManualRoles = useCallback(async (roles: Record<string, "CREWMATE" | "IMPOSTOR"> | null) => {
    if (!auth?.token || !auth.gameId) return;
    await fetch(`/api/games/${auth.gameId}/manual-roles`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ roles }),
    });
  }, [auth]);

  const toggleManualMode = useCallback(async () => {
    if (manualMode) {
      setManualRoles({});
      await saveManualRoles(null);
    }
    setManualMode((v) => !v);
  }, [manualMode, saveManualRoles]);

  const togglePlayerRole = useCallback(async (playerId: string) => {
    setManualRoles((prev) => {
      const current = prev[playerId] ?? "CREWMATE";
      const next = { ...prev, [playerId]: current === "CREWMATE" ? "IMPOSTOR" as const : "CREWMATE" as const };
      saveManualRoles(next);
      return next;
    });
  }, [saveManualRoles]);

  const handleStart = useCallback(async () => {
    if (!auth?.token || !auth.gameId) return;
    setStarting(true);
    setStartError("");
    try {
      const res = await fetch(`/api/games/${auth.gameId}/start`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setStartError(data.error ?? "Erreur lors du lancement");
        setStarting(false);
        return;
      }
      if (code) {
        sessionStorage.setItem(`game_roles_${code}`, JSON.stringify(data.roles));
        sessionStorage.setItem(`game_id_${code}`, data.gameId);
        navigate(`/game/${code}`);
      }
    } catch {
      setStartError("Erreur réseau");
      setStarting(false);
    }
  }, [auth, code]);

  const connectedCount = players.filter((p) => p.isConnected).length;
  const isAdmin = auth?.role === UserRole.ADMIN;
  const manualImpostorCount = Object.values(manualRoles).filter((r) => r === "IMPOSTOR").length;
  const canStartGame = canStart && (!manualMode || manualImpostorCount >= 1);

  return (
    <div className="flex-1 flex flex-col items-center p-6">
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-3 h-3 rounded-full ${
            connected ? "bg-green-400" : "bg-red-400"
          }`}
        />
        <span className="text-sm text-gray-400">
          {connected ? "Connecté" : "Connexion perdue…"}
        </span>
      </div>

      <h1 className="text-2xl font-bold mb-4">Salon d'attente</h1>

      <button
        onClick={copyCode}
        className="bg-surface rounded-xl px-8 py-4 mb-6 flex flex-col items-center gap-1 hover:bg-surface/80 transition-colors"
      >
        <span className="text-xs text-gray-400 uppercase tracking-wider">
          Code d'invitation
        </span>
        <span className="text-4xl font-mono font-bold tracking-widest">
          {code}
        </span>
        <span className="text-xs text-gray-400">
          {copied ? "Copié !" : "Appuyer pour copier"}
        </span>
      </button>

      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Joueurs</h2>
          <span className="text-sm text-gray-400">
            {connectedCount} connecté{connectedCount > 1 ? "s" : ""}
          </span>
        </div>

        <ul className="space-y-2">
          {players.map((player) => {
            const role = manualRoles[player.id] ?? "CREWMATE";
            return (
              <li
                key={player.id}
                className="bg-surface rounded-lg px-4 py-3 flex items-center gap-3"
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    player.isConnected ? "bg-green-400" : "bg-gray-500"
                  }`}
                />
                <span
                  className={
                    player.isConnected ? "text-white" : "text-gray-500"
                  }
                >
                  {player.pseudo}
                </span>
                {!player.isConnected && (
                  <span className="text-xs text-gray-500 ml-auto">
                    Déconnecté
                  </span>
                )}
                {isAdmin && manualMode && player.isConnected && (
                  <button
                    onClick={() => togglePlayerRole(player.id)}
                    className={`ml-auto text-xs font-bold px-3 py-1 rounded-full transition-colors ${
                      role === "IMPOSTOR"
                        ? "bg-red-500/20 text-red-400"
                        : "bg-blue-500/20 text-blue-400"
                    }`}
                  >
                    {role === "IMPOSTOR" ? "Imposteur" : "Crewmate"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {players.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            En attente de joueurs…
          </p>
        )}
      </div>

      {isAdmin && (
        <div className="w-full max-w-sm mt-6">
          <button
            onClick={toggleManualMode}
            className={`w-full py-2 rounded-lg text-sm font-medium mb-3 transition-colors ${
              manualMode
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "bg-surface text-gray-400 border border-gray-700"
            }`}
          >
            {manualMode ? "Assignation manuelle activée" : "Activer l'assignation manuelle des rôles"}
          </button>
          {manualMode && (() => {
            const impostorCount = Object.values(manualRoles).filter((r) => r === "IMPOSTOR").length;
            return (
              <div className="text-center mb-3">
                <p className="text-xs text-gray-500">
                  Cliquez sur un joueur pour changer son rôle.
                </p>
                <p className={`text-xs font-medium mt-1 ${impostorCount === 0 ? "text-red-400" : "text-gray-400"}`}>
                  {impostorCount} imposteur{impostorCount > 1 ? "s" : ""} sélectionné{impostorCount > 1 ? "s" : ""}
                  {impostorCount === 0 && " — il en faut au moins 1"}
                </p>
              </div>
            );
          })()}
          {startError && (
            <p className="text-red-400 text-sm text-center mb-2">{startError}</p>
          )}
          <button
            onClick={handleStart}
            disabled={!canStartGame || starting}
            className={`w-full py-3 rounded-lg font-bold text-lg transition-colors ${
              canStartGame && !starting
                ? "bg-accent hover:bg-accent/80 text-white"
                : "bg-gray-700 text-gray-500 cursor-not-allowed"
            }`}
          >
            {starting ? "Lancement…" : "Lancer la partie"}
          </button>
          {!canStart && (
            <p className="text-gray-500 text-xs text-center mt-1">
              {connectedCount} joueur{connectedCount > 1 ? "s" : ""} connecté{connectedCount > 1 ? "s" : ""} — minimum 4
            </p>
          )}
        </div>
      )}
    </div>
  );
}
