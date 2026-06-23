import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameStatus, GamePhase, PlayerRole, TaskValidationMode } from "@among-us-irl/shared";

const GAME_ID = "game-1";
const TASK_ID = "task-1";
const CREWMATE_ID = "player-crew";
const IMPOSTOR_ID = "player-imp";

const mockTask = {
  id: TASK_ID,
  gameId: GAME_ID,
  name: "Fix wiring",
  description: "",
  isCompleted: false,
  completedBy: null,
  completedAt: null,
};

const completedTask = { ...mockTask, isCompleted: true, completedBy: CREWMATE_ID, completedAt: new Date() };

const crewmatePlayer = {
  id: CREWMATE_ID,
  gameId: GAME_ID,
  role: PlayerRole.CREWMATE,
  lifeState: "ALIVE",
  adminId: null,
};

const impostorPlayer = {
  id: IMPOSTOR_ID,
  gameId: GAME_ID,
  role: PlayerRole.IMPOSTOR,
  lifeState: "ALIVE",
  adminId: null,
};

const runningGame = {
  id: GAME_ID,
  status: GameStatus.RUNNING,
  phase: GamePhase.FREE_ROAM,
};

const anyPlayerConfig = {
  gameId: GAME_ID,
  taskValidationMode: TaskValidationMode.ANY_PLAYER,
};

let selectCallIndex = 0;
let selectResults: unknown[][] = [];
let updateReturning: unknown[] = [];

function mockLimit() {
  return vi.fn().mockImplementation(() => {
    const result = selectResults[selectCallIndex] ?? [];
    selectCallIndex++;
    return Promise.resolve(result);
  });
}

const limitFn = mockLimit();

const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: limitFn,
    }),
  }),
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockImplementation(() => Promise.resolve(updateReturning)),
      }),
    }),
  }),
};

vi.mock("../db.js", () => ({ db: mockDb }));

const { completeTask, uncompleteTask } = await import("./taskService.js");

beforeEach(() => {
  vi.clearAllMocks();
  selectCallIndex = 0;
  selectResults = [];
  updateReturning = [];
  const newLimitFn = mockLimit();
  mockDb.from.mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: newLimitFn,
    }),
  });
});

describe("completeTask", () => {
  it("allows a crewmate to complete a task", async () => {
    // select order: task, player, game, config
    selectResults = [[mockTask], [crewmatePlayer], [runningGame], [anyPlayerConfig]];
    const updated = { ...mockTask, isCompleted: true, completedBy: CREWMATE_ID, completedAt: new Date() };
    updateReturning = [updated];

    const result = await completeTask(TASK_ID, CREWMATE_ID);
    expect(result).toHaveProperty("task");
    expect((result as any).task.isCompleted).toBe(true);
    expect((result as any).task.completedBy).toBe(CREWMATE_ID);
  });

  it("blocks an impostor from completing a task", async () => {
    // select order: task, player (impostor) — stops here
    selectResults = [[mockTask], [impostorPlayer]];

    const result = await completeTask(TASK_ID, IMPOSTOR_ID);
    expect(result).toEqual({ error: "Les imposteurs ne peuvent pas valider de tâches" });
  });

  it("blocks a dead player from completing a task", async () => {
    selectResults = [[mockTask], [{ ...crewmatePlayer, lifeState: "DEAD" }]];

    const result = await completeTask(TASK_ID, CREWMATE_ID);
    expect(result).toEqual({ error: "Les joueurs morts ne peuvent pas valider de tâches" });
  });

  it("returns error for non-existent task", async () => {
    selectResults = [[]];
    const result = await completeTask("no-task", CREWMATE_ID);
    expect(result).toEqual({ error: "Tâche introuvable" });
  });

  it("returns error for already completed task", async () => {
    selectResults = [[completedTask]];
    const result = await completeTask(TASK_ID, CREWMATE_ID);
    expect(result).toEqual({ error: "Tâche déjà complétée" });
  });

  it("returns error when game is not running", async () => {
    selectResults = [[mockTask], [crewmatePlayer], [{ ...runningGame, status: GameStatus.LOBBY_OPEN }]];
    const result = await completeTask(TASK_ID, CREWMATE_ID);
    expect(result).toEqual({ error: "La partie n'est pas en cours" });
  });

  it("returns error during meeting phase", async () => {
    selectResults = [[mockTask], [crewmatePlayer], [{ ...runningGame, phase: GamePhase.MEETING_IN_PROGRESS }]];
    const result = await completeTask(TASK_ID, CREWMATE_ID);
    expect(result).toEqual({ error: "Impossible de valider des tâches pendant un rassemblement" });
  });
});

describe("uncompleteTask", () => {
  it("allows a crewmate to uncomplete a task", async () => {
    // select order: task, player
    selectResults = [[completedTask], [crewmatePlayer]];
    const uncompleted = { ...mockTask, isCompleted: false, completedBy: null, completedAt: null };
    updateReturning = [uncompleted];

    const result = await uncompleteTask(TASK_ID, CREWMATE_ID);
    expect(result).toHaveProperty("task");
    expect((result as any).task.isCompleted).toBe(false);
  });

  it("blocks an impostor from uncompleting a task", async () => {
    // select order: task, player (impostor) — stops here
    selectResults = [[completedTask], [impostorPlayer]];

    const result = await uncompleteTask(TASK_ID, IMPOSTOR_ID);
    expect(result).toEqual({ error: "Les imposteurs ne peuvent pas modifier les tâches" });
  });

  it("returns error for task not yet completed", async () => {
    selectResults = [[mockTask]];
    const result = await uncompleteTask(TASK_ID, CREWMATE_ID);
    expect(result).toEqual({ error: "Tâche pas encore complétée" });
  });

  it("returns error for non-existent task", async () => {
    selectResults = [[]];
    const result = await uncompleteTask("no-task", CREWMATE_ID);
    expect(result).toEqual({ error: "Tâche introuvable" });
  });
});
