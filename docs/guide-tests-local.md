# Guide de test local — Sprint 11

Comment exécuter chaque section de la [checklist de test](sprint-11-test-checklist.md) depuis ton PC Windows, avec Chrome DevTools et plusieurs onglets.

---

## Setup de base

### 1. Lancer l'environnement

```bash
# Terminal 1 — PostgreSQL doit tourner (via pgAdmin ou service Windows)

# Terminal 2 — tout lancer
pnpm dev
```

Le backend tourne sur `localhost:3001`, le frontend sur `localhost:5173`.

### 2. Simuler un téléphone dans Chrome

1. Ouvre `http://localhost:5173` dans Chrome
2. `F12` → DevTools → icône mobile (Toggle Device Toolbar) ou `Ctrl+Shift+M`
3. Choisis un appareil : **iPhone 14 Pro** ou **Samsung Galaxy S20**
4. Coche **"Show media queries"** pour voir les breakpoints

### 3. Simuler plusieurs joueurs

Ouvre **plusieurs onglets** (ou fenêtres en navigation privée pour des sessions distinctes) :
- Onglet 1 : Admin
- Onglets 2-7 : Invités (chacun avec un pseudo différent)

> **Astuce** : utilise 2 navigateurs différents (Chrome + Edge) pour éviter les conflits de localStorage entre admin et invités.

---

## Test par section de la checklist

### Section 1 — Pré-requis techniques

| Test | Comment vérifier en local |
|------|--------------------------|
| Backend accessible | Ouvre `http://localhost:3001/health` → doit répondre OK |
| PostgreSQL opérationnel | Le backend démarre sans erreur dans le terminal |
| `pnpm build` passe | Lance `pnpm build` dans un terminal séparé |
| PWA manifest | DevTools → Application → Manifest → vérifie nom, icônes |
| Service Worker | DevTools → Application → Service Workers (en dev il peut être désactivé, c'est normal) |
| Viewport mobile | DevTools mobile → pas de scroll horizontal, textes lisibles |
| Zones cliquables | DevTools → Settings → Rendering → cocher "Show hit test borders" |

### Section 2 — Authentification

| Test | Comment |
|------|---------|
| Login admin | Onglet 1 : connecte-toi avec les identifiants admin |
| Token JWT | DevTools → Application → Local Storage → vérifie la présence du token |
| Mauvais mot de passe | Entre un mot de passe faux → message d'erreur visible |
| Token expiré | Application → Local Storage → modifie le token manuellement → refresh → redirigé au login |
| Entrée invité | Onglet 2 : entre un pseudo + le code de la partie |
| Pseudo déjà pris | Onglet 3 : entre le même pseudo → erreur |
| Pseudo vide | Soumets le formulaire sans pseudo → rejeté |

### Section 3 — Lobby

| Test | Comment |
|------|---------|
| Joueurs en temps réel | Rejoins depuis 3-4 onglets → tous apparaissent dans la liste |
| Code invitation visible | Vérifie qu'il s'affiche en gros, clique pour copier |
| Joueur qui quitte | Ferme un onglet invité → il disparaît du lobby des autres |
| Bouton Lancer grisé | Avec trop peu de joueurs, le bouton doit être désactivé |
| Bouton Lancer actif | Ajoute assez de joueurs → le bouton s'active |
| Admin uniquement | Vérifie que les onglets invités ne voient pas le bouton |

### Section 4 — Distribution des rôles

| Test | Comment |
|------|---------|
| Lancement | Onglet admin → "Lancer" → tous les onglets reçoivent un rôle |
| Bon nombre d'imposteurs | Compare avec la config (ex: 1 imposteur pour 6 joueurs) |
| Rôle individuel | Chaque onglet ne voit que son propre rôle |
| Co-imposteurs | L'onglet imposteur voit les noms des co-imposteurs |
| Admin voit tout | L'onglet admin liste tous les rôles |
| Timer synchronisé | Compare le timer entre 2 onglets → même valeur (±1s) |

### Section 5 — Tâches

| Test | Comment |
|------|---------|
| Tâches créées | La liste s'affiche après le lancement |
| Validation | Un onglet crewmate coche une tâche → la barre progresse partout |
| Joueur mort | Marque un joueur mort (admin), puis essaie de cocher une tâche depuis son onglet → interdit |
| Admin cocher/décocher | L'admin coche et décoche librement |
| Victoire tâches | Coche toutes les tâches → écran victoire crewmates |

### Section 6 — Morts

| Test | Comment |
|------|---------|
| Marquer mort | Onglet admin → marque un joueur mort |
| Écran de mort | L'onglet du joueur mort affiche l'écran bloquant |
| Actions interdites | Depuis l'onglet mort : tenter voter, cocher tâche, rassemblement → tout bloqué |
| Liste MAJ | Les autres onglets voient le joueur comme mort |
| Victoire imposteurs | Marque assez de crewmates morts → victoire imposteurs |

### Section 7 — Meetings et votes

| Test | Comment |
|------|---------|
| Rassemblement | Un onglet joueur vivant clique "Rassemblement" → meeting sur tous les onglets |
| Signalement corps | Un onglet clique "Signaler corps" → meeting démarre |
| Admin force | L'admin force un rassemblement |
| Timer meeting | Compare le timer entre onglets → synchronisé |
| Voter | Chaque onglet vivant vote pour un joueur ou skip |
| Majorité | Fais voter la majorité pour un même joueur → éliminé |
| Égalité | Fais voter moitié-moitié → personne éliminé |
| Mort ne vote pas | L'onglet du joueur mort ne peut pas voter |
| Sabotage bloque meeting | Déclenche un sabotage, essaie un rassemblement → bloqué. Signalement corps → autorisé |

### Section 8 — Sabotages

| Test | Comment |
|------|---------|
| Déclencher | Depuis un onglet imposteur → bouton sabotage |
| Un seul actif | Essaie de déclencher un 2e sabotage → refusé |
| Énergie | Déclenche énergie → message mini-jeu → admin résout |
| Oxygène | Déclenche oxygène → message silence → entre le bon code → résolu |
| Mauvais code | Entre un mauvais code → rejeté |
| Expiration | Déclenche un sabotage, ne le résous pas → timer expire → victoire imposteurs |
| Cooldown | Résous un sabotage → le bouton est en cooldown |
| Alarme | Vérifie que l'alarme visuelle apparaît (le son ne fonctionne souvent qu'après une interaction utilisateur) |

### Section 9 — Timer global et fin de partie

| Test | Comment |
|------|---------|
| Timer synchro | Compare le timer entre 2 onglets |
| Alerte temps faible | Attends que le timer soit bas (ou modifie la config pour un timer court, ex: 2 min) |
| Expiration | Laisse le timer arriver à 0 → victoire imposteurs |
| Écran fin | Vérifie : vainqueur affiché, tous les rôles révélés, récapitulatif |
| Annuler partie | L'admin annule → tous les joueurs renvoyés |
| Nouvelle partie | L'admin relance → retour au lobby |

> **Astuce timer** : pour ne pas attendre 15 min, crée la partie avec un timer très court (1-2 min) dans la config.

### Section 10 — Reconnexion

| Test | Comment |
|------|---------|
| Reconnexion basique | Sélectionne un onglet invité → DevTools → Network → cocher "Offline" → attends 5s → décocher → l'état se restaure |
| Indicateur connexion perdue | Pendant le mode Offline, vérifie que le message "Connexion perdue…" s'affiche |
| Refresh page | Pendant une partie, `F5` sur un onglet → l'état est restauré (rôle, phase, etc.) |
| Reconnexion pendant vote | Mets un onglet Offline pendant un meeting → remets en ligne → l'écran de vote s'affiche |
| Reconnexion après mort | Mets un onglet mort Offline → remets en ligne → écran de mort |
| Reconnexion pendant sabotage | Mets un onglet Offline pendant un sabotage → remets en ligne → sabotage visible |

### Section 11 — Compatibilité (limité en local)

En local tu ne peux pas tester iOS Safari directement, mais tu peux :

| Test | Comment |
|------|---------|
| Responsive iPhone | DevTools → iPhone 14 Pro (390×844) |
| Responsive Android | DevTools → Samsung Galaxy S20 (360×800) |
| Responsive petit écran | DevTools → iPhone SE (375×667) |
| Safe area (100vh) | DevTools mobile → vérifie que rien n'est coupé en bas |
| Retour arrière | Navigue dans l'app → bouton retour du navigateur → comportement correct |

> **Pour un vrai test iOS/Android** : connecte ton téléphone au même réseau Wi-Fi et ouvre `http://<IP-de-ton-PC>:5173`. Trouve ton IP avec `ipconfig` dans un terminal.

### Section 12 — Parties bout en bout

Lance 5 parties successives avec différentes fins :

| Scénario | Étapes |
|----------|--------|
| **A — Victoire crewmates (tâches)** | 6 onglets, coche toutes les tâches |
| **B — Victoire imposteurs (nombre)** | Admin marque des crewmates morts jusqu'à imposteurs ≥ crewmates |
| **C — Victoire crewmates (vote)** | Meeting → vote unanime contre le dernier imposteur |
| **D — Victoire imposteurs (sabotage)** | Sabotage oxygène → personne ne résout → timer expire |
| **E — Victoire imposteurs (timer)** | Config avec timer 1 min → attends l'expiration |

### Section 13 — UX

| Test | Comment |
|------|---------|
| Compréhension | Demande à quelqu'un qui ne connaît pas l'app de naviguer sans aide |
| Temps chargement | DevTools → Network → Disable cache → Refresh → vérifie < 3s |
| Animations | Vérifie que les modales et transitions sont fluides |
| Textes français | Parcours tous les écrans → pas de texte en anglais ni de faute |
| Contraste | DevTools → Rendering → "Emulate vision deficiency" pour tester l'accessibilité |

---

## Commandes utiles pendant les tests

```bash
# Voir les logs backend en temps réel
pnpm --filter @among-us-irl/backend dev

# Rebuild après un fix
pnpm build

# Reset la base de données (supprimer toutes les parties)
pnpm --filter @among-us-irl/backend db:migrate

# Trouver l'IP locale pour tester depuis un téléphone
ipconfig    # cherche "IPv4 Address" sur le bon adaptateur
```

---

## Checklist rapide avant session de test réelle

- [ ] `pnpm build` passe
- [ ] Backend démarre sans erreur
- [ ] Frontend s'affiche en mode mobile
- [ ] Une partie complète fonctionne en local (6 onglets)
- [ ] La reconnexion fonctionne (mode Offline dans DevTools)
- [ ] Les 5 scénarios de victoire fonctionnent
