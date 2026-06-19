# Guide de déploiement — Among Us IRL

## Pré-requis sur le serveur

- **OS** : Linux (Debian/Ubuntu)
- **Node.js 18+** (`node -v`)
- **pnpm** (`npm install -g pnpm`)
- **PostgreSQL** installé et accessible
- **Nginx** (reverse proxy)
- Un **nom de domaine** ou sous-domaine pointant vers le serveur (ex: `amongus.tondomaine.fr`), ou à défaut l'IP publique

---

## Étape 1 — Installer PostgreSQL (si pas déjà fait)

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo -u postgres psql
```

Dans le prompt PostgreSQL :

```sql
CREATE USER amongus WITH PASSWORD 'un_mot_de_passe_solide';
CREATE DATABASE amongus_irl OWNER amongus;
\q
```

---

## Étape 2 — Cloner et builder le projet

```bash
cd /opt
git clone <ton-repo> among-us-irl
cd among-us-irl
pnpm install
pnpm build
```

---

## Étape 3 — Configurer le backend

Crée `/opt/among-us-irl/backend/.env` :

```env
PORT=3001
DATABASE_URL=postgresql://amongus:un_mot_de_passe_solide@localhost:5432/amongus_irl
JWT_SECRET=génère_une_clé_aléatoire_longue
CORS_ORIGIN=https://amongus.tondomaine.fr
```

Pour générer un JWT secret solide :

```bash
openssl rand -base64 32
```

Lance les migrations :

```bash
cd /opt/among-us-irl
pnpm --filter @among-us-irl/backend db:migrate
```

---

## Étape 4 — Configurer Nginx

Nginx sert les fichiers statiques du frontend et proxifie l'API + WebSocket vers Node.js.

Crée `/etc/nginx/sites-available/amongus` :

```nginx
server {
    listen 80;
    server_name amongus.tondomaine.fr;

    # Frontend (fichiers statiques)
    root /opt/among-us-irl/frontend/dist;
    index index.html;

    # SPA : toutes les routes inconnues → index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API backend
    location /api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.IO (WebSocket + polling)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Active le site :

```bash
sudo ln -s /etc/nginx/sites-available/amongus /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Étape 5 — HTTPS avec Let's Encrypt

**Obligatoire** pour la PWA, les Service Workers et les sons sur mobile.

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d amongus.tondomaine.fr
```

Certbot modifie automatiquement la config Nginx pour ajouter le SSL. Le renouvellement est automatique.

> **Sans domaine ?** Utilise [DuckDNS](https://www.duckdns.org/) pour obtenir un sous-domaine gratuit pointant vers ton IP.

---

## Étape 6 — Lancer le backend en service permanent

Crée `/etc/systemd/system/amongus.service` :

```ini
[Unit]
Description=Among Us IRL Backend
After=network.target postgresql.service

[Service]
Type=simple
User=kevin
WorkingDirectory=/opt/among-us-irl
ExecStart=/usr/bin/node backend/dist/index.js
Restart=always
RestartSec=5
EnvironmentFile=/opt/among-us-irl/backend/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable amongus
sudo systemctl start amongus
sudo systemctl status amongus
```

---

## Étape 7 — Ouvrir les ports

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

Le port 3001 n'a **pas** besoin d'être ouvert — Nginx fait proxy en local.

Vérifie aussi le firewall réseau du panel hébergeur (OVH, Hetzner, etc.).

---

## Étape 8 — Tester depuis un téléphone

1. Ouvre `https://amongus.tondomaine.fr` sur ton téléphone
2. Vérifie que la page s'affiche
3. Crée une partie, rejoins depuis un 2e téléphone
4. Ajoute à l'écran d'accueil pour tester le mode PWA

---

## Étape 9 — Mettre à jour après des changements

```bash
cd /opt/among-us-irl
git pull
pnpm install
pnpm build
pnpm --filter @among-us-irl/backend db:migrate   # si nouvelles migrations
sudo systemctl restart amongus
```

---

## Architecture réseau

```
Téléphone
    │
    │ HTTPS (443)
    ▼
  Nginx
    ├── /           → frontend/dist/ (fichiers statiques)
    ├── /api/*      → Node.js :3001 (Express)
    └── /socket.io  → Node.js :3001 (WebSocket)

  PostgreSQL :5432 (local uniquement)
  Minecraft  :25565 (déjà en place, aucun conflit)
  Discord bot       (déjà en place, aucun conflit)
```
