CREATE TYPE "public"."game_phase" AS ENUM('FREE_ROAM', 'MEETING_IN_PROGRESS', 'GAME_OVER_PENDING');--> statement-breakpoint
CREATE TYPE "public"."game_status" AS ENUM('DRAFT', 'LOBBY_OPEN', 'READY', 'RUNNING', 'ENDED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."meeting_state" AS ENUM('IDLE', 'REQUESTED', 'OPEN', 'DISCUSSION', 'VOTING', 'RESOLVING', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."player_life_state" AS ENUM('ALIVE', 'DEAD', 'EJECTED');--> statement-breakpoint
CREATE TYPE "public"."player_role" AS ENUM('CREWMATE', 'IMPOSTOR');--> statement-breakpoint
CREATE TYPE "public"."sabotage_state" AS ENUM('NONE', 'STARTING', 'ACTIVE', 'RESOLVING', 'RESOLVED', 'FAILED', 'COOLDOWN');--> statement-breakpoint
CREATE TYPE "public"."sabotage_type" AS ENUM('OXYGEN', 'ENERGY');--> statement-breakpoint
CREATE TYPE "public"."task_validation_mode" AS ENUM('ANY_PLAYER', 'ADMIN_ONLY');--> statement-breakpoint
CREATE TABLE "death_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"marked_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"min_players" integer DEFAULT 4 NOT NULL,
	"max_players" integer DEFAULT 15 NOT NULL,
	"impostor_count" integer DEFAULT 1 NOT NULL,
	"game_duration_seconds" integer DEFAULT 1800 NOT NULL,
	"meeting_duration_seconds" integer DEFAULT 120 NOT NULL,
	"sabotage_duration_seconds" integer DEFAULT 60 NOT NULL,
	"sabotage_cooldown_seconds" integer DEFAULT 30 NOT NULL,
	"task_validation_mode" "task_validation_mode" DEFAULT 'ANY_PLAYER' NOT NULL,
	"oxygen_code" varchar(4) DEFAULT '1234' NOT NULL,
	"tasks_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "game_configs_game_id_unique" UNIQUE("game_id")
);
--> statement-breakpoint
CREATE TABLE "game_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(6) NOT NULL,
	"status" "game_status" DEFAULT 'DRAFT' NOT NULL,
	"phase" "game_phase",
	"created_by" uuid NOT NULL,
	"game_timer_ends_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_instances_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "guest_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pseudo" varchar(30) NOT NULL,
	"session_token" text NOT NULL,
	"reconnect_token" text NOT NULL,
	"game_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "guest_sessions_session_token_unique" UNIQUE("session_token"),
	CONSTRAINT "guest_sessions_reconnect_token_unique" UNIQUE("reconnect_token")
);
--> statement-breakpoint
CREATE TABLE "meeting_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"state" "meeting_state" DEFAULT 'IDLE' NOT NULL,
	"triggered_by" uuid,
	"is_body_report" boolean DEFAULT false NOT NULL,
	"timer_ends_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players_in_game" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"guest_session_id" uuid,
	"admin_id" uuid,
	"pseudo" varchar(30) NOT NULL,
	"role" "player_role",
	"life_state" "player_life_state" DEFAULT 'ALIVE' NOT NULL,
	"is_connected" boolean DEFAULT true NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"config_json" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "presets_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "sabotage_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"state" "sabotage_state" DEFAULT 'NONE' NOT NULL,
	"type" "sabotage_type",
	"triggered_by" uuid,
	"timer_ends_at" timestamp,
	"cooldown_ends_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_by" uuid,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(50) NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_accounts_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"voter_id" uuid NOT NULL,
	"target_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "death_events" ADD CONSTRAINT "death_events_game_id_game_instances_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "death_events" ADD CONSTRAINT "death_events_player_id_players_in_game_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players_in_game"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "death_events" ADD CONSTRAINT "death_events_marked_by_user_accounts_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_configs" ADD CONSTRAINT "game_configs_game_id_game_instances_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_game_id_game_instances_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_instances" ADD CONSTRAINT "game_instances_created_by_user_accounts_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_sessions" ADD CONSTRAINT "guest_sessions_game_id_game_instances_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_states" ADD CONSTRAINT "meeting_states_game_id_game_instances_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_states" ADD CONSTRAINT "meeting_states_triggered_by_players_in_game_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."players_in_game"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players_in_game" ADD CONSTRAINT "players_in_game_game_id_game_instances_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players_in_game" ADD CONSTRAINT "players_in_game_guest_session_id_guest_sessions_id_fk" FOREIGN KEY ("guest_session_id") REFERENCES "public"."guest_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players_in_game" ADD CONSTRAINT "players_in_game_admin_id_user_accounts_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sabotage_states" ADD CONSTRAINT "sabotage_states_game_id_game_instances_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sabotage_states" ADD CONSTRAINT "sabotage_states_triggered_by_players_in_game_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."players_in_game"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_game_id_game_instances_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_by_players_in_game_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."players_in_game"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_meeting_id_meeting_states_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting_states"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_voter_id_players_in_game_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."players_in_game"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_target_id_players_in_game_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."players_in_game"("id") ON DELETE no action ON UPDATE no action;