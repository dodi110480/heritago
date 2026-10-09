# Workflow & Qualitätssicherung

> **Verbindlichkeit:** verbindlich · **Geltungsbereich:** gesamtes Projekt · **Aktivierung:** immer

## 1. Definition of Done

Eine Aufgabe ist fertig, wenn:

- der relevante **Build** läuft (siehe Abschnitt 2),
- die Regeln in `.clinerules/` eingehalten sind (bei API/UI/Medien die jeweils geltende Datei
  bewusst gelesen),
- **keine rohen Prisma-Strukturen** nach außen dringen (DTOs! siehe `common.md`) und **keine
  Business-Logik** im Frontend liegt,
- neue/geänderte **Code-Kommentare auf Englisch** sind.

## 2. Build & Verifikation

| Zweck | Befehl |
|-------|--------|
| Frontend-Build (Angular) | `npm run build` (Projekt-Root) |
| Frontend-Tests (Vitest) | `npm test` |
| Backend-Build (tsc) | `cd server && npm run build` |
| End-to-End-Smoke | `./scripts/smoke-test.sh` |

Der Smoke-Test prüft `/api/health`, `/api/trees`, die Erreichbarkeit des Frontends sowie beide Builds.

> Vor Abschluss einer Aufgabe mindestens den **relevanten Build** ausführen und das Ergebnis nennen.

## 3. Prisma-Migrationen

- Schema ändern: `server/prisma/schema.prisma`
- Migration erzeugen: `cd server && npm run prisma:migrate -- --name <kurzer_name>`
- Client neu generieren: `npm run prisma:generate`
- Migrationen sind **additiv** bevorzugt (siehe `db-first.md`); destruktive Änderungen nur nach Rücksprache.
- **Kein** `prisma db push` gegen Produktions-Datenbanken.

## 4. Git & Commits

- **Conventional Commits**: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`, `style:`, `perf:`
- Eine logische Änderung pro Commit; unterschiedliche Themen **getrennt** committen
  (z. B. Doku-/Struktur-Umbau ≠ Feature-Änderung).
- **Kein Commit ohne grünen Build.**
- **Nicht** committen: Secrets, Logs (`*.log`), Build-Artefakte, lokale Screenshots.

## 5. Umgebung & Secrets

- Konfiguration/Secrets nur über Umgebungsvariablen (`.env`, `dotenv`) – `.env` **nicht** committen.
- Keine Secrets/Tokens im Frontend-Bundle.
- Neue Variablen in `docs/install.md` dokumentieren.

## 6. Logging & Fehler

- Fehler nach außen nutzerfreundlich und **ohne** interne Details (keine Stack-Traces, Pfade, UUIDs).
- Serverfehler strukturiert loggen (Upload-Logs: `docs/media/infrastructure.md`).
- Kein `console.log` als dauerhaftes Logging in Produktionspfaden.
