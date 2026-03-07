# RULES_MEDIA_UPLOAD.md – Medien-Ordnerstruktur und Upload-Regeln

## 1. Root-Verzeichnis
```
/var/heri/media/
```

Alle Medien werden **außerhalb des Webroots** gespeichert.

---

## 2. Ordnerstruktur
```
/var/heri/media/
├── users/
│   ├── 00000001/               # User-ID: 8-stellig, führende Nullen
│   │   ├── originals/
│   │   │   ├── v1/             # Erste Version (original)
│   │   │   ├── v2/             # Ersetzt durch Nutzer (optional)
│   │   │   └── …
│   │   ├── thumbs/             # Miniaturbilder (200x200px, crop)
│   │   └── medium/             # Mittelgroße Versionen (max. 1200px)
│   ├── 00000002/
│   │   ├── originals/
│   │   ├── thumbs/
│   │   └── medium/
│   └── …
│
└── temp/
    └── {session-id}/           # Pro Upload-Session ein eigenes Verzeichnis
```

> **Versionierung:** Falls Nutzer Dateien ersetzen dürfen, wird pro Version ein Unterverzeichnis angelegt (`v1/`, `v2/`, …). Jede Version erhält einen eigenen Datenbankeintrag. Die jeweils aktuelle Version wird in der DB als `is_current = true` markiert. Ältere Versionen bleiben erhalten und können wiederhergestellt werden.

---

## 3. Dateirechte
```bash
chown -R www-data:www-data /var/heri/media
chmod -R 750 /var/heri/media
chmod 700 /var/heri/media/temp
```

---

## 4. Dateinamen

Format:
```
UUIDv4 (32 Hex-Zeichen, ohne Bindestriche) + . + Kleinbuchstaben-Endung
```

Beispiele:
```
550e8400e29b41d4a716446655440000.jpg
6ba7b8109dad11d180b400c04fd430c8.pdf
```

Der Originaldateiname wird **nicht** gespeichert oder verwendet.

> **Hinweis zur Pfadlänge:** UUIDv4 + Endung ergibt max. ~37 Zeichen – für aktuelle Linux-Dateisysteme problemlos. Sollten in Zukunft sehr tiefe Pfadstrukturen entstehen, kann auf die ersten 20 Hex-Zeichen + gekürzten Hash umgestellt werden. Bis dahin: volle UUID verwenden.

---

## 5. Datenbank-Speicherung

In der Datenbank wird nur der **relative Pfad** gespeichert.

Beispiel:
```
users/00000001/originals/v1/550e8400e29b41d4a716446655440000.jpg
```

Ein **SHA256-Hash** wird ebenfalls gespeichert und kann für Deduplizierung aktiviert werden. Bei sehr großen Datenmengen kann die Spalte weggelassen werden – die UUID reicht dann als eindeutiger Bezeichner.

Beispiel DB-Felder:
```
id
uuid
user_id
path
version                 # Aktuelle Versionsnummer (1, 2, …)
is_current              # true = aktive Version
checksum_sha256         # nullable – nur befüllen wenn Deduplizierung aktiv
filesize
crop_x                  # nullable – X-Koordinate des Crop-Startpunkts (Pixel)
crop_y                  # nullable – Y-Koordinate des Crop-Startpunkts (Pixel)
crop_width              # nullable – Breite des Crop-Bereichs (Pixel)
crop_height             # nullable – Höhe des Crop-Bereichs (Pixel)
created_at
```

> Alle `crop_*`-Felder sind `nullable`. Kein Crop-Eintrag bedeutet: Varianten werden aus dem gesamten Originalbild erzeugt. Crop-Koordinaten beziehen sich immer auf die **Originaldatei in Originalgröße**.

---

## 6. Upload-Prozess (Pflicht-Schritte)

1. **Session-Verzeichnis anlegen**
```
/var/heri/media/temp/{session-id}/
```

2. **User-ID auf 8 Stellen formatieren**
```php
sprintf("%08d", $userId)
```

3. **Ordnerstruktur prüfen und ggf. anlegen**
```
users/{userid}/originals/v1
users/{userid}/thumbs
users/{userid}/medium
```

4. **Datei validieren**
   - Erlaubte Endung prüfen (Whitelist)
   - MIME-Type prüfen (serverseitig, nicht vom Client übernehmen)
   - **Bildinhalt validieren** mittels `Imagick` (robuster als `getimagesize()` allein, erkennt manipulierte Header zuverlässiger)
   - Dateigröße prüfen
   - **Pixelanzahl prüfen** (nur bei Bildern, Schutz gegen ZIP-Bomb-ähnliche Angriffe):
```
width * height <= 40.000.000 Pixel (max. 40 Megapixel)
```

> Ein 100.000 × 100.000 px PNG würde beim Rendern einen RAM-Absturz verursachen. Diese Prüfung muss **vor** jeder Bildverarbeitung erfolgen.

5. **Virus-Scan** (ClamAV oder vergleichbare Lösung)
   - Pflicht bei PDFs, empfohlen für alle Dateitypen
   - Bei positivem Befund: Datei sofort löschen, Upload abbrechen, Vorfall loggen

6. **Deduplizierung prüfen** *(falls SHA256-Deduplizierung aktiv)*
   - SHA256-Hash der Datei berechnen
   - Prüfen ob Hash bereits in DB vorhanden
   - Falls ja: vorhandenen Pfad referenzieren, keinen neuen Eintrag anlegen

7. **EXIF-Geodaten entfernen** *(siehe Abschnitt 8)*

8. **Datei umbenennen**
```
UUIDv4 + Endung (klein geschrieben)
```

9. **Originaldatei speichern** (vollständig, unverändert)
```
users/{userid}/originals/v{n}/{uuid}.{ext}
```

10. **Crop-Auswahl entgegennehmen** *(nur bei Bildern, optional)*

    Der Client übermittelt nach dem Upload die Crop-Koordinaten (siehe Abschnitt 7).
    Diese werden validiert und in der DB gespeichert.
    Kein Crop = Felder bleiben `null`, Varianten nutzen das gesamte Bild.

11. **SHA256-Hash berechnen und speichern** *(falls Deduplizierung aktiv)*

12. **Datenbankeintrag erstellen** (inkl. `crop_*`-Felder falls vorhanden)

13. **Varianten-Erzeugung asynchron in Queue einreihen**
```
Queue-Job: generate_variants → {uuid}, {userid}, {ext}, {crop_x}, {crop_y}, {crop_width}, {crop_height}
```

14. **Session-Verzeichnis löschen**

> Bei einem Abbruch oder Fehler ab Schritt 9 muss das Session-Verzeichnis aktiv entfernt und kein Datenbankeintrag angelegt werden. Halbfertige Uploads dürfen nicht bestehen bleiben.

---

## 7. Crop-Workflow

### Ablauf
```
1. Nutzer wählt Bild aus
2. Vorschau wird im Browser angezeigt (z. B. via Cropper.js)
3. Nutzer zieht optional einen Crop-Rahmen
4. Upload startet → Originaldatei wird vollständig übertragen
5. Server speichert Original unverändert
6. Crop-Koordinaten werden separat an den Server gesendet und in der DB gespeichert
7. Varianten (thumbs/medium) werden anhand der Koordinaten gerendert
```

### Warum nicht client-seitig croppen?

Das Original wird **immer vollständig gespeichert**. Der Crop beeinflusst ausschließlich die erzeugten Varianten (`thumbs/`, `medium/`). So kann der Nutzer den Crop jederzeit ändern oder zurücksetzen, ohne die Datei erneut hochzuladen.

### Crop nachträglich ändern

Der Nutzer kann den Crop nach dem Upload jederzeit anpassen:
```
PATCH /api/media/{uuid}/crop
Body: { "x": 120, "y": 45, "width": 800, "height": 800 }
```

Nach einer Crop-Änderung wird ein neuer `generate_variants`-Job in die Queue eingereiht. Die alten Varianten werden überschrieben.

### Crop zurücksetzen
```
DELETE /api/media/{uuid}/crop
```

Setzt alle `crop_*`-Felder auf `null`. Nächste Varianten-Erzeugung nutzt wieder das gesamte Originalbild.

### Validierung der Crop-Koordinaten (serverseitig, Pflicht)
```
crop_x >= 0
crop_y >= 0
crop_x + crop_width  <= original_width
crop_y + crop_height <= original_height
crop_width  >= 10 px   (Mindestgröße)
crop_height >= 10 px   (Mindestgröße)
```

> Koordinaten werden immer gegen die tatsächliche Originaldatei geprüft – niemals blind aus dem Client übernehmen.

---

## 8. EXIF-Metadaten

**Geodaten (GPS-Tags) werden vor dem Speichern immer entfernt** – unabhängig vom Datenschutzwunsch des Nutzers. Dies ist Pflicht, da Familienfotos sensible Standortinformationen enthalten können.

Folgende EXIF-Felder können durch Heritago ergänzt werden:
```
ImageUniqueID = {uuid}
Software      = Heritago
```

EXIF dient nur als Zusatzinformation, **nicht** als primäre Zuordnung.

---

## 9. Animierte GIFs

Animierte GIFs sind erlaubt. Bei der Variantenerzeugung gilt:

- **Original** bleibt vollständig (mit Animation) erhalten
- **Thumbs und Medium** werden nur aus **Frame 1** erzeugt (keine animierten Varianten)
- Ein Crop auf animierte GIFs ist erlaubt, wird aber ebenfalls nur auf Frame 1 angewendet

---

## 10. Varianten-Erzeugung (Queue-Job)

Wird asynchron nach dem Upload ausgeführt. Falls Crop-Koordinaten vorhanden sind, wird zunächst der Crop-Bereich aus dem Original ausgeschnitten; das Ergebnis dient als Basis für die Skalierung.

**Bilder:**
```
thumbs  → (Crop →) 200x200px (bei GIF: nur Frame 1; bei JPG/PNG/WebP: als WebP speichern)
medium  → (Crop →) max. 1200px längste Seite (bei GIF: nur Frame 1; bei JPG/PNG/WebP: als WebP speichern)
```

**PDFs:**
```
thumbs  → Erste Seite als PNG (via Ghostscript oder poppler-utils), dann 200x200px
medium  → Erste Seite als PNG, max. 1200px längste Seite
```

> PDFs unterstützen keinen Crop.

---

## 11. Sicherheitsregeln

Speicherort:
```
/var/heri/media/
```

Regeln:
- Dateien **nicht** im Webroot speichern
- **kein direkter HTTP-Zugriff**
- Zugriff ausschließlich über die Anwendung
- Auslieferung über **X-Accel-Redirect** (Nginx) oder vergleichbare Technik
- **Rate Limiting** beim Upload: max. 20 Uploads pro Nutzer pro Minute (anpassbar per Konfiguration)
- Upload-Endpunkt ist nur für authentifizierte Nutzer erreichbar

---

## 12. Erlaubte Dateiformate
```
jpg / jpeg
png
gif
webp
pdf
```

Prüfung erfolgt über:
- Dateiendung (Whitelist)
- MIME-Type (serverseitig)
- Inhaltsprüfung bei Bildern via `Imagick`

> **SVG ist ausdrücklich nicht erlaubt.** SVG-Dateien können eingebettetes JavaScript enthalten und stellen ein ernstes XSS-Risiko dar. SVG darf auch zukünftig **nicht** zur Whitelist hinzugefügt werden, ohne eine dedizierte Sanitization-Lösung (z. B. SVG-Sanitizer-Bibliothek + strikte CSP).

> **WebP:** Hochgeladene WebP-Dateien werden direkt akzeptiert. JPG/PNG-Uploads werden für `thumbs` und `medium` zusätzlich als WebP konvertiert und gespeichert, um Bandbreite zu sparen. Das Original bleibt im Ursprungsformat erhalten.

---

## 13. Maximale Dateigröße & Upload-Timeout

| Typ       | Limit  | Timeout    |
|-----------|--------|------------|
| Bilder    | 15 MB  | 2 Minuten  |
| Dokumente | 100 MB | 5 Minuten  |

> Bei großen Dokumenten (bis 100 MB) wird ein Upload-Timeout von 5 Minuten empfohlen, um hängende Verbindungen zu vermeiden. **Chunked Uploads** sind optional unterstützbar und sinnvoll, falls Nutzer mit langsamer Verbindung häufig Timeouts erleiden.

---

## 14. Fehlermeldungen an den Nutzer

Bei Validierungsfehlern erhält der Nutzer eine **klare, verständliche Fehlermeldung** – keine technischen Rohdaten. Beispiele:

| Fehlercode             | Nachricht an den Nutzer                                                               |
|------------------------|---------------------------------------------------------------------------------------|
| `filesize_exceeded`    | „Die Datei ist zu groß. Bilder: max. 15 MB, Dokumente: max. 100 MB."                 |
| `pixel_limit_exceeded` | „Das Bild hat zu viele Pixel. Bitte auf maximal 40 Megapixel reduzieren."            |
| `invalid_mime`         | „Dieses Dateiformat wird nicht unterstützt. Erlaubt: JPG, PNG, GIF, WebP, PDF."      |
| `virus_detected`       | „Die Datei konnte nicht hochgeladen werden. Bitte prüfen Sie die Datei."             |
| `upload_timeout`       | „Der Upload hat zu lange gedauert. Bitte versuchen Sie es mit einer kleineren Datei."|
| `duplicate_detected`   | „Diese Datei wurde bereits hochgeladen." *(nur falls Deduplizierung aktiv)*          |
| `invalid_crop`         | „Der gewählte Bildausschnitt ist ungültig. Bitte erneut auswählen."                  |

> Fehlermeldungen dürfen **keine** internen Pfade, UUIDs oder Stack-Traces enthalten.

---

## 15. Temporäre Dateien

Upload-Zwischenspeicher:
```
/var/heri/media/temp/{session-id}/
```

Eigenschaften:
- Rechte: `chmod 700`
- Pro Upload-Session ein eigenes Unterverzeichnis mit Session-ID
- Bei erfolgreichem oder fehlerhaftem Abschluss wird das Session-Verzeichnis **sofort gelöscht**
- Verwaiste Verzeichnisse (Session abgebrochen, kein Cleanup) werden per Cronjob bereinigt

Cronjob (verwaiste Session-Verzeichnisse älter als 24 Stunden):
```bash
0 3 * * * find /var/heri/media/temp -mindepth 1 -maxdepth 1 -type d -mtime +1 -exec rm -rf {} +
```

---

## 16. Upload-Protokollierung

Log-Datei:
```
/var/log/heri/uploads.log
```

Format (ISO-8601, inkl. IP und User-Agent für Security-Audits):
```
[ISO-8601-Datum] | user={id} | ip={ip} | ua={user-agent} | file={dateiname} | size={größe} | status={OK|ERR} | detail={…}
```

Beispiele:
```
2026-03-07T21:15:02+01:00 | user=12 | ip=203.0.113.42 | ua=Mozilla/5.0 (…) | file=550e8400…000.jpg | size=3.2MB | status=OK
2026-03-07T21:15:04+01:00 | user=12 | ip=203.0.113.42 | ua=Mozilla/5.0 (…) | file=550e8400…000.jpg | crop=120,45,800,800 | status=OK | detail=crop_saved
2026-03-07T21:16:44+01:00 | user=12 | ip=203.0.113.42 | ua=Mozilla/5.0 (…) | file=FAILED | size=22.1MB | status=ERR | detail=filesize_exceeded
2026-03-07T21:17:11+01:00 | user=15 | ip=203.0.113.99 | ua=Mozilla/5.0 (…) | file=FAILED | size=0MB   | status=ERR | detail=pixel_limit_exceeded
2026-03-07T21:18:03+01:00 | user=9  | ip=203.0.113.77 | ua=Mozilla/5.0 (…) | file=FAILED | size=4.1MB | status=ERR | detail=virus_detected
2026-03-07T21:19:55+01:00 | user=7  | ip=203.0.113.55 | ua=Mozilla/5.0 (…) | file=550e1234…abc.jpg | crop=INVALID | status=ERR | detail=invalid_crop
```

**Log-Rotation** ist Pflicht:
```bash
# /etc/logrotate.d/heri-uploads
/var/log/heri/uploads.log {
    daily
    rotate 90
    compress
    missingok
    notifempty
}
```

Aufbewahrungsdauer: **90 Tage**, danach automatische Löschung durch logrotate.

---

## 17. CDN-Integration (optional)

Falls Heritago global genutzt wird, können `thumbs/` und `medium/` über ein CDN ausgeliefert werden:

- **Originale** verbleiben stets auf dem Ursprungsserver (kein CDN-Zugriff)
- CDN liefert ausschließlich `thumbs/` und `medium/` aus
- Cache-Invalidierung bei neuer Version, Crop-Änderung oder Löschung ist Pflicht
- CDN-URLs werden in der DB nicht gespeichert – sie werden zur Laufzeit aus dem relativen Pfad generiert

---

## 18. REST-API für Medien (Zukunft)

Falls Heritago künftig mit externen Genealogie-Tools integriert wird, sollte eine REST-API für Medien vorgesehen werden. Vorgeschlagene Endpunkte:
```
POST   /api/media/upload            # Datei hochladen
GET    /api/media/{uuid}            # Metadaten abrufen
GET    /api/media/{uuid}/download   # Datei herunterladen (auth required)
DELETE /api/media/{uuid}            # Datei löschen
GET    /api/media/user/{userid}     # Alle Medien eines Nutzers
PATCH  /api/media/{uuid}/crop       # Crop-Koordinaten setzen oder ändern
DELETE /api/media/{uuid}/crop       # Crop zurücksetzen (gesamtes Bild)
```

Regeln:
- Alle Endpunkte erfordern Authentifizierung
- Antworten enthalten **niemals** absolute Dateipfade
- Rate Limiting gilt auch für API-Zugriffe

---

## 19. Backup-Strategie

Backup-Inhalt:
```
/var/heri/media/
```

Es gilt die **3-2-1-Regel**:
- **3** Kopien der Daten
- auf **2** verschiedenen Speichermedien/-typen
- davon **1** Kopie Off-Site (externer Server oder Cloud-Speicher)

Zeitplan:
- Tägliches Backup aller Medien
- Wöchentliche Integritätsprüfung (SHA256-Vergleich mit Datenbankeinträgen)
- Monatlicher Restore-Test auf Testsystem

---

## 20. Grundprinzipien

1. Medien sind **unveränderlich** gespeichert
2. **Originaldateien** bleiben stets vollständig und unverändert erhalten
3. **Datenbank** ist Hauptquelle der Zuordnung
4. UUID (+ optional SHA256) ermöglichen Wiederherstellung und Deduplizierung
5. Medien sind vom Webserver **direkt nicht erreichbar**
6. **Geodaten** aus EXIF werden immer entfernt
7. **Fehlerhafte oder abgebrochene Uploads** hinterlassen keine Dateileichen
8. **Bildvarianten** (thumbs/medium) werden als WebP gespeichert, um Bandbreite zu sparen
9. **PDFs** erhalten eine gerenderte Vorschau (erste Seite als PNG/WebP)
10. **SVG ist dauerhaft verboten** – kein Hinzufügen ohne dedizierte Sanitization
11. **Pixelanzahl-Prüfung** schützt vor RAM-Erschöpfung durch manipulierte Bilddateien
12. **Virus-Scan** ist Pflicht bei PDFs, empfohlen für alle Dateitypen
13. **Varianten-Erzeugung** erfolgt asynchron und blockiert den Upload-Request nicht
14. **Fehlermeldungen** sind nutzerfreundlich und enthalten keine internen Details
15. **Versionierung** ermöglicht Wiederherstellung ersetzter Dateien
16. **Crop-Koordinaten** werden serverseitig gespeichert – das Original bleibt immer vollständig erhalten