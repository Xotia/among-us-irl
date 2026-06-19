import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

export const gameStatusEnum = pgEnum("game_status", [
  "DRAFT",
  "LOBBY_OPEN",
  "READY",
  "RUNNING",
  "ENDED",
  "CANCELLED",
]);

export const gamePhaseEnum = pgEnum("game_phase", [
  "FREE_ROAM",
  "MEETING_IN_PROGRESS",
  "GAME_OVER_PENDING",
]);

export const playerRoleEnum = pgEnum("player_role", ["CREWMATE", "IMPOSTOR"]);

export const playerLifeStateEnum = pgEnum("player_life_state", [
  "ALIVE",
  "DEAD",
  "EJECTED",
]);

export const sabotageTypeEnum = pgEnum("sabotage_type", ["OXYGEN", "ENERGY"]);

export const sabotageStateEnum = pgEnum("sabotage_state", [
  "NONE",
  "STARTING",
  "ACTIVE",
  "RESOLVING",
  "RESOLVED",
  "FAILED",
  "COOLDOWN",
]);

export const meetingStateEnum = pgEnum("meeting_state", [
  "IDLE",
  "REQUESTED",
  "OPEN",
  "DISCUSSION",
  "VOTING",
  "RESOLVING",
  "CLOSED",
]);

export const taskValidationModeEnum = pgEnum("task_validation_mode", [
  "ANY_PLAYER",
  "ADMIN_ONLY",
]);

export const userAccounts = pgTable("user_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const guestSessions = pgTable("guest_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  pseudo: varchar("pseudo", { length: 30 }).notNull(),
  sessionToken: text("session_token").notNull().unique(),
  reconnectToken: text("reconnect_token").notNull().unique(),
  gameId: uuid("game_id")
    .references(() => gameInstances.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
});

export const gameInstances = pgTable("game_instances", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 6 }).notNull().unique(),
  status: gameStatusEnum("status").default("DRAFT").notNull(),
  phase: gamePhaseEnum("phase"),
  createdBy: uuid("created_by")
    .references(() => userAccounts.id)
    .notNull(),
  gameTimerEndsAt: timestamp("game_timer_ends_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const gameConfigs = pgTable("game_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameId: uuid("game_id")
    .references(() => gameInstances.id)
    .notNull()
    .unique(),
  minPlayers: integer("min_players").default(4).notNull(),
  maxPlayers: integer("max_players").default(15).notNull(),
  impostorCount: integer("impostor_count").default(1).notNull(),
  gameDurationSeconds: integer("game_duration_seconds").default(1800).notNull(),
  meetingDurationSeconds: integer("meeting_duration_seconds")
    .default(120)
    .notNull(),
  sabotageDurationSeconds: integer("sabotage_duration_seconds")
    .default(60)
    .notNull(),
  sabotageCooldownSeconds: integer("sabotage_cooldown_seconds")
    .default(30)
    .notNull(),
  taskValidationMode: taskValidationModeEnum("task_validation_mode")
    .default("ANY_PLAYER")
    .notNull(),
  oxygenCode: varchar("oxygen_code", { length: 4 }).default("1234").notNull(),
  revealRoleOnEject: boolean("reveal_role_on_eject").default(true).notNull(),
  tasksJson: jsonb("tasks_json").default([]).notNull(),
});

export const presets = pgTable("presets", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  configJson: jsonb("config_json").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const playersInGame = pgTable("players_in_game", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameId: uuid("game_id")
    .references(() => gameInstances.id)
    .notNull(),
  guestSessionId: uuid("guest_session_id").references(
    () => guestSessions.id
  ),
  adminId: uuid("admin_id").references(() => userAccounts.id),
  pseudo: varchar("pseudo", { length: 30 }).notNull(),
  role: playerRoleEnum("role"),
  lifeState: playerLifeStateEnum("life_state").default("ALIVE").notNull(),
  isConnected: boolean("is_connected").default(true).notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameId: uuid("game_id")
    .references(() => gameInstances.id)
    .notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description").default("").notNull(),
  isCompleted: boolean("is_completed").default(false).notNull(),
  completedBy: uuid("completed_by").references(() => playersInGame.id),
  completedAt: timestamp("completed_at"),
});

export const sabotageStates = pgTable("sabotage_states", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameId: uuid("game_id")
    .references(() => gameInstances.id)
    .notNull(),
  state: sabotageStateEnum("state").default("NONE").notNull(),
  type: sabotageTypeEnum("type"),
  triggeredBy: uuid("triggered_by").references(() => playersInGame.id),
  timerEndsAt: timestamp("timer_ends_at"),
  cooldownEndsAt: timestamp("cooldown_ends_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const meetingStates = pgTable("meeting_states", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameId: uuid("game_id")
    .references(() => gameInstances.id)
    .notNull(),
  state: meetingStateEnum("state").default("IDLE").notNull(),
  triggeredBy: uuid("triggered_by").references(() => playersInGame.id),
  isBodyReport: boolean("is_body_report").default(false).notNull(),
  timerEndsAt: timestamp("timer_ends_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const votes = pgTable("votes", {
  id: uuid("id").defaultRandom().primaryKey(),
  meetingId: uuid("meeting_id")
    .references(() => meetingStates.id)
    .notNull(),
  voterId: uuid("voter_id")
    .references(() => playersInGame.id)
    .notNull(),
  targetId: uuid("target_id").references(() => playersInGame.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const deathEvents = pgTable("death_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameId: uuid("game_id")
    .references(() => gameInstances.id)
    .notNull(),
  playerId: uuid("player_id")
    .references(() => playersInGame.id)
    .notNull(),
  markedBy: uuid("marked_by").references(() => userAccounts.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const gameEvents = pgTable("game_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameId: uuid("game_id")
    .references(() => gameInstances.id)
    .notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  payload: jsonb("payload").default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
