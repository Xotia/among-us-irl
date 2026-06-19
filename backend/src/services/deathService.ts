import type { Server } from "socket.io";
import { eq, and } from "drizzle-orm";
import { db } from "../db.js";
import {
  playersInGame,
  deathEvents,
  gameEvents,
  gameInstances,
} from "../models/schema.js";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  PlayerDTO,
} from "@among-us-irl/shared";
import {
  GameStatus,
  PlayerRole,
  Winner,
  GameOverReason,
} from "@among-us-irl/shared";
import { endGame } from "./gameEndService.js";

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

export async function markPlayerDead(
  io: TypedServer,
  gameId: string,
  playerId: string,
  adminId: string
): Promise<{ success: true } | { error: string }> {
  const [game] = await db
    .select()
    .from(gameInstances)
    .where(eq(gameInstances.id, gameId))
    .limit(1);
  if (!game || game.status !== GameStatus.RUNNING)
    return { error: "La partie n'est pas en cours" };

  const [player] = await db
    .select()
    .from(playersInGame)
    .where(and(eq(playersInGame.id, playerId), eq(playersInGame.gameId, gameId)))
    .limit(1);
  if (!player) return { error: "Joueur introuvable dans cette partie" };
  if (player.lifeState !== "ALIVE") return { error: "Le joueur est déjà mort" };

  await db
    .update(playersInGame)
    .set({ lifeState: "DEAD" })
    .where(eq(playersInGame.id, playerId));

  await db.insert(deathEvents).values({
    gameId,
    playerId,
    markedBy: adminId,
  });

  await db.insert(gameEvents).values({
    gameId,
    type: "PLAYER_DIED",
    payload: { playerId, pseudo: player.pseudo },
  });

  io.to(gameId).emit("player:died", playerId);

  const players = await getAlivePlayers(gameId);
  io.to(gameId).emit("players:update", players);

  const majorityResult = await checkImpostorMajority(gameId);
  if (majorityResult) {
    await endGame(io, gameId, majorityResult.winner, majorityResult.reason);
  }

  return { success: true };
}

export async function getAlivePlayers(gameId: string): Promise<PlayerDTO[]> {
  const rows = await db
    .select({
      id: playersInGame.id,
      pseudo: playersInGame.pseudo,
      isAlive: playersInGame.lifeState,
      isConnected: playersInGame.isConnected,
    })
    .from(playersInGame)
    .where(eq(playersInGame.gameId, gameId));

  return rows.map((r) => ({
    id: r.id,
    pseudo: r.pseudo,
    isAlive: r.isAlive === "ALIVE",
    isConnected: r.isConnected,
  }));
}

async function checkImpostorMajority(
  gameId: string
): Promise<{ winner: Winner; reason: GameOverReason } | null> {
  const players = await db
    .select({ role: playersInGame.role, lifeState: playersInGame.lifeState })
    .from(playersInGame)
    .where(eq(playersInGame.gameId, gameId));

  const alive = players.filter((p) => p.lifeState === "ALIVE");
  const aliveImpostors = alive.filter((p) => p.role === PlayerRole.IMPOSTOR).length;
  const aliveCrewmates = alive.filter((p) => p.role === PlayerRole.CREWMATE).length;

  if (aliveImpostors >= aliveCrewmates) {
    return { winner: Winner.IMPOSTORS, reason: GameOverReason.IMPOSTORS_MAJORITY };
  }

  if (aliveImpostors === 0) {
    return { winner: Winner.CREWMATES, reason: GameOverReason.IMPOSTORS_ELIMINATED };
  }

  return null;
}
