# Heritago – Regelwerk: Grundlagen & Meta

> **Verbindlichkeit:** verbindlich · **Geltungsbereich:** gesamtes Projekt · **Aktivierung:** immer
> (kein `paths:`-Frontmatter → wird in jeder Session geladen)

Diese Datei ist der **Einstieg ins Regelwerk**. Sie definiert Sprache, Vorrang und den Index aller
Regeln. Detailregeln stehen in den jeweils genannten Dateien.

## 1. Sprache

- **Antworten an den Nutzer:** immer **Deutsch**.
- **Code-Kommentare:** **Englisch**. Bei Änderungen an einer Datei dürfen vorhandene deutsche
  Kommentare in den **geänderten Bereichen** ins Englische überführt werden. Eine projektweite
  Umschreibung ist **nicht** verlangt (kein Massen-Diff über unberührte Dateien).

## 2. Vorrang bei Konflikten (Source of Truth)

1. Diese Datei (`common.md`) – Meta- und Grundsatzregeln.
2. Die fachspezifische Regeldatei (`api.md`, `ui.md`, `media-upload.md`, `notes-list.md`, …).
3. Bei einem **echten Widerspruch**: nicht raten, sondern **kurz nachfragen** und die Regel danach
   korrigieren.

Ergänzend gilt: Die Regeln beschreiben den **Zielzustand**. Weicht der Code begründet ab, wird die
Regel angepasst. Weicht er unbeabsichtigt ab (Drift), ist das ein zu behebender Fehler – nicht die
neue Wahrheit.

## 3. Index des Regelwerks

| Datei | Thema | Aktivierung |
|-------|-------|-------------|
| `common.md` | Meta, Sprache, Vorrang, Datenvertrag | immer |
| `backend-first.md` | Lean Frontend / Logik im Backend | immer |
| `db-first.md` | Prisma-/Datenbank-Prinzipien | immer |
| `workflow.md` | Build, Tests, Git, Prisma-Migrationen, Env/Secrets | immer |
| `api.md` | REST-Konventionen, Response-Format, Auth, Medien-Endpunkte | `paths: server/src/**` |
| `ui.md` | Design-System, Tokens, Angular-Konventionen | `paths: src/app/**` |
| `media-upload.md` | Medien-Speicherung/-Upload, Crop, Validierung | `paths: server/src/**media**, src/app/features/media/**, src/app/shared/components/ui/app-media-list/**` |
| `notes-list.md` | `app-notes-list`-Komponente | `paths: src/app/shared/components/ui/app-notes-list/**` |
| `sources-list.md` | `app-sources-list`-Komponente | `paths: src/app/shared/components/ui/app-sources-list/**` |
| `auth-rbac.md` | Auth, RBAC, Benutzerverwaltung, Tenant-Isolation | `paths: server/src/**, src/app/**auth**, src/app/core/guards/**, src/app/features/system/**, src/app/shared/components/navbar*` |

> **Wichtig:** Regeln mit `paths:`-Frontmatter werden von Cline nur geladen, wenn passende Dateien
> im Kontext sind. Wird im jeweiligen Bereich gearbeitet, **muss** die Datei dennoch bewusst
> gelesen werden – auch wenn sie nicht automatisch geladen wurde.

## 4. Architektur in vier Sätzen

- **Backend-First:** Datenverarbeitung, Formatierung und komplexe Logik im Backend; das Frontend ist
  reiner View-Layer („Lean Frontend"). → `backend-first.md`
- **DB-First:** `schema.prisma` ist die Source of Truth; relationale Stärken von Prisma direkt nutzen. → `db-first.md`
- **API:** Ressourcen-Endpunkte sind tree-scoped, einheitliches Response-Format. → `api.md`
- **UI:** nur Design-Tokens, keine Business-Logik, Angular-Standards. → `ui.md`

## 5. Datenvertrag (verbindlich – löst frühere Mehrdeutigkeit auf)

- **Interne Schicht:** Das Backend nutzt die Prisma-Modelle **direkt** (siehe `db-first.md`).
- **Externe Schicht:** Nach außen gibt der Server **ausschließlich DTOs / View-Models** aus –
  einheitlich als `{ "success": true, "data": … }` bzw. `{ "success": false, "message": …, "code": … }`
  (siehe `api.md`). Das Frontend konsumiert **nie** rohe Prisma-Strukturen.
- Aufbereitung für die Anzeige (Formatierung, Labels, Aggregationen, Auswahl/Filter großer Mengen)
  liefert das **Backend** (siehe `backend-first.md`).

## 6. Feature-Spezifikationen liegen nicht hier

Visionäre/zielbildhafte Feature-Dokumente sind **keine** Regeln und liegen unter `docs/`
(z. B. `docs/features/person-page.md`). Sie werden vor der Umsetzung gegen dieses Regelwerk geprüft.
