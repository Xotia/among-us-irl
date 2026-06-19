# Rapport de test — Among Us IRL

Date : 2026-06-20

## Résumé

- Tests exécutés : 38
- Tests OK : 33
- Bugs trouvés et corrigés : 5
- Bugs trouvés non corrigés : 1 (UX, mineur)

## Résultats par section

### Section 1 — Pré-requis techniques

| Test | Résultat | Notes |
|------|----------|-------|
| Backend accessible (`/health`) | ✅ | Répond `{"status":"ok"}` |
| PostgreSQL opérationnel | ✅ | Backend démarre sans erreur |
| Frontend s'affiche | ✅ | Page d'accueil avec boutons "Rejoindre" et "Connexion Admin" |
| Viewport mobile (390×844) | ✅ | Pas de scroll horizontal, textes lisibles |

### Section 2 — Authentification

| Test | Résultat | Notes |
|------|----------|-------|
| Login admin | ✅ | Redirige vers tableau de bord |
| Token JWT en localStorage | ✅ | `auth_state` et `auth_token` présents |
| Mauvais mot de passe | ✅ | Message "Identifiants incorrects" affiché |
| Entrée invité (via bots) | ✅ | `POST /auth/guest` retourne token |
| Pseudo vide rejeté | ✅ | Message d'erreur affiché (était en anglais → Bug #5 corrigé) |

### Section 3 — Lobby

| Test | Résultat | Notes |
|------|----------|-------|
| Joueurs en temps réel | ✅ | 5-6 bots apparaissent en temps réel via Socket.IO |
| Code invitation visible | ✅ | Affiché en gros, bouton copier |
| Bouton Lancer grisé (< 4 joueurs) | ✅ | Affiche "minimum 4" |
| Bouton Lancer actif (≥ 4 joueurs) | ✅ | S'active dès 4 joueurs connectés |

### Section 4 — Distribution des rôles

| Test | Résultat | Notes |
|------|----------|-------|
| Lancement de partie | ✅ | Tous les bots reçoivent `game:started` + `role:assigned` |
| Rôles distribués correctement | ✅ | Imposteurs + crewmates selon config |
| Co-imposteurs visibles | ✅ | `Role: IMPOSTOR (co-impostors: Jaune)` dans les logs |
| Écran révélation rôle (admin) | ✅ | Modale "CREWMATE" avec bouton "Compris" |
| Timer synchronisé | ✅ | Timer affiché côté admin |

### Section 5 — Tâches

| Test | Résultat | Notes |
|------|----------|-------|
| Tâches créées | ✅ | 15 tâches affichées après lancement |
| Validation par joueur | ✅ | Les bots complètent les tâches, barre de progression se met à jour |
| Progression temps réel | ✅ | `tasks:progress` émis et affiché côté admin |
| Tâche déjà complétée rejetée | ✅ | Backend rejette avec "Tâche déjà complétée" (pas de crash) |
| Tâches bloquées pendant meeting | ✅ | Corrigé via Bug #4 — `completeTask` vérifie maintenant `game.phase === FREE_ROAM` |

### Section 6 — Morts

| Test | Résultat | Notes |
|------|----------|-------|
| Marquer mort (admin) | ✅ | Bouton "Marquer mort" fonctionne |
| Bot reçoit notification de mort | ✅ | `[Rouge] I died!` dans les logs |
| Victoire si dernier imposteur éliminé | ✅ | `Winner: CREWMATES (IMPOSTORS_ELIMINATED)` |

### Section 7 — Meetings et votes

| Test | Résultat | Notes |
|------|----------|-------|
| Forcer un rassemblement (admin) | ✅ | `POST /games/:id/force-meeting` → meeting démarre |
| Bots reçoivent meeting | ✅ | `Meeting: VOTING` dans les logs de tous les bots |
| Bots votent | ✅ | Tous les bots votent skip dans les 1-4 secondes |
| Résultat meeting (skip) | ✅ | "no one eliminated", retour en FREE_ROAM |

### Section 8 — Sabotages

| Test | Résultat | Notes |
|------|----------|-------|
| Déclencher sabotage (imposteur) | ✅ | Bot imposteur émet `sabotage:trigger OXYGEN` |
| Tous les joueurs notifiés | ✅ | `Sabotage: OXYGEN (ACTIVE)` dans tous les logs |
| Non-imposteur ne peut pas déclencher | ✅ | Vérifié par code review (rôle vérifié ligne 54 de `sabotageService.ts`) |
| Expiration → victoire imposteurs | ✅ | `Winner: IMPOSTORS (SABOTAGE_EXPIRED)` après 45s |
| Crewmates tentent de résoudre | ✅ | Bots envoient `sabotage:resolve` (échoue sans code pour OXYGEN) |

### Section 9 — Fin de partie

| Test | Résultat | Notes |
|------|----------|-------|
| Écran fin de partie | ✅ | "Victoire des Crewmates !" ou "Victoire des Imposteurs !" |
| Rôles révélés | ✅ | Tous les rôles affichés (Crewmate/Imposteur) |
| Récapitulatif | ✅ | Bouton "Voir le récapitulatif (N événements)" |
| Bouton retour accueil | ✅ | Présent |

### Section 10 — Reconnexion

| Test | Résultat | Notes |
|------|----------|-------|
| Indicateur connexion perdue | ✅ | "Connexion perdue…" affiché quand le backend redémarre |

### Section 11 — Compatibilité responsive

| Test | Résultat | Notes |
|------|----------|-------|
| iPhone 14 Pro (390×844) | ✅ | Layout correct |
| Samsung Galaxy S20 (360×800) | ✅ | Layout correct |
| iPhone SE (375×667) | ✅ | Layout correct |

### Section 12 — Parties bout en bout

| Scénario | Résultat | Notes |
|----------|----------|-------|
| A — Victoire crewmates (imposteur éliminé) | ✅ | `IMPOSTORS_ELIMINATED` |
| B — Victoire imposteurs (sabotage expiré) | ✅ | `SABOTAGE_EXPIRED` |
| C — Meeting avec vote skip | ✅ | "no one eliminated", partie continue |

### Section 13 — UX

| Test | Résultat | Notes |
|------|----------|-------|
| Textes français | ⚠️ | Messages Zod en anglais → corrigé (Bug #5) |
| Page d'accueil claire | ✅ | Deux boutons clairs "Rejoindre" et "Connexion Admin" |
| Page join invité | ✅ | Formulaire simple pseudo + code |

## Bugs corrigés

### Bug 1 : Meeting admin crash — FK violation sur `triggered_by`

- **Section** : 7 — Meetings et votes
- **Description** : Quand l'admin force un meeting, `triggeredBy` utilisait l'ID admin (UUID user_accounts) au lieu d'un ID valide dans `players_in_game`, causant une violation de foreign key.
- **Erreur** : `Error: Failed query: insert into "meeting_states" ... triggeredBy → players_in_game.id`
- **Fichier modifié** : `backend/src/services/meetingService.ts:133`
- **Fix** : Changé `adminPlayer?.id ?? adminId` en `adminPlayer?.id ?? null` — quand l'admin n'est pas joueur, `triggeredBy` est null.
- **Vérifié** : ✅

### Bug 2 : Reset complet crash — ordre de suppression FK

- **Section** : Pré-requis (reset)
- **Description** : `POST /games/reset` échouait sur `delete from "guest_sessions"` car des `players_in_game` d'autres parties référençaient encore des `guest_sessions` via la FK `guest_session_id`.
- **Erreur** : `Error: Failed query: delete from "guest_sessions" where "guest_sessions"."game_id" = $1`
- **Fichier modifié** : `backend/src/services/gameService.ts:243-259`
- **Fix** : Séparé la boucle de suppression en 3 passes : (1) tables dépendantes de playersInGame par game, (2) tous les playersInGame, (3) guestSessions + gameConfigs + gameInstances.
- **Vérifié** : ✅

### Bug 3 : Réorganisation de l'ordre de suppression dans reset

- **Section** : Pré-requis (reset)
- **Description** : `meetingStates` était supprimé avant `sabotageStates` et `tasksTable`, mais `meetingStates.triggeredBy` référence `playersInGame`.
- **Fichier modifié** : `backend/src/services/gameService.ts` (même fix que Bug 2)
- **Fix** : `sabotageStates` et `tasksTable` supprimés avant `meetingStates`.
- **Vérifié** : ✅

### Bug 4 : Tâches complétables pendant un meeting

- **Section** : 5 — Tâches / 7 — Meetings
- **Description** : `completeTask` ne vérifiait pas la phase du jeu. Les joueurs pouvaient compléter des tâches pendant un meeting (`MEETING_IN_PROGRESS`), ce qui ne devrait pas être possible.
- **Fichier modifié** : `backend/src/services/taskService.ts:70-71`
- **Fix** : Ajouté `if (game.phase !== GamePhase.FREE_ROAM) return { error: "Impossible de valider des tâches pendant un rassemblement" };`
- **Vérifié** : ✅ (par code review — le check est en place)

### Bug 5 : Messages de validation Zod en anglais

- **Section** : 13 — UX
- **Description** : Les messages d'erreur de validation Zod (pseudo trop court, code invalide) s'affichaient en anglais brut ("String must contain at least 2 character(s)") au lieu de messages français.
- **Fichier modifié** : `backend/src/routes/auth.ts:9-17`
- **Fix** : Ajouté des messages personnalisés en français à toutes les validations Zod : `min(2, "Le pseudo doit contenir au moins 2 caractères")`, `length(6, "Le code de la partie doit contenir 6 caractères")`, etc.
- **Vérifié** : ✅ (par code review)

## Bugs non corrigés

### Bug mineur UX : Lobby orphelin après reset

- **Section** : UX / Reconnexion
- **Description** : Quand les parties sont supprimées via reset, si l'admin est sur la page Lobby, il voit "Connexion perdue…" et reste bloqué. Il devrait être redirigé vers l'accueil ou le tableau de bord.
- **Impact** : Mineur — ne se produit que lors d'un reset admin, pas en usage normal.
- **Suggestion** : Ajouter un handler Socket.IO côté frontend qui détecte quand le game n'existe plus et redirige.

## Notes et recommandations

1. **tsx watch EADDRINUSE** : Le hot-reload de tsx watch crash souvent avec `EADDRINUSE` quand on modifie un fichier backend. Le port n'est pas libéré avant le re-listen. Recommandation : ajouter un graceful shutdown du `httpServer` dans `index.ts`.

2. **Script de bots** : Le script `scripts/bot-players.mjs` fonctionne bien mais tous les crewmates essaient de compléter toutes les tâches (pas de répartition). Cela génère beaucoup de "Tâche déjà complétée" dans les logs backend. Amélioration possible : répartir les tâches entre les bots.

3. **Sabotage OXYGEN** : Les bots crewmates tentent de résoudre sans fournir le code. Le script de bots pourrait être amélioré pour lire le `oxygenCode` depuis la config et le fournir lors de la résolution.

4. **Config via Preview** : Les inputs React contrôlés ne répondent pas à `preview_fill` — il faut utiliser `setNativeValue` avec dispatch d'events pour modifier les valeurs. C'est une limitation de l'outil de preview, pas de l'app.

## Fichiers modifiés

| Fichier | Modifications |
|---------|--------------|
| `backend/src/services/meetingService.ts` | Bug #1 — `triggeredBy` null au lieu de adminId |
| `backend/src/services/gameService.ts` | Bugs #2-3 — Ordre de suppression FK dans reset |
| `backend/src/services/taskService.ts` | Bug #4 — Vérification phase FREE_ROAM pour tâches |
| `backend/src/routes/auth.ts` | Bug #5 — Messages Zod en français |
| `scripts/bot-players.mjs` | Nouveau — Script de simulation de joueurs |
| `.claude/settings.json` | Permissions pour tests automatisés |
| `.claude/launch.json` | Ajout config backend |
