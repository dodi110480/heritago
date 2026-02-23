# Heritago – Installationsanleitung (Linux Server)

Vollständige Anleitung für die Installation auf einem frisch aufgesetzten Ubuntu/Debian Server.

---

## Voraussetzungen

| Software     | Mindestversion | Wird installiert in |
|-------------|---------------|---------------------|
| curl        | –             | Schritt 1            |
| Node.js     | 22.x          | Schritt 1            |
| npm         | 10.x          | Schritt 1 (kommt mit Node.js) |
| PostgreSQL  | 14.x          | Schritt 1            |
| Nginx       | –             | Schritt 6            |
| Git         | 2.x           | Schritt 1            |

---

## 1. System vorbereiten & Pakete installieren

```bash
# System aktualisieren
sudo apt update && sudo apt upgrade -y

# Grundlegende Tools installieren
sudo apt install -y curl ca-certificates gnupg git

# WICHTIG: Falls eine alte Node.js Version installiert ist, zuerst entfernen
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

# PostgreSQL installieren
sudo apt install -y postgresql postgresql-contrib

# Nginx installieren
sudo apt install -y nginx
```

> [!WARNING]
> Ubuntu liefert standardmäßig eine sehr alte Node.js Version (v12). Diese muss **zuerst entfernt** werden, bevor die aktuelle Version von NodeSource installiert wird!

---

## 2. PostgreSQL einrichten

```bash
# Als postgres-User anmelden
sudo -u postgres psql
```

Im PostgreSQL-Prompt folgende Befehle eingeben:

```sql
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

## 4. Frontend bauen (Angular)

```bash
cd /opt/heritago
npm install
npm run build
```

> Der Build erstellt den produktionsfertigen Output in `dist/heritago/browser/`.

---

## 5. Backend einrichten (Express + Prisma)

### 5.1 Abhängigkeiten installieren

```bash
cd /opt/heritago/server
npm install
```

### 5.2 Umgebungsvariablen konfigurieren

```bash
nano /opt/heritago/server/.env
```

Inhalt:

```env
PORT=3000
DATABASE_URL="postgresql://heritago:dein_sicheres_passwort@127.0.0.1:5432/heritago?schema=public"
JWT_SECRET="ein-langes-zufaelliges-geheimnis"
NODE_ENV=production
```

> [!IMPORTANT]
> Ersetze `dein_sicheres_passwort` durch das Passwort aus Schritt 2 und `ein-langes-zufaelliges-geheimnis` durch einen eigenen, sicheren Wert!

### 5.3 Datenbank-Schema anlegen & Backend kompilieren

```bash
cd /opt/heritago/server

# Prisma Client generieren
npx prisma generate

# Datenbank-Schema direkt anwenden (bei Erstinstallation)
npx prisma db push

# TypeScript kompilieren
npm run build
```

---

## 6. Nginx als Reverse Proxy konfigurieren

### 6.1 Konfigurationsdatei erstellen

```bash
sudo nano /etc/nginx/sites-available/heritago
```

Folgenden Inhalt einfügen (IP-Adresse bzw. Domain anpassen):

```nginx
server {
    listen 80;
    server_name DEINE_IP_ODER_DOMAIN;

    root /opt/heritago/dist/heritago/browser;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 50M;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:3000/uploads/;
    }
}
```

> [!CAUTION]
> Ersetze `DEINE_IP_ODER_DOMAIN` durch die tatsächliche IP-Adresse des Servers (z.B. `10.10.1.13`) oder den Domainnamen!

### 6.2 Aktivieren und starten

```bash
# Verlinken & Default entfernen
sudo ln -s /etc/nginx/sites-available/heritago /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Konfiguration prüfen (muss "ok" und "successful" ausgeben!)
sudo nginx -t

# Nginx starten
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## 7. Backend als systemd-Dienst einrichten

### 7.1 Service-Datei erstellen

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

### 7.2 Berechtigungen setzen und starten

```bash
# Berechtigungen für den Webserver-User setzen
sudo chown -R www-data:www-data /opt/heritago

# Systemd neu laden und Service starten
sudo systemctl daemon-reload
sudo systemctl start heritago
sudo systemctl enable heritago

# Status prüfen (sollte "active (running)" zeigen)
sudo systemctl status heritago
```

---

## 8. Firewall konfigurieren (optional)

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp    # Nur für HTTPS
sudo ufw enable
```

---

## 9. SSL mit Let's Encrypt einrichten (optional, empfohlen)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d deine-domain.de
```

---

## Nützliche Befehle

| Aktion                        | Befehl                                    |
|-------------------------------|-------------------------------------------|
| Backend-Status prüfen         | `sudo systemctl status heritago`          |
| Backend neustarten            | `sudo systemctl restart heritago`         |
| Backend-Logs ansehen          | `sudo journalctl -u heritago -f`          |
| Nginx neustarten              | `sudo systemctl restart nginx`            |
| Nginx-Config prüfen           | `sudo nginx -t`                           |
| Datenbank-Backup              | `pg_dump -U heritago heritago > backup.sql` |
| Datenbank wiederherstellen    | `psql -U heritago heritago < backup.sql`  |

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
npx prisma db push
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
├── dist/heritago/browser/   # Angular Production Build (wird von Nginx ausgeliefert)
├── server/
│   ├── dist/                # Kompiliertes Backend (JS)
│   ├── src/                 # Backend-Quellcode (TS)
│   ├── prisma/              # Datenbank-Schema & Migrationen
│   ├── uploads/             # Hochgeladene Medien
│   └── .env                 # Umgebungsvariablen (NICHT ins Git!)
├── src/                     # Angular-Quellcode (Frontend)
├── package.json             # Frontend-Abhängigkeiten
└── angular.json             # Angular-Konfiguration
```

---

## Fehlerbehebung

### Backend startet nicht
```bash
sudo journalctl -u heritago -n 50    # Letzte 50 Log-Zeilen
```

### Nginx zeigt Fehler
```bash
sudo nginx -t                        # Config prüfen
sudo tail -f /var/log/nginx/error.log # Nginx Error-Log
```

### Datenbank-Fehler (z.B. "invalid input syntax")
```bash
cd /opt/heritago/server
npx prisma db push --force-reset     # Schema neu anlegen (LÖSCHT DATEN!)
sudo systemctl restart heritago
```
