import type { Server } from "socket.io";
import { eq, and } from "drizzle-orm";
import { db } from "../db.js";
import {
  sabotageStates,
  playersInGame,
  gameInstances,
  gameConfigs,
  gameEvents,
} from "../models/schema.js";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  SabotageDTO,
} from "@among-us-irl/shared";
import {
  GameStatus,
  GamePhase,
  SabotageState,
  SabotageType,
  PlayerRole,
  Winner,
  GameOverReason,
} from "@among-us-irl/shared";
import { endGame } from "./gameEndService.js";

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

const sabotageTimers = new Map<string, NodeJS.Timeout>();

export async function triggerSabotage(
  io: TypedServer,
  gameId: string,
  playerId: string,
  type: SabotageType
): Promise<{ success: true } | { error: string }> {
  const [game] = await db
    .select()
    .from(gameInstances)
    .where(eq(gameInstances.id, gameId))
    .limit(1);
  if (!game || game.status !== GameStatus.RUNNING)
    return { error: "La partie n'est pas en cours" };
  if (game.phase !== GamePhase.FREE_ROAM)
    return { error: "Impossible de déclencher un sabotage maintenant" };

  const [player] = await db
    .select()
    .from(playersInGame)
    .where(and(eq(playersInGame.id, playerId), eq(playersInGame.gameId, gameId)))
    .limit(1);
  if (!player || player.lifeState !== "ALIVE")
    return { error: "Seul un joueur vivant peut déclencher un sabotage" };
  if (player.role !== PlayerRole.IMPOSTOR)
    return { error: "Seul un imposteur peut déclencher un sabotage" };

  const [existing] = await db
    .select()
    .from(sabotageStates)
    .where(eq(sabotageStates.gameId, gameId))
    .limit(1);

  if (existing) {
    if (existing.state === SabotageState.ACTIVE || existing.state === SabotageState.STARTING)
      return { error: "Un sabotage est déjà en cours" };
    if (existing.state === SabotageState.COOLDOWN && existing.cooldownEndsAt) {
      if (new Date() < existing.cooldownEndsAt)
        return { error: "Sabotage en cooldown" };
    }
  }

  const [config] = await db
    .select()
    .from(gameConfigs)
    .where(eq(gameConfigs.gameId, gameId))
    .limit(1);
  if (!config) return { error: "Configuration introuvable" };

  const timerEndsAt = new Date(Date.now() + config.sabotageDurationSeconds * 1000);

  if (existing) {
    await db
      .update(sabotageStates)
      .set({
        state: SabotageState.ACTIVE,
        type,
        triggeredBy: playerId,
        timerEndsAt,
        cooldownEndsAt: null,
      })
      .where(eq(sabotageStates.id, existing.id));
  } else {
    await db.insert(sabotageStates).values({
      gameId,
      state: SabotageState.ACTIVE,
      type,
      triggeredBy: playerId,
      timerEndsAt,
    });
  }

  await db.insert(gameEvents).values({
    gameId,
    type: "SABOTAGE_TRIGGERED",
    payload: { playerId, pseudo: player.pseudo, sabotageType: type },
  });

  const dto: SabotageDTO = { state: SabotageState.ACTIVE, type, timerEndsAt: timerEndsAt.getTime() };
  io.to(gameId).emit("sabotage:update", dto);

  scheduleSabotageExpiry(io, gameId, config.sabotageDurationSeconds);

  return { success: true };
}

export async function resolveSabotage(
  io: TypedServer,
  gameId: string,
  code?: string
): Promise<{ success: true } | { error: string }> {
  const [sabotage] = await db
    .select()
    .from(sabotageStates)
    .where(eq(sabotageStates.gameId, gameId))
    .limit(1);
  if (!sabotage || sabotage.state !== SabotageState.ACTIVE)
    return { error: "Aucun sabotage actif" };

  if (sabotage.type === SabotageType.OXYGEN) {
    const [config] = await db
      .select()
      .from(gameConfigs)
      .where(eq(gameConfigs.gameId, gameId))
      .limit(1);
    if (!config) return { error: "Configuration introuvable" };
    if (code !== config.oxygenCode)
      return { error: "Code incorrect" };
  }

  const [config] = await db
    .select()
    .from(gameConfigs)
    .where(eq(gameConfigs.gameId, gameId))
    .limit(1);

  const cooldownEndsAt = config
    ? new Date(Date.now() + config.sabotageCooldownSeconds * 1000)
    : new Date(Date.now() + 30000);

  await db
    .update(sabotageStates)
    .set({
      state: SabotageState.COOLDOWN,
      timerEndsAt: null,
      cooldownEndsAt,
    })
    .where(eq(sabotageStates.id, sabotage.id));

  clearSabotageTimer(gameId);

  await db.insert(gameEvents).values({
    gameId,
    type: "SABOTAGE_RESOLVED",
    payload: { sabotageType: sabotage.type },
  });

  io.to(gameId).emit("sabotage:resolved");
  io.to(gameId).emit("sabotage:update", {
    state: SabotageState.COOLDOWN,
    type: sabotage.type as SabotageType,
    timerEndsAt: cooldownEndsAt.getTime(),
  });

  scheduleCooldownEnd(io, gameId, config?.sabotageCooldownSeconds ?? 30);

  return { success: true };
}

function scheduleSabotageExpiry(io: TypedServer, gameId: string, durationSeconds: number) {
  clearSabotageTimer(gameId);
  const timer = setTimeout(async () => {
    sabotageTimers.delete(gameId);
    const [sabotage] = await db
      .select()
      .from(sabotageStates)
      .where(eq(sabotageStates.gameId, gameId))
      .limit(1);
    if (!sabotage || sabotage.state !== SabotageState.ACTIVE) return;

    await db
      .update(sabotageStates)
      .set({ state: SabotageState.FAILED, timerEndsAt: null })
      .where(eq(sabotageStates.id, sabotage.id));

    await db.insert(gameEvents).values({
      gameId,
      type: "SABOTAGE_FAILED",
      payload: { sabotageType: sabotage.type },
    });

    await endGame(io, gameId, Winner.IMPOSTORS, GameOverReason.SABOTAGE_EXPIRED);
  }, durationSeconds * 1000);
  sabotageTimers.set(gameId, timer);
}

function scheduleCooldownEnd(io: TypedServer, gameId: string, cooldownSeconds: number) {
  setTimeout(async () => {
    const [sabotage] = await db
      .select()
      .from(sabotageStates)
      .where(eq(sabotageStates.gameId, gameId))
      .limit(1);
    if (!sabotage || sabotage.state !== SabotageState.COOLDOWN) return;

    await db
      .update(sabotageStates)
      .set({ state: SabotageState.NONE, cooldownEndsAt: null, type: null })
      .where(eq(sabotageStates.id, sabotage.id));

    io.to(gameId).emit("sabotage:update", {
      state: SabotageState.NONE,
      type: SabotageType.OXYGEN,
    });
  }, cooldownSeconds * 1000);
}

function clearSabotageTimer(gameId: string) {
  const timer = sabotageTimers.get(gameId);
  if (timer) {
    clearTimeout(timer);
    sabotageTimers.delete(gameId);
  }
}

export async function getActiveSabotage(gameId: string): Promise<SabotageDTO | null> {
  const [sabotage] = await db
    .select()
    .from(sabotageStates)
    .where(eq(sabotageStates.gameId, gameId))
    .limit(1);

  if (!sabotage || sabotage.state === SabotageState.NONE)
    return null;

  return {
    state: sabotage.state as SabotageState,
    type: (sabotage.type as SabotageType) ?? SabotageType.OXYGEN,
    timerEndsAt: sabotage.state === SabotageState.ACTIVE
      ? sabotage.timerEndsAt?.getTime()
      : sabotage.state === SabotageState.COOLDOWN
        ? sabotage.cooldownEndsAt?.getTime()
        : undefined,
  };
}
