import type { Server, Socket } from "socket.io";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "@among-us-irl/shared";
import {
  requestMeeting,
  castVote,
  getActiveMeetingId,
} from "../services/meetingService.js";

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

interface SocketData {
  playerId: string;
  gameId: string;
  auth: unknown;
}

export function registerMeetingHandlers(
  io: TypedServer,
  socket: TypedSocket,
  socketDataMap: Map<string, SocketData>
) {
  socket.on("meeting:call", async () => {
    const data = socketDataMap.get(socket.id);
    if (!data) return;
    await requestMeeting(io, data.gameId, data.playerId, false);
  });

  socket.on("meeting:report", async () => {
    const data = socketDataMap.get(socket.id);
    if (!data) return;
    await requestMeeting(io, data.gameId, data.playerId, true);
  });

  socket.on("vote:cast", async (targetPlayerId: string | null) => {
    const data = socketDataMap.get(socket.id);
    if (!data) return;

    const meetingId = await getActiveMeetingId(data.gameId);
    if (!meetingId) return;

    await castVote(io, data.gameId, meetingId, data.playerId, targetPlayerId);
  });
}
