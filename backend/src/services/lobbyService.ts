import { eq, and } from "drizzle-orm";
import { db } from "../db.js";
import {
  playersInGame,
  gameInstances,
  gameConfigs,
} from "../models/schema.js";
import { GameStatus } from "@among-us-irl/shared";
import type { LobbyPlayerDTO } from "@among-us-irl/shared";

export async function addPlayerToGame(
  gameId: string,
  pseudo: string,
  guestSessionId?: string
): Promise<{ player: LobbyPlayerDTO } | { error: string }> {
  const [game] = await db
    .select()
    .from(gameInstances)
    .where(eq(gameInstances.id, gameId))
    .limit(1);

  if (!game) return { error: "Partie introuvable" };

  const currentPlayers = await db
    .select()
    .from(playersInGame)
    .where(eq(playersInGame.gameId, gameId));

  // Allow reconnection for existing players regardless of game status
  const existing = currentPlayers.find(
    (p) => guestSessionId && p.guestSessionId === guestSessionId
  );

  if (existing) {
    await db
      .update(playersInGame)
      .set({ isConnected: true })
      .where(eq(playersInGame.id, existing.id));

    return {
      player: {
        id: existing.id,
        pseudo: existing.pseudo,
        isConnected: true,
      },
    };
  }

  // New players can only join during lobby phase
  if (
    game.status !== GameStatus.LOBBY_OPEN &&
    game.status !== GameStatus.DRAFT
  ) {
    return { error: "Cette partie n'accepte plus de joueurs" };
  }

  const [config] = await db
    .select()
    .from(gameConfigs)
    .where(eq(gameConfigs.gameId, gameId))
    .limit(1);

  if (config && currentPlayers.length >= config.maxPlayers) {
    return { error: "La partie est pleine" };
  }

  const duplicatePseudo = currentPlayers.find((p) => p.pseudo === pseudo);
  if (duplicatePseudo) {
    return { error: "Ce pseudo est déjà pris dans cette partie" };
  }

  const [player] = await db
    .insert(playersInGame)
    .values({
      gameId,
      guestSessionId: guestSessionId ?? null,
      adminId: null,
      pseudo,
      isConnected: true,
    })
    .returning();

  if (game.status === GameStatus.DRAFT) {
    await db
      .update(gameInstances)
      .set({ status: "LOBBY_OPEN" })
      .where(eq(gameInstances.id, gameId));
  }

  return {
    player: {
      id: player.id,
      pseudo: player.pseudo,
      isConnected: true,
    },
  };
}

export async function setPlayerConnected(
  playerId: string,
  isConnected: boolean
): Promise<void> {
  await db
    .update(playersInGame)
    .set({ isConnected })
    .where(eq(playersInGame.id, playerId));
}

export async function getGamePlayers(
  gameId: string
): Promise<LobbyPlayerDTO[]> {
  const players = await db
    .select()
    .from(playersInGame)
    .where(eq(playersInGame.gameId, gameId));

  return players.map((p) => ({
    id: p.id,
    pseudo: p.pseudo,
    isConnected: p.isConnected,
  }));
}

export async function removePlayer(playerId: string): Promise<string | null> {
  const [player] = await db
    .select()
    .from(playersInGame)
    .where(eq(playersInGame.id, playerId))
    .limit(1);

  if (!player) return null;

  await db
    .delete(playersInGame)
    .where(eq(playersInGame.id, playerId));

  return player.gameId;
}

export async function getGameReadiness(
  gameId: string
): Promise<{ canStart: boolean; playerCount: number; minPlayers: number }> {
  const [config] = await db
    .select()
    .from(gameConfigs)
    .where(eq(gameConfigs.gameId, gameId))
    .limit(1);

  const players = await db
    .select()
    .from(playersInGame)
    .where(eq(playersInGame.gameId, gameId));

  const connectedCount = players.filter((p) => p.isConnected).length;
  const minPlayers = config?.minPlayers ?? 4;

  return {
    canStart: connectedCount >= minPlayers,
    playerCount: connectedCount,
    minPlayers,
  };
}

export async function findGameByCode(code: string) {
  const [game] = await db
    .select()
    .from(gameInstances)
    .where(eq(gameInstances.code, code.toUpperCase()))
    .limit(1);
  return game ?? null;
}
