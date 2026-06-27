import type { Server } from "socket.io";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "@among-us-irl/shared";
import { PlayerRole } from "@among-us-irl/shared";
import type { StartGameResult } from "../services/gameStateMachine.js";
import { socketDataMap } from "./lobbyHandler.js";
import { getGameTasks, getTasksProgress } from "../services/taskService.js";
import { getAlivePlayers } from "../services/deathService.js";
import { getActiveMeeting } from "../services/meetingService.js";
import { getActiveSabotage } from "../services/sabotageService.js";
import { UserRole } from "@among-us-irl/shared";

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

export async function emitGameStarted(io: TypedServer, result: StartGameResult) {
  const { gameId, gameTimerEndsAt, roleAssignments } = result;

  io.to(gameId).emit("game:started");

  const impostorPseudos = roleAssignments
    .filter((a) => a.role === PlayerRole.IMPOSTOR)
    .map((a) => a.pseudo);

  for (const [socketId, data] of socketDataMap.entries()) {
    if (data.gameId !== gameId) continue;

    const assignment = roleAssignments.find(
      (a) => a.playerId === data.playerId
    );
    if (!assignment) continue;

    const socket = io.sockets.sockets.get(socketId);
    if (!socket) continue;

    const coImpostors =
      assignment.role === PlayerRole.IMPOSTOR
        ? impostorPseudos.filter((p) => p !== assignment.pseudo)
        : undefined;

    socket.emit("role:assigned", {
      role: assignment.role,
      coImpostors,
    });
  }

  io.to(gameId).emit("game:timer", gameTimerEndsAt.getTime());

  const gameTasks = await getGameTasks(gameId);
  const progress = await getTasksProgress(gameId);
  io.to(gameId).emit("tasks:progress", progress.completed, progress.total);

  const allPlayers = await getAlivePlayers(gameId);
  const activeMeeting = await getActiveMeeting(gameId);
  const activeSabotage = await getActiveSabotage(gameId);

  for (const [socketId, data] of socketDataMap.entries()) {
    if (data.gameId !== gameId) continue;
    const sock = io.sockets.sockets.get(socketId);
    if (!sock) continue;

    const isAdminObserver = data.auth.role === UserRole.ADMIN;
    const myRole = isAdminObserver
      ? PlayerRole.CREWMATE
      : (roleAssignments.find((a) => a.playerId === data.playerId)?.role ?? PlayerRole.CREWMATE);
    const coImpostors = myRole === PlayerRole.IMPOSTOR
      ? impostorPseudos.filter((p) => p !== roleAssignments.find((a) => a.playerId === data.playerId)?.pseudo)
      : undefined;
    sock.emit("connection:sync", {
      gameId,
      gameStatus: "RUNNING" as any,
      gamePhase: "FREE_ROAM" as any,
      players: allPlayers,
      tasks: gameTasks,
      meeting: activeMeeting,
      sabotage: activeSabotage,
      myPlayerId: data.playerId,
      myRole,
      myLifeState: "ALIVE" as any,
      gameTimerEndsAt: gameTimerEndsAt.getTime(),
      coImpostors,
      usedSabotages: [],
      serverTime: Date.now(),
    });
  }
}
