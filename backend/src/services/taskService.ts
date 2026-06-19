import { eq, and, sql } from "drizzle-orm";
import { db } from "../db.js";
import {
  tasks,
  playersInGame,
  gameInstances,
  gameConfigs,
} from "../models/schema.js";
import { GameStatus, TaskValidationMode } from "@among-us-irl/shared";
import type { TaskDTO } from "@among-us-irl/shared";

export async function getGameTasks(gameId: string): Promise<TaskDTO[]> {
  const rows = await db
    .select({
      id: tasks.id,
      name: tasks.name,
      description: tasks.description,
      isCompleted: tasks.isCompleted,
      completedBy: tasks.completedBy,
    })
    .from(tasks)
    .where(eq(tasks.gameId, gameId));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isCompleted: r.isCompleted,
    completedBy: r.completedBy ?? undefined,
  }));
}

export async function getTasksProgress(
  gameId: string
): Promise<{ completed: number; total: number }> {
  const [result] = await db
    .select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${tasks.isCompleted})::int`,
    })
    .from(tasks)
    .where(eq(tasks.gameId, gameId));

  return { completed: result.completed, total: result.total };
}

export async function completeTask(
  taskId: string,
  playerId: string
): Promise<{ task: TaskDTO } | { error: string }> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return { error: "Tâche introuvable" };
  if (task.isCompleted) return { error: "Tâche déjà complétée" };

  const [player] = await db
    .select()
    .from(playersInGame)
    .where(eq(playersInGame.id, playerId))
    .limit(1);
  if (!player) return { error: "Joueur introuvable" };
  if (player.gameId !== task.gameId) return { error: "Joueur pas dans cette partie" };
  if (player.lifeState !== "ALIVE") return { error: "Les joueurs morts ne peuvent pas valider de tâches" };

  const [game] = await db
    .select()
    .from(gameInstances)
    .where(eq(gameInstances.id, task.gameId))
    .limit(1);
  if (!game || game.status !== GameStatus.RUNNING)
    return { error: "La partie n'est pas en cours" };

  const [config] = await db
    .select()
    .from(gameConfigs)
    .where(eq(gameConfigs.gameId, task.gameId))
    .limit(1);

  if (config?.taskValidationMode === TaskValidationMode.ADMIN_ONLY && !player.adminId) {
    return { error: "Seul l'admin peut valider les tâches" };
  }

  const [updated] = await db
    .update(tasks)
    .set({ isCompleted: true, completedBy: playerId, completedAt: new Date() })
    .where(and(eq(tasks.id, taskId), eq(tasks.isCompleted, false)))
    .returning();

  if (!updated) return { error: "Tâche déjà complétée" };

  return {
    task: {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      isCompleted: true,
      completedBy: playerId,
    },
  };
}

export async function uncompleteTask(
  taskId: string,
  playerId: string
): Promise<{ task: TaskDTO } | { error: string }> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return { error: "Tâche introuvable" };
  if (!task.isCompleted) return { error: "Tâche pas encore complétée" };

  const [player] = await db
    .select()
    .from(playersInGame)
    .where(eq(playersInGame.id, playerId))
    .limit(1);
  if (!player) return { error: "Joueur introuvable" };

  const [updated] = await db
    .update(tasks)
    .set({ isCompleted: false, completedBy: null, completedAt: null })
    .where(eq(tasks.id, taskId))
    .returning();

  return {
    task: {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      isCompleted: false,
    },
  };
}

export async function adminToggleTask(
  taskId: string
): Promise<{ task: TaskDTO } | { error: string }> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return { error: "Tâche introuvable" };

  const [updated] = await db
    .update(tasks)
    .set({
      isCompleted: !task.isCompleted,
      completedBy: task.isCompleted ? null : null,
      completedAt: task.isCompleted ? null : new Date(),
    })
    .where(eq(tasks.id, taskId))
    .returning();

  return {
    task: {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      isCompleted: updated.isCompleted,
    },
  };
}

export async function checkTasksVictory(
  gameId: string
): Promise<boolean> {
  const progress = await getTasksProgress(gameId);
  return progress.total > 0 && progress.completed >= progress.total;
}
