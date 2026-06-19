import { eq } from "drizzle-orm";
import type { Server } from "socket.io";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "@among-us-irl/shared";
import { Winner, GameOverReason } from "@among-us-irl/shared";
import { endGame } from "./gameEndService.js";
import { db } from "../db.js";
import { gameInstances } from "../models/schema.js";

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

const activeTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pausedRemaining = new Map<string, number>();

export function scheduleGameTimer(
  io: TypedServer,
  gameId: string,
  gameTimerEndsAt: Date
) {
  clearGameTimer(gameId);
  pausedRemaining.delete(gameId);

  const delay = gameTimerEndsAt.getTime() - Date.now();
  if (delay <= 0) {
    endGame(io, gameId, Winner.IMPOSTORS, GameOverReason.TIMER_EXPIRED);
    return;
  }

  const timer = setTimeout(async () => {
    activeTimers.delete(gameId);
    await endGame(io, gameId, Winner.IMPOSTORS, GameOverReason.TIMER_EXPIRED);
  }, delay);

  activeTimers.set(gameId, timer);
}

export function clearGameTimer(gameId: string) {
  const timer = activeTimers.get(gameId);
  if (timer) {
    clearTimeout(timer);
    activeTimers.delete(gameId);
  }
}

export function pauseGameTimer(gameId: string, gameTimerEndsAt: Date) {
  clearGameTimer(gameId);
  const remaining = Math.max(0, gameTimerEndsAt.getTime() - Date.now());
  pausedRemaining.set(gameId, remaining);
}

export async function resumeGameTimer(io: TypedServer, gameId: string) {
  const remaining = pausedRemaining.get(gameId);
  if (remaining === undefined) return;
  pausedRemaining.delete(gameId);

  const newEndsAt = new Date(Date.now() + remaining);

  await db
    .update(gameInstances)
    .set({ gameTimerEndsAt: newEndsAt, updatedAt: new Date() })
    .where(eq(gameInstances.id, gameId));

  io.to(gameId).emit("game:timer", newEndsAt.getTime());

  scheduleGameTimer(io, gameId, newEndsAt);
}
