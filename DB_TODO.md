# DB_TODO.md — Frontend-Lücken gegenüber Datenbankmodell

Dieses Dokument analysiert das Prisma-Schema und listet alle Felder, Relationen und Modelle,
die noch **kein Frontend** haben. Stand: **2026-03-03**.

---

## 🟢 Gut abgedeckt

| Modell | Abgedeckt durch |
|--------|----------------|
| `Person` (Basisdaten, isLiving, Sex) | `person-detail`, `person-list`, `person-create-modal` |
| `Name` (full/given/surname/prefix/suffix) | `person-detail` (Simple + Expert Mode) |
| `Event` (Typ, Datum, Ort, Citations, Notes) | `person-detail`, `family-detail` |
| `Fact` (Typ, Wert, Datum, Ort, Citations) | `person-detail` |
| `Family` + `FamilyMember` (Rollen) | `family-detail`, `family-list` |
| `Place` (Name, Koordinaten, Parent, Hierarchie) | `place-list`, `place-modal` |
| `Source` (Titel, Kurztitel, Autor, Publikation, Repository) | `source-list`, `source-modal` |
| `Repository` (Name, Adresse, Phone, Email, Website) | `repository-list` |
| `Media` (Upload, Download, Verlinkung, Title, MimeType) | `media-gallery`, `media-add-modal` |
| `Citation` (sourceId, page, confidence, an Person/Event/Fact/Familie) | `person-detail`, `family-detail` |
| `Association` (role, relationText, dateText, confidence, notes) | `person-detail` (Tab "Assoziationen") |
| `SharedNote` + `NoteLink` (text, noteType, privacyLevel, researchStatus) | `person-detail`, `family-detail` |
| `MediaLink` (role, caption, isPrimary, an Person/Familie/Event/Source) | `media-gallery`, `person-detail` |
| `ChangeLog` (Backend-Logging bei Person-Änderungen) | `server/index.ts` — Einträge werden geschrieben |

---

## 🔴 Komplett fehlend im Frontend

### `ResearchLog` — Forschungsprotokoll
**DB-Felder:** `status`, `title`, `description`, `objective`, `result`, `nextStep`, `entityType/Id`, `startedAt`, `completedAt`
- **0% abgedeckt** — kein Backend-Endpunkt, kein Frontend
- Würde eine eigene Seite `/research` verdienen
- **Nützlichkeit:** Sehr hoch — offene Forschungsfragen pro Person/Familie verfolgen

### `DnaMatch` + `DnaSegment` — DNA-Analyse
**DB-Felder DnaMatch:** `provider`, `totalCm`, `largestSegmentCm`, `segmentCount`, `predictedRelationship`, `confidence`, `testDate`, `kitId`
**DB-Felder DnaSegment:** `chromosome`, `startPosition`, `endPosition`, `cm`, `snpCount`, `isTriangulated`, `build`
- **0% abgedeckt** — kein Backend-Endpunkt, kein Frontend
- Eigene Seite `/dna` oder Tab in Person-Detail

### `ChangeLog` — Frontend-Anzeige
- Backend schreibt bereits Einträge (Person CREATE/UPDATE/DELETE)
- **Kein Frontend** — weder als globale Seite noch als Datensatz-Verlauf
- Sollte als "Verlauf"-Tab in `person-detail` und als Dashboard-Widget erscheinen
- Auch Logging für Family, Source, Media etc. fehlt noch im Backend

### `Citation` an `Media` / `Note` / `Association`
**DB unterstützt:** Citation kann an mediaId, noteId, associationId geknüpft werden
- **0% im Frontend** — nur Citation an Person/Event/Fact/Familie ist implementiert

---

## 🟡 Teilweise fehlend im Frontend

### `Person` — Fehlende Felder

| Feld | Status | Beschreibung |
|------|--------|-------------|
| `privacyLevel` | ❌ Nicht sichtbar | `PUBLIC / FAMILY / PRIVATE` — kein UI-Element |
| `exid` | ❌ Nicht sichtbar | Externe ID (z.B. Ancestry-ID) — kein Eingabefeld |
| `gedcomId` | ℹ️ Nur Anzeige | Wird beim Import gesetzt, kein Edit-UI |

### `Event` — Fehlende Felder

| Feld | Status | Beschreibung |
|------|--------|-------------|
| `eventSubtype` | ❌ Nicht editierbar | Untertyp des Events (z.B. "Taufe" als Subtyp von "Religiös") |
| `isNegative` | ❌ Nicht sichtbar | Negatives Event ("Kein Militärdienst" etc.) |
| `dateType` | ❌ Nicht editierbar | `EXACT / ABOUT / CALCULATED / BEFORE / AFTER / BETWEEN / RANGE` |
| `dateStart` / `dateEnd` | ⚠️ Nur dateText | Für Zeiträume — nur `dateText` wird genutzt |
| `description` | ⚠️ Unklar | Freitextbeschreibung zum Event — im Expert Mode möglicherweise vorhanden |

### `Fact` — Fehlende Felder

| Feld | Status | Beschreibung |
|------|--------|-------------|
| `dateType` | ❌ Nicht editierbar | `EXACT / ABOUT / CALCULATED / BEFORE / AFTER / BETWEEN / RANGE` |
| `dateStart` / `dateEnd` | ⚠️ Nur dateText | Für Zeiträume — nur `dateText` wird genutzt |

### `FamilyMember` — Fehlende Felder

| Feld | Status | Beschreibung |
|------|--------|-------------|
| `marriageType` | ❌ Nicht sichtbar | `CIVIL / RELIGIOUS / COMMON_LAW / SAME_SEX / UNKNOWN` |
| `pedigreeType` | ❌ Nicht sichtbar | `BIRTH / ADOPTED / FOSTER / STEP / SEALED` |
| `sortOrder` | ❌ Nicht editierbar | Reihenfolge der Kinder |

### `Place` — Fehlende Felder

| Feld | Status | Beschreibung |
|------|--------|-------------|
| `historicNames` | ⚠️ Rudimentär | Kommasepariert eingabbar, UI-Darstellung minimal |
| `jurisdiction` | ❌ Fehlt komplett | z.B. Kirchspiel, Gemeinde — im Schema vorhanden, kein UI |

### `Name` — Fehlende Felder

| Feld | Status | Beschreibung |
|------|--------|-------------|
| Mehrere Namen | ⚠️ Teilweise | Mehrere Namen für eine Person nur im GEDCOM-Import, nicht im UI |
| `type` | ❌ Nicht editierbar | Namenstyp (z.B. "Geburtsname", "Ehename", "Spitzname") |
| `sortOrder` / `isPrimary` | ❌ Nicht editierbar | Reihenfolge, welcher Name primär ist |

### `Association` — Fehlende Felder

| Feld | Status | Beschreibung |
|------|--------|-------------|
| `eventId` / `placeId` | ❌ Kein UI | Eine Assoziation kann an ein Event/Ort geknüpft werden — kein Feld im UI |
| `citations` | ❌ Kein UI | Quellen zu einer Assoziation belegen |

### `Media` — Fehlende Felder

| Feld | Status | Beschreibung |
|------|--------|-------------|
| `mediaType` | ⚠️ Auto-gesetzt | Wird aus mimeType abgeleitet, kein explizites UI-Feld |
| `dimensions` | ❌ Nur Metadaten | Wird beim Upload nicht angezeigt |
| `sortOrder` | ❌ Nicht editierbar | Reihenfolge der Medien im Album |

### `TreePermission` — Mehrbenutzerverwaltung

| Feld | Status | Beschreibung |
|------|--------|-------------|
| Nutzerverwaltung je Baum | ❌ Kein UI | `TreePermission` (OWNER/EDITOR/VIEWER/COMMENTER) komplett ohne Frontend |
| `privacyOverride` | ❌ Kein UI | Ob ein Nutzer den Privacy-Level ignorieren darf |

---

## 📊 Prioritätsliste (Stand 2026-03-03)

### Hohe Priorität
1. **FamilyMember.pedigreeType + marriageType** — Adoption, Pflegekinder, Ehetyp: genealogisch essenziell
2. **ChangeLog-Frontend** — Dashboard-Widget "Letzte Änderungen", Verlauf-Tab je Datensatz
3. **Person.privacyLevel** — Datenschutz für noch lebende Personen
4. **Event/Fact.dateType** — Datumsunsicherheit (ABOUT, BEFORE, AFTER) ausdrücken; sehr wichtig für korrekte Darstellung

### Mittlere Priorität
5. **ResearchLog** — Forschungsprotokoll für offene Fragen (eigene Seite `/research`)
6. **Name.type + mehrere Namen** — Geburtsname, Ehename etc. per UI verwaltbar machen
7. **Place.jurisdiction** — Kirchspiel, Kreis, Diözese fehlen im Ortsformular
8. **Citation an Media/Note/Association** — Quellenbelege auch für diese Entitäten
9. **Association.eventId/placeId** — Kontext einer Assoziation verknüpfbar machen
10. **TreePermission UI** — Mehrbenutzer-Verwaltung (Teilen von Stammbäumen)

### Niedrige / Spezial-Priorität
11. **DNA-Module** — Vollständig in DB vorhanden, aber Nischenfeature (`/dna`-Seite)
12. **Event.isNegative** — Selten genutzt
13. **Media.sortOrder** — Drag & Drop Reihenfolge in der Galerie
14. **Event.eventSubtype** — Stärker GEDCOM orientiert, weniger kritisch für UI

---

## 🗂️ Vorhandene Frontend-Seiten (zur Referenz)

| Seite / Komponente | Route / Datei | Notizen |
|--------------------|---------------|---------|
| Personen-Liste | `person-list` | ✅ |
| Personen-Detail | `person-detail` | ✅ Größte Komponente (105kb HTML) |
| Familien-Liste | `family-list` | ✅ |
| Familien-Detail | `family-detail` | ✅ |
| Stammbaum (Karte) | `family-chart.component` | ✅ D3-basiert |
| Karte / Map | `map-view` | ✅ Leaflet |
| Orte | `place-list`, `place-modal` | ✅ |
| Quellen & Archive | `source-list`, `source-modal`, `repository-list` | ✅ Neu: Merge/Delete im Modal |
| Medien-Galerie | `media-gallery`, `media-add-modal` | ✅ |
| Timeline | `timeline` | ⚠️ Vorhanden, Umfang unklar |
| Statistiken | `statistics` | ⚠️ Vorhanden, Umfang unklar |
| Dashboard | `dashboard` | ⚠️ Basis vorhanden, ChangeLog-Widget fehlt |
| Kalender-Widget | `calendar-widget` | ⚠️ Vorhanden, Umfang unklar |
| GEDCOM Import/Export | `gedcom-io` | ✅ |
| Suche | `search-results` | ⚠️ Vorhanden, Umfang unklar |
| Login / Einstellungen | `login`, `settings`, `update-settings` | ✅ |
| Benutzerverwaltung | `user-management` | ⚠️ Vorhanden, aber minimal (1.3kb) |
| Forschungsprotokoll | — | ❌ Fehlt komplett |
| DNA-Analyse | — | ❌ Fehlt komplett |
| ChangeLog / Verlauf | — | ❌ Fehlt komplett (Backend teilweise vorhanden) |
