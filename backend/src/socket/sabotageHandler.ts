import type { Server, Socket } from "socket.io";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "@among-us-irl/shared";
import { SabotageType } from "@among-us-irl/shared";
import { triggerSabotage, resolveSabotage } from "../services/sabotageService.js";

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

interface SocketData {
  playerId: string;
  gameId: string;
  auth: unknown;
}

export function registerSabotageHandlers(
  io: TypedServer,
  socket: TypedSocket,
  socketDataMap: Map<string, SocketData>
) {
  socket.on("sabotage:trigger", async (type: SabotageType) => {
    const data = socketDataMap.get(socket.id);
    if (!data) return;
    if (!Object.values(SabotageType).includes(type)) return;
    await triggerSabotage(io, data.gameId, data.playerId, type);
  });

  socket.on("sabotage:resolve", async (code?: string) => {
    const data = socketDataMap.get(socket.id);
    if (!data) return;
    await resolveSabotage(io, data.gameId, code);
  });
}
