import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { getSocket, connectSocket } from "../lib/socket";
import { apiFetch } from "../lib/api";
import { RoleReveal } from "./RoleReveal";
import { playSound, playMusic, stopMusic } from "../lib/audio";
import { UserRole, MeetingState, SabotageState, SabotageType } from "@among-us-irl/shared";
import type {
  RoleAssignmentDTO,
  TaskDTO,
  GameOverDTO,
  PlayerDTO,
  MeetingDTO,
  VoteResultDTO,
  SabotageDTO,
} from "@among-us-irl/shared";

export function Game() {
  const { code } = useParams<{ code: string }>();
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<RoleAssignmentDTO | null>(null);
  const [showReveal, setShowReveal] = useState(false);
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [adminRoles, setAdminRoles] = useState<Record<string, string> | null>(
    null
  );
  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [gameOver, setGameOver] = useState<GameOverDTO | null>(null);
  const [players, setPlayers] = useState<PlayerDTO[]>([]);
  const [isDead, setIsDead] = useState(false);
  const [killingPlayerId, setKillingPlayerId] = useState<string | null>(null);
  const [, setMyPlayerId] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(() =>
    sessionStorage.getItem(`game_id_${code}`)
  );
  const [meeting, setMeeting] = useState<MeetingDTO | null>(null);
  const [voteResult, setVoteResult] = useState<VoteResultDTO | null>(null);
  const [myVote, setMyVote] = useState<string | null | undefined>(undefined);
  const [meetingTimeLeft, setMeetingTimeLeft] = useState("");
  const [forcingMeeting, setForcingMeeting] = useState(false);
  const [sabotage, setSabotage] = useState<SabotageDTO | null>(null);
  const [sabotageTimeLeft, setSabotageTimeLeft] = useState("");
  const [oxygenCodeInput, setOxygenCodeInput] = useState("");
  const [resolvingEnergy, setResolvingEnergy] = useState(false);
  const [connected, setConnected] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [oxygenCode, setOxygenCode] = useState<string | null>(null);
  const [timerWarning, setTimerWarning] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const serverOffsetRef = useRef(0);
  const [meetingCooldownLeft, setMeetingCooldownLeft] = useState(0);

  useEffect(() => {
    if (meetingCooldownLeft <= 0) return;
    const interval = setInterval(() => {
      setMeetingCooldownLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [meetingCooldownLeft]);

  useEffect(() => {
    if (sabotage?.state === SabotageState.ACTIVE) {
      playMusic("/alarm.mp3");
    } else {
      stopMusic();
    }
    return () => stopMusic();
  }, [sabotage?.state]);

  useEffect(() => {
    if (!auth?.token || !code) {
      navigate("/");
      return;
    }

    let socket = getSocket();
    if (!socket) {
      socket = connectSocket(auth.token, code);
    }

    if (socket.connected) {
      socket.emit("game:join", code, auth.token);
    }

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("role:assigned", (data) => {
      setAssignment(data);
      setShowReveal(true);
      stopMusic();
      playSound("/game-start.mp3");
    });

    socket.on("game:timer", (endsAt) => {
      setTimerEndsAt(endsAt);
    });

    socket.on("task:completed", (task) => {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
      playSound("/task-complete.mp3");
    });

    socket.on("task:uncompleted", (task) => {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
    });

    socket.on("tasks:progress", (completed, total) => {
      setProgress({ completed, total });
    });

    socket.on("game:over", (result) => {
      setGameOver(result);
      stopMusic();
      if (result.winner === "CREWMATES") {
        playSound("/victory-crewmates.mp3");
      } else if (result.winner === "IMPOSTORS") {
        playSound("/victory-impostors.mp3");
      }
    });

    socket.on("player:died", (playerId) => {
      setPlayers((prev) =>
        prev.map((p) => (p.id === playerId ? { ...p, isAlive: false } : p))
      );
      setMyPlayerId((myId) => {
        if (myId === playerId) setIsDead(true);
        return myId;
      });
    });

    socket.on("players:update", (updatedPlayers) => {
      setPlayers(updatedPlayers);
    });

    socket.on("meeting:update", (m) => {
      setMeeting(m);
      if (m.state === MeetingState.IDLE) {
        setVoteResult(null);
        setMyVote(undefined);
        setMeetingCooldownLeft(15);
      }
    });

    socket.on("meeting:result", (result) => {
      setVoteResult(result);
      if (result.eliminatedPlayerId) {
        playSound("/player-ejected.mp3");
      }
    });

    socket.on("sabotage:update", (s) => {
      setSabotage(s);
      if (s.state === SabotageState.NONE) {
        setSabotage(null);
      }
    });

    socket.on("sabotage:resolved", () => {
      setOxygenCodeInput("");
    });

    socket.on("connection:sync", (state) => {
      serverOffsetRef.current = state.serverTime - Date.now();
      setTasks(state.tasks);
      setProgress({
        completed: state.tasks.filter((t) => t.isCompleted).length,
        total: state.tasks.length,
      });
      setPlayers(state.players);
      setMyPlayerId(state.myPlayerId);
      setGameId(state.gameId);
      if (code) sessionStorage.setItem(`game_id_${code}`, state.gameId);
      if (state.myRole) {
        setAssignment((prev) => {
          if (!prev) {
            setShowReveal(true);
            stopMusic();
            playSound("/game-start.mp3");
          }
          return prev ?? { role: state.myRole, coImpostors: state.coImpostors };
        });
      }
      if (state.myLifeState !== "ALIVE") {
        setIsDead(true);
      }
      if (state.gameTimerEndsAt) {
        setTimerEndsAt(state.gameTimerEndsAt);
      }
      setMeeting(state.meeting);
      setSabotage(state.sabotage);
    });

    if (auth.role === UserRole.ADMIN) {
      const stored = sessionStorage.getItem(`game_roles_${code}`);
      if (stored) {
        setAdminRoles(JSON.parse(stored));
      }
      const gid = gameId ?? sessionStorage.getItem(`game_id_${code}`);
      if (gid) {
        apiFetch<{ config: { oxygenCode?: string } }>(`/games/${gid}`)
          .then((g) => setOxygenCode(g.config?.oxygenCode ?? null))
          .catch(() => {});
      }
    }

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("role:assigned");
      socket.off("game:timer");
      socket.off("task:completed");
      socket.off("task:uncompleted");
      socket.off("tasks:progress");
      socket.off("game:over");
      socket.off("player:died");
      socket.off("players:update");
      socket.off("meeting:update");
      socket.off("meeting:result");
      socket.off("sabotage:update");
      socket.off("sabotage:resolved");
      socket.off("connection:sync");
    };
  }, [auth, code, navigate]);

  useEffect(() => {
    if (!timerEndsAt) return;
    const interval = setInterval(() => {
      const now = Date.now() + serverOffsetRef.current;
      const remaining = Math.max(0, timerEndsAt - now);
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, "0")}`);
      setTimerWarning(remaining > 0 && remaining <= 60000);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerEndsAt]);

  useEffect(() => {
    if (!meeting?.timerEndsAt) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, meeting.timerEndsAt! - (Date.now() + serverOffsetRef.current));
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setMeetingTimeLeft(`${minutes}:${seconds.toString().padStart(2, "0")}`);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [meeting?.timerEndsAt]);

  useEffect(() => {
    if (!sabotage?.timerEndsAt || sabotage.state === SabotageState.NONE) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, sabotage.timerEndsAt! - (Date.now() + serverOffsetRef.current));
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setSabotageTimeLeft(`${minutes}:${seconds.toString().padStart(2, "0")}`);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [sabotage?.timerEndsAt, sabotage?.state]);

  function handleTriggerSabotage(type: SabotageType) {
    const socket = getSocket();
    if (!socket || isDead) return;
    socket.emit("sabotage:trigger", type);
  }

  function handleResolveOxygen() {
    const socket = getSocket();
    if (!socket) return;
    socket.emit("sabotage:resolve", oxygenCodeInput);
    setOxygenCodeInput("");
  }

  async function handleResolveEnergy() {
    if (!auth?.token || !gameId) return;
    setResolvingEnergy(true);
    try {
      await fetch(`/api/games/${gameId}/resolve-sabotage`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.token}`,
          "Content-Type": "application/json",
        },
      });
    } finally {
      setResolvingEnergy(false);
    }
  }

  function handleCallMeeting() {
    const socket = getSocket();
    if (!socket || isDead) return;
    socket.emit("meeting:call");
    playSound("/meeting-called.mp3");
  }

  function handleReportBody() {
    const socket = getSocket();
    if (!socket || isDead) return;
    socket.emit("meeting:report");
    playSound("/body-reported.mp3");
  }

  const handleVote = useCallback((targetPlayerId: string | null) => {
    const socket = getSocket();
    if (!socket || isDead) return;
    socket.emit("vote:cast", targetPlayerId);
    setMyVote(targetPlayerId);
  }, [isDead]);

  async function handleForceMeeting() {
    if (!auth?.token || !gameId) return;
    setForcingMeeting(true);
    try {
      await fetch(`/api/games/${gameId}/force-meeting`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.token}`,
          "Content-Type": "application/json",
        },
      });
    } finally {
      setForcingMeeting(false);
    }
  }

  async function handleTaskToggle(task: TaskDTO) {
    if (isDead && !isAdmin) return;
    if (isAdmin && auth?.token && gameId) {
      await fetch(`/api/games/${gameId}/tasks/${task.id}/toggle`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.token}`,
          "Content-Type": "application/json",
        },
      });
      return;
    }
    const socket = getSocket();
    if (!socket) return;
    if (task.isCompleted) {
      socket.emit("task:uncomplete", task.id);
    } else {
      socket.emit("task:complete", task.id);
    }
  }

  async function handleKillPlayer(playerId: string) {
    if (!auth?.token || !gameId) return;
    setKillingPlayerId(playerId)
    try {
      const res = await fetch(`/api/games/${gameId}/players/${playerId}/kill`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) {
        const data = await res.json();
        console.error(data.error);
      }
    } finally {
      setKillingPlayerId(null);
    }
  }

  async function handleCancelGame() {
    if (!auth?.token || !gameId) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/games/${gameId}/cancel`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) {
        const data = await res.json();
        console.error("cancel error:", data.error);
      }
    } finally {
      setCancelling(false);
    }
  }

  const isAdmin = auth?.role === UserRole.ADMIN;

  if (isDead && !gameOver && !isAdmin) {
    return (
      <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-6">
        <div className="text-center">
          <div className="text-6xl mb-6">💀</div>
          <h1 className="text-4xl font-bold text-red-500 mb-4">
            Vous êtes mort
          </h1>
          <p className="text-gray-400 text-lg mb-8">
            Vous ne pouvez plus agir dans cette partie.
          </p>
          <div className="bg-surface rounded-xl p-4 max-w-sm w-full">
            <p className="text-sm text-gray-500">
              Attendez la fin de la partie pour voir les résultats.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isMeetingActive = meeting && meeting.state !== MeetingState.IDLE;

  if (isMeetingActive && !isDead && !isAdmin && !gameOver) {
    const alivePlayers = players.filter((p) => p.isAlive);
    return (
      <div className="fixed inset-0 bg-black/95 flex flex-col items-center z-50 p-6 overflow-y-auto">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold mb-2">
              {meeting.isBodyReport ? "Corps signalé !" : "Rassemblement !"}
            </h1>
            <p className="text-gray-400 text-sm">
              Déclenché par {meeting.triggeredBy}
            </p>
            {meeting.timerEndsAt && (
              <span className="inline-block mt-2 bg-amber-900/50 text-amber-300 px-4 py-1 rounded-full text-lg font-mono">
                {meetingTimeLeft}
              </span>
            )}
          </div>

          {voteResult ? (
            <div className="bg-surface rounded-2xl p-6 text-center">
              <h2 className="text-xl font-bold mb-2">
                {voteResult.eliminatedPlayerId
                  ? `${players.find((p) => p.id === voteResult.eliminatedPlayerId)?.pseudo ?? "Un joueur"} a été éjecté !`
                  : "Personne n'est éjecté."}
              </h2>
              {voteResult.eliminatedRole && (
                <p className={`text-lg font-semibold mb-4 ${
                  voteResult.eliminatedRole === "IMPOSTOR" ? "text-red-400" : "text-cyan-400"
                }`}>
                  {voteResult.eliminatedRole === "IMPOSTOR" ? "C'était un Imposteur !" : "C'était un Crewmate."}
                </p>
              )}
              {voteResult.eliminatedPlayerId && !voteResult.eliminatedRole && (
                <p className="text-gray-500 text-sm mb-4 italic">Rôle non révélé.</p>
              )}
              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Votes
                </h3>
                {Object.entries(voteResult.votes).map(([voter, target]) => (
                  <div
                    key={voter}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{voter}</span>
                    <span className="text-gray-400">→</span>
                    <span
                      className={
                        target === "SKIP"
                          ? "text-gray-500 italic"
                          : "text-white"
                      }
                    >
                      {target === "SKIP" ? "Passer" : target}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : meeting.state === MeetingState.VOTING ? (
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Votez pour éjecter
              </h2>
              <ul className="space-y-2 mb-4">
                {alivePlayers.map((player) => (
                  <li key={player.id}>
                    <button
                      onClick={() => handleVote(player.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        myVote === player.id
                          ? "bg-red-900/60 border-2 border-red-500"
                          : "bg-surface hover:bg-gray-700"
                      }`}
                    >
                      {player.pseudo}
                    </button>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleVote(null)}
                className={`w-full px-4 py-3 rounded-lg transition-colors ${
                  myVote === null
                    ? "bg-gray-600 border-2 border-gray-400"
                    : "bg-surface hover:bg-gray-700"
                }`}
              >
                Passer (ne pas voter)
              </button>
              {myVote !== undefined && (
                <p className="text-center text-gray-400 text-sm mt-3">
                  Vote enregistré. Appuyez sur un autre choix pour changer.
                </p>
              )}
            </div>
          ) : (
            <div className="text-center">
              <div className="bg-surface rounded-2xl p-6">
                <p className="text-lg">Phase de discussion</p>
                <p className="text-gray-400 text-sm mt-2">
                  Discutez entre vous pour identifier les imposteurs.
                  Le vote commencera automatiquement.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const isSabotageActive = sabotage?.state === SabotageState.ACTIVE;

  if (isSabotageActive && !isDead && !gameOver) {
    return (
      <div className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center z-50 p-6">
        <div className="w-full max-w-sm text-center">
          <div className="text-5xl mb-4 animate-pulse">⚠️</div>
          <h1 className="text-3xl font-bold text-red-400 mb-2">
            {sabotage.type === SabotageType.OXYGEN ? "Sabotage Oxygène !" : "Sabotage Énergie !"}
          </h1>
          {sabotage.timerEndsAt && (
            <span className="inline-block mb-6 bg-red-900/50 text-red-300 px-4 py-1 rounded-full text-2xl font-mono">
              {sabotageTimeLeft}
            </span>
          )}

          {sabotage.type === SabotageType.OXYGEN ? (
            <div className="bg-surface rounded-2xl p-6">
              {!isAdmin && (
                <>
                  <p className="text-red-300 font-semibold mb-2">
                    🤫 Vous n'avez plus le droit de parler !
                  </p>
                  <p className="text-gray-400 text-sm mb-4">
                    Entrez le code pour rétablir l'oxygène.
                  </p>
                  <div className="flex flex-col gap-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={oxygenCodeInput}
                      onChange={(e) => setOxygenCodeInput(e.target.value.replace(/\D/g, ""))}
                      placeholder="Code…"
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-center text-2xl font-mono tracking-widest focus:outline-none focus:border-red-400"
                    />
                    <button
                      onClick={handleResolveOxygen}
                      disabled={!oxygenCodeInput}
                      className="w-full bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-colors"
                    >
                      Valider
                    </button>
                  </div>
                </>
              )}
              {isAdmin && (
                <div className="text-center">
                  <p className="text-gray-400 text-sm mb-3">
                    En attente de la résolution par les joueurs…
                  </p>
                  {oxygenCode && (
                    <div className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-3">
                      <p className="text-gray-400 text-xs mb-1">Code de désactivation</p>
                      <p className="text-3xl font-mono font-bold tracking-widest text-red-400">
                        {oxygenCode}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-surface rounded-2xl p-6">
              {!isAdmin && (
                <p className="text-gray-400 text-sm mb-4">
                  Effectuez le mini-jeu IRL pour rétablir l'énergie.
                </p>
              )}
              {isAdmin && (
                <button
                  onClick={handleResolveEnergy}
                  disabled={resolvingEnergy}
                  className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl transition-colors"
                >
                  {resolvingEnergy ? "..." : "Énergie rétablie (admin)"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (gameOver) {
    const eventLabels: Record<string, string> = {
      GAME_STARTED: "Partie lancée",
      GAME_ENDED: "Partie terminée",
      PLAYER_DIED: "Joueur tué",
      BODY_REPORTED: "Corps signalé",
      MEETING_CALLED: "Rassemblement",
      MEETING_FORCED: "Rassemblement forcé",
      MEETING_RESOLVED: "Vote résolu",
      SABOTAGE_TRIGGERED: "Sabotage déclenché",
      SABOTAGE_RESOLVED: "Sabotage résolu",
      SABOTAGE_FAILED: "Sabotage échoué",
    };

    return (
      <div className="flex-1 flex flex-col items-center p-6 overflow-y-auto">
        <div className="bg-surface rounded-2xl p-8 max-w-sm w-full text-center">
          <h1 className="text-3xl font-bold mb-2">Partie terminée</h1>
          <div
            className={`text-2xl font-bold mb-4 ${
              gameOver.reason === "CANCELLED"
                ? "text-gray-400"
                : gameOver.winner === "CREWMATES"
                  ? "text-cyan-400"
                  : "text-red-400"
            }`}
          >
            {gameOver.reason === "CANCELLED"
              ? "Partie annulée"
              : gameOver.winner === "CREWMATES"
                ? "Victoire des Crewmates !"
                : "Victoire des Imposteurs !"}
          </div>
          <p className="text-gray-400 text-sm mb-6">
            {gameOver.reason === "TASKS_COMPLETED" &&
              "Toutes les tâches ont été complétées."}
            {gameOver.reason === "IMPOSTORS_MAJORITY" &&
              "Les imposteurs sont majoritaires."}
            {gameOver.reason === "IMPOSTORS_ELIMINATED" &&
              "Tous les imposteurs ont été éliminés."}
            {gameOver.reason === "TIMER_EXPIRED" && "Le temps est écoulé."}
            {gameOver.reason === "SABOTAGE_EXPIRED" &&
              "Un sabotage n'a pas été résolu à temps."}
            {gameOver.reason === "CANCELLED" &&
              "La partie a été annulée par l'administrateur."}
          </p>
          <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
            Rôles révélés
          </h2>
          <ul className="space-y-2 mb-6">
            {Object.entries(gameOver.roles).map(([pseudo, role]) => (
              <li key={pseudo} className="flex items-center justify-between">
                <span>{pseudo}</span>
                <span
                  className={`text-sm font-semibold px-2 py-0.5 rounded ${
                    role === "IMPOSTOR"
                      ? "bg-red-900/50 text-red-300"
                      : "bg-cyan-900/50 text-cyan-300"
                  }`}
                >
                  {role === "IMPOSTOR" ? "Imposteur" : "Crewmate"}
                </span>
              </li>
            ))}
          </ul>

          {gameOver.events && gameOver.events.length > 0 && (
            <div className="mb-6">
              <button
                onClick={() => setShowEvents(!showEvents)}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                {showEvents ? "Masquer" : "Voir"} le récapitulatif ({gameOver.events.length} événements)
              </button>
              {showEvents && (
                <ul className="mt-3 space-y-1 text-left text-xs max-h-48 overflow-y-auto">
                  {gameOver.events.map((evt, i) => (
                    <li key={i} className="flex items-start gap-2 text-gray-400">
                      <span className="text-gray-600 flex-shrink-0">
                        {new Date(evt.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                      <span>{eventLabels[evt.type] ?? evt.type}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={() => navigate(isAdmin ? "/admin" : "/")}
              className="btn-primary w-full"
            >
              Retour à l'accueil
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center p-6">
      {!connected && (
        <div className="fixed top-0 left-0 right-0 bg-red-900/90 text-white text-center py-2 px-4 z-[60] flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          <span className="text-sm font-medium">Connexion perdue… Reconnexion en cours</span>
        </div>
      )}

      {showReveal && assignment && (
        <RoleReveal
          assignment={assignment}
          onDismiss={() => setShowReveal(false)}
        />
      )}

      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold">Partie en cours</h1>
        {timerEndsAt && (
          <span className={`px-3 py-1 rounded-full text-sm font-mono ${
            timerWarning
              ? "bg-red-900/60 text-red-300 animate-pulse"
              : "bg-surface"
          }`}>
            {timeLeft}
          </span>
        )}
      </div>

      {auth?.role === UserRole.ADMIN && (
        <div className="rounded-xl px-6 py-3 mb-6 font-bold text-lg bg-purple-900/40 text-purple-300">
          Admin (observateur)
        </div>
      )}

      {auth?.role !== UserRole.ADMIN && assignment && !showReveal && (
        <button
          onClick={() => setShowReveal(true)}
          className={`rounded-xl px-6 py-3 mb-6 font-bold text-lg cursor-pointer transition-opacity hover:opacity-80 ${
            assignment.role === "IMPOSTOR"
              ? "bg-red-900/40 text-red-300"
              : "bg-cyan-900/40 text-cyan-300"
          }`}
        >
          {assignment.role === "IMPOSTOR" ? "Imposteur" : "Crewmate"}
        </button>
      )}

      {progress.total > 0 && (
        <div className="w-full max-w-sm mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Tâches
            </h2>
            <span className="text-sm text-gray-400">
              {progress.completed}/{progress.total}
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3 mb-4">
            <div
              className="bg-green-500 h-3 rounded-full transition-all duration-500"
              style={{
                width: `${(progress.completed / progress.total) * 100}%`,
              }}
            />
          </div>
          <ul className="space-y-2">
            {tasks.map((task) => (
              <li
                key={task.id}
                className={`flex items-center gap-3 bg-surface rounded-lg px-4 py-3 ${
                  task.isCompleted ? "opacity-60" : ""
                }`}
              >
                <button
                  onClick={() => handleTaskToggle(task)}
                  disabled={false}
                  className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                    task.isCompleted
                      ? "bg-green-500 border-green-500 text-white"
                      : "border-gray-500 hover:border-green-400"
                  } ${
                    task.isCompleted && auth?.role !== UserRole.ADMIN
                      ? "cursor-not-allowed"
                      : "cursor-pointer"
                  }`}
                >
                  {task.isCompleted && (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-medium ${
                      task.isCompleted ? "line-through text-gray-500" : ""
                    }`}
                  >
                    {task.name}
                  </p>
                  {task.description && (
                    <p className="text-sm text-gray-400 truncate">
                      {task.description}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {auth?.role === UserRole.ADMIN && adminRoles && (
        <div className="w-full max-w-sm bg-surface rounded-xl p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
            Rôles (admin)
          </h2>
          <ul className="space-y-2">
            {Object.entries(adminRoles).map(([pseudo, role]) => (
              <li key={pseudo} className="flex items-center justify-between">
                <span>{pseudo}</span>
                <span
                  className={`text-sm font-semibold px-2 py-0.5 rounded ${
                    role === "IMPOSTOR"
                      ? "bg-red-900/50 text-red-300"
                      : "bg-cyan-900/50 text-cyan-300"
                  }`}
                >
                  {role === "IMPOSTOR" ? "Imposteur" : "Crewmate"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {auth?.role === UserRole.ADMIN && players.length > 0 && (
        <div className="w-full max-w-sm bg-surface rounded-xl p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
            Joueurs
          </h2>
          <ul className="space-y-2">
            {players.map((player) => (
              <li
                key={player.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      player.isAlive ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  <span
                    className={player.isAlive ? "" : "text-gray-500 line-through"}
                  >
                    {player.pseudo}
                  </span>
                </div>
                {player.isAlive && (
                  <button
                    onClick={() => handleKillPlayer(player.id)}
                    disabled={killingPlayerId === player.id}
                    className="text-xs bg-red-900/50 text-red-300 px-2 py-1 rounded hover:bg-red-900/80 disabled:opacity-50"
                  >
                    {killingPlayerId === player.id
                      ? "..."
                      : "Marquer mort"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isDead && !isAdmin && (
        <div className="w-full max-w-sm flex gap-3 mb-6">
          <button
            onClick={handleCallMeeting}
            disabled={meetingCooldownLeft > 0}
            className={`flex-1 font-bold py-3 px-4 rounded-xl transition-colors ${
              meetingCooldownLeft > 0
                ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                : "bg-amber-700 hover:bg-amber-600 text-white"
            }`}
          >
            {meetingCooldownLeft > 0 ? `Rassemblement (${meetingCooldownLeft}s)` : "Rassemblement"}
          </button>
          <button
            onClick={handleReportBody}
            className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-xl transition-colors"
          >
            Signaler corps
          </button>
        </div>
      )}

      {!isDead && !isAdmin && assignment?.role === "IMPOSTOR" && (
        <div className="w-full max-w-sm mb-6">
          <h2 className="text-sm font-semibold text-red-400 mb-2 uppercase tracking-wider">
            Sabotages
          </h2>
          <div className="flex gap-3">
            <button
              onClick={() => handleTriggerSabotage(SabotageType.OXYGEN)}
              disabled={sabotage !== null}
              className="flex-1 bg-red-900/50 hover:bg-red-900/80 disabled:opacity-30 text-red-300 font-bold py-3 px-4 rounded-xl transition-colors"
            >
              Oxygène
            </button>
            <button
              onClick={() => handleTriggerSabotage(SabotageType.ENERGY)}
              disabled={sabotage !== null}
              className="flex-1 bg-red-900/50 hover:bg-red-900/80 disabled:opacity-30 text-red-300 font-bold py-3 px-4 rounded-xl transition-colors"
            >
              Énergie
            </button>
          </div>
          {sabotage?.state === SabotageState.COOLDOWN && (
            <p className="text-xs text-gray-500 text-center mt-2">
              Cooldown : {sabotageTimeLeft}
            </p>
          )}
        </div>
      )}

      {auth?.role === UserRole.ADMIN && (
        <div className="w-full max-w-sm space-y-3 mb-6">
          <button
            onClick={handleForceMeeting}
            disabled={forcingMeeting}
            className="w-full bg-amber-900/50 text-amber-300 py-2 px-4 rounded-lg hover:bg-amber-900/80 disabled:opacity-50 text-sm"
          >
            {forcingMeeting ? "..." : "Forcer un rassemblement (admin)"}
          </button>
          <button
            onClick={handleCancelGame}
            disabled={cancelling}
            className="w-full bg-gray-800 text-gray-400 py-2 px-4 rounded-lg hover:bg-gray-700 disabled:opacity-50 text-sm"
          >
            {cancelling ? "..." : "Annuler la partie (admin)"}
          </button>
        </div>
      )}

      <p className="text-gray-400 text-center">
        Phase de jeu libre — déplacez-vous et accomplissez vos objectifs.
      </p>
    </div>
  );
}
