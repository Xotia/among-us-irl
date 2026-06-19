/**
 * Bot players for Among Us IRL — simulates N guests joining a game,
 * completing tasks, voting in meetings, etc.
 *
 * Usage: node scripts/bot-players.mjs <gameCode> [botCount=5]
 *
 * Requires: socket.io-client (installed at root or in backend)
 */

import { io as ioClient } from "socket.io-client";

const API_BASE = "http://localhost:3001";
const WS_URL = "http://localhost:3001";

const GAME_CODE = process.argv[2];
const BOT_COUNT = parseInt(process.argv[3] || "5", 10);

if (!GAME_CODE) {
  console.error("Usage: node scripts/bot-players.mjs <gameCode> [botCount]");
  process.exit(1);
}

const BOT_NAMES = [
  "Rouge", "Bleu", "Vert", "Jaune", "Rose",
  "Orange", "Cyan", "Violet", "Blanc", "Noir",
  "Marron", "Lime",
];

const bots = [];

async function joinAsGuest(pseudo, gameCode) {
  const res = await fetch(`${API_BASE}/auth/guest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pseudo, gameCode }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to join as ${pseudo}: ${res.status} ${err}`);
  }
  return res.json();
}

function createBot(pseudo, token, gameCode) {
  const socket = ioClient(WS_URL, {
    transports: ["websocket"],
    autoConnect: true,
  });

  const bot = { pseudo, token, socket, role: null, tasks: [], playerId: null, alive: true };

  socket.on("connect", () => {
    console.log(`[${pseudo}] Connected, joining game ${gameCode}...`);
    socket.emit("game:join", gameCode, token);
  });

  socket.on("lobby:update", (players) => {
    console.log(`[${pseudo}] Lobby update: ${players.length} players`);
  });

  socket.on("game:started", () => {
    console.log(`[${pseudo}] Game started!`);
  });

  socket.on("role:assigned", (assignment) => {
    bot.role = assignment.role;
    console.log(`[${pseudo}] Role: ${assignment.role}${assignment.coImpostors ? ` (co-impostors: ${assignment.coImpostors.join(", ")})` : ""}`);
  });

  socket.on("connection:sync", (state) => {
    bot.playerId = state.myPlayerId;
    bot.role = state.myRole;
    bot.tasks = state.tasks || [];
    bot.alive = state.myLifeState === "ALIVE";
    console.log(`[${pseudo}] Synced — role: ${state.myRole}, tasks: ${bot.tasks.length}, alive: ${bot.alive}`);

    if (bot.role === "CREWMATE" && bot.alive) {
      scheduleTaskCompletion(bot);
    }
    if (bot.role === "IMPOSTOR" && bot.alive) {
      scheduleImpostorActions(bot);
    }
  });

  socket.on("game:phase", (phase) => {
    console.log(`[${pseudo}] Phase: ${phase}`);
  });

  socket.on("meeting:update", (meeting) => {
    console.log(`[${pseudo}] Meeting: ${meeting.state}`);
    if (meeting.state === "VOTING" && bot.alive) {
      setTimeout(() => {
        // Vote skip (null) or random player — bots vote skip for simplicity
        socket.emit("vote:cast", null);
        console.log(`[${pseudo}] Voted: skip`);
      }, 1000 + Math.random() * 3000);
    }
  });

  socket.on("meeting:result", (result) => {
    const action = result.eliminatedPlayerId ? `eliminated ${result.eliminatedPlayerId}` : "no one eliminated";
    console.log(`[${pseudo}] Meeting result: ${action}`);
  });

  socket.on("player:died", (playerId) => {
    if (playerId === bot.playerId) {
      bot.alive = false;
      console.log(`[${pseudo}] I died!`);
    }
  });

  socket.on("task:completed", (task) => {
    console.log(`[${pseudo}] Task completed: ${task.name}`);
  });

  socket.on("tasks:progress", (completed, total) => {
    console.log(`[${pseudo}] Tasks progress: ${completed}/${total}`);
  });

  socket.on("sabotage:update", (sabotage) => {
    console.log(`[${pseudo}] Sabotage: ${sabotage.type} (${sabotage.state})`);
    if (sabotage.state === "ACTIVE" && bot.alive && bot.role === "CREWMATE") {
      setTimeout(() => {
        socket.emit("sabotage:resolve");
        console.log(`[${pseudo}] Attempting to resolve sabotage`);
      }, 2000 + Math.random() * 3000);
    }
  });

  socket.on("game:over", (result) => {
    console.log(`[${pseudo}] Game over! Winner: ${result.winner} (${result.reason})`);
  });

  socket.on("disconnect", () => {
    console.log(`[${pseudo}] Disconnected`);
  });

  socket.on("connect_error", (err) => {
    console.error(`[${pseudo}] Connection error: ${err.message}`);
  });

  return bot;
}

function scheduleImpostorActions(bot) {
  // Trigger a sabotage after 10 seconds
  setTimeout(() => {
    if (!bot.alive) return;
    const types = ["OXYGEN", "ENERGY"];
    const type = types[Math.floor(Math.random() * types.length)];
    bot.socket.emit("sabotage:trigger", type);
    console.log(`[${bot.pseudo}] Triggering sabotage: ${type}`);
  }, 10000 + Math.random() * 5000);
}

function scheduleTaskCompletion(bot) {
  const incompleteTasks = bot.tasks.filter((t) => !t.isCompleted);
  if (incompleteTasks.length === 0) return;

  incompleteTasks.forEach((task, i) => {
    const delay = 5000 + i * (8000 + Math.random() * 7000);
    setTimeout(() => {
      if (!bot.alive) return;
      bot.socket.emit("task:complete", task.id);
      console.log(`[${bot.pseudo}] Completing task: ${task.name}`);
    }, delay);
  });
}

async function main() {
  console.log(`Starting ${BOT_COUNT} bots for game ${GAME_CODE}...\n`);

  for (let i = 0; i < BOT_COUNT; i++) {
    const pseudo = BOT_NAMES[i] || `Bot${i + 1}`;
    try {
      const { token } = await joinAsGuest(pseudo, GAME_CODE);
      console.log(`[${pseudo}] Joined via API, got token`);
      const bot = createBot(pseudo, token, GAME_CODE);
      bots.push(bot);
      // Stagger connections slightly
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      console.error(`[${pseudo}] Error: ${err.message}`);
    }
  }

  console.log(`\n${bots.length} bots connected. Press Ctrl+C to stop.\n`);

  process.on("SIGINT", () => {
    console.log("\nDisconnecting all bots...");
    bots.forEach((b) => b.socket.disconnect());
    process.exit(0);
  });
}

main().catch(console.error);
