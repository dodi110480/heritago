---
paths:
  - "server/src/**media**"
  - "src/app/features/media/**"
  - "src/app/shared/components/ui/app-media-list/**"
---

# Medien-Speicherung & Upload-Regeln

> **Verbindlichkeit:** verbindlich · **Geltungsbereich:** Medien-Upload/-Speicherung ·
> **Aktivierung:** `paths:` (siehe oben)
>
> **Betrieb/Infrastruktur** (Dateirechte, Reverse-Proxy/`X-Accel-Redirect`, Log-Rotation,
> verwaiste Sessions, Backup, CDN) wurde nach `docs/media/infrastructure.md` ausgelagert.
> Medien-Endpunkte stehen in `api.md`.

## 1. Root-Verzeichnis

```
/var/heri/media/
```

Alle Medien werden **außerhalb des Webroots** gespeichert.

## 2. Ordnerstruktur

```
/var/heri/media/
├── users/
│   └── {user-uuid}/            # User.id (UUID) aus dem Prisma-Schema
│       ├── originals/
│       │   ├── v1/             # Erste Version (Original)
│       │   ├── v2/             # Ersetzt durch Nutzer (optional)
│       │   └── …
│       ├── thumbs/             # Miniaturbilder (200x200px, Crop)
│       └── medium/             # Mittelgroße Versionen (max. 1200px)
└── temp/
    └── {session-id}/           # Pro Upload-Session ein eigenes Verzeichnis
```

> **Nutzer-Ordner = UUID:** `User.id` ist eine **UUID**
> (`server/prisma/schema.prisma`: `id String @id @default(uuid())`). Der Ordnername ist diese UUID –
> es gibt **kein** 8-stelliges Zahlenformat. Wird später ein kurzer, stabiler „User-Ref" gewünscht,
> kommt dafür ein eigenes DB-Feld hinzu, und der Ordner folgt diesem Feld.

> **Versionierung:** Ersetzt ein Nutzer eine Datei, wird ein neues Versionsverzeichnis angelegt
> (`v1/`, `v2/`, …). Jede Version erhält einen **eigenen Datenbankeintrag**; die aktuelle Version ist
> als `is_current = true` markiert. Ältere Versionen bleiben erhalten und sind wiederherstellbar.

## 3. Dateinamen

Format: `UUIDv4 (32 Hex-Zeichen, ohne Bindestriche) + "." + Kleinbuchstaben-Endung`

```
550e8400e29b41d4a716446655440000.jpg
6ba7b8109dad11d180b400c04fd430c8.pdf
```

Der Originaldateiname wird **nicht** gespeichert und **nicht** verwendet.

> **Pfadlänge:** UUIDv4 + Endung ≈ max. 37 Zeichen – für Linux-Dateisysteme unkritisch. Bei sehr
> tiefen Pfadstrukturen könnte später auf gekürzte IDs umgestellt werden; bis dahin: volle UUID.

## 4. Datenbank-Speicherung

In der DB wird nur der **relative Pfad** gespeichert:

```
users/1f0c9a2e-…/originals/v1/550e8400e29b41d4a716446655440000.jpg
```

Ein **SHA256-Hash** kann optional zur Deduplizierung gespeichert werden (siehe Abschnitt 14).

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
crop_x / crop_y         # nullable – Crop-Startpunkt (Pixel)
crop_width / crop_height# nullable – Crop-Breite/-Höhe (Pixel)
created_at
```

> Alle `crop_*`-Felder sind `nullable`. Kein Crop = Varianten werden aus dem gesamten Original
> erzeugt. Crop-Koordinaten beziehen sich immer auf die **Originaldatei in Originalgröße**.

## 5. Upload-Prozess (Pflicht-Schritte)

1. **Session-Verzeichnis anlegen:** `/var/heri/media/temp/{session-id}/`
2. **Nutzer-Ordner bestimmen:** `users/{user-uuid}/` (UUID aus `User.id`)
3. **Ordnerstruktur prüfen/anlegen:** `originals/v{n}`, `thumbs`, `medium`
4. **Datei validieren:**
   - Endung (Whitelist) prüfen
   - MIME-Type serverseitig bestimmen, **nicht** vom Client übernehmen (z. B. via `file-type`)
   - Bildinhalt dekodieren/validieren (z. B. via `sharp` – robuster als Endung allein)
   - Dateigröße prüfen
   - **Pixelanzahl** prüfen: `width * height <= 40.000.000` (40 MP) – **vor** jeder Bildverarbeitung,
     schützt vor RAM-Erschöpfung durch manipulierte Dateien
5. **Virus-Scan** (ClamAV o. ä.): Pflicht bei PDFs, empfohlen für alle Typen.
   Bei Befund: Datei löschen, Upload abbrechen, Vorfall loggen.
6. **EXIF-Geodaten entfernen** (siehe Abschnitt 8)
7. **Datei umbenennen:** UUIDv4 + Kleinbuchstaben-Endung
8. **Original speichern** (vollständig, unverändert):
   `users/{user-uuid}/originals/v{n}/{uuid}.{ext}`
9. **Crop-Auswahl entgegennehmen** (nur Bilder, optional) und serverseitig validieren (Abschnitt 6)
10. **SHA256 berechnen** (falls Dedupe aktiv, siehe Abschnitt 14)
11. **DB-Eintrag erstellen** (inkl. `crop_*`, falls vorhanden)
12. **Varianten asynchron** in die Queue einreihen → Job `generate_variants`
13. **Session-Verzeichnis löschen**

> Bei Abbruch/Fehler ab Schritt 8: Session-Verzeichnis aktiv entfernen und **keinen** DB-Eintrag
> anlegen. Halbfertige Uploads dürfen nicht bestehen bleiben.

## 6. Crop-Workflow

Ablauf:
```
1. Nutzer wählt Bild
2. Vorschau im Browser (z. B. Cropper.js)
3. Nutzer zieht optional einen Crop-Rahmen
4. Upload überträgt das vollständige Original
5. Server speichert Original unverändert
6. Crop-Koordinaten separat an den Server → DB
7. Varianten (thumbs/medium) werden anhand der Koordinaten gerendert
```

**Warum nicht client-seitig croppen?** Das Original wird **immer vollständig** gespeichert. Der Crop
beeinflusst ausschließlich die erzeugten Varianten. So kann der Nutzer den Crop jederzeit ändern oder
zurücksetzen, ohne erneut hochzuladen.

Crop nachträglich ändern/zurücksetzen über
`PATCH` / `DELETE /api/tree/:tree/media/:uuid/crop` (siehe `api.md`). Nach einer Änderung wird ein
neuer `generate_variants`-Job eingereiht; alte Varianten werden überschrieben.

**Validierung (serverseitig, Pflicht):**
```
crop_x >= 0
crop_y >= 0
crop_x + crop_width  <= original_width
crop_y + crop_height <= original_height
crop_width  >= 10 px
crop_height >= 10 px
```
> Koordinaten immer gegen die tatsächliche Originaldatei prüfen – niemals blind aus dem Client übernehmen.

## 7. EXIF-Metadaten

- **GPS-Tags werden vor dem Speichern immer entfernt** – Pflicht, unabhängig vom Nutzerwunsch
  (Familienfotos enthalten oft sensible Standortdaten).
- Ergänzbare Felder: `ImageUniqueID = {uuid}`, `Software = Heritago`.
- EXIF dient nur als Zusatzinformation, **nicht** als primäre Zuordnung.

## 8. Animierte GIFs

- Erlaubt. Das **Original** bleibt vollständig (mit Animation) erhalten.
- **Thumbs/Medium** werden nur aus **Frame 1** erzeugt (keine animierten Varianten).
- Ein Crop auf animierte GIFs ist erlaubt, wird aber ebenfalls nur auf Frame 1 angewendet.

## 9. Varianten-Erzeugung (Queue-Job)

Asynchron, blockiert den Upload-Request nicht. Sind Crop-Koordinaten vorhanden, wird zuerst der
Crop-Bereich ausgeschnitten; das Ergebnis ist die Basis für die Skalierung.

```
Bilder:
thumbs  → (Crop →) 200x200px                (GIF: nur Frame 1; JPG/PNG/WebP: als WebP speichern)
medium  → (Crop →) max. 1200px längste Seite (GIF: nur Frame 1; JPG/PNG/WebP: als WebP speichern)

PDFs:
thumbs  → erste Seite rastern, dann 200x200px
medium  → erste Seite rastern, max. 1200px längste Seite
```

> PDFs unterstützen keinen Crop.

## 10. Erlaubte Dateiformate

```
jpg / jpeg · png · gif · webp · pdf
```

Prüfung über Dateiendung (Whitelist) + MIME-Type (serverseitig) + Inhaltsprüfung (Bilder).

> **SVG ist ausdrücklich nicht erlaubt.** SVG kann eingebettetes JavaScript enthalten (XSS-Risiko).
> SVG darf auch zukünftig **nicht** ohne dedizierte Sanitization und strikte CSP zur Whitelist
> hinzugefügt werden.

> **WebP:** WebP-Uploads werden direkt akzeptiert. JPG/PNG werden für `thumbs`/`medium` zusätzlich als
> WebP gespeichert (Bandbreite). Das Original bleibt im Ursprungsformat erhalten.

## 11. Maximale Dateigröße & Upload-Timeout

| Typ       | Limit  | Timeout   |
|-----------|--------|-----------|
| Bilder    | 15 MB  | 2 Minuten |
| Dokumente | 100 MB | 5 Minuten |

> Bei großen Dokumenten verhindert ein Timeout hängende Verbindungen. **Chunked Uploads** sind
> optional sinnvoll bei langsamen Verbindungen.

## 12. Fehlermeldungen an den Nutzer

| Fehlercode             | Nachricht an den Nutzer |
|------------------------|-------------------------|
| `filesize_exceeded`    | „Die Datei ist zu groß. Bilder: max. 15 MB, Dokumente: max. 100 MB." |
| `pixel_limit_exceeded` | „Das Bild hat zu viele Pixel. Bitte auf maximal 40 Megapixel reduzieren." |
| `invalid_mime`         | „Dieses Dateiformat wird nicht unterstützt. Erlaubt: JPG, PNG, GIF, WebP, PDF." |
| `virus_detected`       | „Die Datei konnte nicht hochgeladen werden. Bitte prüfen Sie die Datei." |
| `upload_timeout`       | „Der Upload hat zu lange gedauert. Bitte versuchen Sie es mit einer kleineren Datei." |
| `duplicate_detected`   | „Diese Datei wurde bereits hochgeladen." (nur falls Dedupe aktiv) |
| `invalid_crop`         | „Der gewählte Bildausschnitt ist ungültig. Bitte erneut auswählen." |

> Fehlermeldungen dürfen **keine** internen Pfade, UUIDs oder Stack-Traces enthalten.

## 13. Sicherheitsregeln

- Dateien **nicht** im Webroot speichern und **kein** direkter HTTP-Zugriff.
- Zugriff ausschließlich über die Anwendung (Proxy-Auslieferung: `docs/media/infrastructure.md`).
- **Rate Limiting** beim Upload: max. 20 Uploads pro Nutzer pro Minute (konfigurierbar).
- Upload-Endpunkt ist nur für authentifizierte Nutzer erreichbar.

## 14. Deduplizierung & Versionierung (Klarstellung)

- **Versionierung gilt immer:** Jeder Upload/jede Version erhält einen **eigenen DB-Eintrag**
  (`version`, `is_current`). Ältere Versionen bleiben erhalten.
- **Deduplizierung ist optional und rein speicherplatzbezogen:** Ist sie aktiv und existiert derselbe
  SHA256 bereits, wird die **vorhandene Datei** auf der Platte referenziert (kein zweites Original),
  aber es wird **dennoch ein eigener Media-/Verknüpfungseintrag** für den Nutzer angelegt. So bleiben
  Eigentum, Versionierung und Wiederherstellung pro Nutzer intakt.
- Deduplizierung darf **niemals** über Nutzergrenzen hinweg Zugriff auf fremde Dateien eröffnen.

## 15. Grundprinzipien

1. Medien sind **unveränderlich** gespeichert.
2. **Originaldateien** bleiben stets vollständig und unverändert erhalten.
3. Die **Datenbank** ist die Hauptquelle der Zuordnung.
4. UUID (+ optional SHA256) ermöglichen Wiederherstellung und Deduplizierung.
5. Medien sind vom Webserver **direkt nicht erreichbar**.
6. **GPS-Daten** werden immer aus EXIF entfernt.
7. Fehlerhafte/abgebrochene Uploads hinterlassen **keine Dateileichen**.
8. **Bildvarianten** (thumbs/medium) werden als WebP gespeichert.
9. **PDFs** erhalten eine gerenderte Vorschau (erste Seite).
10. **SVG ist dauerhaft verboten** (ohne dedizierte Sanitization).
11. **Pixelanzahl-Prüfung** schützt vor RAM-Erschöpfung.
12. **Virus-Scan** ist Pflicht bei PDFs.
13. **Varianten-Erzeugung** erfolgt asynchron.
14. **Fehlermeldungen** sind nutzerfreundlich und enthalten keine internen Details.
15. **Versionierung** ermöglicht die Wiederherstellung ersetzter Dateien.
