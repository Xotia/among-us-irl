# Sprint 11 — Checklist de test grandeur nature

## Informations session

| | |
|---|---|
| **Date** | ____/____/________ |
| **Nombre de joueurs** | _____ |
| **Appareils** | ☐ iOS Safari ☐ Android Chrome ☐ Autre : ________ |
| **Réseau** | ☐ Wi-Fi ☐ 4G ☐ Mixte |
| **Testeur principal** | ________________________ |

---

## 1. Pré-requis techniques

### 1.1 Serveur et déploiement
- [ ] Backend accessible depuis les smartphones (URL publique ou réseau local)
- [ ] PostgreSQL opérationnel, migrations à jour
- [ ] Variables d'environnement configurées (JWT secret, DB URL, CORS)
- [ ] `pnpm build` passe sans erreur

### 1.2 PWA et mobile
- [ ] Le site s'affiche correctement sur iOS Safari
- [ ] Le site s'affiche correctement sur Android Chrome
- [ ] Le manifest PWA est chargé (icône, nom, thème)
- [ ] L'app peut être ajoutée à l'écran d'accueil
- [ ] Le viewport s'adapte à tous les écrans (pas de scroll horizontal)
- [ ] Pas de zone cliquable trop petite (min 44×44px)
- [ ] Les textes sont lisibles sans zoom

---

## 2. Authentification et entrée en partie

### 2.1 Admin
- [ ] Admin se connecte avec identifiants → JWT retourné
- [ ] Admin accède au tableau de bord
- [ ] Mauvais mot de passe → message d'erreur clair
- [ ] Token expiré → redirection login

### 2.2 Invité
- [ ] Invité entre un pseudo + code partie → rejoint le lobby
- [ ] Pseudo déjà pris dans la partie → message d'erreur
- [ ] Code partie invalide → message d'erreur
- [ ] Pseudo avec caractères spéciaux → comportement correct
- [ ] Pseudo vide → rejeté

---

## 3. Lobby

- [ ] Tous les joueurs apparaissent en temps réel dans la liste
- [ ] Le code invitation est visible et copiable
- [ ] L'indicateur de connexion est correct pour chaque joueur
- [ ] Un joueur qui quitte disparaît de la liste pour les autres
- [ ] Le bouton "Lancer" est grisé tant que les conditions ne sont pas remplies
- [ ] Le bouton "Lancer" s'active quand assez de joueurs sont prêts
- [ ] Seul l'admin voit le bouton "Lancer"

---

## 4. Lancement et distribution des rôles

- [ ] L'admin lance la partie → tous les joueurs reçoivent leur rôle
- [ ] Le nombre d'imposteurs correspond à la config
- [ ] Chaque joueur voit UNIQUEMENT son propre rôle
- [ ] Les imposteurs voient la liste de leurs co-imposteurs
- [ ] L'admin voit tous les rôles dans son panneau
- [ ] La modale de rôle est plein écran et demande confirmation pour fermer
- [ ] Le timer global démarre et est synchronisé entre tous les clients

---

## 5. Tâches

- [ ] Les tâches sont créées au lancement de la partie
- [ ] La liste des tâches est visible par tous les joueurs
- [ ] La barre de progression est visible et à jour
- [ ] Un joueur vivant valide une tâche → progression mise à jour en temps réel pour tous
- [ ] Un joueur mort NE PEUT PAS valider de tâche
- [ ] L'admin peut cocher/décocher n'importe quelle tâche
- [ ] Toutes les tâches complétées → victoire crewmates immédiate

---

## 6. Morts et éliminations

- [ ] L'admin marque un joueur comme mort → notification immédiate
- [ ] Le joueur mort voit un écran de mort plein écran bloquant
- [ ] Le joueur mort ne peut plus voter
- [ ] Le joueur mort ne peut plus valider de tâches
- [ ] Le joueur mort ne peut plus déclencher de rassemblement
- [ ] La liste des joueurs vivants/morts est à jour en temps réel
- [ ] Imposteurs vivants ≥ crewmates vivants → victoire imposteurs

---

## 7. Meetings et votes

### 7.1 Déclenchement
- [ ] Un joueur vivant déclenche un rassemblement → meeting démarre pour tous
- [ ] Un joueur vivant signale un corps → meeting démarre pour tous
- [ ] L'admin force un rassemblement → meeting démarre pour tous
- [ ] Le rassemblement est bloqué pendant un sabotage actif (sauf signalement corps)

### 7.2 Déroulement
- [ ] L'écran de meeting est plein écran pour tous
- [ ] Le timer de débat+vote est synchronisé entre tous les clients
- [ ] Chaque joueur vivant peut voter pour un autre joueur ou skip
- [ ] Un joueur mort NE PEUT PAS voter
- [ ] Un joueur peut changer son vote avant la fin du timer

### 7.3 Résolution
- [ ] Majorité claire → le joueur ciblé est éliminé
- [ ] Égalité → personne n'est éliminé
- [ ] Majorité skip → personne n'est éliminé
- [ ] Le résultat est affiché à tous avec animation
- [ ] Si la cible meurt pendant le vote → ses votes retirés, revote déclenché

---

## 8. Sabotages

### 8.1 Déclenchement
- [ ] Un imposteur déclenche un sabotage → alerte pour tous
- [ ] Un seul sabotage actif à la fois
- [ ] Le cooldown empêche un sabotage immédiat après le précédent
- [ ] Le cooldown est visible pour les imposteurs

### 8.2 Énergie
- [ ] L'imposteur déclenche le sabotage énergie
- [ ] Le message mini-jeu IRL s'affiche
- [ ] L'admin peut résoudre le sabotage énergie

### 8.3 Oxygène
- [ ] L'imposteur déclenche le sabotage oxygène
- [ ] Le message "Vous n'avez plus le droit de parler" s'affiche
- [ ] Le code paramétré permet de résoudre le sabotage
- [ ] Un mauvais code est rejeté

### 8.4 Expiration et blocage
- [ ] Timer sabotage expiré → victoire imposteurs
- [ ] Rassemblement bloqué pendant sabotage (sauf signalement corps)
- [ ] L'alarme visuelle fonctionne sur mobile
- [ ] L'alarme sonore fonctionne sur mobile (vérifier volume, mode silencieux)

---

## 9. Timer global et fin de partie

- [ ] Le timer global est synchronisé entre tous les clients
- [ ] Une alerte s'affiche quand le temps restant est faible
- [ ] Timer expiré → victoire imposteurs
- [ ] L'écran de fin affiche le bon vainqueur
- [ ] L'écran de fin révèle tous les rôles
- [ ] L'écran de fin affiche un récapitulatif de la partie
- [ ] L'admin peut annuler la partie en cours
- [ ] L'admin peut lancer une nouvelle partie

---

## 10. Reconnexion et robustesse réseau

### 10.1 Reconnexion basique
- [ ] Couper le Wi-Fi 5s → reconnexion automatique
- [ ] Couper le Wi-Fi 10s → reconnexion automatique, état restauré
- [ ] L'indicateur "Connexion perdue…" s'affiche pendant la déconnexion
- [ ] Fermer et rouvrir le navigateur → session et état retrouvés
- [ ] Rafraîchir la page (pull-to-refresh) → état restauré

### 10.2 Reconnexion en contexte
- [ ] Reconnexion pendant un vote → écran de vote affiché
- [ ] Reconnexion après une mort → écran de mort affiché
- [ ] Reconnexion pendant un sabotage → sabotage visible
- [ ] Reconnexion pendant un meeting → écran meeting affiché
- [ ] Reconnexion en lobby → liste joueurs à jour

### 10.3 Réseau dégradé
- [ ] Passage Wi-Fi → 4G → Wi-Fi : pas de perte d'état
- [ ] Réseau lent (3G) : l'app reste utilisable, pas de timeout immédiat
- [ ] Plusieurs joueurs perdent la connexion simultanément → tous se reconnectent

---

## 11. Compatibilité navigateurs et appareils

| Appareil | OS / Navigateur | Fonctionne | Problèmes |
|----------|-----------------|:----------:|-----------|
| iPhone ______ | iOS __ / Safari | ☐ | |
| iPhone ______ | iOS __ / Safari | ☐ | |
| Android ______ | Android __ / Chrome | ☐ | |
| Android ______ | Android __ / Chrome | ☐ | |
| __________ | __________ | ☐ | |
| __________ | __________ | ☐ | |

### Points d'attention spécifiques
- [ ] iOS Safari : pas de problème avec les 100vh (safe area)
- [ ] iOS Safari : les sons se jouent (autoplay policy)
- [ ] iOS Safari : le clavier virtuel ne masque pas les champs de saisie
- [ ] Android Chrome : les notifications push fonctionnent (si implémenté)
- [ ] Android Chrome : le retour arrière ne casse pas la navigation

---

## 12. Partie complète de bout en bout

### Scénario A — Victoire crewmates par tâches
- [ ] Créer partie → joueurs rejoignent → lancer → tâches complétées → victoire crewmates
- [ ] Tous les écrans intermédiaires fonctionnent

### Scénario B — Victoire imposteurs par nombre
- [ ] Imposteurs tuent assez de crewmates → victoire imposteurs
- [ ] L'écran de fin s'affiche correctement

### Scénario C — Victoire par vote
- [ ] Meeting → vote → dernier imposteur éliminé → victoire crewmates
- [ ] Le flow complet est fluide

### Scénario D — Victoire imposteurs par sabotage
- [ ] Sabotage oxygène non résolu → timer expire → victoire imposteurs

### Scénario E — Victoire imposteurs par timer global
- [ ] Timer global expire → victoire imposteurs

---

## 13. UX et ressenti joueur

- [ ] Les joueurs comprennent l'interface sans explication
- [ ] Le temps de chargement est acceptable (< 3s)
- [ ] Les animations ne saccadent pas
- [ ] Les transitions entre écrans sont fluides
- [ ] Les textes en français sont corrects (pas de fautes, pas de troncature)
- [ ] Le contraste est suffisant en extérieur (luminosité forte)
- [ ] L'app ne draine pas la batterie de manière excessive

---

## 14. Bugs identifiés

| # | Sévérité | Description | Appareil / OS | Étapes de reproduction | Statut |
|---|----------|-------------|---------------|------------------------|--------|
| 1 | ☐ Bloquant ☐ Majeur ☐ Mineur | | | | ☐ Ouvert |
| 2 | ☐ Bloquant ☐ Majeur ☐ Mineur | | | | ☐ Ouvert |
| 3 | ☐ Bloquant ☐ Majeur ☐ Mineur | | | | ☐ Ouvert |
| 4 | ☐ Bloquant ☐ Majeur ☐ Mineur | | | | ☐ Ouvert |
| 5 | ☐ Bloquant ☐ Majeur ☐ Mineur | | | | ☐ Ouvert |

---

## 15. Feedback joueurs

| Joueur | Feedback | Priorité |
|--------|----------|----------|
| | | ☐ Haute ☐ Moyenne ☐ Basse |
| | | ☐ Haute ☐ Moyenne ☐ Basse |
| | | ☐ Haute ☐ Moyenne ☐ Basse |
| | | ☐ Haute ☐ Moyenne ☐ Basse |
| | | ☐ Haute ☐ Moyenne ☐ Basse |

---

## Résultat final

- [ ] **Une partie complète jouée sans problème majeur avec de vrais joueurs**

**Verdict :** ☐ MVP validé ☐ Corrections nécessaires avant validation

**Notes :**

_________________________________________________________

_________________________________________________________

_________________________________________________________
