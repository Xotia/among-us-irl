import type { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import type { AuthPayload } from "../middleware/auth.js";
import { UserRole } from "@among-us-irl/shared";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "@among-us-irl/shared";
import {
  addPlayerToGame,
  setPlayerConnected,
  getGamePlayers,
  getGameReadiness,
  findGameByCode,
} from "../services/lobbyService.js";
import { buildGameSyncState, buildAdminSyncState } from "../services/reconnectionService.js";
import { registerTaskHandlers } from "./taskHandler.js";
import { registerMeetingHandlers } from "./meetingHandler.js";
import { registerSabotageHandlers } from "./sabotageHandler.js";

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

interface SocketData {
  playerId: string;
  gameId: string;
  auth: AuthPayload;
}

const socketDataMap = new Map<string, SocketData>();

export function registerLobbyHandlers(io: TypedServer) {
  io.on("connection", (socket: TypedSocket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on("game:join", async (gameCode: string, token: string) => {
      let payload: AuthPayload;
      try {
        payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
      } catch {
        socket.disconnect();
        return;
      }

      const game = await findGameByCode(gameCode);
      if (!game) {
        socket.disconnect();
        return;
      }

      const isGuest = payload.role === UserRole.GUEST;
      const isRunning = game.status === "RUNNING" || game.status === "READY";

      if (!isGuest) {
        // Admin joins as observer, not as a player
        const adminId = (payload as import("../middleware/auth.js").AdminPayload).userId;
        const data: SocketData = {
          playerId: `admin_${adminId}`,
          gameId: game.id,
          auth: payload,
        };
        socketDataMap.set(socket.id, data);
        await socket.join(game.id);

        const players = await getGamePlayers(game.id);
        io.to(game.id).emit("lobby:update", players);

        if (isRunning) {
          const syncState = await buildAdminSyncState(game.id);
          if (syncState) {
            socket.emit("connection:sync", syncState);
          }
        }
        return;
      }

      const pseudo = (payload as import("../middleware/auth.js").GuestPayload).pseudo;
      const guestSessionId = (payload as import("../middleware/auth.js").GuestPayload).sessionId;

      const result = await addPlayerToGame(
        game.id,
        pseudo,
        guestSessionId
      );

      if ("error" in result) {
        socket.disconnect();
        return;
      }

      const data: SocketData = {
        playerId: result.player.id,
        gameId: game.id,
        auth: payload,
      };
      socketDataMap.set(socket.id, data);

      await socket.join(game.id);

      const players = await getGamePlayers(game.id);
      io.to(game.id).emit("lobby:update", players);
      socket.to(game.id).emit("player:joined", result.player);

      if (isRunning) {
        const syncState = await buildGameSyncState(game.id, result.player.id);
        if (syncState) {
          socket.emit("connection:sync", syncState);
        }
      }
    });

    registerTaskHandlers(io, socket, socketDataMap);
    registerMeetingHandlers(io, socket, socketDataMap);
    registerSabotageHandlers(io, socket, socketDataMap);

    socket.on("disconnect", async () => {
      const data = socketDataMap.get(socket.id);
      if (!data) return;

      socketDataMap.delete(socket.id);

      const isAdminObserver = data.playerId.startsWith("admin_");
      if (!isAdminObserver) {
        await setPlayerConnected(data.playerId, false);
        io.to(data.gameId).emit("player:left", data.playerId);
      }

      const players = await getGamePlayers(data.gameId);
      io.to(data.gameId).emit("lobby:update", players);

      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}

export { socketDataMap };
