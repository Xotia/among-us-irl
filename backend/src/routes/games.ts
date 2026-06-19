import { Router } from "express";
import type { Router as RouterType } from "express";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import type { AdminPayload } from "../middleware/auth.js";
import { CONFIG_LIMITS } from "@among-us-irl/shared";
import {
  createGame,
  getGameDetail,
  updateGameConfig,
  listPresets,
  importPreset,
} from "../services/gameService.js";
import { startGame } from "../services/gameStateMachine.js";
import { emitGameStarted } from "../socket/gameHandler.js";
import { markPlayerDead } from "../services/deathService.js";
import { forceMeeting } from "../services/meetingService.js";
import { resolveSabotage } from "../services/sabotageService.js";
import { adminToggleTask, getTasksProgress, checkTasksVictory } from "../services/taskService.js";
import { endGame } from "../services/gameEndService.js";
import { Winner, GameOverReason } from "@among-us-irl/shared";
import { scheduleGameTimer } from "../services/gameTimerService.js";
import { cancelGame } from "../services/gameEndService.js";
import { resetAllGames } from "../services/gameService.js";
import { io } from "../index.js";

const router: RouterType = Router();

const configSchema = z
  .object({
    minPlayers: z
      .number()
      .int()
      .min(CONFIG_LIMITS.minPlayers.min)
      .max(CONFIG_LIMITS.minPlayers.max)
      .optional(),
    maxPlayers: z
      .number()
      .int()
      .min(CONFIG_LIMITS.maxPlayers.min)
      .max(CONFIG_LIMITS.maxPlayers.max)
      .optional(),
    impostorCount: z
      .number()
      .int()
      .min(CONFIG_LIMITS.impostorCount.min)
      .max(CONFIG_LIMITS.impostorCount.max)
      .optional(),
    gameDurationSeconds: z
      .number()
      .int()
      .min(CONFIG_LIMITS.gameDurationSeconds.min)
      .max(CONFIG_LIMITS.gameDurationSeconds.max)
      .optional(),
    meetingDurationSeconds: z
      .number()
      .int()
      .min(CONFIG_LIMITS.meetingDurationSeconds.min)
      .max(CONFIG_LIMITS.meetingDurationSeconds.max)
      .optional(),
    sabotageDurationSeconds: z
      .number()
      .int()
      .min(CONFIG_LIMITS.sabotageDurationSeconds.min)
      .max(CONFIG_LIMITS.sabotageDurationSeconds.max)
      .optional(),
    sabotageCooldownSeconds: z
      .number()
      .int()
      .min(CONFIG_LIMITS.sabotageCooldownSeconds.min)
      .max(CONFIG_LIMITS.sabotageCooldownSeconds.max)
      .optional(),
    taskValidationMode: z.enum(["ANY_PLAYER", "ADMIN_ONLY"]).optional(),
    oxygenCode: z
      .string()
      .min(CONFIG_LIMITS.oxygenCodeLength.min)
      .max(CONFIG_LIMITS.oxygenCodeLength.max)
      .regex(/^\d+$/, "Le code oxygène doit être numérique")
      .optional(),
    tasks: z
      .array(
        z.object({
          name: z.string().min(1).max(200),
          description: z.string().max(500).optional(),
        })
      )
      .max(CONFIG_LIMITS.maxTasks)
      .optional(),
  })
  .refine(
    (data) => {
      if (
        data.minPlayers !== undefined &&
        data.maxPlayers !== undefined &&
        data.minPlayers > data.maxPlayers
      ) {
        return false;
      }
      return true;
    },
    { message: "minPlayers ne peut pas dépasser maxPlayers" }
  );

const createGameSchema = z.object({
  presetCode: z.string().max(20).optional(),
});

const importPresetSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  config: configSchema,
});

// POST /games — create a new game
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const parsed = createGameSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const result = await createGame((req.auth as AdminPayload).userId, parsed.data.presetCode);
  res.status(201).json(result);
});

// GET /games/:id — get game detail
router.get("/:id", requireAuth, requireAdmin, async (req, res) => {
  const result = await getGameDetail(req.params.id as string, (req.auth as AdminPayload).userId);
  if ("error" in result) {
    res.status(404).json({ error: result.error });
    return;
  }
  res.json(result);
});

// PATCH /games/:id/config — update game config
router.patch("/:id/config", requireAuth, requireAdmin, async (req, res) => {
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const result = await updateGameConfig(
    req.params.id as string,
    (req.auth as AdminPayload).userId,
    parsed.data
  );
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result);
});

// POST /games/:id/start — launch the game
router.post("/:id/start", requireAuth, requireAdmin, async (req, res) => {
  const result = await startGame(
    req.params.id as string,
    (req.auth as AdminPayload).userId
  );
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }

  await emitGameStarted(io, result);
  scheduleGameTimer(io, result.gameId, result.gameTimerEndsAt);

  const allRoles = Object.fromEntries(
    result.roleAssignments.map((a) => [a.pseudo, a.role])
  );

  res.json({
    gameId: result.gameId,
    gameTimerEndsAt: result.gameTimerEndsAt.toISOString(),
    roles: allRoles,
  });
});

// POST /games/:id/players/:playerId/kill — admin marks a player dead
router.post("/:id/players/:playerId/kill", requireAuth, requireAdmin, async (req, res) => {
  const result = await markPlayerDead(
    io,
    req.params.id as string,
    req.params.playerId as string,
    (req.auth as AdminPayload).userId
  );
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result);
});

// POST /games/:id/force-meeting — admin forces a meeting
router.post("/:id/force-meeting", requireAuth, requireAdmin, async (req, res) => {
  const result = await forceMeeting(
    io,
    req.params.id as string,
    (req.auth as AdminPayload).userId
  );
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result);
});

// POST /games/:id/resolve-sabotage — admin force-resolves a sabotage (energy)
router.post("/:id/resolve-sabotage", requireAuth, requireAdmin, async (req, res) => {
  const result = await resolveSabotage(
    io,
    req.params.id as string
  );
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result);
});

// POST /games/:id/cancel — admin cancels a running game
router.post("/:id/cancel", requireAuth, requireAdmin, async (req, res) => {
  const result = await cancelGame(
    io,
    req.params.id as string,
    (req.auth as AdminPayload).userId
  );
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result);
});

// POST /games/:id/tasks/:taskId/toggle — admin toggles a task
router.post("/:id/tasks/:taskId/toggle", requireAuth, requireAdmin, async (req, res) => {
  const result = await adminToggleTask(req.params.taskId as string);
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }

  const gameId = req.params.id as string;
  if (result.task.isCompleted) {
    io.to(gameId).emit("task:completed", result.task);
  } else {
    io.to(gameId).emit("task:uncompleted", result.task);
  }

  const progress = await getTasksProgress(gameId);
  io.to(gameId).emit("tasks:progress", progress.completed, progress.total);

  if (result.task.isCompleted && await checkTasksVictory(gameId)) {
    await endGame(io, gameId, Winner.CREWMATES, GameOverReason.TASKS_COMPLETED);
  }

  res.json(result);
});

// GET /presets — list all presets
router.get("/presets/list", async (_req, res) => {
  const result = await listPresets();
  res.json(result);
});

// POST /presets — import a preset
router.post("/presets/import", requireAuth, requireAdmin, async (req, res) => {
  const parsed = importPresetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const result = await importPreset(
    parsed.data.code,
    parsed.data.name,
    parsed.data.config
  );
  if ("error" in result) {
    res.status(409).json({ error: result.error });
    return;
  }
  res.status(201).json(result);
});

// POST /games/reset — delete all games, players, events (admin only)
router.post("/reset", requireAuth, requireAdmin, async (_req, res) => {
  const result = await resetAllGames(io);
  res.json(result);
});

export default router;
