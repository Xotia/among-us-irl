import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { config } from "./config.js";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "@among-us-irl/shared";
import authRoutes from "./routes/auth.js";
import gameRoutes from "./routes/games.js";
import { registerLobbyHandlers } from "./socket/lobbyHandler.js";

const app = express();
const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: config.corsOrigin,
    methods: ["GET", "POST"],
  },
});

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/auth", authRoutes);
app.use("/games", gameRoutes);

registerLobbyHandlers(io);

httpServer.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

export { io };
