---
paths:
  - "server/src/**"
  - "src/app/core/services/auth.service.ts"
  - "src/app/core/interceptors/**"
  - "src/app/core/guards/**"
  - "src/app/features/auth/**"
  - "src/app/features/system/**"
  - "src/app/shared/components/app-shell.ts"
  - "src/app/shared/components/navbar.ts"
  - "src/app/shared/components/navbar.html"
---

# Auth, RBAC & Multi-Tenancy

> **Verbindlichkeit:** verbindlich · **Geltungsbereich:** Authentifizierung, Autorisierung, Benutzerverwaltung, Mandanten-Trennung (Tenant Isolation)
> Ergänzend gelten `api.md` (Response-Format, Auth-Endpunkte), `db-first.md`, `backend-first.md`, `workflow.md` (Env/Secrets).
> Ist-Stand (Bestandsaufnahme): `docs/architecture/multi-tenancy-audit.md`.

## 1. Grundsätze (Invarianten)

### 1.1 Tenant-Isolation (nicht verhandelbar)
- Jeder Datensatz gehört genau einem `Tree`. Ein User darf Daten eines Baums **nur** sehen/bearbeiten, wenn:
  1. der Baum `isPublic` ist (dann nur lesend), oder
  2. eine `TreePermission` für `(treeId, userId)` existiert.
- Auch `ADMIN` hat **keinen** automatischen Zugriff auf Baumdaten – er benötigt wie jeder andere eine `TreePermission`. `ADMIN` verwaltet User/Limits, aber keine Baum-Inhalte.
- **Jede** Datenabfrage (Prisma-Query) muss nach `treeId` gefiltert sein. Es gibt **keine** ungefilterten `findMany` auf Fachdaten.
- Die Durchsetzung erfolgt zentral in `treeAuth`; Routen dürfen diese Prüfung **nicht** umgehen.

### 1.2 Backend-First
- Rollenprüfung, Passwort-Validierung, Limits, Verifizierung: **nur im Backend**. Das Frontend rendert lediglich rollenabhängig (keine sicherheitsrelevante Logik im Client).

## 2. Rollenmodell (RBAC)

### 2.1 Globale Rollen (`GlobalRole`)
| Rolle | Bedeutung |
|---|---|
| `ADMIN` | System-Admin: verwaltet User & Limits; kein automatischer Zugriff auf Baumdaten. |
| `USER` | Normaler Nutzer: besitzt/freigegebene Bäume. |
| `GUEST` | Minimal-Rechte (z. B. nur öffentliche Bäume lesen). |

### 2.2 Baum-Rollen (`TreeAccessLevel`)
| Rolle | Rechte |
|---|---|
| `OWNER` | Voller Zugriff inkl. Löschen, Teilen, Rechtevergabe. |
| `EDITOR` | Lesen + Bearbeiten (kein Baum-Löschen, kein Rechte-Management). |
| `VIEWER` | Nur lesen. |
| `COMMENTER` | Lesen + Kommentieren (Notizen/Beiträge), kein Editieren. |

### 2.3 Hierarchie
`ADMIN` > `OWNER` > `EDITOR` > `VIEWER` ≥ `COMMENTER` (global schlägt baum-lokal).

## 3. Benutzerverwaltung (zeitgemäß)

### 3.1 Registrierung & E-Mail-Verifizierung
- Selbstregistrierung mit Benutzername + E-Mail + Passwort.
- Nach Registrierung: **Verifizierungs-E-Mail** mit einmaligem Token (kurze Gültigkeit, z. B. 24 h, serverseitig gehasht gespeichert).
- Konto ist bis zur Verifizierung **nicht aktiv** (kein Login).
- Endpunkte: `POST /api/auth/register`, `POST /api/auth/verify-email`.
- Passwort-Reset nur über E-Mail-Link: `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`.
- **Keine User-Enumeration:** Login/Registrierung/Reset geben bei unbekannter E-Mail dieselbe generische Meldung.

### 3.2 Passwort-Policy (serverseitig erzwungen)
- Mindestens **12 Zeichen**, maximal 64.
- Mindestens **3 von 4** Zeichenklassen (Groß, Klein, Ziffer, Sonderzeichen).
- **Nicht** erlaubt: Benutzername/E-Mail als (Teil des) Passworts, bekannte/geknackte Passwörter (Breached-Password-Check oder Common-Password-Liste).
- Validierung nur im Backend; Passwort mit `bcrypt` (Cost ≥ 12) gehasht, nie im Klartext geloggt.

### 3.3 Bot-Schutz & Rate Limiting
- Rate Limiting auf allen Auth-Endpunkten (`login`, `register`, `verify`, `forgot/reset`) – **pro IP und pro Account**.
- **CAPTCHA** auf Registrierung (und Login nach N Fehlversuchen).
- **Account-Sperre** (temporär) nach N Fehlversuchen beim Login; Entsperren automatisch oder via Reset.
- E-Mail-Verifizierung ist die erste Bot-Abwehr (kein Konto ohne gültige Mail).

### 3.4 E-Mail-Versand
- Transaktionaler Mail-Dienst (SMTP/Provider) über **Umgebungsvariablen** (keine Credentials im Code/Repo).
- Versand: Verifizierung, Passwort-Reset, später Einladungen/Benachrichtigungen.
- Konfiguration in `docs/install.md` dokumentieren (vgl. `workflow.md` Env/Secrets).

### 3.5 Admin-Verwaltung & Navigation
- Admin sieht alle User mit: `username`, `email`, `globalRole`, Verifizierungsstatus, Baum-Anzahl, erstellt am.
- Admin kann: Rolle ändern, User **sperren/entsperren** (suspend), löschen.
- Eigener **Menüpunkt „Benutzerverwaltung“** in der Navigation, **nur** für `ADMIN` sichtbar (Gating über `adminGuard`/`isAdmin`, kein hartes `Dodi`-Hardcoding).
- Admin-Aktionen laufen über dedizierte Endpunkte (`GET/DELETE/PATCH /api/auth/users/...`) mit `requireAdmin`.

## 4. Autorisierung (Middleware-Pflicht)

- Jeder tree-scoped Endpunkt läuft durch `treeAuth` (AuthN + AuthZ).
- Jeder Admin-Endpunkt läuft durch `requireAdmin`.
- Keine Route darf `req.tree`/`req.user` ohne Middleware setzen.
- Fehlerantworten ohne interne Details (kein `_debug`-Objekt in Produktion; vgl. `api.md`).

## 5. Baum-Limits

- `maxTrees` ist **konfigurierbar** (Feld am `User`, Admin-einstellbar), statt hart codiert auf 1.
- Default: `USER` = 5 OWNER-Bäume (mehrere Bäume/Familien möglich), `ADMIN` = unbegrenzt.
- Prüfung serverseitig bei `POST /api/trees`.

## 6. Teilen von Bäumen (Sharing)

- `OWNER` lädt andere User per E-Mail ein (Rolle `VIEWER`/`EDITOR`/`COMMENTER`).
- Einladung = eigener Datensatz `Invitation` (email, treeId, level, tokenHash, expiresAt, claimedAt) + E-Mail-Versand.
- **Ablauf:** Einladung ist **7 Tage** gültig. Sie wird erst aktiv, wenn sich jemand mit **genau dieser E-Mail** registriert **und** verifiziert (→ Umwandlung in `TreePermission`). Kein zweites Owner-Bestätigen nötig – die E-Mail-Verifizierung ist der Sicherheits-Anker.
- Entzug/Änderung der Rolle nur durch `OWNER` oder `ADMIN`; offene Einladungen sind jederzeit widerrufbar.
- Feingranulares Teilen (nur bestimmte Familien) ist Zielbild; das Datenmodell soll dafür erweiterbar bleiben (spätere Berechtigungs-Ebene unterhalb des Baums).

## 7. Cross-Tree-Links

- Verknüpfungen zwischen Personen verschiedener Bäume nur mit `EDITOR`/`OWNER`-Recht auf **beiden** Bäumen.
- **Azyklizität erzwingen** (keine Zirkelbezüge); Validierung im Backend.

## 8. Messaging (Grundsätze)

- Zielbild: Postfach zwischen Usern (Read-Status, Konversation) – getrennt vom GEDCOM-`Communication`-Modell.
- Echtzeit (WebSocket) ist optional; Polling reicht initial.
- Zugriff nur auf eigene Konversationen (User-Isolation).

## 9. Änderungs-Bestätigung & Benachrichtigungen

- **Nur `OWNER` wendet Änderungen direkt an.** Änderungen durch `EDITOR`/`COMMENTER` werden als **Bestätigungsantrag** (`ChangeRequest`, Status `PENDING`) gespeichert – sie sind erst nach Freigabe durch den `OWNER` wirksam.
- Der `OWNER` wird über das **Benachrichtigungssystem** (Glocke) informiert: „User X hat am … Folgendes geändert/vorgeschlagen“.
- Der `OWNER` **bestätigt** (→ Änderung wird angewendet) oder **lehnt ab**.
- Der Ändernde sieht den Status „Wartet auf Bestätigung“ und kann seinen Antrag **stornieren**, solange er `PENDING` ist.
- Benachrichtigungen (`Notification`) sind user-gebunden, haben `readAt` und werden über die Glocke in der Navigation angezeigt.
- **Ablehnung mit Begründung:** `rejectReason` am `ChangeRequest`. Die Begründung wird dem Ändernden als Nachricht zugestellt und zusätzlich benachrichtigt.
- **Konversation:** `ConversationMessage` (gebunden an `ChangeRequest`). Owner und Ändernder können wechselseitig antworten; jede Antwort benachrichtigt die Gegenseite.
- **Änderungsvorschlagsseite (`/change-requests`):** Review-Inbox für alle Anträge (eigene Anträge + Anträge an Bäumen, die man besitzt), getrennt nach „Ausstehend“ und „Erledigt“. Klick auf eine Glocken-Benachrichtigung öffnet den zugehörigen Antrag; dort kann bestätigt, mit Begründung abgelehnt, geantwortet oder (als Ändernder) storniert werden. Die Diskussion (`ConversationMessage`) ist ein untergeordneter Abschnitt des Antrags.
- **Zugriffsschutz:** Die Konversations-Endpunkte sind serverseitig auf den Autor oder den `OWNER` des Baums begrenzt (Tenant-Isolation, § 1.1). Ein Zugriff auf fremde Anträge/Nachrichten ist ausgeschlossen.

