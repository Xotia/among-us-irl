import type { Server, Socket } from "socket.io";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "@among-us-irl/shared";
import { Winner, GameOverReason } from "@among-us-irl/shared";
import {
  completeTask,
  uncompleteTask,
  getTasksProgress,
  checkTasksVictory,
} from "../services/taskService.js";
import { endGame } from "../services/gameEndService.js";

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

interface SocketData {
  playerId: string;
  gameId: string;
  auth: unknown;
}

export function registerTaskHandlers(
  io: TypedServer,
  socket: TypedSocket,
  socketDataMap: Map<string, SocketData>
) {
  socket.on("task:complete", async (taskId: string) => {
    const data = socketDataMap.get(socket.id);
    if (!data) {
      console.error(`task:complete: no socket data for ${socket.id}`);
      return;
    }

    const result = await completeTask(taskId, data.playerId);
    if ("error" in result) {
      console.error(`task:complete failed for player ${data.playerId}:`, result.error);
      return;
    }

    io.to(data.gameId).emit("task:completed", result.task);

    const progress = await getTasksProgress(data.gameId);
    io.to(data.gameId).emit("tasks:progress", progress.completed, progress.total);

    if (await checkTasksVictory(data.gameId)) {
      await endGame(io, data.gameId, Winner.CREWMATES, GameOverReason.TASKS_COMPLETED);
    }
  });

  socket.on("task:uncomplete", async (taskId: string) => {
    const data = socketDataMap.get(socket.id);
    if (!data) return;

    const result = await uncompleteTask(taskId, data.playerId);
    if ("error" in result) {
      console.error(`task:uncomplete failed for player ${data.playerId}:`, result.error);
      return;
    }

    io.to(data.gameId).emit("task:uncompleted", result.task);

    const progress = await getTasksProgress(data.gameId);
    io.to(data.gameId).emit("tasks:progress", progress.completed, progress.total);
  });
}
