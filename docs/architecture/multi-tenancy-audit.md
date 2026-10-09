# Ist-Analyse: Auth, RBAC & Multi-Tenancy

> **Stand:** 09.10.2026
> **Zweck:** Bestandsaufnahme des vorhandenen Auth-/Rechte-/Mandanten-Fundaments vor der geplanten SaaS-Transformation (Mehrbenutzer, mehrere Bäume pro User, Verknüpfen & Teilen von Bäumen, Messaging).
> **Einordnung:** Dieses Dokument ist eine **Analyse**, keine Regel und keine Feature-Spezifikation. Regeln leben in `.clinerules/`, Zielbilder in `docs/features/`.

## 1. Executive Summary

Heritago ist **keine** Single-User-Anwendung. Das Fundament für Multi-Tenancy ist im **Schema und Backend bereits vorhanden** und wird aktiv von der Middleware `treeAuth` durchgesetzt. Die Lücke liegt primär in (a) der **UI-Schicht** (Teilen, Rechte, Messaging) und (b) dem **Regelwerk** (keine dedizierte Auth/RBAC/Tenant-Regel in `.clinerules/`). Ein Greenfield-Umbau ist **nicht** nötig – es geht um Erweiterung und Formalisierung des Vorhandenen.

## 2. Datenbank (Prisma-Schema)

Pfad: `server/prisma/schema.prisma`

| Baustein | Status | Details |
|---|---|---|
| `enum GlobalRole` | ✅ | `ADMIN`, `USER`, `GUEST` |
| `enum TreeAccessLevel` | ✅ | `OWNER`, `EDITOR`, `VIEWER`, `COMMENTER` |
| `model User` | ✅ | `id` (UUID), `username` (unique), `email` (unique), `password?`, `globalRole` (default `USER`), `isEmailVerified`, Relationen `permissions`, `sentCommunications`, `receivedCommunications` |
| `model Tree` | ✅ | `id`, `name` (unique), `isPublic` (default `false`), Relationen `permissions`, `communications`, alle Fachdaten |
| `model TreePermission` | ✅ | `treeId`, `userId`, `level` (TreeAccessLevel), `privacyOverride?`, `@@unique([treeId, userId])` |
| `model Communication` | ⚠️ teilweise | `treeId`, `senderId`, `recipientId?`, `subject`, `body`, `date` – **GEDCOM-Stil**, kein Read-Status, kein Threading |

## 3. Backend – Authentifizierung & Autorisierung

### 3.1 Middleware (`server/src/middleware/`)

| Datei | Funktion |
|---|---|
| `authJwt.ts` | JWT aus HttpOnly-Cookie `auth_token` verifizieren, `req.user` setzen; bei ungültigem Token nur `next()`. Refresh-Cookie `refresh_token`. |
| `devAuth.ts` | Nur Dev: fallback über `x-user-id`-Header; in `production` mit `401` geblockt. |
| `treeAuth.ts` | **RBAC-Kern:** (1) Admin-Bypass → `OWNER`, (2) `isPublic` + `GET` → `VIEWER`, (3) `TreePermission`-Lookup, (4) Schreib-Check (`POST/PUT/PATCH/DELETE` erfordern `OWNER`/`EDITOR`, sonst `403`). Setzt `req.tree` + `req.permission`. |

### 3.2 Auth-Endpunkte (`server/src/routes/auth.routes.ts`)

- `POST /api/auth/login`, `/register`, `/refresh`, `/logout`
- `GET /api/auth/me` (erfordert Auth) → `id`, `username`, `email`, `globalRole`, `isAdmin`
- **Admin-User-Verwaltung (vorhanden):** `GET /api/auth/users`, `DELETE /api/auth/users/:id`, `PATCH /api/auth/users/:id/role` – hinter `requireAdmin`.
- JWT: Access `1h`, Refresh `7d`; Cookies `httpOnly + secure(prod) + sameSite=strict`.

### 3.3 Tree-Endpunkte (`server/src/routes/tree.routes.ts`)

- `GET /api/trees`: Admin → alle Bäume; sonst → Bäume mit `permissions.some({ userId })`.
- `POST /api/trees`: legt Baum an **und** erzeugt `TreePermission(level: OWNER)` für den Ersteller.
- `PUT /api/tree/:id`, `DELETE /api/tree/:id`.

### 3.4 Wichtiger Befund: hartes 1-Baum-Limit

In `server/src/services/tree.service.ts` (Z. 50–64) wird für Nicht-Admins ein **fest verdrahtetes Limit von genau einem OWNER-Baum** erzwungen („Du kannst nur einen Stammbaum besitzen.“). Es gibt **kein** konfigurierbares `maxTrees`-Feld und keine Admin-Einstellung dafür.

## 4. Frontend (Angular)

- `core/services/auth.service.ts`: `login`, `me`, Admin-Methoden (`getUsers`, `deleteUser`, `updateUserRole`).
- `core/interceptors/auth.interceptor.ts`: JWT-Refresh via `BehaviorSubject`.
- `features/system/user-management.ts`: **Admin-UI vorhanden** (Benutzerliste inkl. `_count.permissions`, Rolle ändern, löschen; Benutzer `Dodi` hart geschützt).

## 5. Gap-Analyse (Was fehlt)

| Lücke | Beschreibung |
|---|---|
| **Tree-Sharing / Einladungen** | Kein Endpunkt und keine UI, um einem anderen User `TreePermission` zu erteilen/entziehen. Größte funktionale Lücke (vgl. `docs/database/db-todo.md`). |
| **Konfigurierbares Baum-Limit** | Limit ist hart auf 1 (OWNER) codiert; kein `maxTrees`-Feld, keine Admin-Einstellung. |
| **Feingranulares Teilen (Familien)** | `TreePermission` ist nur Baum-Ebene; Teilen einzelner Familien existiert nicht. |
| **Cross-Tree-Links** | Kein Modell, um Person A (Baum 1) ↔ Person B (Baum 2) zu verknüpfen (inkl. Azyklizitäts-Regel). |
| **Messaging als Postfach** | `Communication` ist GEDCOM-flavor: kein Read-Status, kein Threading, keine Endpunkte/UI. |
| **Regelwerk** | Keine dedizierte Auth/RBAC/Tenant-Isolations-Regel in `.clinerules/` (nur JWT-Abschnitt in `api.md`). |
| **Rate Limiting** | Nicht implementiert (keine Library); `api.md` fordert es nur als „sollte“. |
| **`privacyOverride`** | Nullable, keine UI, Semantik undefiniert. |

## 6. Sicherheitshinweise (auffällig)

- `treeAuth` liefert im `403`-Fall ein `_debug`-Objekt (userId, treeId, role) mit – interne Details, die in Produktion nicht nach außen dürfen.
- `devAuth` (`x-user-id`) ist in `production` geblockt – korrekt, aber bei Hosting zu prüfen.
- `console.log`/`console.warn` in Middleware sind als Dauerlogging in Produktionspfaden ungeeignet (`workflow.md`).

## 7. Empfehlung für die nächsten Schritte

1. **Regelwerk erweitern** (nächster Schritt): neue Datei `.clinerules/auth-rbac.md` mit (a) Tenant-Isolation als Invariante, (b) RBAC-Hierarchie, (c) zwingende AuthN+AuthZ-Middleware je Endpunkt, (d) Regeln für Teilen (Baum vs. Familie), (e) Azyklizität für Cross-Tree-Links.
2. **Zielbild** in `docs/features/` (z. B. `multi-tenancy.md`) für Hosting/Mehrbäume/Verknüpfen/Messaging.
3. **Iterativ umsetzen:** zuerst User-/Rollen-Verwaltung & Baum-Limit, dann Tree-Sharing, dann Messaging.
