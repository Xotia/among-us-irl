# Among Us IRL — Document final de cadrage et de roadmap

## Objectif

Ce document sert de base de travail propre pour concevoir l’application Among Us IRL.

Il est structuré pour être réutilisé en plusieurs conversations indépendantes avec Perplexity, afin d’économiser les tokens.

---

# 1. Règles figées

Les règles ci-dessous sont considérées comme stables pour le cadrage courant.

## 1.1 Accès et comptes

- Les comptes classiques sont réservés aux admins.
- Les invités rejoignent la partie avec un pseudo unique.
- La reconnexion invité doit fonctionner dès le MVP.
- La reconnexion invité doit être pensée dès maintenant dans le produit.
- La forme exacte de cette reconnexion peut rester simple dans le MVP, mais elle doit permettre à un joueur de récupérer sa session et son état courant après une coupure réseau ou un rafraîchissement.

## 1.2 Parties et configuration

- Un admin peut créer une partie.
- Un code d’invitation permet de rejoindre une partie.
- Un preset JSON peut être chargé avant lancement.
- Un preset écrase la configuration courante.
- La configuration peut encore être modifiée après chargement d’un preset.
- La partie ne peut pas être lancée sans configuration valide.
- Le support admin central est obligatoire au niveau fonctionnel.
- En revanche, il n’y a pas forcément de poste central d’animation admin dédié dans le MVP.
- Dans le MVP, les admins doivent pouvoir faire le paramétrage, lancer la partie, cocher les tâches et définir des joueurs morts depuis les mêmes écrans que les joueurs, avec des capacités supplémentaires liées à leur rôle.

## 1.3 Rôles

- Chaque joueur reçoit un rôle secret au démarrage.
- Les imposteurs voient les autres imposteurs.
- Les admins voient tous les rôles.

## 1.4 Tâches

- Les tâches sont globales.
- Les tâches sont visibles par tous les joueurs.
- Les imposteurs voient aussi la progression globale des tâches.
- La validation des tâches est paramétrable avant la partie.
- Il n’y a pas de tâches optionnelles.
- La victoire des non-imposteurs par tâches arrive quand toutes les tâches obligatoires sont terminées.
- Dans le MVP, les admins doivent aussi pouvoir cocher les tâches si l’animation réelle de la partie le nécessite.

## 1.5 Sabotages

- Un seul sabotage peut être actif à la fois.
- Un sabotage déclenche une alarme visuelle et sonore.
- Un cooldown empêche de relancer immédiatement un sabotage.
- Le sabotage d’information et le sabotage d’énergie sont fusionnés en un sabotage unique déclenché par un imposteur et désactivé par un admin.
- Ce sabotage unique peut inclure une interaction physique en vraie vie, par exemple relier des fils électriques.
- Le sabotage d’oxygène utilise un code paramétrable défini au début de la partie.
- Le sabotage d’oxygène affiche un message indiquant que les joueurs n’ont plus le droit de parler.
- Le sabotage d’oxygène repose sur un seul point de saisie.
- Le sabotage d’énergie correspond à un mini-jeu IRL effectué par les joueurs innocents, puis un admin désactive le sabotage une fois le jeu effectué.

## 1.6 Rassemblements et votes

- Un joueur vivant peut déclencher un rassemblement.
- Un joueur vivant peut signaler un corps.
- Un admin peut forcer un rassemblement à tout moment.
- Un rassemblement est interdit pendant un sabotage actif, sauf en cas de découverte de corps.
- Le débat et le vote utilisent le même timer.
- En cas d’égalité de vote, personne n’est éliminé.
- Si un joueur ciblé par des votes meurt pendant le vote, les votes concernés sont retirés et les votants doivent revoter.

## 1.7 Morts et fin de partie

- Un admin peut marquer un joueur comme mort en temps réel.
- Un joueur mort ne peut plus voter, signaler un corps, cocher une tâche ou déclencher un sabotage.
- Dans le MVP, un joueur mort voit un écran de mort et ne consulte plus le reste de l’application.
- La distinction visuelle et fonctionnelle entre “mort” et “éliminé” n’est pas requise pour le MVP.
- Cette distinction pourra être introduite dans une V2.
- Le timer global de partie fait gagner les imposteurs s’il expire.
- Les imposteurs gagnent si leur nombre vivant devient égal ou supérieur au nombre de non-imposteurs vivants.
- Les imposteurs gagnent si le sabotage d’oxygène ou d’énergie expire sans résolution.

## 1.8 Robustesse et reprise

- Le MVP doit afficher un état de synchronisation en cas de perte de réseau.
- Le MVP doit prévoir des mécanismes de reprise sur incident pour les écrans critiques.
- L’objectif minimal est de restaurer un état cohérent après coupure réseau, reconnexion ou rafraîchissement.
- Les écrans critiques à protéger dans le MVP sont au minimum : l’écran de rôle au démarrage, l’écran de mort, l’écran de meeting et de vote, l’écran de sabotage actif, la vue admin avec ses actions spécifiques, l’écran de reconnexion invité et l’écran de lancement ou de synchronisation de partie.

---

# 2. Questions encore ouvertes

Les points ci-dessous ne sont plus ouverts pour le cadrage actuel.

- La mécanique exacte de résolution du sabotage énergie est un mini-jeu IRL effectué par les joueurs innocents, puis un admin désactive le sabotage une fois le jeu effectué.
- La reconnexion invité doit permettre de re-rejoindre une partie normalement sans souci, avec la version la plus simple possible pour le MVP.
- La distinction entre “mort” et “éliminé” sera bien introduite plus tard, dans une version future.

---

# 3. Périmètre MVP

## 3.1 Inclus dans le MVP

Le MVP doit inclure :

- authentification admin ;
- entrée invité par pseudo unique ;
- reconnexion invité ;
- création de partie ;
- code d’invitation ;
- chargement de preset JSON ;
- modification de configuration avant lancement ;
- lancement de partie ;
- distribution des rôles ;
- modale de rôle au démarrage ;
- vue admin des rôles ;
- tâches globales ;
- possibilité pour les admins de cocher les tâches ;
- sabotage d’énergie fusionné, déclenché par un imposteur et désactivé par un admin ;
- sabotage oxygène ;
- rassemblement ;
- signalement de corps ;
- vote ;
- mort en temps réel par admin ;
- calcul de victoire ;
- écran de mort bloquant le reste pour le joueur mort ;
- état de synchronisation en cas de perte de réseau ;
- mécanismes minimaux de reprise sur incident pour les écrans critiques.

## 3.2 Exclu du MVP

Le MVP ne doit pas inclure :

- reprise d’état avancée après crash serveur complexe ;
- historique détaillé complet des parties avec post-mortem avancé ;
- écran post-mortem avancé ;
- poste central d’animation admin dédié si cela impose une interface séparée ;
- mini-jeu élaboré de résolution énergie tant que ce choix n’est pas validé ;
- distinction avancée entre “mort” et “éliminé” dans l’UI.

---

# 4. Étapes de développement indépendantes

## Étape A — Cadrage fonctionnel

### Objectif

Valider les règles, les exceptions, les choix de gameplay et le périmètre MVP.

### Livrable demandé à Perplexity

- Transformer le besoin en règles métier claires.
- Identifier les ambiguïtés restantes.
- Proposer les questions à trancher avant développement.

## Étape B — Modélisation des états

### Objectif

Définir les machines d’état de la partie, des meetings, des sabotages et des joueurs.

### États à définir

- Partie : DRAFT, LOBBY_OPEN, READY, RUNNING, ENDED, CANCELLED.
- Phase de partie : FREE_ROAM, MEETING_IN_PROGRESS, GAME_OVER_PENDING.
- Meeting : IDLE, REQUESTED, OPEN, DISCUSSION, VOTING, RESOLVING, CLOSED.
- Sabotage : NONE, STARTING, ACTIVE, RESOLVING, RESOLVED, FAILED, COOLDOWN.
- Joueur : ALIVE, DEAD.
- Connexion : CONNECTED, DISCONNECTED, RECONNECTING.

### Livrable demandé à Perplexity

- Décrire les transitions d’état.
- Lister les événements qui déclenchent ces transitions.
- Définir les recalculs automatiques après chaque action critique.

## Étape C — Cas d’usage fonctionnels

### Objectif

Transformer les règles en cas d’usage numérotés et exploitables.

### Livrable demandé à Perplexity

- Générer une liste structurée de cas d’usage.
- Classer les cas d’usage en priorité.

## Étape D — Modèle de données

### Objectif

Définir les entités nécessaires au MVP.

### Entités minimales

- UserAccount.
- GuestSession.
- GameInstance.
- GameConfig.
- Preset.
- PlayerInGame.
- Task.
- SabotageState.
- MeetingState.
- Vote.
- DeathEvent.
- GameEvent.

### Livrable demandé à Perplexity

- Proposer un modèle de données minimal.
- Identifier les champs obligatoires, optionnels et dérivés.

## Étape E — DTO et contrats d’échange

### Objectif

Définir les objets échangés entre front et back.

### Livrable demandé à Perplexity

- Définir les DTO.
- Définir les contrats d’événements.
- Proposer des noms stables et propres.

## Étape F — Arborescence de repo

### Objectif

Choisir une structure de projet modulaire et évolutive.

### Livrable demandé à Perplexity

- Proposer une arborescence de monorepo.
- Expliquer le rôle de chaque dossier.

## Étape G — Architecture technique

### Objectif

Valider le choix de stack et le découpage applicatif.

### Recommandation actuelle

- Frontend : PWA mobile-first.
- Backend : Node.js + TypeScript.
- Temps réel : WebSocket.
- Données : base relationnelle.
- Presets : JSON.

### Livrable demandé à Perplexity

- Comparer les architectures possibles.
- Justifier le choix recommandé.
- Détailler les modules fonctionnels.

## Étape H — Plan d’implémentation MVP

### Objectif

Découper le développement en lots réalisables.

### Ordre conseillé

1. Domaine métier.
2. Contrats partagés.
3. API.
4. Temps réel.
5. Front joueur.
6. Front admin.
7. Robustesse réseau.
8. Finalisation MVP.

### Livrable demandé à Perplexity

- Proposer le plan de développement détaillé.
- Découper le travail en étapes indépendantes.

---

# 5. Recommandation d’utilisation

Utilise ce document en plusieurs conversations indépendantes :

- une conversation pour l’Étape A ;
- une autre pour l’Étape B ;
- une autre pour l’Étape C ;
- etc.

Donne à Perplexity uniquement le bloc utile à l’étape du moment pour économiser les tokens.

---

# 6. Ordre de travail recommandé

1. Écrire les règles figées.
2. Lister les questions ouvertes.
3. Définir le périmètre MVP.
4. Définir les états du jeu.
5. Définir le modèle de données.
6. Définir les DTO et contrats.
7. Définir l’arborescence du repo.
8. Définir l’architecture technique.
9. Définir les sprints d’implémentation.