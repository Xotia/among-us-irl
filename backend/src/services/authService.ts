import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db.js";
import { userAccounts, guestSessions, gameInstances } from "../models/schema.js";
import { UserRole, GameStatus } from "@among-us-irl/shared";
import type { AdminPayload, GuestPayload } from "../middleware/auth.js";

const SALT_ROUNDS = 10;

export async function loginAdmin(username: string, password: string) {
  const [user] = await db
    .select()
    .from(userAccounts)
    .where(eq(userAccounts.username, username))
    .limit(1);

  if (!user) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  const payload: AdminPayload = {
    userId: user.id,
    username: user.username,
    role: UserRole.ADMIN,
  };

  const token = jwt.sign(payload, config.jwtSecret, { expiresIn: "24h" });

  return {
    token,
    user: { id: user.id, username: user.username, role: UserRole.ADMIN as const },
  };
}

export async function registerAdmin(username: string, password: string) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const [user] = await db
    .insert(userAccounts)
    .values({ username, passwordHash })
    .returning();
  return user;
}

export async function joinAsGuest(pseudo: string, gameCode: string) {
  const [game] = await db
    .select()
    .from(gameInstances)
    .where(eq(gameInstances.code, gameCode.toUpperCase()))
    .limit(1);

  if (!game) return { error: "Partie introuvable" };

  if (game.status !== GameStatus.LOBBY_OPEN && game.status !== GameStatus.DRAFT) {
    return { error: "Cette partie n'accepte plus de joueurs" };
  }

  const [existing] = await db
    .select()
    .from(guestSessions)
    .where(
      and(
        eq(guestSessions.gameId, game.id),
        eq(guestSessions.pseudo, pseudo)
      )
    )
    .limit(1);

  if (existing) return { error: "Ce pseudo est déjà pris dans cette partie" };

  const sessionToken = crypto.randomBytes(32).toString("hex");
  const reconnectToken = crypto.randomBytes(32).toString("hex");

  const [session] = await db
    .insert(guestSessions)
    .values({
      pseudo,
      sessionToken,
      reconnectToken,
      gameId: game.id,
    })
    .returning();

  const payload: GuestPayload = {
    sessionId: session.id,
    pseudo: session.pseudo,
    gameId: game.id,
    role: UserRole.GUEST,
  };

  const token = jwt.sign(payload, config.jwtSecret, { expiresIn: "24h" });

  return {
    token,
    sessionId: session.id,
    pseudo: session.pseudo,
    gameId: game.id,
    gameCode: game.code,
    reconnectToken,
  };
}
