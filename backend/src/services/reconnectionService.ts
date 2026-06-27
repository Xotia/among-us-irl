import { eq, and } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { db } from "../db.js";
import {
  guestSessions,
  playersInGame,
  gameInstances,
} from "../models/schema.js";
import { GameStatus, UserRole } from "@among-us-irl/shared";
import type { GameSyncStateDTO } from "@among-us-irl/shared";
import type { GuestPayload } from "../middleware/auth.js";
import { getAlivePlayers } from "./deathService.js";
import { getGameTasks } from "./taskService.js";
import { getActiveMeeting } from "./meetingService.js";
import { getActiveSabotage, getUsedSabotageTypes } from "./sabotageService.js";

export async function reconnectGuest(reconnectToken: string) {
  const [session] = await db
    .select()
    .from(guestSessions)
    .where(eq(guestSessions.reconnectToken, reconnectToken))
    .limit(1);

  if (!session) return { error: "Session introuvable" };

  const [game] = await db
    .select()
    .from(gameInstances)
    .where(eq(gameInstances.id, session.gameId))
    .limit(1);

  if (!game) return { error: "Partie introuvable" };

  if (game.status === GameStatus.ENDED || game.status === GameStatus.CANCELLED) {
    return { error: "Cette partie est terminée" };
  }

  await db
    .update(guestSessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(guestSessions.id, session.id));

  const payload: GuestPayload = {
    sessionId: session.id,
    pseudo: session.pseudo,
    gameId: session.gameId,
    role: UserRole.GUEST,
  };

  const token = jwt.sign(payload, config.jwtSecret, { expiresIn: "24h" });

  return {
    token,
    sessionId: session.id,
    pseudo: session.pseudo,
    gameId: session.gameId,
    gameCode: game.code,
    gameStatus: game.status,
  };
}

export async function buildGameSyncState(
  gameId: string,
  playerId: string
): Promise<GameSyncStateDTO | null> {
  const [game] = await db
    .select()
    .from(gameInstances)
    .where(eq(gameInstances.id, gameId))
    .limit(1);

  if (!game) return null;

  const [player] = await db
    .select()
    .from(playersInGame)
    .where(eq(playersInGame.id, playerId))
    .limit(1);

  if (!player) return null;

  const players = await getAlivePlayers(gameId);
  const gameTasks = await getGameTasks(gameId);
  const meeting = await getActiveMeeting(gameId);
  const sabotage = await getActiveSabotage(gameId);
  const usedSabotages = await getUsedSabotageTypes(gameId);

  let coImpostors: string[] | undefined;
  if (player.role === "IMPOSTOR") {
    const allPlayers = await db
      .select({ pseudo: playersInGame.pseudo, role: playersInGame.role })
      .from(playersInGame)
      .where(eq(playersInGame.gameId, gameId));
    coImpostors = allPlayers
      .filter((p) => p.role === "IMPOSTOR" && p.pseudo !== player.pseudo)
      .map((p) => p.pseudo);
  }

  return {
    gameId,
    gameStatus: game.status as any,
    gamePhase: (game.phase ?? "FREE_ROAM") as any,
    players,
    tasks: gameTasks,
    meeting,
    sabotage,
    myPlayerId: playerId,
    myRole: (player.role ?? "CREWMATE") as any,
    myLifeState: player.lifeState as any,
    gameTimerEndsAt: game.gameTimerEndsAt?.getTime() ?? null,
    coImpostors,
    usedSabotages,
    serverTime: Date.now(),
  };
}

export async function buildAdminSyncState(
  gameId: string
): Promise<GameSyncStateDTO | null> {
  const [game] = await db
    .select()
    .from(gameInstances)
    .where(eq(gameInstances.id, gameId))
    .limit(1);

  if (!game) return null;

  const players = await getAlivePlayers(gameId);
  const gameTasks = await getGameTasks(gameId);
  const meeting = await getActiveMeeting(gameId);
  const sabotage = await getActiveSabotage(gameId);
  const usedSabotages = await getUsedSabotageTypes(gameId);

  return {
    gameId,
    gameStatus: game.status as any,
    gamePhase: (game.phase ?? "FREE_ROAM") as any,
    players,
    tasks: gameTasks,
    meeting,
    sabotage,
    myPlayerId: `admin_observer`,
    myRole: "CREWMATE" as any,
    myLifeState: "ALIVE" as any,
    gameTimerEndsAt: game.gameTimerEndsAt?.getTime() ?? null,
    usedSabotages,
    serverTime: Date.now(),
  };
}
