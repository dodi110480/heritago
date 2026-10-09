# Medien-Infrastruktur & Betrieb

> **Typ:** Betriebs-/Infrastruktur-Dokumentation – **keine** Entwicklungsregel.
> Die verbindlichen Entwicklungs-Regeln für Medien stehen in `.clinerules/media-upload.md`.
> Dieses Dokument beschreibt Server-, Deployment- und Backup-Themen und wurde bewusst aus dem
> Regelwerk ausgelagert, um den Coding-Kontext schlank zu halten.

## 1. Speicherort & Dateirechte

Alle Medien liegen **außerhalb des Webroots** unter `/var/heri/media/`.

```bash
# Eigentümer/Gruppe = der Nutzer, unter dem der Node-Server läuft (hier: www-data)
chown -R www-data:www-data /var/heri/media
chmod -R 750 /var/heri/media
chmod 700 /var/heri/media/temp
```

> Der Node-Prozess muss Lese-/Schreibrechte auf `/var/heri/media/` und `/var/heri/media/temp/` haben.

## 2. Auslieferung über den Reverse-Proxy

- **Kein** direkter HTTP-Zugriff auf `/var/heri/media/`.
- Auslieferung ausschließlich über die Anwendung; für große Dateien kann der Server intern auf den
  Proxy umleiten (**`X-Accel-Redirect`** unter Nginx oder vergleichbare Technik).
- Der interne Auslieferungs-Location darf nur vom Node-Server erreichbar sein.

Beispiel (Nginx):

```nginx
location /protected-media/ {
    internal;
    alias /var/heri/media/;
}

location /media/ {
    proxy_pass http://127.0.0.1:3000;
}
```

## 3. Upload-Protokollierung

Log-Datei: `/var/log/heri/uploads.log`
Format (ISO-8601, inkl. IP und User-Agent für Security-Audits):

```
[ISO-8601] | user={id} | ip={ip} | ua={user-agent} | file={dateiname} | size={größe} | status={OK|ERR} | detail={…}
```

Beispiele:

```
2026-03-07T21:15:02+01:00 | user=42 | ip=203.0.113.10 | ua=Mozilla/5.0 (…) | file=550e1234…abc.jpg | size=2.3MB | status=OK  | detail=stored
2026-03-07T21:17:11+01:00 | user=15 | ip=203.0.113.99 | ua=Mozilla/5.0 (…) | file=FAILED | size=0MB   | status=ERR | detail=pixel_limit_exceeded
2026-03-07T21:18:03+01:00 | user=9  | ip=203.0.113.77 | ua=Mozilla/5.0 (…) | file=FAILED | size=4.1MB | status=ERR | detail=virus_detected
```

**Log-Rotation** ist Pflicht (`/etc/logrotate.d/heri-uploads`):

```bash
/var/log/heri/uploads.log {
    daily
    rotate 90
    compress
    missingok
    notifempty
}
```

Aufbewahrungsdauer: **90 Tage**, danach automatische Löschung durch logrotate.

## 4. Aufräumen verwaister Upload-Sessions

Session-Verzeichnisse unter `/var/heri/media/temp/` werden regulär sofort gelöscht. Verwaiste
Reste (abgebrochene Sessions) entfernt ein Cronjob (täglich 03:00, älter als 24 Stunden):

```bash
0 3 * * * find /var/heri/media/temp -mindepth 1 -maxdepth 1 -type d -mtime +1 -exec rm -rf {} +
```

## 5. Virus-Scan

- **Pflicht** bei PDFs, empfohlen für alle Dateitypen.
- Bei positivem Befund: Datei sofort löschen, Upload abbrechen, Vorfall loggen.

## 6. CDN-Integration (optional)

Falls Heritago global genutzt wird, können `thumbs/` und `medium/` über ein CDN ausgeliefert werden:

- **Originale** verbleiben stets auf dem Ursprungsserver (kein CDN-Zugriff).
- CDN liefert ausschließlich `thumbs/` und `medium/` aus.
- Cache-Invalidierung bei neuer Version, Crop-Änderung oder Löschung ist Pflicht.
- CDN-URLs werden **nicht** in der DB gespeichert – sie werden zur Laufzeit aus dem relativen Pfad erzeugt.

## 7. Backup-Strategie

Backup-Inhalt: `/var/heri/media/`

Es gilt die **3-2-1-Regel**:
- **3** Kopien der Daten
- auf **2** verschiedenen Speichermedien/-typen
- davon **1** Kopie Off-Site (externer Server oder Cloud-Speicher)

Zeitplan:
- Tägliches Backup aller Medien
- Wöchentliche Integritätsprüfung (SHA256-Vergleich mit Datenbankeinträgen)
- Monatlicher Restore-Test auf einem Testsystem
