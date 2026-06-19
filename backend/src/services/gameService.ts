import crypto from "crypto";
import { eq, sql } from "drizzle-orm";
import type { Server } from "socket.io";
import { db } from "../db.js";
import {
  gameInstances,
  gameConfigs,
  presets,
  gameEvents,
  meetingStates,
  votes,
  deathEvents,
  sabotageStates,
  tasks as tasksTable,
  playersInGame,
  guestSessions,
} from "../models/schema.js";
import { socketDataMap } from "../socket/lobbyHandler.js";
import { GameStatus } from "@among-us-irl/shared";
import type {
  GameConfigDTO,
  GameDetailDTO,
  PresetDTO,
  TaskConfigItem,
} from "@among-us-irl/shared";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

export async function createGame(
  adminId: string,
  presetCode?: string
): Promise<{ gameId: string; code: string; config: GameConfigDTO }> {
  let presetConfig: Partial<GameConfigDTO> | null = null;

  if (presetCode) {
    const [preset] = await db
      .select()
      .from(presets)
      .where(eq(presets.code, presetCode))
      .limit(1);
    if (preset) {
      presetConfig = preset.configJson as Partial<GameConfigDTO>;
    }
  }

  const code = generateCode();

  const [game] = await db
    .insert(gameInstances)
    .values({
      code,
      status: "LOBBY_OPEN",
      createdBy: adminId,
    })
    .returning();

  const defaultTasks: TaskConfigItem[] = [
    { name: "Chiffres Romains", description: "Convertissez les chiffres en chiffres romains" },
    { name: "Décodage", description: "Déchiffrez le message codé" },
    { name: "Reliure de points", description: "Reliez les points pour former l'image" },
    { name: "Recopie les phrases", description: "Recopiez les phrases sans erreur" },
    { name: "Rébus", description: "Trouvez la solution du rébus" },
    { name: "Mots mêlés", description: "Trouvez tous les mots cachés dans la grille" },
    { name: "Puzzle", description: "Assemblez le puzzle" },
    { name: "Calculs", description: "Résolvez les opérations mathématiques" },
    { name: "Kappla", description: "Construisez la structure en Kappla" },
    { name: "Bottle flip", description: "Réussissez un bottle flip" },
    { name: "Tri sélectif", description: "Triez les déchets dans les bonnes poubelles" },
    { name: "Déboucher et reboucher les stylos", description: "Débouchez puis rebouchez tous les stylos" },
    { name: "Sudoku", description: "Complétez la grille de Sudoku" },
    { name: "Lancer d'anneaux", description: "Lancez les anneaux sur les cibles" },
    { name: "Basket", description: "Marquez un panier" },
  ];
  const tasks: TaskConfigItem[] = presetConfig?.tasks ?? defaultTasks;

  await db.insert(gameConfigs).values({
    gameId: game.id,
    minPlayers: presetConfig?.minPlayers ?? 4,
    maxPlayers: presetConfig?.maxPlayers ?? 15,
    impostorCount: presetConfig?.impostorCount ?? 2,
    gameDurationSeconds: presetConfig?.gameDurationSeconds ?? 300,
    meetingDurationSeconds: presetConfig?.meetingDurationSeconds ?? 60,
    sabotageDurationSeconds: presetConfig?.sabotageDurationSeconds ?? 45,
    sabotageCooldownSeconds: presetConfig?.sabotageCooldownSeconds ?? 20,
    taskValidationMode: presetConfig?.taskValidationMode ?? "ANY_PLAYER",
    oxygenCode: presetConfig?.oxygenCode ?? "4782",
    revealRoleOnEject: presetConfig?.revealRoleOnEject ?? true,
    tasksJson: tasks,
  });

  const config = await getGameConfig(game.id);

  return { gameId: game.id, code: game.code, config: config! };
}

export async function getGameConfig(
  gameId: string
): Promise<GameConfigDTO | null> {
  const [cfg] = await db
    .select()
    .from(gameConfigs)
    .where(eq(gameConfigs.gameId, gameId))
    .limit(1);

  if (!cfg) return null;

  return {
    minPlayers: cfg.minPlayers,
    maxPlayers: cfg.maxPlayers,
    impostorCount: cfg.impostorCount,
    gameDurationSeconds: cfg.gameDurationSeconds,
    meetingDurationSeconds: cfg.meetingDurationSeconds,
    sabotageDurationSeconds: cfg.sabotageDurationSeconds,
    sabotageCooldownSeconds: cfg.sabotageCooldownSeconds,
    taskValidationMode: cfg.taskValidationMode as "ANY_PLAYER" | "ADMIN_ONLY",
    oxygenCode: cfg.oxygenCode,
    revealRoleOnEject: cfg.revealRoleOnEject,
    tasks: (cfg.tasksJson as TaskConfigItem[]) ?? [],
  };
}

export async function updateGameConfig(
  gameId: string,
  adminId: string,
  partial: Partial<GameConfigDTO>
): Promise<GameConfigDTO | { error: string }> {
  const [game] = await db
    .select()
    .from(gameInstances)
    .where(eq(gameInstances.id, gameId))
    .limit(1);

  if (!game) return { error: "Partie introuvable" };
  if (game.createdBy !== adminId) return { error: "Non autorisé" };
  if (
    game.status !== GameStatus.DRAFT &&
    game.status !== GameStatus.LOBBY_OPEN
  ) {
    return { error: "La config ne peut être modifiée qu'avant le lancement" };
  }

  const update: Record<string, unknown> = {};
  if (partial.minPlayers !== undefined) update.minPlayers = partial.minPlayers;
  if (partial.maxPlayers !== undefined) update.maxPlayers = partial.maxPlayers;
  if (partial.impostorCount !== undefined)
    update.impostorCount = partial.impostorCount;
  if (partial.gameDurationSeconds !== undefined)
    update.gameDurationSeconds = partial.gameDurationSeconds;
  if (partial.meetingDurationSeconds !== undefined)
    update.meetingDurationSeconds = partial.meetingDurationSeconds;
  if (partial.sabotageDurationSeconds !== undefined)
    update.sabotageDurationSeconds = partial.sabotageDurationSeconds;
  if (partial.sabotageCooldownSeconds !== undefined)
    update.sabotageCooldownSeconds = partial.sabotageCooldownSeconds;
  if (partial.taskValidationMode !== undefined)
    update.taskValidationMode = partial.taskValidationMode;
  if (partial.oxygenCode !== undefined) update.oxygenCode = partial.oxygenCode;
  if (partial.revealRoleOnEject !== undefined) update.revealRoleOnEject = partial.revealRoleOnEject;
  if (partial.tasks !== undefined) update.tasksJson = partial.tasks;

  if (Object.keys(update).length > 0) {
    await db
      .update(gameConfigs)
      .set(update)
      .where(eq(gameConfigs.gameId, gameId));
  }

  return (await getGameConfig(gameId))!;
}

export async function getGameDetail(
  gameId: string,
  adminId: string
): Promise<GameDetailDTO | { error: string }> {
  const [game] = await db
    .select()
    .from(gameInstances)
    .where(eq(gameInstances.id, gameId))
    .limit(1);

  if (!game) return { error: "Partie introuvable" };
  if (game.createdBy !== adminId) return { error: "Non autorisé" };

  const config = await getGameConfig(gameId);
  if (!config) return { error: "Config introuvable" };

  return {
    id: game.id,
    code: game.code,
    status: game.status,
    config,
    createdAt: game.createdAt.toISOString(),
  };
}

export async function listPresets(): Promise<PresetDTO[]> {
  const rows = await db.select().from(presets);
  return rows.map((r) => ({
    code: r.code,
    name: r.name,
    config: r.configJson as Partial<GameConfigDTO>,
  }));
}

export async function importPreset(
  code: string,
  name: string,
  config: Partial<GameConfigDTO>
): Promise<PresetDTO | { error: string }> {
  try {
    const [row] = await db
      .insert(presets)
      .values({ code, name, configJson: config })
      .returning();
    return {
      code: row.code,
      name: row.name,
      config: row.configJson as Partial<GameConfigDTO>,
    };
  } catch (err: any) {
    const errCode = err?.code ?? err?.cause?.code;
    if (errCode === "23505") {
      return { error: "Un preset avec ce code existe déjà" };
    }
    throw err;
  }
}

export async function resetAllGames(
  io: Server
): Promise<{ deleted: number }> {
  const games = await db.select({ id: gameInstances.id }).from(gameInstances);
  const gameIds = games.map((g) => g.id);

  if (gameIds.length > 0) {
    for (const gid of gameIds) {
      await db.delete(gameEvents).where(eq(gameEvents.gameId, gid));
      const meetings = await db.select({ id: meetingStates.id }).from(meetingStates).where(eq(meetingStates.gameId, gid));
      for (const m of meetings) {
        await db.delete(votes).where(eq(votes.meetingId, m.id));
      }
      await db.delete(deathEvents).where(eq(deathEvents.gameId, gid));
      await db.delete(sabotageStates).where(eq(sabotageStates.gameId, gid));
      await db.delete(tasksTable).where(eq(tasksTable.gameId, gid));
      await db.delete(meetingStates).where(eq(meetingStates.gameId, gid));
    }
    for (const gid of gameIds) {
      await db.delete(playersInGame).where(eq(playersInGame.gameId, gid));
    }
    for (const gid of gameIds) {
      await db.delete(guestSessions).where(eq(guestSessions.gameId, gid));
      await db.delete(gameConfigs).where(eq(gameConfigs.gameId, gid));
      await db.delete(gameInstances).where(eq(gameInstances.id, gid));
    }
  }

  for (const [socketId] of socketDataMap) {
    const sock = io.sockets.sockets.get(socketId);
    if (sock) sock.disconnect(true);
  }
  socketDataMap.clear();

  return { deleted: gameIds.length };
}
