import { Router } from "express";
import type { Router as RouterType } from "express";
import { z } from "zod";
import { loginAdmin, registerAdmin, joinAsGuest } from "../services/authService.js";
import { reconnectGuest } from "../services/reconnectionService.js";

const router: RouterType = Router();

const loginSchema = z.object({
  username: z.string().min(3, "Le nom d'utilisateur doit contenir au moins 3 caractères").max(50),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

const guestSchema = z.object({
  pseudo: z.string().min(2, "Le pseudo doit contenir au moins 2 caractères").max(30, "Le pseudo ne peut pas dépasser 30 caractères").regex(/^[a-zA-Z0-9_\- àâéèêëïîôùûüÿçÀÂÉÈÊËÏÎÔÙÛÜŸÇ]+$/, "Pseudo invalide"),
  gameCode: z.string().length(6, "Le code de la partie doit contenir 6 caractères"),
});

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const result = await loginAdmin(parsed.data.username, parsed.data.password);
  if (!result) {
    res.status(401).json({ error: "Identifiants incorrects" });
    return;
  }

  res.json(result);
});

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  try {
    const user = await registerAdmin(parsed.data.username, parsed.data.password);
    res.status(201).json({ id: user.id, username: user.username });
  } catch (err: any) {
    const code = err?.code ?? err?.cause?.code;
    if (code === "23505") {
      res.status(409).json({ error: "Ce nom d'utilisateur est déjà pris" });
      return;
    }
    throw err;
  }
});

router.post("/guest", async (req, res) => {
  const parsed = guestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const result = await joinAsGuest(parsed.data.pseudo, parsed.data.gameCode);
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json(result);
});

const reconnectSchema = z.object({
  reconnectToken: z.string().min(1),
});

router.post("/reconnect", async (req, res) => {
  const parsed = reconnectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const result = await reconnectGuest(parsed.data.reconnectToken);
  if ("error" in result) {
    res.status(401).json({ error: result.error });
    return;
  }

  res.json(result);
});

export default router;
