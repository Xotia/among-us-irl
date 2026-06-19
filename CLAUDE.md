# Among Us IRL

Application web mobile-first pour jouer à Among Us dans la vraie vie.

## Stack

- **Monorepo** pnpm workspaces : `shared/`, `backend/`, `frontend/`
- **Shared** : TypeScript, enums + DTOs + contrats Socket.IO typés
- **Backend** : Node.js, Express 5, TypeScript, Drizzle ORM, PostgreSQL, Socket.IO, Zod, JWT (admin), bcrypt
- **Frontend** : React 19, Vite 8, TypeScript, Tailwind CSS **v3** (pas v4), React Router, Socket.IO client, PWA (vite-plugin-pwa)

## Commandes

```bash
pnpm install          # installer les dépendances
pnpm build            # build les 3 packages (shared → backend + frontend)
pnpm dev              # lance backend + frontend en parallèle

# Backend
pnpm --filter @among-us-irl/backend dev         # serveur dev (tsx watch, port 3001)
pnpm --filter @among-us-irl/backend db:generate  # générer les migrations Drizzle
pnpm --filter @among-us-irl/backend db:migrate   # exécuter les migrations

# Frontend
pnpm --filter @among-us-irl/frontend dev         # Vite dev server (port 5173)
```

## Structure

```
shared/src/
  enums.ts          # GameStatus, GamePhase, PlayerRole, MeetingState, SabotageState, etc.
  events.ts         # ServerToClientEvents, ClientToServerEvents, DTOs
  dto.ts            # DTOs (GameConfigDTO, TaskConfigItem, PresetDTO, etc.)
  index.ts          # ré-export tout

backend/src/
  index.ts          # point d'entrée Express + Socket.IO
  config.ts         # variables d'env
  db.ts             # connexion Drizzle + PostgreSQL
  models/schema.ts  # schéma Drizzle (12 tables)
  routes/           # routes Express (games.ts contient CRUD + start + presets)
  services/         # logique métier (gameStateMachine.ts, lobbyService.ts, etc.)
  middleware/       # auth JWT, validation
  socket/           # handlers Socket.IO (lobbyHandler, gameHandler, taskHandler, meetingHandler, sabotageHandler)

frontend/src/
  App.tsx            # router principal
  lib/auth.ts        # AuthState, useAuth, saveAuth/loadAuth/clearAuth (localStorage)
  lib/socket.ts      # connectSocket/disconnectSocket, typed Socket.IO client
  lib/api.ts         # apiFetch helper
  pages/             # écrans (Home, AdminLogin, CreateGame, GameConfig, Lobby, Game, GuestJoin, RoleReveal, etc.)
  index.css          # Tailwind directives
```

## Contraintes importantes

- **Tailwind v4 interdit** : le binaire natif `@tailwindcss/oxide` est bloqué par la policy Windows. Rester sur Tailwind v3.
- **Ne pas exporter `app` depuis `backend/src/index.ts`** : provoque une erreur TS2742 liée à express-serve-static-core.
- Le frontend proxy `/api` → `localhost:3001` et `/socket.io` → WebSocket backend (configuré dans vite.config.ts).
- Shared doit être build avant backend/frontend (`pnpm build` le fait automatiquement via l'ordre des dépendances).
- `pnpm-workspace.yaml` contient `allowBuilds: bcrypt: true, esbuild: true`.

## Doc de cadrage

Le document de référence complet est `docs/among-us-irl-final-clean.md`. Il contient :
- Règles du jeu, machines d'état, modèle de données, 49 cas d'usage, architecture technique.

## Plan de développement

Plan détaillé sprint par sprint : `C:\Users\kevin\.claude\plans\je-souhaite-d-velopper-une-snappy-pillow.md`

## Flow principal (admin)

1. Admin se connecte (`/login`) → JWT stocké dans localStorage
2. Admin crée une partie (`/admin/create`) → redirigé vers config (`/admin/games/:id`)
3. Config : réglages (joueurs, imposteurs, timers, tâches), import preset JSON, sauvegarde
4. Bouton "Rejoindre le lobby" → sauvegarde `gameId`/`gameCode` dans auth → navigue vers `/lobby/:code`
5. Lobby : admin voit les joueurs connectés en temps réel via Socket.IO
6. Bouton "Lancer la partie" (activé quand ≥ 4 joueurs connectés) → `POST /api/games/:id/start` → navigation vers `/game/:code`

## Flow joueur (invité)

1. Invité entre pseudo + code (`/join`) → token session + redirection `/lobby/:code`
2. Socket.IO émet `game:join` → rejoint la room, visible par tous
3. `game:started` → redirection `/game/:code`, réception du rôle

## Import preset JSON

Le champ d'import accepte deux formats :
- Objet `PresetDTO` complet : `{ "code": "...", "name": "...", "config": { ... } }` → extrait `config`
- Objet `GameConfigDTO` direct : `{ "minPlayers": 6, ... }` → appliqué tel quel

## Reset complet

`POST /api/games/reset` (admin uniquement) : supprime toutes les parties, joueurs, événements, sessions invités et déconnecte tous les sockets. Retourne `{ "deleted": <nombre> }`.

```bash
curl -X POST http://localhost:3001/api/games/reset -H "Authorization: Bearer <jwt>"
```

## Conventions

- Code et commentaires en anglais, UI en français
- Un fichier par route Express, un fichier par page React
- Validation des inputs avec Zod côté backend
- Les types partagés (DTOs, enums, events) vont toujours dans `shared/`
