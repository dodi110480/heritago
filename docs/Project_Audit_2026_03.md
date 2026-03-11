# 🌳 Heritago Projekt-Audit und Architekturanalyse (März 2026)

Basierend auf einer detaillierten Analyse der Codebase (`src/app` und `server/src`) wurde dieses Audit erstellt. Es beleuchtet den aktuellen Status von Heritago in Bezug auf Code-Qualität, Strukturierung, Optimierungspotential und mögliche "Dateileichen".

---

## 1. 📊 Management Summary & Status Quo

Das Projekt macht einen **sehr soliden und modernen Eindruck**, insbesondere durch die Verwendung von Angular Signals und einem sauberen, standardisierten UI (Glassmorphism). Die Funktionalität (CRUD für genealogische Daten) ist stark fortgeschritten. 

Jedoch zeigt die Architektur noch **deutliche Züge einer monolithischen "Start-Phase"**. Sowohl im Frontend als auch im Backend gibt es Dateien ("God Objects"), die zu viel Verantwortung tragen und extrem groß geworden sind. Dies erschwert langfristig die Wartung und parallele Entwicklung.

---

## 2. 🏗️ Struktur- und Architekturprobleme

### 2.1 "Flat Directory"-Syndrom im Frontend (`src/app`)
Im Ordner `src/app` befinden sich aktuell **über 70 Typescript-Dateien** auf der obersten Ebene (z.B. `person-detail.ts`, `family-detail.ts`, `media-add-modal.ts`).
*   **Problem:** Es fehlt eine logische Gruppierung nach Features (Domain-Driven Design).
*   **Empfehlung:** Die Codebase sollte in logische Feature-Module/Ordner unterteilt werden.
    *   `src/app/features/person/` (für alle Personen-bezogenen Komponenten)
    *   `src/app/features/family/`
    *   `src/app/features/media/`
    *   `src/app/shared/components/` (für generische UI-Basics, an denen wir bereits mit `app-usage-list` und `app-notes-list` gearbeitet haben)

### 2.2 Zirkuläre Abhängigkeiten im Backend
Ein Check mit `madge` hat **3 zirkuläre Abhängigkeiten** im Backend offengelegt:
1.  `server/src/index.ts` ↔ `server/src/routes/gedcom.routes.ts`
2.  `server/src/index.ts` ↔ `server/src/routes/media.routes.ts`
3.  `server/src/index.ts` ↔ `server/src/routes/tree.routes.ts`
*   **Problem:** Eine Route importiert Variablen aus der `index.ts` (z.B. Konfigurationen, Instanzen), während die `index.ts` die Route initialisiert. Das kann beim Bootstrapping oder in Tests zu "undefined"-Fehlern (Race Conditions) führen.
*   **Empfehlung:** Gemeinsam genutzte Konstanten oder Instanzen (wie `PrismaClient` oder Pfade) in eine dedizierte Konfigurations- oder Datenbank-Datei (z.B. `db.ts` oder `config.ts`) auslagern.

---

## 3. 🐘 "God Objects" und zu viel Code

Einige Dateien sind unproportional groß und verletzen das "Single Responsibility Principle" (Aufgabentrennung).

### 3.1 Frontend: `person-detail.ts` (~ 69 KB) & `family-detail.ts` (~ 28 KB)
*   **Analyse:** Obwohl die Tabs im Personen-Detail bereits in eigene Dateien (`person-tab-notes.ts`, etc.) ausgelagert wurden, ist die `person-detail.ts` noch extrem groß. Sie steuert wahrscheinlich immer noch zu viel an Status und Event-Handling zentral.
*   **Lösung:** Weiteres Splitting von Logik in spezialisierte Services, Auslagerung komplexer Template-Teile in "Dumb Components" (Präsentationskomponenten).

### 3.2 Frontend: `gedcom.service.ts` (~ 11 KB)
*   **Analyse:** Dieser Service fungiert als zentraler, riesiger HTTP-Client für **alle** Backend-Endpunkte.
*   **Lösung:** Er sollte perspektivisch in spezifische Services wie `PersonService`, `MediaService`, `PlaceService` etc. aufgeteilt werden, die per Dependency Injection (DI) genutzt werden. Die Benennung `gedcom.service.ts` ist zudem irreführend, da er die komplette REST-API bedient, nicht nur GEDCOM-spezifische Aufgaben.

### 3.3 Backend: Die "dicken" Routes (z.B. `media.routes.ts` - 33 KB, `place.routes.ts` - 22 KB)
*   **Analyse:** Das Routing ist extrem überladen. Neben der Entgegennahme von Requests enthalten die Routen die gesamte Business-Logik (Prisma Queries, Datenformatierung, Validierung).
*   **Lösung:** Umzug auf das bewährte Controller-Service-Pattern (oder zumindest Auslagerung in eigenständige Service-Klassen im Ordner `server/src/services/`). Wir haben das mit `media.service.ts` schon richtig angefangen – dieser Weg muss für den Rest des Backends konsequent fortgesetzt werden.

---

## 4. 🗑️ Dateileichen und Fehler-Potential

*   **Dateileichen:** Eine kurze Untersuchung ergab, dass die meisten Dateien (wie `statistics.ts` oder `diagnostics.ts`) korrekt in den Angular-Routen oder Templates referenziert werden. Echte "tote" Dateien sind auf den ersten Blick rar. Bei der kürzlichen Aufräumaktion haben wir bereits ausgediente UI-Komponenten gelöscht.
*   **Fehler-Potential (Sicherheit/Validierung):**
    *   Viele Express-Routen vertrauen sehr auf die Inputs aus dem Body (z.B. `req.body.id`). Hier besteht Potenzial für Laufzeitfehler (z.B. Prisma wirft Exceptions bei fehlerhaften IDs), die zwar vom `try/catch` abgefangen werden, aber nicht immer mit sauberen 400 Bad Request-Nachrichten beantwortet werden.
    *   Sicherheitscheck: Im Backend gibt es eine `auth.routes.ts`, aber es muss sichergestellt sein (z.B. via Middleware), dass jede Route, die auf `treeId` zugreift, auch autorisiert ist (Mandantentrennung).

---

## 5. 🎯 Handlungsempfehlungen (Roadmap für Refactoring)

Sollten wir das Projekt strukturell bereinigen wollen, empfehle ich folgende Prioritäten:

1.  **Backend auflösen (Zirkuläre Refs & Fat Routes)**:
    *   `config.ts` einführen, um die Loops mit `index.ts` zu brechen.
    *   Logik aus `place.routes.ts` in einen `PlaceService` auslagern.
2.  **Frontend Struktur (`src/app`) bereinigen**:
    *   Anlegen der Ordner `features/` und `core/` und Verschieben aller zugehörigen Komponenten und HTMLs (inklusive Anpassung der Import-Pfade in VS Code / im Repo).
3.  **API Services splitten**:
    *   `gedcom.service.ts` zerteilen in sinnvolle kleine Services.
4.  **UI/UX Refinement der "God Objects"**:
    *   Die `person-detail`-Komponente analysieren und reduzieren.

## Fazit
Heritago ist technisch sehr modern (Angular Standalone, Prisma, Tailwind). Das UI ist exzellent aufgestellt. Die größte Baustelle ist derzeit rein **struktureller Natur** ("Aufräumen" der Ordner und Trennung von Business-Logik und Controllern/Routen), was für Projekte in diesem Wachstumsstadium aber völlig normal und leicht lösbar ist.
