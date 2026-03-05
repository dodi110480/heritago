# DESIGN_TODO

## Ziel
Einheitliches Design über gemeinsame UI-Komponenten und globale Utility-Muster statt seitenlokaler Einzel-Styles.

## 1) Angular Card-Komponenten (Ist-Stand)

### Vorhanden
- `AppCardComponent` (`src/app/ui/app-card.ts`)
  - Wrapper auf Basis von `.glass-card`
  - Optionaler `title`
  - Aktuelle Nutzung: praktisch nur in `src/app/person-detail.html`
- `AppEntityCard` (`src/app/ui/app-entity-card.ts`)
  - Listen-/Übersichtskarte mit Icon/Avatar, Badge, Meta, Actions-Slot
  - Nutzung in mehreren Listen: Personen, Familien, Orte, Quellen, Medien, Archive

### Nicht vorhanden
- Keine externen Angular-Card-Komponenten (`mat-card`, `p-card`) im Projekt.

### TODO
- [ ] `AppCardComponent` als Standard-Content-Card für weitere Detailseiten etablieren (nicht nur Personendetail).
- [ ] `AppEntityCard` als einziges Pattern für Listenkarten festschreiben; lokale Alternativen vermeiden.
- [x] `AppStatCardComponent` für Dashboard/Statistik eingeführt und produktiv genutzt.

## 2) Shell-Komponenten (Ist-Stand)

### Vorhanden
- `AppShellComponent` (`src/app/app-shell.ts`)
  - Globale Rahmenstruktur mit Navbar, Main, Footer
- `Navbar` (`src/app/navbar.ts`, `src/app/navbar.html`)
  - Top-Navigation inkl. Mobile-Menü
- `AppPageContainerComponent` (`src/app/ui/app-page-container.ts`)
  - Einheitliche Seitenbreite/Padding
- `AppPageHeaderComponent` (`src/app/ui/app-page-header.ts`)
  - Einheitlicher Seitentitel + Actions
- `AppModalShell` (`src/app/ui/app-modal-shell.ts`)
  - Einheitliches Modal-Layout inkl. Header/Body/Footer + Aktionen

### TODO
- [x] Root-Struktur bereinigt: `src/app/app.html` auf neutrales `<router-outlet />` reduziert; Navbar bleibt zentral in `AppShellComponent`.
- [ ] Für alle Seiten als Standard definieren: `app-page-container` + `app-page-header`.
- [ ] Alle modalen Dialoge auf `app-modal-shell` migrieren (siehe Abweichungen unten; Login als Sonderfall dokumentieren).

## 3) Globale Tailwind-Utilities / Design-Tokens (Ist-Stand)

### Globale Komponentenklassen in `src/styles.css`
- Karten/Flächen:
  - `.glass-card`
- Header:
  - `.page-header`, `.page-header-inner`, `.page-title`, `.page-subtitle`
- Buttons:
  - `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`
- Suche/Form:
  - `.search-wrapper`, `.search-icon-wrapper`, `.search-input`
  - `.form-group`, `.form-label`, `.form-input`
- Modal:
  - `.modal-container`, `.modal-glass`
- Sonstiges:
  - `.badge*`, Leaflet-Overrides, FamilyChart-Isolation

### TODO
- [ ] Diese Klassen als verbindlichen Design-Standard dokumentieren (wann Utility-only, wann Component-Class).
- [ ] Regel festlegen: keine langen lokalen Utility-Ketten, wenn semantische Klasse bereits existiert.
- [ ] Varianten systematisch über Inputs/Props statt `!`-Overrides (`!p-*`, `!rounded-*`) steuern.

## 4) Stellen mit selbständigem Design ohne globale Vorgaben (Hotspots)

## A) Seiten ohne zentrale Layout-Wrapper (`app-page-container`/`app-page-header`)
- `src/app/map-view.html`
- `src/app/person-detail.html` (komplexes Sonderlayout, teilweise bereits modularisiert)

### TODO
- [x] Standardseiten auf `app-page-container` + `app-page-header` migriert.
- [ ] `map-view` und `person-detail` als bewusste Sonderlayouts final dokumentieren (inkl. Design-Regeln pro Sonderlayout).

## B) Modals mit lokalem Modal-Design statt `app-modal-shell`
- `src/app/login.html` (`modal-container`/`modal-glass` als eigener Screen)

### TODO
- [x] Modale Interaktionen vereinheitlicht: `person-create-modal`, `media-add-modal`, `media-selector`, Delete-Modal in `person-detail` auf `app-modal-shell`.
- [ ] Wenn bewusst abweichend (z. B. Login), als Ausnahme dokumentieren.

## C) Starke lokale Einzelgestaltung (hoher Refactor-Hebel)
- `src/app/person-detail.html` (sehr viele individuelle Karten-/Form-Varianten)
- `src/app/dashboard.html` (mehrere individuelle Card- und CTA-Layouts)
- `src/app/map-view.html` (eigene Karten-/Overlay-Strukturen)
- `src/app/update-settings.html` (eigene Header/Card-Strukturen)
- `src/app/navbar.html` (umfangreiche direkte Utility-Ketten)

### TODO
- [ ] `person-detail` in wiederverwendbare Sub-Komponenten zerlegen (z. B. SectionCard, EditableListCard).
- [x] Dashboard- und Statistik-Karten auf gemeinsames `StatCard`-Muster gebracht.
- [ ] Navbar-Klassen reduzieren und auf Design-Tokens/Helper-Klassen konsolidieren.

## 5) Priorisierte Umsetzungsreihenfolge
- [x] 1. Design-Richtlinie in `DESIGN_TODO.md` finalisieren und als Team-Referenz nutzen.
- [x] 2. Layout-Standardisierung: Standardseiten auf `app-page-container` + `app-page-header` gezogen; Sonderlayouts dokumentieren.
- [x] 3. Modal-Standardisierung: lokale Modals auf `app-modal-shell` migriert (Login als Sonderfall).
- [ ] 4. Card-Standardisierung: lokale Kartenmuster in `app-card`/`app-entity-card`/`app-stat-card` überführen (Rest: person-detail).
- [ ] 5. Größter Block: `person-detail` modularisieren und lokale Utility-Overloads abbauen.

### Phase-1 Status (umgesetzt)
- [x] `dashboard` auf `app-page-container` + `app-page-header` umgestellt.
- [x] `update-settings` auf `app-page-container` + `app-page-header` umgestellt.
- [x] Delete-Modal in `person-detail` auf `app-modal-shell` umgestellt.

### Phase-2 Status (Teil 1, umgesetzt)
- [x] `settings` auf `app-page-container` + `app-page-header` umgestellt.
- [x] `statistics` auf `app-page-container` + `app-page-header` umgestellt.
- [x] `tree-management` auf `app-page-container` + `app-page-header` umgestellt (ohne Eingriff in `family-chart`).

### Phase-2 Status (Teil 2, umgesetzt)
- [x] `diagnostics` auf `app-page-container` + `app-page-header` umgestellt.
- [x] `family-detail` auf `app-page-container` + `app-page-header` umgestellt.
- [x] `gedcom-io` auf `app-page-container` + `app-page-header` umgestellt.
- [x] `map-view` als bewusstes Sonderlayout geführt (kompakter Overlay-Header statt Standard-Page-Header).
- [x] `search-results` auf `app-page-container` + `app-page-header` umgestellt.
- [x] `timeline` auf `app-page-container` umgestellt.

### Phase-3 Status (Teil 1, umgesetzt)
- [x] `person-create-modal` auf `app-modal-shell` umgestellt.
- [x] `media-add-modal` auf `app-modal-shell` umgestellt.
- [x] `media-selector` auf `app-modal-shell` umgestellt.

### Phase-4 Status (Teil 1, umgesetzt)
- [x] Neue gemeinsame KPI-Karte `app-stat-card` eingeführt.
- [x] `statistics` KPI-Karten auf `app-stat-card` migriert.
- [x] `dashboard` KPI-Karten auf `app-stat-card` migriert.

### Phase-4 Status (Teil 2, umgesetzt)
- [x] `search-results` Ergebnis-Karten auf `app-entity-card` migriert.
- [x] `map-view` Personenliste auf `app-entity-card` migriert.
- [x] `map-view` Karten-Theme-Schalter (dark/light) mit Persistenz via `localStorage` ergänzt.

### Phase-5 Status (Teil 1, umgesetzt)
- [x] Neue `app-section-card` als wiederverwendbare Section-Hülle eingeführt.
- [x] `person-detail` (Simple Mode) Sidebar-Sektionen `Herkunft`, `Notizen`, `System-Info` auf `app-section-card` migriert (historisch; Simple Mode später entfernt).
- [ ] Nächster Schritt: `person-detail` Experten-Tabs (`Basics`, `Timeline`, `Relations`) schrittweise in eigene Sub-Komponenten aufteilen.

### Phase-5 Status (Teil 2, umgesetzt)
- [x] Root-Struktur bereinigt: veraltetes `app.html`-Navbar-Markup entfernt, Shell bleibt alleiniger Navbar-Owner.

### Phase-5 Status (Teil 3, umgesetzt)
- [x] `person-detail` Stammdaten/Lebensweg im Simple Mode kurzzeitig in eigene Komponenten ausgelagert.
- [x] Erkenntnis dokumentiert: Simple-`Lebensweg` war zuvor leer gerendert (`timeline-container` ohne Inhalt).

### Phase-5 Status (Teil 4, umgesetzt)
- [x] Simple-Ansicht in `person-detail` vollständig entfernt; `person-detail` nutzt nur noch eine einheitliche Expert-Ansicht.
- [x] Mode-Toggle (`Einfach/Experte`) und zugehörige `isExpertMode`-Logik entfernt.
- [ ] Nächster Schritt: Experten-Tabs (`Basics`, `Timeline`, `Relations`) in eigene Komponenten extrahieren.

### Phase-5 Status (Teil 5, umgesetzt)
- [x] Experten-Tab `Basics` in eigene Komponente `app-person-expert-basics-tab` ausgelagert.
- [x] Experten-Tab `Timeline` in eigene Komponente `app-person-expert-timeline-tab` ausgelagert.
- [x] Experten-Tab `Relations` in eigene Komponente `app-person-expert-relations-tab` ausgelagert.
- [x] Add-Flows in Personen-Registern vereinheitlicht: `Beziehung`, `Notiz`, `Beleg`, `Assoziation`, `DNA-Match` öffnen jetzt `app-modal-shell` statt Inline-Neuanlage.
- [x] Lebenslauf-Add-Flow vereinheitlicht: `+ Ereignis/Fakt hinzufügen` öffnet jetzt `app-modal-shell`.
- [ ] Nächster Schritt: Read-only + Click-to-Edit-Modal Muster auf weitere Registerkarten ausrollen.

### Phase-5 Status (Teil 6, umgesetzt)
- [x] Lebenslauf-Karten auf konsistente Bedienung umgestellt: keine Inline-Edit/Delete-Buttons mehr, Öffnen per Kartenklick.
- [x] Lebenslauf-Detailbearbeitung in `app-modal-shell` verlagert (Speichern/Löschen im Modal, sofern erlaubt).
- [x] Gesperrte/abgeleitete Lebenslauf-Einträge als `Nur lesen` markiert.
- [x] Für gesperrte Einträge Navigation zum Ursprungsdatensatz ergänzt (zur Person bzw. Familie).
- [x] Save-Logik korrigiert: `family-event` wird nicht mehr als Personen-Event gespeichert; Familien-Events werden über `saveFamily` persistiert.

### Phase-5 Status (Teil 7, umgesetzt)
- [x] `Basics`-Tab auf Read-only-in-Card + Bearbeitung-im-Modal umgestellt.
- [x] Name/Basisdaten in `Basics` nur noch als Textdarstellung in der Karte; Edit via `app-modal-shell`.
- [x] `Notizen` auf Read-only-Karten + Klick-Edit im `app-modal-shell` umgestellt.
- [x] `Referenzen` auf Read-only-Karten + Klick-Edit im `app-modal-shell` umgestellt.
- [ ] Nächster Schritt: Dasselbe Read-only + Click-to-Edit-Modal Muster auf verbleibende Registerkarten (`Assoziationen`, `DNA`, `Namen`, ggf. `Medien`) ausrollen.

## 7) Offene Kernpunkte (aktualisiert)
- [ ] Weitere `person-detail` Registerkarten auf das neue Muster umstellen:
  - Read-only Kartenansicht
  - Klick öffnet `app-modal-shell`
  - Keine Inline-Edit-Formulare in der Karte
  - Bereits umgestellt: `Basics`, `Lebenslauf`, `Notizen`, `Referenzen`
  - Noch offen: `Assoziationen`, `DNA`, `Namen`, `Medien` (fachlich zu prüfen)
- [ ] `map-view` und `person-detail` als Sonderlayouts final dokumentieren (inkl. Regeln).
- [ ] Login-Modalabweichung als bewusste Ausnahme dokumentieren.
- [ ] Navbar-Utility-Ketten reduzieren/konsolidieren.
- [ ] Globale Design-Tokens verbindlich dokumentieren (Nutzung, Varianten, Verbote von lokalen Utility-Overloads).

## 6) Kurzfazit
Es gibt bereits eine solide globale Basis (`styles.css` + `ui/`-Komponenten). Die größte Design-Inkonsistenz entsteht aktuell dort, wo Seiten und Modals noch mit lokalen Utility-Ketten und eigenen Kartenmustern gebaut sind.
