import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import {
  gameInstances,
  gameConfigs,
  playersInGame,
  tasks as tasksTable,
  gameEvents,
} from "../models/schema.js";
import { GameStatus, GamePhase, PlayerRole } from "@among-us-irl/shared";
import type { TaskConfigItem } from "@among-us-irl/shared";

export interface StartGameResult {
  gameId: string;
  gameTimerEndsAt: Date;
  roleAssignments: {
    playerId: string;
    pseudo: string;
    role: PlayerRole;
  }[];
}

export async function startGame(
  gameId: string,
  adminId: string
): Promise<StartGameResult | { error: string }> {
  const [game] = await db
    .select()
    .from(gameInstances)
    .where(eq(gameInstances.id, gameId))
    .limit(1);

  if (!game) return { error: "Partie introuvable" };
  if (game.createdBy !== adminId) return { error: "Non autorisé" };
  if (
    game.status !== GameStatus.LOBBY_OPEN &&
    game.status !== GameStatus.READY
  ) {
    return { error: "La partie ne peut pas être lancée dans cet état" };
  }

  const [config] = await db
    .select()
    .from(gameConfigs)
    .where(eq(gameConfigs.gameId, gameId))
    .limit(1);

  if (!config) return { error: "Configuration introuvable" };

  const players = await db
    .select()
    .from(playersInGame)
    .where(eq(playersInGame.gameId, gameId));

  const connectedPlayers = players.filter((p) => p.isConnected);

  if (connectedPlayers.length < config.minPlayers) {
    return {
      error: `Pas assez de joueurs connectés (${connectedPlayers.length}/${config.minPlayers})`,
    };
  }

  const manualRoles = config.manualRoles as Record<string, "CREWMATE" | "IMPOSTOR"> | null;
  let roleAssignments: { playerId: string; pseudo: string; role: PlayerRole }[];

  if (manualRoles && Object.keys(manualRoles).length > 0) {
    const manualImpostorCount = Object.values(manualRoles).filter((r) => r === "IMPOSTOR").length;
    if (manualImpostorCount < 1) {
      return { error: "L'assignation manuelle doit contenir au moins un imposteur" };
    }
    roleAssignments = connectedPlayers.map((p) => ({
      playerId: p.id,
      pseudo: p.pseudo,
      role: manualRoles[p.id] === "IMPOSTOR" ? PlayerRole.IMPOSTOR : PlayerRole.CREWMATE,
    }));
  } else {
    const impostorCount = Math.min(
      config.impostorCount,
      Math.floor(connectedPlayers.length / 3)
    );

    if (impostorCount < 1) {
      return { error: "Pas assez de joueurs pour avoir un imposteur" };
    }

    const shuffled = [...connectedPlayers].sort(() => crypto.randomBytes(1)[0] / 255 - 0.5);
    const impostors = shuffled.slice(0, impostorCount);
    const impostorIds = new Set(impostors.map((p) => p.id));

    roleAssignments = connectedPlayers.map((p) => ({
      playerId: p.id,
      pseudo: p.pseudo,
      role: impostorIds.has(p.id) ? PlayerRole.IMPOSTOR : PlayerRole.CREWMATE,
    }));
  }

  for (const assignment of roleAssignments) {
    await db
      .update(playersInGame)
      .set({ role: assignment.role, lifeState: "ALIVE" })
      .where(eq(playersInGame.id, assignment.playerId));
  }

  const gameTimerEndsAt = new Date(
    Date.now() + config.gameDurationSeconds * 1000
  );

  await db
    .update(gameInstances)
    .set({
      status: "RUNNING",
      phase: "FREE_ROAM",
      gameTimerEndsAt,
      updatedAt: new Date(),
    })
    .where(eq(gameInstances.id, gameId));

  const taskItems = (config.tasksJson as TaskConfigItem[]) ?? [];
  if (taskItems.length > 0) {
    await db.insert(tasksTable).values(
      taskItems.map((t) => ({
        gameId,
        name: t.name,
        description: t.description ?? "",
      }))
    );
  }

  await db.insert(gameEvents).values({
    gameId,
    type: "GAME_STARTED",
    payload: {
      playerCount: connectedPlayers.length,
      impostorCount: roleAssignments.filter((a) => a.role === PlayerRole.IMPOSTOR).length,
      gameDurationSeconds: config.gameDurationSeconds,
    },
  });

  return { gameId, gameTimerEndsAt, roleAssignments };
}
