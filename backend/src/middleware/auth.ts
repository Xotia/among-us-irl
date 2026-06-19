import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { UserRole } from "@among-us-irl/shared";

export interface AdminPayload {
  userId: string;
  username: string;
  role: UserRole.ADMIN;
}

export interface GuestPayload {
  sessionId: string;
  pseudo: string;
  gameId: string;
  role: UserRole.GUEST;
}

export type AuthPayload = AdminPayload | GuestPayload;

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token manquant" });
    return;
  }

  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as AuthPayload;
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ error: "Token invalide" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.auth || req.auth.role !== UserRole.ADMIN) {
    res.status(403).json({ error: "Accès réservé aux administrateurs" });
    return;
  }
  next();
}
