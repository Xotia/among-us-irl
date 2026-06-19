# Among Us IRL

Application web mobile-first pour jouer à Among Us dans la vraie vie.

## Prérequis

- **Node.js** >= 20
- **pnpm** >= 11 (`npm install -g pnpm`)
- **PostgreSQL** >= 15

## Installation

### 1. Cloner le repo

```bash
git clone https://github.com/Xotia/among-us-irl.git
cd among-us-irl
```

### 2. Installer les dépendances

```bash
pnpm install
```

### 3. Configurer PostgreSQL

Créer la base de données :

```sql
CREATE DATABASE among_us_irl;
```

### 4. Configurer les variables d'environnement

Copier le fichier d'exemple et adapter les valeurs :

```bash
cp backend/.env.example backend/.env
```

Variables disponibles :

| Variable       | Description                          | Défaut                                                    |
| -------------- | ------------------------------------ | --------------------------------------------------------- |
| `DATABASE_URL` | URL de connexion PostgreSQL          | `postgresql://postgres:postgres@localhost:5432/among_us_irl` |
| `JWT_SECRET`   | Clé secrète pour les tokens JWT      | `change-me-in-production`                                 |
| `PORT`         | Port du serveur backend              | `3001`                                                    |

### 5. Build du projet

Le package `shared` doit être compilé avant le backend et le frontend. La commande suivante gère l'ordre automatiquement :

```bash
pnpm build
```

### 6. Appliquer les migrations de base de données

```bash
pnpm --filter @among-us-irl/backend db:migrate
```

### 7. Lancer le projet

```bash
pnpm dev
```

Cela démarre en parallèle :
- **Backend** sur `http://localhost:3001`
- **Frontend** sur `http://localhost:5173`

## Commandes utiles

```bash
# Lancer uniquement le backend
pnpm --filter @among-us-irl/backend dev

# Lancer uniquement le frontend
pnpm --filter @among-us-irl/frontend dev

# Générer une nouvelle migration après modification du schéma
pnpm --filter @among-us-irl/backend db:generate

# Appliquer les migrations
pnpm --filter @among-us-irl/backend db:migrate

# Ouvrir Drizzle Studio (interface visuelle pour la BDD)
pnpm --filter @among-us-irl/backend db:studio

# Vérification des types
pnpm typecheck

# Lint
pnpm lint

# Build de production
pnpm build
```

## Structure du projet

```
among-us-irl/
├── shared/          # Types, enums, DTOs et contrats Socket.IO partagés
├── backend/         # API Express + Socket.IO + Drizzle ORM
├── frontend/        # App React + Vite + Tailwind CSS (PWA)
├── docs/            # Documentation de cadrage
├── pnpm-workspace.yaml
└── package.json
```
