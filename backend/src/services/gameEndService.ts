import type { Server } from "socket.io";
import { eq, asc } from "drizzle-orm";
import { db } from "../db.js";
import {
  gameInstances,
  playersInGame,
  gameEvents,
} from "../models/schema.js";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  GameEventDTO,
} from "@among-us-irl/shared";
import {
  GameStatus,
  GamePhase,
  PlayerRole,
  Winner,
  GameOverReason,
} from "@among-us-irl/shared";
import { clearGameTimer } from "./gameTimerService.js";

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

export async function endGame(
  io: TypedServer,
  gameId: string,
  winner: Winner,
  reason: GameOverReason
) {
  clearGameTimer(gameId);

  const [game] = await db
    .select({ status: gameInstances.status })
    .from(gameInstances)
    .where(eq(gameInstances.id, gameId))
    .limit(1);
  if (game?.status === GameStatus.ENDED || game?.status === GameStatus.CANCELLED) {
    return;
  }

  const finalStatus = reason === GameOverReason.CANCELLED
    ? GameStatus.CANCELLED
    : GameStatus.ENDED;

  await db
    .update(gameInstances)
    .set({
      status: finalStatus,
      phase: GamePhase.GAME_OVER_PENDING,
      updatedAt: new Date(),
    })
    .where(eq(gameInstances.id, gameId));

  const players = await db
    .select({ pseudo: playersInGame.pseudo, role: playersInGame.role })
    .from(playersInGame)
    .where(eq(playersInGame.gameId, gameId));

  const roles: Record<string, PlayerRole> = {};
  for (const p of players) {
    if (p.role) roles[p.pseudo] = p.role as PlayerRole;
  }

  await db.insert(gameEvents).values({
    gameId,
    type: "GAME_ENDED",
    payload: { winner, reason },
  });

  const eventRows = await db
    .select({
      type: gameEvents.type,
      payload: gameEvents.payload,
      createdAt: gameEvents.createdAt,
    })
    .from(gameEvents)
    .where(eq(gameEvents.gameId, gameId))
    .orderBy(asc(gameEvents.createdAt));

  const events: GameEventDTO[] = eventRows.map((e) => ({
    type: e.type,
    payload: e.payload as Record<string, unknown>,
    createdAt: e.createdAt.toISOString(),
  }));

  io.to(gameId).emit("game:over", { winner, reason, roles, events });
}

export async function cancelGame(
  io: TypedServer,
  gameId: string,
  adminId: string
): Promise<{ success: boolean } | { error: string }> {
  const [game] = await db
    .select()
    .from(gameInstances)
    .where(eq(gameInstances.id, gameId))
    .limit(1);

  if (!game) return { error: "Partie introuvable" };
  if (game.createdBy !== adminId) {
    console.error(`cancelGame: createdBy=${game.createdBy} !== adminId=${adminId}`);
    return { error: "Non autorisé" };
  }
  if (game.status !== GameStatus.RUNNING && game.status !== GameStatus.LOBBY_OPEN && game.status !== GameStatus.READY) {
    console.error(`cancelGame: status=${game.status}, expected RUNNING/LOBBY_OPEN/READY`);
    return { error: "Cette partie ne peut pas être annulée" };
  }

  await endGame(io, gameId, Winner.CREWMATES, GameOverReason.CANCELLED);
  return { success: true };
}
