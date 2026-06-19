# Plan de développement — Among Us IRL (MVP)

## Contexte

Application web mobile-first permettant de jouer à Among Us dans la vraie vie. La doc de cadrage (`docs/among-us-irl-final-clean.md`) définit les règles, les machines d'état, le modèle de données et 49 cas d'usage. Ce plan découpe le MVP en sprints progressifs, chacun produisant un incrément testable.

## Stack technique

| Couche | Choix |
|--------|-------|
| Frontend | React + Vite + TypeScript, Tailwind CSS, PWA (vite-plugin-pwa) |
| Backend | Node.js + Express + TypeScript |
| Base de données | PostgreSQL + Drizzle ORM |
| Temps réel | Socket.IO |
| Structure | Monorepo pnpm workspaces (`backend/`, `frontend/`, `shared/`) |

---

## Sprint 0 — Scaffolding et infrastructure (2-3j) ✅

**Backend :** Init Express + TypeScript, Drizzle ORM + PostgreSQL, structure dossiers (`routes/`, `services/`, `models/`, `socket/`, `middleware/`), scripts de migration.

**Frontend :** Init Vite + React + TypeScript, Tailwind CSS, PWA basique (manifest, service worker), React Router, layout shell mobile-first.

**Shared :** Package TypeScript avec enums de base (`GameState`, `GamePhase`, `PlayerState`, `MeetingState`, `SabotageState`, `ConnectionState`), types utilitaires.

**Validation :**
- `pnpm build` passe sur les 3 packages
- Backend répond sur `GET /health`
- Frontend s'affiche sur mobile
- Types shared importables depuis backend et frontend
- Migrations Drizzle s'exécutent

---

## Sprint 1 — Auth admin + entrée invité (3-4j) ✅

**Backend :** Tables `user_accounts` et `guest_sessions`. Routes `POST /auth/login` (JWT admin), `POST /auth/guest` (token session invité). Middleware auth. Validation pseudo unique par partie.

**Frontend :** Écran login admin, écran entrée invité (pseudo + code partie), stockage token localStorage, guards de route.

**Shared :** DTOs `LoginRequest/Response`, `GuestJoinRequest/Response`, enum `UserRole`.

**Validation :**
- Admin se connecte → JWT retourné
- Invité entre avec pseudo → token session retourné
- Pseudo déjà pris → rejeté
- Routes protégées → 401 sans token
- Tests unitaires : validation pseudo, hash password, middleware

---

## Sprint 2 — Création et configuration de partie (3-4j) ✅

**Backend :** Tables `game_instances`, `game_configs`, `presets`. Routes création partie, lecture/modification config, chargement preset. Génération code invitation (6 chars). Validation config (min/max joueurs, imposteurs, timers).

**Frontend :** Écran création partie (admin), formulaire de config complet, import preset JSON, affichage code invitation (gros, copiable).

**Shared :** DTOs config/preset, constantes (valeurs par défaut, limites).

**Validation :**
- Admin crée partie → code invitation généré
- Preset chargé → config pré-remplie, reste modifiable
- Config invalide → rejetée avec message d'erreur
- Tests unitaires : validation config, génération code

---

## Sprint 3 — Lobby + Socket.IO temps réel (4-5j) ✅

**Backend :** Intégration Socket.IO + Express. Rooms par partie. Table `players_in_game`. Route `POST /games/:code/join`. Événements `player:joined`, `player:left`, `lobby:update`. Logique readiness (assez de joueurs → admin peut lancer).

**Frontend :** Écran lobby : liste joueurs en temps réel, code invitation partageable, indicateur connexion, bouton "Lancer" (admin, conditionnel).

**Shared :** Contrats Socket typés (`ServerToClientEvents`, `ClientToServerEvents`), DTOs lobby.

**Validation :**
- Invité rejoint via code → visible par tous en temps réel
- Déconnexion visible par les autres
- Bouton "Lancer" s'active quand conditions remplies
- 2 onglets simultanés reçoivent les mêmes updates
- Test reconnexion Socket.IO : couper wifi 5s → reconnexion auto

---

## Sprint 4 — Lancement + distribution des rôles (3-4j) ✅

**Backend :** Machine d'état `LOBBY_OPEN → READY → RUNNING`. Distribution aléatoire des rôles (respecte nombre imposteurs). Événements `game:started`, `role:assigned` (individuel). Imposteurs reçoivent la liste co-imposteurs. Admins reçoivent tous les rôles. Timer global démarre.

**Frontend :** Modale rôle plein écran animée ("Tu es CREWMATE" / "Tu es IMPOSTEUR"), confirmation pour fermer. Imposteurs : noms co-imposteurs. Admin : panneau avec tous les rôles. Timer global visible.

**Validation :**
- Rôles distribués correctement (bon nombre imposteurs)
- Chaque joueur voit uniquement son rôle
- Imposteurs voient les co-imposteurs
- Admin voit tous les rôles
- Timer synchronisé entre clients
- Test avec 6 joueurs simultanés

---

## Sprint 5 — Tâches globales (3-4j) ✅

**Backend :** Table `tasks`. Peuplement depuis config au lancement. Validation de tâche (selon mode : tout joueur vivant ou admin seul). Progression globale (complétées/total). Victoire crewmates si toutes tâches complétées. Événements `task:completed`, `tasks:progress`.

**Frontend :** Liste tâches + barre de progression globale. Bouton validation. Distinction visuelle complétée/en cours. Admin : cocher/décocher toute tâche.

**Validation :**
- Tâches créées au lancement
- Joueur vivant valide une tâche → progression MAJ temps réel pour tous
- Joueur mort ne peut pas valider
- Toutes tâches complétées → victoire crewmates
- Admin peut cocher/décocher

---

## Sprint 6 — Morts + victoire imposteurs par nombre (2-3j) ✅

**Backend :** Table `death_events`. Admin marque joueur mort. Événement `player:died`. Recalcul victoire : imposteurs vivants ≥ crewmates vivants → victoire imposteurs. Joueur mort ne peut plus agir.

**Frontend :** Écran de mort plein écran bloquant. Admin : bouton "Marquer mort" par joueur. Liste joueurs vivants/morts MAJ temps réel. Écran fin de partie (vainqueur).

**Validation :**
- Admin marque joueur mort → écran de mort bloquant
- Joueur mort ne peut ni voter, ni cocher tâche, ni signaler
- Imposteurs ≥ crewmates → victoire imposteurs
- Écran fin affiche le bon vainqueur

---

## Sprint 7 — Meetings et votes (5-6j) ✅

**Backend :** Tables `meeting_states`, `votes`. Machine d'état meeting (IDLE → REQUESTED → DISCUSSION → VOTING → RESOLVING → CLOSED). Déclenchement : joueur vivant (rassemblement/signalement corps) ou admin (forcer). Timer unique débat+vote. Vote : majorité → éliminé, égalité → personne. Cas spécial : cible meurt pendant vote → ses votes retirés, votants doivent revoter. Événements meeting/vote.

**Frontend :** Écran meeting plein écran, timer, interface vote (liste joueurs + skip), résultat animé. Boutons "Rassemblement" et "Signaler corps" en jeu. Admin : forcer rassemblement.

**Validation :**
- Joueur vivant déclenche rassemblement ou signale corps
- Admin force rassemblement
- Timer meeting synchronisé
- Majorité → éliminé, égalité → rien
- Joueur mort ne vote pas
- Rassemblement bloqué pendant sabotage actif (sauf signalement corps)
- Revote si cible meurt pendant vote

---

## Sprint 8 — Sabotages (4-5j) ✅

**Backend :** Table `sabotage_states`. Machine d'état sabotage (NONE → ACTIVE → RESOLVING → RESOLVED/FAILED → COOLDOWN). Énergie : imposteur déclenche, admin désactive. Oxygène : imposteur déclenche, résolu par code paramétré. Timer sabotage (expiration → victoire imposteurs). Cooldown. Un seul sabotage actif. Rassemblement bloqué pendant sabotage (sauf corps).

**Frontend :** Bouton sabotage (imposteurs, avec cooldown). Alarme visuelle + sonore. Oxygène : saisie code + "Vous n'avez plus le droit de parler". Énergie : message mini-jeu IRL + bouton admin. Cooldown visible.

**Validation :**
- Imposteur déclenche sabotage
- Un seul sabotage actif
- Oxygène résolu par bon code
- Énergie résolu par admin
- Expiration → victoire imposteurs
- Cooldown fonctionnel
- Rassemblement bloqué pendant sabotage (sauf corps)
- Alarme fonctionne sur mobile

---

## Sprint 9 — Reconnexion invité + robustesse réseau (3-4j) ✅

**Backend :** Route `POST /auth/reconnect` → snapshot complet état joueur. Socket.IO : reconnexion auto, réintégration room, renvoi état. Gestion reconnexion pendant vote/meeting/sabotage en cours.

**Frontend :** Indicateur "Connexion perdue…", reconnexion auto + restauration écran correct. Écrans critiques protégés (rôle, mort, meeting, sabotage). Token + gameId en localStorage pour reconnexion après refresh.

**Validation :**
- Fermer/rouvrir navigateur → session + état retrouvés
- Couper wifi 10s → reconnexion auto, état restauré
- Reconnexion pendant vote → écran de vote
- Reconnexion après mort → écran de mort
- Reconnexion pendant sabotage → sabotage visible

---

## Sprint 10 — Timer global + victoire complète + polish (3-4j) ✅

**Backend :** Timer global synchronisé serveur. Expiration → victoire imposteurs. Consolidation toutes conditions victoire (tâches, nombre, timer, sabotage expiré, vote dernier imposteur). Table `game_events` (journal). Annulation partie par admin.

**Frontend :** Écran fin complet (vainqueur, rôles révélés, récapitulatif). Timer global avec alerte temps restant. Boutons "Annuler" et "Nouvelle partie" (admin). Polish UI : animations, transitions.

**Validation :**
- Toutes conditions de victoire fonctionnent
- Timer expiré → victoire imposteurs
- Écran fin affiche tous les rôles
- Admin annule/relance partie
- **Partie complète de bout en bout (6+ joueurs)**

---

## Bugfixes et améliorations (post-sprints)

- **Import preset JSON** : corrigé pour supporter les deux formats (objet `PresetDTO` wrappé ou `GameConfigDTO` direct). Avant, les tâches ne s'affichaient pas car `parsed.config.tasks` n'était pas extrait.
- **Lancement de partie** : ajout d'un `navigate()` direct après le POST `/start` réussi. Avant, l'admin restait bloqué sur "Lancement…" car il dépendait uniquement de l'event socket `game:started`.
- **Flow admin → lobby** : ajout du bouton "Rejoindre le lobby" sur la page de configuration. Sauvegarde `gameId`/`gameCode` dans l'auth de l'admin avant navigation vers `/lobby/:code`.

---

## Sprint 11 — Test grandeur nature (3-5j)

Session de test avec 6-10 vrais joueurs sur smartphones réels.

- Tester iOS Safari + Android Chrome
- Tester 4G, wifi faible
- Corriger bugs identifiés
- Ajustements UX selon feedback

**Critère final :** Une partie complète jouée sans problème majeur avec de vrais joueurs.

---

## Estimation totale : ~38-51 jours

## Dépendances

```
S0 → S1 → S2 → S3 → S4 ──→ S5 ─┐
                      │          ├→ S10 → S11
                      ├──→ S6 ──┤
                      ├──→ S7 ──┘
                      └──→ S8 ──┘
S3 ────────────────────────→ S9
```

Sprints 5, 6, 7, 8 parallélisables après Sprint 4. Sprint 9 peut avancer dès Sprint 3.

## Fichiers critiques à créer

- `shared/src/types/events.ts` — contrats Socket.IO typés
- `shared/src/types/dto.ts` — DTOs d'échange
- `shared/src/types/enums.ts` — enums partagés
- `backend/src/services/gameStateMachine.ts` — machine d'état, cœur métier
- `backend/src/models/schema.ts` — schéma Drizzle ORM

## Vérification

À chaque sprint : exécuter les tests de validation listés, vérifier sur mobile (Chrome DevTools device mode ou smartphone réel), s'assurer que les fonctionnalités précédentes ne régressent pas. Sprint 11 = validation finale en conditions réelles.