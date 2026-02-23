# Heritago – Installationsanleitung (Linux Server)

Diese Anleitung erklärt Schritt für Schritt, wie du Heritago auf einem Linux-Server installierst und dauerhaft betreibst.

---

## Voraussetzungen

| Software     | Mindestversion | Prüfen mit          |
|-------------|---------------|---------------------|
| Node.js     | 20.x          | `node -v`           |
| npm         | 10.x          | `npm -v`            |
| PostgreSQL  | 14.x          | `psql --version`    |
| Git         | 2.x           | `git --version`     |

---

## 1. System vorbereiten

```bash
# System aktualisieren
sudo apt update && sudo apt upgrade -y

# Benötigte Tools installieren
sudo apt install -y curl ca-certificates gnupg

# WICHTIG: Alte Node.js Version entfernen (Ubuntu liefert oft v12, wir brauchen v22+)
sudo apt remove -y nodejs
sudo apt autoremove -y

# Node.js 22.x installieren (npm wird automatisch mitgeliefert)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# npm auf die neueste Version aktualisieren
sudo npm install -g npm@latest

# Versionen prüfen
node -v   # Sollte v22.x.x anzeigen
npm -v    # Sollte 10.x.x oder höher anzeigen
```

> [!WARNING]
> Ubuntu liefert standardmäßig eine sehr alte Node.js Version (v12). Diese muss **zuerst entfernt** werden, bevor die aktuelle Version von NodeSource installiert wird!

# PostgreSQL installieren
sudo apt install -y postgresql postgresql-contrib

# Git installieren (falls nicht vorhanden)
sudo apt install -y git
```

---

## 2. PostgreSQL einrichten

```bash
# Als postgres-User anmelden
sudo -u postgres psql

# Datenbank und Benutzer erstellen
CREATE USER heritago WITH PASSWORD 'dein_sicheres_passwort';
CREATE DATABASE heritago OWNER heritago;
GRANT ALL PRIVILEGES ON DATABASE heritago TO heritago;
\q
```

---

## 3. Repository klonen

```bash
cd /opt
sudo git clone https://github.com/dodi110480/heritago.git
sudo chown -R $USER:$USER /opt/heritago
cd /opt/heritago
```

---

## 4. Frontend (Angular) installieren & bauen

```bash
# Im Projektverzeichnis
cd /opt/heritago
npm install
npm run build
```

Das erstellt den produktionsfertigen Build im Ordner `dist/`.

---

## 5. Backend (Express) installieren & konfigurieren

```bash
cd /opt/heritago/server
npm install
```

### 5.1 Umgebungsvariablen konfigurieren

```bash
cp .env.example .env  # Falls vorhanden, sonst manuell erstellen:
nano /opt/heritago/server/.env
```

Inhalt der `.env`:

```env
PORT=3000
DATABASE_URL="postgresql://heritago:dein_sicheres_passwort@127.0.0.1:5432/heritago?schema=public"
JWT_SECRET="ein-langes-zufaelliges-geheimnis"
NODE_ENV=production

# GitHub Update-Funktion (optional)
GITHUB_TOKEN="dein_github_pat_token"
GITHUB_OWNER="dodi110480"
GITHUB_REPO="heritago"
```

> [!IMPORTANT]
> Ersetze `dein_sicheres_passwort` und `ein-langes-zufaelliges-geheimnis` durch eigene, sichere Werte!

### 5.2 Datenbank migrieren & Backend bauen

```bash
cd /opt/heritago/server

# Prisma Client generieren
npx prisma generate

# Datenbank-Schema anwenden
npx prisma migrate deploy

# TypeScript kompilieren
npm run build
```

---

## 6. Webserver einrichten (Nginx als Reverse Proxy)

```bash
sudo apt install -y nginx
```

### Nginx-Konfiguration erstellen

```bash
sudo nano /etc/nginx/sites-available/heritago
```

Inhalt:

```nginx
server {
    listen 80;
    server_name deine-domain.de;  # Oder die Server-IP

    # Frontend (Angular Build)
    root /opt/heritago/dist/heritago/browser;
    index index.html;

    # Angular Routing (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Proxy zum Backend
    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 50M;
    }

    # Uploads Proxy
    location /uploads/ {
        proxy_pass http://127.0.0.1:3000/uploads/;
    }
}
```

### Aktivieren und starten

```bash
sudo ln -s /etc/nginx/sites-available/heritago /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Standard-Seite entfernen
sudo nginx -t                             # Konfiguration prüfen
sudo systemctl restart nginx
sudo systemctl enable nginx               # Autostart
```

---

## 7. Backend dauerhaft mit systemd betreiben

### Systemd-Service erstellen

```bash
sudo nano /etc/systemd/system/heritago.service
```

Inhalt:

```ini
[Unit]
Description=Heritago Backend Server
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/heritago/server
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### Service aktivieren und starten

```bash
# Berechtigungen setzen
sudo chown -R www-data:www-data /opt/heritago

# Systemd neu laden und Service starten
sudo systemctl daemon-reload
sudo systemctl start heritago
sudo systemctl enable heritago    # Autostart bei Boot

# Status prüfen
sudo systemctl status heritago
```

---

## 8. Firewall konfigurieren (optional)

```bash
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS (falls SSL)
sudo ufw enable
```

---

## 9. SSL mit Let's Encrypt (optional, empfohlen)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d deine-domain.de
```

Certbot passt die Nginx-Konfiguration automatisch an und richtet die automatische Erneuerung ein.

---

## Nützliche Befehle

| Aktion                        | Befehl                                    |
|-------------------------------|-------------------------------------------|
| Backend-Status prüfen         | `sudo systemctl status heritago`          |
| Backend neustarten            | `sudo systemctl restart heritago`         |
| Backend-Logs ansehen          | `sudo journalctl -u heritago -f`          |
| Nginx neustarten              | `sudo systemctl restart nginx`            |
| Datenbank-Backup              | `pg_dump -U heritago heritago > backup.sql` |
| Datenbank wiederherstellen    | `psql -U heritago heritago < backup.sql`  |
| Update einspielen (manuell)   | Siehe Abschnitt unten                     |

---

## Manuelles Update

```bash
cd /opt/heritago

# Neueste Änderungen holen
git fetch --tags
git checkout tags/<NEUER_TAG>

# Frontend neu bauen
npm install
npm run build

# Backend neu bauen
cd server
npm install
npx prisma generate
npx prisma migrate deploy
npm run build

# Backend neustarten
sudo systemctl restart heritago
```

> [!TIP]
> Du kannst Updates auch bequem über die Weboberfläche unter **Einstellungen → System & Updates** durchführen!

---

## Verzeichnisstruktur

```
/opt/heritago/
├── dist/                    # Angular Production Build (Frontend)
├── server/
│   ├── dist/                # Kompiliertes Backend (JS)
│   ├── src/                 # Backend-Quellcode (TS)
│   ├── prisma/              # Datenbank-Schema & Migrationen
│   ├── uploads/             # Hochgeladene Medien
│   └── .env                 # Umgebungsvariablen
├── src/                     # Angular-Quellcode (Frontend)
├── package.json             # Frontend-Abhängigkeiten
└── angular.json             # Angular-Konfiguration
```
