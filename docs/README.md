# Heritago – Dokumentation

Übersicht der Projektdokumentation. Verbindliche Entwicklungsregeln liegen in
[`.clinerules/`](../.clinerules/) – hier befinden sich nur beschreibende Dokumente,
Analysen und Referenzen.

## Inhalt

| Ordner / Datei | Beschreibung |
|---|---|
| [`install.md`](./install.md) | Installationsanleitung für einen Linux-Server (Ubuntu/Debian) |
| [`database/`](./database/) | Datenbank-Referenzen |
| [`database/schema-guide.md`](./database/schema-guide.md) | Felderläuterung zum Genealogie-Schema |
| [`database/db-todo.md`](./database/db-todo.md) | Frontend-Lücken gegenüber dem Datenbankmodell |
| [`assets/er-diagram.png`](./assets/er-diagram.png) | ER-Diagramm des Datenmodells |
| [`design/`](./design/) | Design-System-Dokumentation |
| [`design/audit.md`](./design/audit.md) | Design-Audit (Status der Token-Migration) |
| [`design/todo.md`](./design/todo.md) | Offene Design-Aufgaben |
| [`design/tailwind-strategy.md`](./design/tailwind-strategy.md) | Tailwind-Architektur-Strategie |
| [`migration/`](./migration/) | Einmalige Umstrukturierungs-Anweisungen |
| [`features/`](./features/) | Feature-Spezifikationen/Visionen (keine Regeln) |
| [`features/person-page.md`](./features/person-page.md) | Zielbild der Seite `/person` (visionär) |
| [`media/`](./media/) | Medien-Infrastruktur & Betrieb |
| [`media/infrastructure.md`](./media/infrastructure.md) | Dateirechte, Proxy, Log-Rotation, Backup, CDN |
| [`random-dashboard-texts.md`](./random-dashboard-texts.md) | Textbausteine für das Dashboard |
| [`assets/`](./assets/) | Bilder (u. a. `hero-banner.png` für das README) |

## Regeln

Die verbindlichen Regeln stehen in [`.clinerules/`](../.clinerules/):

**Immer aktiv**
- `common.md` – Meta: Sprache, Vorrang (Source of Truth), Index, Datenvertrag
- `backend-first.md` – Lean Frontend / Logik im Backend
- `db-first.md` – Prisma-/Datenbank-Prinzipien
- `workflow.md` – Build, Tests, Git, Prisma-Migrationen, Env/Secrets

**Kontextabhängig (`paths:`-Frontmatter)**
- `api.md` – REST/API-Konventionen (`server/src/**`)
- `ui.md` – Design-System & Angular-Konventionen (`src/app/**`)
- `media-upload.md` – Medien-Upload/-Speicherung (`**media**`)
- `notes-list.md`, `sources-list.md` – Komponenten-Spezifikationen

> Betriebs-/Infrastrukturthemen (Medien) liegen bewusst **nicht** im Regelwerk, sondern in
> [`media/infrastructure.md`](./media/infrastructure.md).
