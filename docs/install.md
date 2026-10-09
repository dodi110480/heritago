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
> Der `postbuild`-Schritt kopiert zusätzlich `3rdpartylicenses.txt` in den Webroot
> (`scripts/copy-licenses.js`), damit die Lizenz- und Copyright-Hinweise der
> verwendeten Bibliotheken unter `/3rdpartylicenses.txt` abrufbar sind.

---

## 5. Backend einrichten (Express + Prisma)

### 5.1 Abhängigkeiten installieren

```bash
cd /opt/heritago/server
npm install
```

### 5.2 Umgebungsvariablen konfigurieren

Eine vollständige Vorlage **aller** Variablen liegt im Repository unter
`server/.env.example` – am einfachsten von dort kopieren und anpassen:

```bash
cp /opt/heritago/server/.env.example /opt/heritago/server/.env
nano /opt/heritago/server/.env
```

Inhalt:

```env
PORT=3000
DATABASE_URL="postgresql://heritago:dein_sicheres_passwort@127.0.0.1:5432/heritago?schema=public"
JWT_SECRET="ein-langes-zufaelliges-geheimnis"
NODE_ENV=production

# Öffentliche Basis-URL der Anwendung (für Links in E-Mails)
APP_URL="https://deine-domain.de"

# E-Mail (SMTP) – für E-Mail-Verifizierung & Passwort-Reset
# Ohne MAIL_HOST werden E-Mails im Dev-Modus nur in die Konsole geloggt.
MAIL_HOST="smtp.example.com"
MAIL_PORT=587
MAIL_USER="dein-smtp-user"
MAIL_PASS="dein-smtp-passwort"
MAIL_FROM="Heritago <no-reply@deine-domain.de>"

# Cookie-Sicherheit (optional)
# Standard: in Produktion werden die Auth-Cookies mit `Secure` gesetzt.
# Wird die Anwendung ohne TLS (reines HTTP) betrieben, verwirft der Browser diese
# Cookies und der Login hält nicht – dann hier explizit abschalten.
# COOKIE_SECURE=false

# Bot-Schutz / Rate Limiting (optional – es gelten sichere Defaults)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=20

# Update-Prüfung (optional)
# Quelle ist das GitHub-Repository, aus dem installiert wurde. Ohne Angabe wird
# dodi110480/heritago verwendet. Ein GITHUB_TOKEN ist nur nötig, wenn das anonyme
# Limit der GitHub-API (60 Anfragen/Stunde) nicht reicht oder das Repository privat
# ist – ein ungültiger oder abgelaufener Token wird ignoriert und die Prüfung läuft
# dann anonym weiter.
GITHUB_OWNER="dodi110480"
GITHUB_REPO="heritago"
# GITHUB_TOKEN="ghp_..."
```

> [!IMPORTANT]
> Ersetze `dein_sicheres_passwort` durch das Passwort aus Schritt 2 und `ein-langes-zufaelliges-geheimnis` durch einen eigenen, sicheren Wert!

### 5.3 Datenbank-Schema anlegen & Backend kompilieren

```bash
cd /opt/heritago/server

# Prisma Client generieren
npx prisma generate

# Datenbank-Migrationen anwenden (sicher, nicht-destruktiv)
npx prisma migrate deploy

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

### 7.3 Automatische Updates einrichten (optional, empfohlen)

Die Seite **Einstellungen → System & Updates** kann eine neue Version vollständig
installieren: Tag auschecken, Frontend und Backend bauen, Dienst neu starten. Dafür
sind drei Bausteine nötig, die **einmalig als root** eingerichtet werden – danach
genügt in der Weboberfläche ein Klick. Ohne diese Einrichtung lehnt die Anwendung das
Update mit einer verständlichen Meldung ab; es wird nichts halb installiert.

Der Build läuft dabei bewusst **nicht** im Web-Prozess: dieser wird durch den Neustart
beendet, den das Update auslöst. Stattdessen startet der Web-Prozess eine eigene
systemd-Unit (`heritago-update.service`), die Checkout, Builds und Neustart übernimmt.

**a) Zustandsverzeichnis** (Austausch von Fortschritt/Protokoll zwischen Web-Prozess
und Update-Worker):

```bash
sudo install -d -o www-data -g www-data -m 0755 /var/lib/heritago
```

**b) Worker-Unit erstellen**

```bash
sudo nano /etc/systemd/system/heritago-update.service
```

```ini
[Unit]
Description=Heritago Update (Checkout, Build, Neustart)
After=network.target

[Service]
Type=oneshot
WorkingDirectory=/opt/heritago
ExecStart=/opt/heritago/scripts/update.sh
```

**c) Freigabe für den Web-User** – `www-data` darf ausschließlich diese eine Unit
starten (exakter Befehl, kein Wildcard). Die Ziel-Version übergibt die Anwendung über
die Datei `/var/lib/heritago/update-request.txt`, also **nicht** über die
Kommandozeile:

```bash
sudo nano /etc/sudoers.d/heritago-update
```

```
www-data ALL=(root) NOPASSWD: /usr/bin/systemctl start --no-block heritago-update.service
```

```bash
sudo chmod 0440 /etc/sudoers.d/heritago-update
sudo visudo -c                                   # Syntax prüfen
sudo chmod +x /opt/heritago/scripts/update.sh
sudo systemctl daemon-reload
```

**d) Prüfen**

```bash
sudo -u www-data sudo -n systemctl start --no-block heritago-update.service
sudo systemctl status heritago-update            # sollte kurz "activating/active" zeigen
tail -n 20 /var/lib/heritago/update.log          # Protokoll des Workers
```

Fortschritt und Protokoll sind zusätzlich im Fortschrittsdialog der Update-Seite
sichtbar; der Worker schreibt seinen Zustand nach
`/var/lib/heritago/update-state.txt`.

> **Optionale Umgebungsvariablen** (in der Worker-Unit bzw. beim Web-Service):
> `HERITAGO_STATE_DIR` (Standard `/var/lib/heritago`), `HERITAGO_APP_ROOT`
> (Standard `/opt/heritago`), `HERITAGO_SERVICE_NAME` (Standard `heritago`),
> `HERITAGO_WEB_USER` (Standard `www-data`) sowie `HERITAGO_UPDATE_UNIT`
> (Standard `heritago-update.service`) für das Backend.

**e) Update ohne Weboberfläche** (gleicher Weg, den die Anwendung auslöst) – nützlich
für Wartung per SSH:

```bash
sudo install -d -o www-data -g www-data -m 0755 /var/lib/heritago
echo 'tag=v1.0.0' | sudo tee /var/lib/heritago/update-request.txt
sudo systemctl start heritago-update
sudo journalctl -u heritago-update -f          # Fortschritt verfolgen
cat /var/lib/heritago/update-state.txt         # Ergebnis (status=success/failed)
```

**f) Fehlgeschlagene Updates (automatischer Rollback)**

Schlägt ein Schritt **nach** dem Auschecken fehl (typisch: Frontend- oder Backend-Build),
bleibt die Installation nicht halbfertig zurück. `update.sh` lädt die vorher installierte
Version erneut, baut sie und startet den Dienst wieder darauf. Die Oberfläche meldet dann
„Vorherige Version wiederhergestellt", in `/var/lib/heritago/update-state.txt` steht
`status=rolled_back`. Schlägt auch der Rollback fehl, steht dort `status=failed` – dann ist
ein manueller Eingriff per SSH nötig (Log siehe unten).

> `update.sh` akzeptiert als Ziel-Version nur ein Tag im Format `v1.2.3` (oder `1.2.3`).
> Lokale Änderungen im Installationsverzeichnis blockieren den Checkout: Die Datei
> `package-lock.json` wird automatisch zurückgesetzt, alles andere muss vorher
> zurückgenommen werden (`git checkout -- <datei>`).


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
npx prisma migrate deploy
npm run build

# Backend neustarten
sudo systemctl restart heritago
```

> [!TIP]
> Du kannst Updates auch bequem über die Weboberfläche unter **Einstellungen → System & Updates** durchführen!

> [!NOTE]
> Als neue Version zählt sowohl das neueste GitHub-Release als auch der höchste Tag. Ein Tag,
> für den noch kein Release veröffentlicht wurde, wird also ebenfalls als Update angeboten –
> denn die Web-Oberfläche installiert genau diesen Tag (`git checkout tags/<tag>`).

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

### „Prüfung nicht möglich" auf der Seite Einstellungen → System & Updates

Die Update-Prüfung fragt die GitHub-API ab. Schlägt das fehl (Server ohne Internetzugang,
Rate-Limit erreicht, Repository noch ohne Release/Tag), zeigt die Seite die installierte
Version weiter an und meldet nur, dass die Prüfung derzeit nicht möglich ist.

```bash
# Erreichbarkeit der GitHub-API prüfen
curl -s -o /dev/null -w '%{http_code}\n' https://api.github.com/repos/dodi110480/heritago/tags

# Ursache im Backend-Log
sudo journalctl -u heritago -n 50 | grep -i 'github\|update check'
```

Meldet das Log `GitHub rejected GITHUB_TOKEN` oder `Bad credentials`, ist der in `server/.env`
hinterlegte Token abgelaufen: entweder einen neuen Personal Access Token setzen oder
`GITHUB_TOKEN` ganz entfernen (das Repository ist öffentlich, die Prüfung läuft dann anonym).

Ohne Token erlaubt die GitHub-API nur **60 Anfragen pro Stunde**. Ist das Kontingent
aufgebraucht, antwortet GitHub mit HTTP 403 und `x-ratelimit-remaining: 0`. In diesem Fall
zeigt die Seite ausdrücklich „Die GitHub-API ist derzeit limitiert …" und
`/api/system/check-update` setzt `rateLimited: true` (unterscheidbar von einem echten
Verbindungsfehler). Abhilfe: später erneut suchen oder ein Fine-grained Token mit
Lesezugriff auf *Contents* und *Metadata* als `GITHUB_TOKEN` in `server/.env` hinterlegen und
den Dienst neu starten.

### Update schlägt fehl / „Vorherige Version wiederhergestellt"

```bash
cat /var/lib/heritago/update-state.txt      # status=rolled_back (ok) oder failed (Eingriff nötig)
tail -n 60 /var/lib/heritago/update.log     # welcher Schritt gescheitert ist
git -C /opt/heritago describe --tags --always   # welche Version jetzt läuft
```

Nach `status=rolled_back` läuft die vorherige Version weiter – es ist nichts weiter zu tun.
Bei `status=failed` hat auch die Wiederherstellung nicht funktioniert: Fehler im Log beheben
und das Update per SSH erneut anstoßen (Abschnitt 7.3 e).

### Datenbank-Fehler (z.B. "invalid input syntax")
```bash
cd /opt/heritago/server
npx prisma db push --force-reset     # Schema neu anlegen (LÖSCHT DATEN!)
sudo systemctl restart heritago
```
