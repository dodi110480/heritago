# 🌳 Heritago Projekt-Audit und Architekturanalyse (April 2026)

Basierend auf der umfassenden Refaktorisierung der letzten Wochen (März-Audit-Folgearbeiten) wurde dieses neue Audit erstellt. Es dokumentiert den massiven strukturellen Fortschritt und identifiziert die nächsten kritischen Baustellen.

---

## 1. 📊 Management Summary & Status Quo

Heritago hat einen **gewaltigen Architektur-Sprung** gemacht. Das "Flat Directory"-Syndrom im Frontend und das "Bleeding Logic"-Problem im Backend wurden zu ~90% gelöst. Die Anwendung ist nun weitestgehend **service-orientiert** und nutzt moderne Angular-Patterns (Standalone, Signals, Feature-Stores).

**Herausforderung:** Der Umbau hat neue "Schwerpunkte" erzeugt. Einige der neuen Services fangen an, zu "God Services" zu mutieren, und kritische Sicherheits-Grundlagen (Passwort-Hashing) sind noch offen.

---

## 2. ✅ Erreichte Meilensteine (Review März-Audit)

### 2.1 Frontend-Strukturierung
*   **Status:** **ERLEDIGT.** Die Ordner `features/`, `core/` und `shared/` sind etabliert.
*   **Effekt:** Komponenten wie `PersonDetail` wurden von >60KB auf <3KB reduziert, da die Logik in `PersonFeatureStore` und spezialisierte Tabs ausgelagert wurde.

### 2.2 Backend Service-Layer
*   **Status:** **ERLEDIGT.** Fast alle Routen (`Person`, `Family`, `Source`, `Media`, `Place`, `Auth`, `Gedcom`) delegieren ihre Logik nun an instanzbasierte Services.
*   **Effekt:** Die Routen-Dateien sind sauber, lesbar und konzentrieren sich auf HTTP-Concerns.

---

## 3. 🏗️ Aktuelle Architektur-Baustellen & "Rigid Patterns"

### 3.1 🐘 Neue "God Services" (Beispiel `PlaceService.ts`)
*   **Analyse:** Mit 431 Zeilen ist der `PlaceService` aktuell einer der komplexesten Services. Er vereint CRUD, Merge-Logik, Usage-Tracking und die Verwaltung von Sub-Entitäten (Translations, Identifiers, Notes).
*   **Problem:** Das "Single Responsibility Principle" droht erneut zu erodieren. 
*   **Empfehlung:** Splitting in `PlaceQueryService` (Read) und `PlaceActionService` (Write/Merge).

### 3.2 🏰 Logik-Reste in `tree.routes.ts`
*   **Analyse:** Die Route `/tree/:tree/map` enthält umfangreiche Logik zur Generierung von Map-Markern und Personen-Daten für die Kartenansicht.
*   **Problem:** Das Backend-Routing sollte keine Daten für spezifische UI-Widgets "zusammenbauen".
*   **Lösung:** Umzug dieser Logik in den `PlaceService` oder einen neuen `MapService`.

### 3.3 🔒 Kritische Sicherheitslücke: Auth-Security
*   **Analyse:** Der `AuthService` und die `auth.routes.ts` enthalten noch `TODO`-Markierungen für **Passwort-Hashing**. Aktuell werden Passwörter im Klartext gespeichert (`password: 'heritago123'`).
*   **Dringlichkeit:** **EXTREM HOCH.** Dies verhindert jeden produktiven Einsatz oder Beta-Test.
*   **Lösung:** Integration von `bcrypt` oder `argon2` im `AuthService`.

---

## 4. 🗑️ Analyse von Altlasten ("Orphans")

*   **Frontend:** Die Dateien `app.ts` und `app.html` in `src/app` wirken auf den ersten Blick wie Altlasten (da Angular oft `app.component.ts` nutzt), sind aber in diesem Projekt die sauberen Standalone-Entrypoints für den Bootstrap-Prozess.
*   **Zirkuläre Abhängigkeiten:** Die Loops um `index.ts` wurden größtenteils durch die Einführung der `config.ts` und die Auslagerung der Routen-Initialisierung gebrochen. Ein Restrisiko besteht bei der direkten Instanziierung von Services in den Routen-Files – hier sollte perspektivisch ein zentraler `ServiceRegistry` oder DI-Container (NestJS-like) angestrebt werden.

---

## 5. 🎯 Roadmap & Handlungsempfehlungen (Q2 2026)

### 🔴 Priorität 1: Security Hardening
*   **Passwort-Hashing** im `AuthService` implementieren.
*   **Token-Refresh-Logik** prüfen (aktuell einfache JWT-Struktur).

### 🟡 Priorität 2: Service-Refining
*   **`PlaceService` refaktorisieren**: Trennung von Kern-CRUD und komplexen Operationen (Merge/Translations).
*   **`TreeRoutes` säubern**: Map-Logik in den Service-Layer verschieben.

### 🟢 Priorität 3: Frontend-Feinschliff
*   **`PersonFeatureStore` Audit**: Prüfen, ob der Store zu viele Nebeneffekte hat oder ob Logik in kleine Utility-Funktionen extrahiert werden kann.
*   **Standardisierung**: Sicherstellen, dass alle neuen Modals (`place-modal`, `event-modal`) konsequent die `app-notes-list` und `app-sources-list` nutzen.

## Fazit
Heritago hat die "Monolithen-Falle" erfolgreich verlassen. Die Codebasis ist nun professionell strukturiert. Wenn die kritische Auth-Lücke geschlossen und die letzten Logik-Bleeds im Backend (Map-Route) behoben werden, steht einer stabilen Skalierung nichts im Weg.
