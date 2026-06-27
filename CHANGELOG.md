# Changelog

## [Unreleased]

### Added
- **Assignation manuelle des rôles** : l'admin peut activer un mode dans le lobby pour choisir manuellement qui est crewmate ou imposteur avant de lancer la partie. En mode manuel, le paramètre `impostorCount` de la config est ignoré (contrôle total). Validation : au moins 1 imposteur requis, sinon le bouton "Lancer" est désactivé.
- **Indicateur visuel sabotage unique** : quand l'option "sabotage unique par type" est activée, les boutons de sabotage déjà utilisés sont grisés, barrés et marqués d'un "✕" pour que l'imposteur voie clairement ce qui reste disponible. L'état est synchronisé à la reconnexion via `usedSabotages` dans `GameSyncStateDTO`.
- **Blocage des imposteurs sur les tâches** : les imposteurs ne peuvent plus valider ni décocher des tâches (anti-triche).
- **Affichage du code oxygène pour l'admin** : le code de désactivation s'affiche sur l'écran admin pendant un sabotage oxygène.
- **Mode sabotage unique** (`singleUseSabotage`) : chaque type de sabotage ne peut être utilisé qu'une seule fois par partie (configurable dans les réglages).
- **Tests unitaires** : mise en place de Vitest + 22 tests couvrant `taskService` (validation, rôles, états de jeu).
- **Script bot-players** : ajout d'actions de sabotage pour les bots de test.
- **Migration DB** : ajout du champ `manualRoles` dans `game_configs`, champ `single_use_sabotage`.

### Fixed
- **Crash du reset** : réorganisation des suppressions FK dans `resetAllGames` (approche 3 passes).
- **Tâches pendant les réunions** : blocage de la validation de tâches quand la phase n'est pas `FREE_ROAM`.
- **Messages d'erreur Zod** : traduction française des messages de validation d'authentification.
- **Enums de test** : correction des valeurs d'enum (`LOBBY_OPEN`, `MEETING_IN_PROGRESS`) dans les tests.

## [1.0.0] - 2026-06-19

### Added
- Version initiale : création de parties, lobby temps réel, attribution de rôles, tâches, sabotage, réunions, vote, fin de partie.
- Stack : Express 5, Socket.IO, Drizzle ORM, PostgreSQL, React 19, Vite 8, Tailwind CSS v3, PWA.
