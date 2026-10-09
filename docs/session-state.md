# Session-State & Arbeitsstand

> **Stand:** 09.10.2026
> **Zweck:** Wiederaufsetzpunkt für eine neue Session. Enthält Ziel, Ist-Stand, was in der
> letzten Sitzung umgesetzt wurde, offene Punkte und wie man den Stand testet/startet.
> **Einordnung:** Dieses Dokument ist eine **Arbeitsnotiz**, keine Regel und keine
> Feature-Spezifikation. Regeln leben in `.clinerules/`, Zielbilder in `docs/features/`,
> Architektur-Analysen in `docs/architecture/`.

---

## 1. Übergeordnetes Ziel

1. **Multi-Tenancy-/Datenschutzlücken schließen** (Tenant-Isolation, Baum-Zugriff).
2. **Bestätigungs-/Benachrichtigungsworkflow** für Änderungen durch Nicht-Besitzer
   (`EDITOR`/`COMMENTER`) an Stammbäumen implementieren.
3. Daraus eine **Konversation/Messaging** zwischen Besitzer und Vorschlagendem ableiten
   (Ablehnung mit Begründung → Antwort → echter Chat).

---

## 2. Erledigt (Gesamtstand)

### 2.1 E-Mail-Einladungen (Tree-Sharing)
- Schema `Invitation` (email, treeId, level, tokenHash, expiresAt, claimedAt).
- Backend-Service/-Routen, Frontend-UI im Tree-Management.
- 7-Tage-Gültigkeit; **Auto-Claim** nach E-Mail-Verifizierung → Umwandlung in `TreePermission`.

### 2.2 Datenschutz-Fix (Tenant-Isolation)
- **Admin-Bypass** aus `treeAuth` entfernt (Admin hat keinen automatischen Zugriff auf Baumdaten).
- Ungeschützter Tree-Resolver in `tree.routes.ts` abgesichert:
  öffentlich lesbar **ODER** `TreePermission`, sonst `403`.
- `GET /trees` liefert für alle nur noch **eigene** Bäume.

### 2.3 Bestätigungs-Workflow (Basis)
- Modelle `ChangeRequest` (Status `PENDING`/`APPROVED`/`REJECTED`/`CANCELLED`) und `Notification`.
- Backend-Services/-Routen; Frontend-Glocke (Navbar) und Prüf-Dialog im Tree-Management.
- End-to-End getestet: `PENDING` → `APPROVED`, Storno → `CANCELLED`.
- `.clinerules/auth-rbac.md` um § 9 (Änderungs-Bestätigung & Benachrichtigungen) + angepasste
  Invarianten/Rollen erweitert.

### 2.4 Testdaten bereinigt
- `admin_test`, `helfer` (Vorgänger), `Peter Probe`, alte ChangeRequests/Notifications gelöscht.
- `helfer@example.com` neu als **EDITOR** am Demo-Baum angelegt (für manuellen Test).

---

## 3. Diese Session: Konversation & Nachrichtenseite

> Auslöser: Besitzer (`musterfamilie`) klickte auf die Glocken-Benachrichtigung – es passierte nur
> „Schrift wird heller“, keine Möglichkeit zu bestätigen/abzulehnen. → UX-Fix + Ablehnung mit
> Begründung + Konversation + Nachrichtenseite.

### 3.1 Datenmodell
- `ChangeRequest.rejectReason` (nullable, Ablehnungsbegründung).
- Neues Modell `ConversationMessage`:
  `id`, `changeRequestId`, `senderId`, `body`, `createdAt` (Cascade-Delete am ChangeRequest/User).
- `User.sentMessages`-Relation.
- Migration: `server/prisma/migrations/20261009160000_add_conversation_messages/migration.sql`
  (**bereits angewendet** via `npx prisma migrate deploy`).

### 3.2 Backend
- `ChangeRequestService`:
  - `reject(treeId, id, reviewedById, reason?)` → speichert `rejectReason`, legt Begründung als
    Nachricht ab, benachrichtigt den Vorschlagenden.
  - `approve(...)` → benachrichtigt den Vorschlagenden jetzt ebenfalls.
  - `addMessage(changeRequestId, senderId, body)` → Antwort anlegen + **Gegenseite** benachrichtigen.
  - `listRelevant(userId)` → eigene Anträge + Anträge an Bäumen, die man als `OWNER` besitzt.
- Routen:
  - `change-request.routes.ts`: `POST /:id/reject` akzeptiert `{ reason }`.
  - `change-request.me.routes.ts`: `GET /` → `listRelevant`, neu `GET /:id`, `POST /:id/messages`.

### 3.3 Frontend
- `core/services/change-request.service.ts`: `reject(...)` mit `reason`, neu `getChangeRequest(id)`,
  `addMessage(id, body)`.
- Neue Seite **„Nachrichten"** (`features/messages/messages.ts` + `.html`), Route `/messages`
  (auth-geschützt im AppShell).
  - Links: Konversationsliste. Rechts: Thread mit Nachrichten, Antwortfeld,
    **Bestätigen/Ablehnen** (mit Pflicht-Begründung), Stornieren (als Vorschlagender).
- `navbar.ts`: `openNotification(n)` → als gelesen markieren **und** bei `CHANGE_REQUEST` nach
  `/messages?open=<changeRequestId>` navigieren.
- `navbar.html`: Glocken-Klick → `openNotification`; neuer Nav-Link **„Nachrichten"**
  (Desktop + Mobile, für jeden eingeloggten User sichtbar).

### 3.4 Doku
- `.clinerules/auth-rbac.md` § 9 ergänzt: Ablehnung mit Begründung, `ConversationMessage`,
  Nachrichtenseite `/messages`.
- `.clinerules/auth-rbac.md` § 9: „Zugriffsschutz" ergänzt (Konversations-Endpunkte nur Autor/OWNER).
- `.clinerules/api.md`: Kategorie **„Me-scoped Ressourcen"** (`/api/change-requests/*`) ergänzt.

### 3.5 Regel-Review (Nacharbeiten)
- **Tenant-Isolation-Fix:** `getChangeRequest`/`addMessage` waren zunächst ungefiltert (jeder
  authentifizierte User konnte fremde Anträge lesen/beschreiben). Behoben: `findFirst` mit
  `OR [ { userId }, { tree.permissions.some OWNER } ]`.
- **Control-Flow:** `messages.html` nutzte `*ngIf`/`*ngFor` → auf `@if`/`@for` migriert (ui.md).
- **Bekannter Drift (nicht angetastet):** `ui.md` schreibt `OnPush` vor, die Codebase nutzt für
  Feature-Seiten durchgängig `ChangeDetectionStrategy.Eager`. Folgeaufgabe: Regel präzisieren oder
  Codebasis migrieren.

### 3.5 Verifikation dieser Session
- Backend-Build (`tsc`) ✅
- Frontend-Build (`ng build`) ✅
- Migration angewendet ✅
- Server startet fehlerfrei, `/api/health` → `{"status":"ok"}` ✅
- `./scripts/smoke-test.sh`: Frontend-Build + Backend-Build grün; 2 Fehlschläge nur weil der
  Server (Port 3000) nicht lief – kein Code-Problem.

---


---

## 3b. Fortsetzung: Review-Inbox & Admin-Stammbaumverwaltung

> Auslöser: (1) Admin löschte andere User → deren `OWNER`-Bäume blieben **verwaist** zurück
> (`deleteUser` räumt Bäume nicht auf). (2) Die „Nachrichten“-Seite vermischte Review-Inbox und
> Chat und war dadurch unübersichtlich.

### Admin-Stammbaumverwaltung (Neu)
- Middleware `requireAdmin` extrahiert → `server/src/middleware/requireAdmin.ts`.
- Route `server/src/routes/admin-trees.routes.ts` unter `/api/admin`:
  `GET /trees` (Metadaten + `isOrphaned` + owners/collaborators/counts, **keine** Fachdaten),
  `PATCH /trees/:id/owner` (Besitzer neu zuweisen, heilt verwaiste Bäume).
- `TreeService.listAllTreesForAdmin()` / `reassignTreeOwner()`.
- Frontend `features/system/tree-administration.ts` + Route `/admin/trees` (adminGuard) + Navbar-Link.

### Review-Inbox „Änderungsvorschläge“ (Umbau)
- `/messages` → **`/change-requests`** (Route, Navbar, Glocken-Navigation).
- Komponente `features/change-requests/` (ersetzt `features/messages/`).
- Links getrennt nach **„Ausstehend“** / **„Erledigt“** (Badge-Zähler) + „Wartet auf dich“-Badge.
- Rechts klarer Aufbau: Vorgeschlagene Änderung → Bestätigen/Ablehnen → Diskussion (Chat untergeordnet).
- `.clinerules/auth-rbac.md` § 9 an `/change-requests` angepasst.

### deleteUser-Fix (verwaiste Bäume verhindern)
- `auth.service.ts` `deleteUser()` blockiert jetzt, solange der User **alleiniger OWNER** eines
  Baums ist → Fehler `ADMIN_USER_OWNS_TREES` (409) mit Liste der betroffenen Bäume.
- Route reicht `message`/`code` durch; `user-management.ts` zeigt die konkrete Meldung.
- Verifiziert: `DELETE /api/admin/users/testhelfer` → 409 „… alleiniger Besitzer von 1 Stammbaum
  (Familie Muster) …“.

### Verifikation
- Backend-Build (tsc) ✅, Frontend-Build (ng build) ✅.
- API-Test: `GET /api/admin/trees` liefert verwaisten Baum; `PATCH .../owner` heilt ihn.

### DB-Zustand (Achtung)
- Test-User `testhelfer` (Passwort `heritago123`) angelegt; verwaister Baum `familie-muster` ihm
  testweise zugewiesen (nicht mehr verwaist).

### Update-Seite (`/settings/update`) – Security-Fix
- **Befund (verifiziert):** `app.use('/api/system', systemRoutes())` lag **ohne** Auth-Middleware.
  `POST /api/system/update` war offen erreichbar und führte `git checkout tags/${tag}` mit
  ungeprüftem `tag` aus einer Shell aus → **Command Injection** + unautorisierte Updates.
- **Fix 1 – Autorisierung:** in `server/src/index.ts` nun `requireAdmin(prisma)` vor `systemRoutes()`.
  Alle `/api/system/*` (info, check-update, update) sind jetzt **ADMIN-only**.
- **Fix 2 – Injection:** `exec` → `execFile` (kein Shell) + Whitelist
  `TAG_PATTERN = /^v?\d+\.\d+\.\d+$/` → ungültige Tags liefern `400 VALIDATION_ERROR`, **bevor**
  irgendein git-Befehl startet.
- **Fix 3 – Fehler-Leak:** `data: { error: … }` (roher git-Output/Pfade) entfernt; Meldungen jetzt
  deutsch gemäß `api.md` (`SYSTEM_INFO_FAILED`, `SYSTEM_UPDATE_CHECK_FAILED`, `SYSTEM_UPDATE_FAILED`).
- **Frontend:** `update-settings.ts` sendet `credentials: 'include'` (api.md-Konvention).
- **Verifikation:** Backend-Build (tsc) ✅, Frontend-Build (ng build) ✅.
  Live-Tests: `GET /info` ohne Auth → 401, mit Admin → 200; `POST /update` ohne Auth → 401;
  Injection `{"tag":"v0.0.8; echo INJECTED"}` → 400 (nichts ausgeführt); Repo unverändert.
- **Bewusst nicht geändert (außerhalb Scope):** die Update-Mechanik selbst
  (`git fetch --tags` + `git checkout tags/{tag}`) erzeugt weiter einen **detached HEAD** und führt
  **kein** `npm install`/Rebuild/Restart aus → ein „Update" ist erst nach manuellem Deploy wirksam.

### Update-Seite (`/settings/update`) – Versionsanzeige repariert
- **Befund (verifiziert):** Der Badge „Installierte Version" blieb leer; die Kacheln Node.js/Platform
  zeigten „...". Ursache: Das Frontend entpackte die API-Antwort nicht. Die Endpunkte liefern
  `{ success, data: {...} }` (siehe `api.md`), gelesen wurde aber `this.systemInfo = data` bzw.
  `data.currentVersion` statt `data.data.*`. Alle drei Aufrufe (`info`, `check-update`, `update`)
  waren betroffen – dadurch waren auch `updateStatus.currentVersion`/`updateResult.message` leer.
- **Zweitursache:** Die Versionsanzeige hing ausschließlich an der GitHub-API (`check-update`).
  Ohne `GITHUB_TOKEN` (Limit 60 req/h) oder offline blieb sie leer.
- **Fix – Backend (`system.routes.ts`):** neue Helper `runGit` / `readGitInfo` / `formatDate` liefern
  lokale Git-Metadaten (Tag, Commit, Branch, Commit-Datum). Diese IDs sind identisch mit denen auf
  GitHub, funktionieren aber **ohne** GitHub-API. `GET /info` liefert nun `gitTag`, `gitCommit`,
  `gitBranch`, `gitCommitDate`, `gitDescribe`, `repositoryUrl` (plus `version` aus der
  Root-`package.json`); `check-update` und `update` geben dieselben Felder mit aus. Das Datum wird im
  Backend deutsch formatiert (backend-first). Nebenbefund: `git config --global --add safe.directory`
  lief pro Request und wuchs unbegrenzt – jetzt einmalig beim Start via `--replace-all`.
- **Fix – Frontend (`update-settings.ts` / `update-settings.html`):** korrektes Entpacken von
  `data.data`; der Badge zeigt den Release-Tag, darunter eine Commit-Zeile
  (`Commit 5fb6d98f23 · v0.0.8-53-g5fb6d98f23`) mit Link auf
  `github.com/dodi110480/heritago/commit/<sha>`; die Kacheln zeigen nun Node.js, Platform, Branch und
  Build-Datum. Der Badge wird bereits von `/info` gefüllt und bleibt daher auch dann sichtbar, wenn
  GitHub nicht erreichbar oder rate-limited ist.
- **Verifikation:** Backend-Build ✅, Frontend-Build ✅ (nur die bekannte Budget-Warnung).
  `GET /api/system/info` (Admin) → `gitTag: v0.0.8`, `gitCommit: 5fb6d98f23`, `gitBranch: main`,
  `gitCommitDate: 09.10.2026, 13:56`. Die Frontend-Bindung wurde per Node-Smoke-Test gegen die
  Live-API nachgestellt. Ein visueller Browser-Check war nicht möglich (kein X-Server/`xvfb`).
- **Hinweis zur Anzeige:** `v0.0.8` ist der **letzte Release-Tag**; der installierte Stand ist laut
  `gitDescribe` `v0.0.8-53-g5fb6d98f23`, also **53 Commits nach** dem Release. Der Commit-Hash in der
  UI macht den Stand eindeutig zuordenbar.

### Design-Fundament: zentrale Tokens statt toter Klassen

Ausgangslage war die Rückmeldung, dass das Design „nicht aus einem Guss" wirke, Kontraste fehlen
(„linux" unlesbar, Kacheln zu hell) und Ecken mal rund/mal eckig seien. Ursache war **nicht**
fehlender Wille zur Zentralisierung, sondern ein Konfigurationsfehler mit großer Reichweite.

**Root Cause 1 – Palette gelöscht:** `src/styles.css` beginnt mit `--color-*: initial` und legt nur
~50 Tokens neu an. Dadurch existieren die Tailwind-Standardfarben (`emerald`, `amber`, `red`,
`purple`, `blue`, `gray`, `green`, `rose`, `teal`, `pink` …) **nicht mehr**; Tailwind generiert für
sie **kein CSS**. Ungenutzte Klassennamen sind wirkungslos – verifiziert gegen das Build-CSS:
`bg-emerald-500`, `text-emerald-400`, `bg-amber-500`, `bg-blue-100`, `text-blue-800` → **FEHLT**.
Zusätzlich waren **nie definierte** Projet-Tokens in Gebrauch: `brand-900`, `brand-200`,
`neutral-black`.

- Umfang: **143 Vorkommen in 21 Dateien**.
- Wirkung: Der „Kein Update verfügbar"-Kasten (`bg-emerald-500/10`) hatte **keinen Hintergrund**,
  Code-Boxen (`bg-neutral-black/40`) waren transparent, die Notiz-/Quellen-Kategorie-Badges
  (`app-notes-list.ts`, `app-sources-list.ts`) **farbenlos** – projektweit, da die Komponente
  überall eingesetzt wird.

**Root Cause 2 – `modal-*`-Klassen undefiniert:** Auf allen fünf Auth-Seiten wird
`class="modal-container bg-neutral-400"` plus `modal-glass` / `modal-glow-brand` /
`modal-glow-highlight` / `form-group` / `form-error` verwendet – **keine dieser Klassen war irgendwo
definiert**. Der einzige wirksame Style war `bg-neutral-400` (`#94a3b8`, helles Blau-Grau) → der
helle Block über dem dunklen Hintergrund auf dem Login-Screen.

**Root Cause 3 – Dark-Mode nie aktiv:** `src/index.html` setzte `.dark` ausschließlich nach
`prefers-color-scheme`. Bei hellem System blieben **333 `dark:`-Styles inaktiv** und die für dunkel
geschriebenen Seiten (Settings/Update: `text-neutral-200`, `bg-brand-900/40`) wurden hell gerendert.

**Root Cause 4 – Radius/Layout nicht zentral:** `--radius-card: 0.2rem` (glass-card = fast eckig)
gegen ad-hoc `rounded-2xl` (1 rem) / `rounded-3xl` / `rounded-[32px]` in den Templates.

**Root Cause 5 – Race Condition auf der Update-Seite:** `ngOnInit()` startet `loadSystemInfo()`
(`/api/system/info`) und `checkUpdate()` (`/check-update`) **parallel**. `/check-update` liefert die
Git-Felder nicht, rief aber `applyInstalledInfo()` auf und **überschrieb** die von `/info` gesetzten
Werte mit `null` → BRANCH/BUILD/Commit zeigten „—".

**Umsetzung (Fundament, Seiten-Layouts unverändert):**

| Maßnahme | Datei |
|---|---|
| **Gold-Palette** `brand-50…950` (statt Indigo) + fehlende Stufen ergänzt | `src/styles.css` |
| **Canvas** Türkis `#8cc4c1` → Anthrazit `#15151b` / `#0c0c10` | `src/styles.css` |
| Glass, `ui-bg/-border/-card` auf dunklen Grund + goldener Schimmer | `src/styles.css` |
| **Radius zentral**: `--radius-sm…4xl` überschrieben → `rounded-xl/2xl/3xl` laufen nun auf **0.75 rem** zusammen; `--radius-card/-btn/-modal` | `src/styles.css` |
| Schatten `--shadow-brand-glow/-sm` Indigo → Gold; `.glass-card`-Hover entschärft (`-translate-y-2` + `scale-1.01` → `-translate-y-1`) | `src/styles.css` |
| **Border-Fallback** `var(--color-gray-200)` (gelöscht → `currentcolor`!) → `var(--color-ui-border)` | `src/styles.css` |
| **Edle Schrift**: `Cormorant Garamond` **selbst gehostet** (`public/fonts/`, Variable Font, `300 700`); `@layer base` setzt `h1–h4` auf `--font-display` | `src/styles.css`, `public/fonts/` |
| **Dark-First**: `.dark` wird dauerhaft gesetzt | `src/index.html` |
| **`modal-container` / `modal-glass` / `modal-glow-*` / `form-group` / `form-error` zentral definiert** (Glass + Gold-Glow); `bg-neutral-400` von allen 5 Auth-Seiten entfernt | `src/styles.css`, `src/app/features/auth/*` |
| **143 tote Klassen gemappt** auf die Token-Familien: `emerald/green/teal`→`accent-success`, `amber/yellow`→`accent-highlight`, `red/rose/pink`→`accent-danger`, `blue/purple/indigo`→`accent-violet`, `gray`→`neutral`; `accent-emerald-*`→`accent-success-*` usw. | 22 Dateien in `src/app/**` |
| `bg-neutral-black` → `bg-canvas-black` | 3 Dateien |
| **Dark-on-Dark gefixt**: `text-neutral-900/800/700` **ohne** `dark:`-Variante → `+ dark:text-neutral-100/200/300` | 17 Dateien |
| `app-page-header` Titel: `text-neutral-900` → `+ dark:text-brand-100` (Titel war dunkel auf dunkel) | `src/app/shared/components/ui/app-page-header.ts` |
| `applyInstalledInfo()` überschreibt nur noch **vorhandene** Werte (Race-Condition-Fix) | `src/app/features/system/update-settings.ts` |

**Verifikation:**

- Frontend-Build ✅, Backend-Build ✅ (nur bekannte Budget-Warnung 510 kB > 500 kB).
- Gegen das neu erzeugte Build-CSS geprüft: `bg-accent-success-500`, `text-accent-highlight-400`,
  `bg-accent-danger-500`, `bg-accent-violet-500`, `bg-brand-900`, `bg-canvas-black` → **OK**;
  `--radius-2xl: .75rem` aktiv; `@font-face` + `.font-display` vorhanden; Font unter
  `/fonts/cormorant-garamond.woff2` → HTTP 200 (37 640 B).
- **Visueller Browser-Check** (headless Chrome, `--screenshot`): Login, Dashboard,
  `/settings`, `/settings/update`, `/admin/users` geprüft. Geschützte Seiten wurden über einen
  temporären Dev-Proxy (`:4300` → `:4200`, injiziert `X-User-Id` für `devAuth`) aufgerufen.
  Ergebnis: dunkler Anthrazit mit Gold, einheitlich runde Ecken, Serif-Überschriften,
  **„linux" lesbar**, BRANCH `main` / BUILD `09.10.2026, 13:56` / COMMIT `5fb6d98f23`.
- Backup der Vorher-Dateien: `/tmp/heritago-backup/src-app-before-mapping.tgz`.

**Bewusst NICHT geändert (Folgearbeit):** Seiten-Layouts/Strukturen (z. B. Settings-Kacheln auf
`app-glass-card` umstellen), konkurrierende Karten-Wrapper (`bg-canvas-white/5` 33×, `bg-ui-card` 2×),
Navbar-Überlauf auf dem Dashboard.

---

### Karten & Rahmen: warum zwei Seiten unterschiedlich aussahen

**Beobachtung des Nutzers:** `/tree-management` wirke „dicker gerahmt" als `/admin/users`.

**Messung (headless Chrome, Pixel-Analyse der Screenshots):** Der 1 px-Rahmen selbst war auf beiden
Seiten **pixelgenau identisch** – `rgba(201,162,39,0.16)` (`.glass-card`) blendet zu `(59,51,27)`,
Luminanz 51.0 vs. 51.2. Der wahrgenommene Unterschied kam **nicht** vom Rahmen, sondern von den
Overrides drumherum:

| Ursache | Vorher (`tree-management`) | Zentraler Standard (`admin/users`) |
|---|---|---|
| **Eckenradius** | `rounded-3xl!` → `.875rem`, Kurve `43,40,38,37,36,35,34,34,33,33,32` | `rounded-card` → `.75rem`, Kurve `41,39,37,36,35,34,33,33,33,32` |
| **Schatten** | `shadow-lg` ersetzt `shadow-card-light` → verliert den hellen Inset-Highlight | `shadow-card-light` (3 Lagen inkl. `inset 0 1px 1px rgba(255,255,255,.15)`) |
| **Hover-Hintergrund** | `hover:bg-surface/60` → Token **existiert nicht** (toter Code) | – |
| **Form-Box** | `rounded-[40px]!` → umgeht die Token-Skala komplett (40 px statt 12 px) | – |

**Zusätzlich gefunden (echte Dark-Mode-Bugs):** `border-neutral-200` = `#e2e8f0` – ein fast weißer
Rahmen an **13 Stellen ohne `dark:`-Variante** (Modals in `tree-management`, `dashboard`, das
Glocken-Dropdown in `navbar`, `gedcom-io`-Dropzone, `image-cropper`, `media-gallery`). Auf Anthrazit
(`#15151b`) ergibt das ~14:1 Kontrast und wirkt wie ein **dicker greller Rahmen**.

**Behoben:**

- `tree-management.html`: `rounded-3xl!`, `rounded-[40px]!`, `shadow-lg`, `hover:bg-surface/60` entfernt
  → nutzt jetzt Radius, Schatten und Hover aus `.glass-card`. Modals auf `border-glass-border`.
- 13× `border-neutral-200` → `border-glass-border` bzw. `border-ui-border` (Trenner/Dropzones);
  `bg-neutral-100`/`bg-neutral-50/50` (helle Kästen) → `bg-canvas-white/5`.
- Toter Token `bg-surface` (4× in `repository-list.html`, `map-view.html`) → `bg-canvas-white/5`.
- `rounded-[32px]` (`map-view`) → `rounded-4xl`, `rounded-3xl!` (`statistics`) → zentral.
- **Verifikation:** Nach dem Fix sind Radius-Kurve und Rahmenzeile beider Seiten **pixelgenau gleich**
  (`41,39,37,36,35,34,33,33,33,32`); Build ✅; `border-neutral-200` ohne `dark:`-Variante = **0**.
### Phase 2: Overrides systematisch abbauen

Nach der Analyse war klar, dass die Ursache **nicht** einzelne Seiten waren, sondern ein Muster:
Utilities, die die zentrale `.glass-card`-Definition überschreiben. Der Bestand wurde daraufhin
vollständig abgeräumt.

| Override-Art | Anzahl | Behandlung |
|---|---|---|
| Radius (`rounded-xl!`, `rounded-2xl!`, `rounded-lg!`) | 23 | `!important` entfernt; Werte sind identisch mit `--radius-card`, daher verhaltensneutral |
| Schatten (`shadow-lg`, `shadow-xl`, `shadow-2xl`, `shadow-xs`) | 9 | entfernt; schwebende Overlays (Toolbar, Dropdown, Empty-State) nutzen `shadow-modal` |
| Rahmen (`border-transparent`, `border-neutral-200/300`, `border-canvas/10 dark:border-white/10`) | 16 | entfernt bzw. auf `border-glass-border` / `border-ui-border` gemappt |
| Hintergrund (`bg-white/80`, `bg-neutral-100`, `bg-brand-50/100`, `bg-neutral-50/10`) | 8 | auf `bg-canvas-white/5` bzw. `bg-brand-500/10` gemappt |

**Wichtigster Einzelfund:** `app-stat-card` trug `border-transparent` und `shadow-lg`. Damit war der
goldene Kartenrahmen auf dem **Dashboard** komplett unsichtbar – die Statistik-Karten sahen wie
randlose Flächen aus, während alle anderen Seiten gerahmte Karten zeigten. Nach dem Entfernen greift
`border-glass-border` wieder. Das war der einzige Fix mit sichtbarer struktureller Wirkung; alle
übrigen sind Angleichungen im Millimetermaßstab bzw. Dark-Mode-Korrektheiten.

**Radius-Skala rationalisiert:** `--radius-2xl` (0.75rem) war ein stilles Duplikat von `--radius-xl`
und `--radius-card`, `--radius-3xl` (0.875rem) ein willkürlicher Zwischenwert ohne Anwendungsfall.
`3xl` wurde auf 0.75rem gezogen; die Skala hat jetzt drei klare Ebenen – 0.75rem (Karten),
1rem (Modals), 0.5rem (Buttons/Inputs). Dokumentiert in `src/styles.css` und `.clinerules/ui.md`.

**Testinfrastruktur:** Der Dev-Proxy (`/tmp/heritago-proxy.js`) bekam `/__seed?next=<pfad>`. Er
schreibt den aktiven Baum in `localStorage` (`activeTree`, vom `treeGuard` gelesen) und leitet dann
weiter. Nur so sind tree-scoped Seiten (`/statistics`, `/media`, `/activity`, `/map`) aus einem
headless CLI-Screenshot-Lauf erreichbar – vorher landete man immer auf `/tree-management`.

> **Fallstrick bei der Verifikation:** `/dashboard` und `/analytics/statistics` existieren **nicht**
> als Routen (`NG04002`). Korrekt sind `/` (Dashboard) und `/statistics`. Ein leerer Screenshot war
> hier zunächst als Regression fehlinterpretiert worden – erst der Console-Log zeigte, dass es eine
> falsche Test-URL war.

**Verifikation nach Phase 2:** Build ✅ (Frontend + Backend), alle `rounded-*!` = **0**,
`border-neutral-200/300` ohne `dark:`-Variante = **0**, helle Hintergründe ohne `dark:` = **0**,
`glass-card`-Zeilen mit Schatten- oder Hell-Hintergrund-Override = **0**. Visuell geprüft:
`/`, `/activity`, `/statistics`, `/media`, `/map`, `/tree-management`, `/admin/users`,
`/change-requests`, `/settings/update`, `/settings`, `/gedcom-io`, `/persons`.



**Weiterhin offen (Phase 2):** 26 `rounded-*!`- und 9 `shadow-*`-Overrides auf `.glass-card`,
69× rohe `.glass-card`-Klasse vs. nur 3× `<app-glass-card>`, 41× `bg-canvas-white/5` und 4× `bg-ui-card`
als konkurrierende Wrapper. Die zentrale Radius-Skala ist mehrdeutig (`xl` = `2xl` = `card` = 0.75rem,
`3xl` = 0.875rem, `4xl` = 1rem) – das sollte in `ui.md` dokumentiert und die Overrides abgebaut werden.
Ebenso: `--color-neutral-*` enthält die **Slate**-Werte (blaustichig), nicht echte Neutraltöne.

---



## 4. Wichtiger Hinweis: Server neu starten

In der Session wurden laufende `node dist/index.js`-Prozesse beendet. Zum Testen der neuen
Endpunkte **Backend neu starten**:

```bash
cd server && npm run dev        # oder: npm run build && node dist/index.js
```

Frontend (Dev-Server mit `/api`-Proxy) wie gewohnt laufen lassen.

---

## 5. Offene Punkte / mögliche Folgearbeiten

- [ ] **Echtes Messaging-Postfach (§ 8)** bauen (Eingang/Gesendet/Gelöscht), getrennt von der
      Review-Inbox `/change-requests`.
- [ ] **Vorschlagslogik nur für Personen & Familien** – Medien/Quellen/Orte folgen noch nicht
      demselben `ChangeRequest`-Muster.
- [ ] **CAPTCHA fehlt** (Honeypot + Rate-Limiting + E-Mail-Verifizierung als Ersatz);
      Account-basierte Rate-Limit-Dimension fehlt.
- [ ] **Direkter Einladungs-Link** (mit Token) für besseren UX beim Einladen fehlt noch.
- [ ] Aufräumen des Testusers `testhelfer` sowie evtl. Test-ChangeRequests/Notifications nach Abschluss.
- [ ] **Update-Mechanik härten (`/settings/update`):** `git checkout tags/{tag}` erzeugt einen
      detached HEAD und rebuildet/restartet nicht; sauberer wäre Branch-Checkout + `git pull` +
      Build/Reload sowie ein semantischer Versionsvergleich statt `currentTag !== latestTag`.

---

## 6. Manueller Test des Workflows

1. Login als `helfer` → Person anlegen (wird als `ChangeRequest` `PENDING` gespeichert).
2. Login als `musterfamilie` → Glocke zeigt Benachrichtigung → Klick öffnet die Konversation
   auf `/messages`.
3. Besitzer bestätigt oder **lehnt mit Begründung** ab.
4. `helfer` wird benachrichtigt, sieht die Begründung und kann **antworten** (Konversation).
5. Alternativ alles über den neuen Menüpunkt **„Nachrichten"** erreichbar.

---

## 7. Relevante Dateien (Wiederaufsetzpunkt)

### Backend (`server/`)
- `prisma/schema.prisma` – `ChangeRequest.rejectReason`, `ConversationMessage`, `User.sentMessages`
- `prisma/migrations/20261009160000_add_conversation_messages/migration.sql`
- `src/services/change-request.service.ts` – reject/approve/addMessage/listRelevant
- `src/services/notification.service.ts` – `create(userId, type, title, message, entityId?)`
- `src/services/invitation.service.ts`, `src/services/mail.service.ts` – Einladungen
- `src/routes/change-request.routes.ts`, `src/routes/change-request.me.routes.ts`
- `src/routes/invitation.routes.ts`, `src/routes/notification.routes.ts`
- `src/middleware/treeAuth.ts` – Tenant-Isolation (kein Admin-Bypass)

### Frontend (`src/app/`)
- `features/messages/messages.ts` + `.html` – Nachrichtenseite
- `core/services/change-request.service.ts`
- `core/services/invitation.service.ts`, `core/services/notification.service.ts`
- `shared/components/navbar.ts` + `.html` – Glocke→Navigation + „Nachrichten"-Link
- `app.routes.ts` – Route `/messages`
- `features/system/tree-management.ts` + `.html` – Teilen + Prüf-Dialog

### Regeln / Doku
- `.clinerules/auth-rbac.md` (insb. § 8 Messaging, § 9 Änderungs-Bestätigung)
- `docs/architecture/multi-tenancy-audit.md`
- `docs/install.md`

---

## 8. Nachtrag: Admin-Navigation & Stammbaum-Chart

### 8.1 Admin-Links aus der Navbar entfernt
Die Desktop- und Mobile-Navbar war mit `/admin/users` und `/admin/trees` überladen. Beide Links
leben jetzt ausschließlich in `/settings` (die Kacheln sind weiterhin über
`authService.currentUser()?.isAdmin` gated).

- `src/app/shared/components/navbar.html` – Desktop- und Mobile-Block entfernt
- `src/app/features/system/settings.html` – Kachel „Stammbaum-Administration" (`/admin/trees`)
  ergänzt; die bestehende `/tree-management`-Kachel heißt zur Abgrenzung jetzt „Meine Stammbäume"

### 8.2 Chart zeigte (fast) nichts an, obwohl 182 Personen existierten

**Symptom:** `/tree` im Baum `sperlich` blieb leer, obwohl `/persons` 182 Einträge listete.

**Ursache:** Der `chart-data`-Endpunkt gab ein flaches Knoten-Array zurück. Das Frontend nahm
naiv `data[0]` als Hauptperson und `Person.findMany` hatte **kein `orderBy`** – PostgreSQL lieferte
also eine beliebige Zeile zuerst. Im Baum `sperlich` fiel die Wahl auf „Dominik Sperlich", eine
**isolierte Person ohne jede Relation**. Da `family-chart` nur die Hauptperson plus Vorfahren/
Nachfahren zeichnet, blieb genau **eine Karte** sichtbar.

**Datenlage `sperlich`:** 182 Personen, 69 Familien, aber **4 Zusammenhangskomponenten**
(179 + 1 + 1 + 1). Isoliert sind: Dominik Sperlich, Julius Pachsteffl, Elise Herold – ein
Datenqualitätsproblem aus dem GEDCOM-Import, das separat zu bereinigen ist.

**Behebung:**
- `server/src/services/tree.service.ts` – `getFamilyChartData()` liefert jetzt
  `{ nodes, mainPersonId }`. `mainPersonId` wird deterministisch bestimmt: größte
  Zusammenhangskomponente → darin die am höchsten vernetzte Person (`pickMainPersonId`).
  Zusätzlich `orderBy: { id: 'asc' }` gegen die nicht-deterministische Reihenfolge.
- `src/app/features/family/family-chart.component.ts` – liest `res.data.nodes` und
  `res.data.mainPersonId`. Eine im `localStorage` gemerkte Fokus-Person wird nur noch genutzt,
  wenn sie Relationen besitzt – sonst greift der Backend-Wert (verhindert erneut einen leeren Chart).

**Ergebnis:** `mainPersonId` = „Else Bertha Arnold" (11 Kanten, größte Komponente). Bei
`ancestry_depth`/`progeny_depth` = 2 sind damit 18 statt 1 Person sichtbar (Optimum wären 21).

**Verifikation:** Backend- und Frontend-Build grün; Live-Request gegen
`/api/tree/sperlich/chart-data` liefert `{ nodes: 182, mainPersonId }`.

