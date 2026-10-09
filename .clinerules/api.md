---
paths:
  - "server/src/**"
---

# API-Konventionen

> **Verbindlichkeit:** verbindlich · **Geltungsbereich:** HTTP-API des Backends · **Aktivierung:** `paths: server/src/**`

**Neue** Endpoints halten diese Konventionen zu 100 % ein. Legacy-Code wird schrittweise gemäß
Migrations-Guideline angepasst; Ausnahmen gibt es nur mit schriftlicher Genehmigung.

## Basisregeln

- **Alle Ressourcen-Endpunkte sind tree-scoped**: `/api/tree/:tree/...` für alle Daten, die zu einem
  konkreten Baum gehören.

## Unscoped-Endpunkte

Nur erlaubt für:
- Auth (`/api/auth/*`)
- System (`/api/health`; ein `/api/version` ist optional/geplant)
- Tree-Verwaltung (Collection-Routen wie `/api/trees`)
- **Me-scoped Ressourcen** (`/api/change-requests/*`): benutzergebundene Endpunkte, die über Bäume
  hinweg arbeiten, aber **ausschließlich** Daten des angemeldeten Users liefern/bearbeiten
  (Inbox-/Postfach-Prinzip, analog `/api/auth/me`). Jeder Zugriff wird strikt gegen `req.user.id`
  gefiltert (Autor **oder** `OWNER` des Baums) – Zugriff auf fremde Datensätze ist ausgeschlossen.

**Legacy (bis zur Migration toleriert, siehe Migrations-Guideline):**
- `/api/family/*` und `/api/media/*` existieren noch als **unscoped** Varianten parallel zu den
  tree-scoped Routen. Diese nicht erweitern und nicht neu nachbauen – bei Arbeit an diesen Bereichen
  die tree-scoped Variante verwenden und die Legacy-Route schrittweise abbauen.

## Tree-Scope

`/api/tree/:tree/...`

`:tree` ist:
- ein Baum-**Name** (Slug, bevorzugt), oder
- eine Baum-**UUID** (Fallback für API-Clients).

Tree-scoped Routen müssen Zugriffsrechte validieren (Scope-Middleware, `server/src`).

## Auth

- Auth läuft ausschließlich über **JWT in HttpOnly + Secure + SameSite=Strict Cookies**.
- Cookie `auth_token` (Access-Token) – **aktuell 1 h**. Zielwert aus Sicherheitsgründen: 15 min;
  Wert und diese Regel bei Änderung gemeinsam anpassen.
- Cookie `refresh_token` – **7 Tage**, nur für `POST /api/auth/refresh`.
- Das Frontend sendet `withCredentials: true` / `credentials: 'include'`.

Endpunkte:
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET  /api/auth/me`

## Response-Format

### Erfolg

```json
{ "success": true, "data": {} }
```

`data` ist ein beliebiges JSON-Objekt/-Array. Legacy-Felder (z. B. `tree`, `person`) werden bis zur
Migration toleriert.

### Fehler

Einheitliches Format:

```json
{
  "success": false,
  "message": "Der Baum-Name existiert bereits.",
  "code": "TREE_NAME_CONFLICT"
}
```

- `code` ist **Pflicht** (vorhersehbares Frontend-Verhalten).
- `message` ist **nutzerfreundlich auf Deutsch**.
- HTTP-Status konsistent:
  - `400` Validierungsfehler
  - `401` nicht authentifiziert
  - `403` nicht autorisiert
  - `404` nicht gefunden
  - `409` Konflikt (z. B. doppelter Baum-Name)
  - `500` unerwarteter Fehler

## Medien-Endpunkte (tree-scoped)

Medien sind Ressourcen eines Baums und daher tree-scoped:

```
POST   /api/tree/:tree/media                 # Datei hochladen
GET    /api/tree/:tree/media/:uuid           # Metadaten abrufen
GET    /api/tree/:tree/media/:uuid/download  # Datei herunterladen (auth required)
DELETE /api/tree/:tree/media/:uuid           # Datei löschen
PATCH  /api/tree/:tree/media/:uuid/crop      # Crop-Koordinaten setzen/ändern
DELETE /api/tree/:tree/media/:uuid/crop      # Crop zurücksetzen (gesamtes Bild)
```

- Alle Endpunkte erfordern Authentifizierung und Rate Limiting.
- Antworten enthalten **niemals** absolute Dateipfade.
- Speicherung, Validierung und Crop-Details: siehe `media-upload.md`.

## Migrations-Guideline (Legacy)

Legacy-Endpunkte mit nicht-standardisierten Antworten in dieser Reihenfolge migrieren:

1. `code`-Feld in allen Fehlerantworten ergänzen.
2. Erfolgs-Payloads in `data` wrappen.
3. Unscoped-Ressourcen-Routen entfernen (tree-scoped bevorzugen).

## Security-Hinweise

- `logout` löscht beide Cookies; Refresh-Tokens können serverseitig geblacklistet werden (z. B. Redis).
- Alle Endpunkte sollten rate-limited sein.

## Versionierung

- **Kein** `/v1`-Präfix (Bestand läuft unter `/api/...`).
- Breaking Changes werden über einen Response-Header (z. B. `X-API-Version`) und im Changelog dokumentiert.
