import { io, Socket } from "socket.io-client";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "@among-us-irl/shared";

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;
let currentToken: string | null = null;
let currentGameCode: string | null = null;

export function connectSocket(token: string, gameCode: string): TypedSocket {
  if (socket?.connected && currentToken === token && currentGameCode === gameCode) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
  }

  currentToken = token;
  currentGameCode = gameCode;

  socket = io({
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on("connect", () => {
    socket!.emit("game:join", gameCode, token);
  });

  socket.connect();

  return socket;
}

export function getSocket(): TypedSocket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
    currentGameCode = null;
  }
}
