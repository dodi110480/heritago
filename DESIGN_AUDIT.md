# Design-Audit — Stand März 2026 (FINAL)

## Zusammenfassung
Das gesamte Fronend-Projekt wurde erfolgreich auf das neue semantische Design-System umgestellt. 
**Es existieren keine alten Hintergrund- oder Fehlerfarben (`bg-surface-dark`, `text-state-error` etc.) mehr in den HTML-Dateien.** Alle Sektionen nutzen konsequent `glass-card` (oder spezialisierte Entitäts-Karten) und die passenden semantischen Tokens (`bg-ui-panel`, `text-accent-danger-500` etc.).

## Legende
- ✅ = voll konform (semantische Tokens, AppCard/glass-card, btn-* Utilities)

## Farbtoken-Status (Legacy vs. Semantisch)
> **Legacy** = `bg-surface-dark`, `bg-surface-darkest`, `text-state-error`, `text-[#…]`  
> **Semantisch** = `bg-ui-*`, `text-ui-*`, `text-brand-*`, `text-accent-*`

| Seite | Legacy | Semantisch | Status |
|---|---|---|---|
| `person-detail.html` | **0** | 2 | ✅ |
| `family-detail.html` | **0** | 33 | ✅ |
| `dashboard.html` | **0** | 13 | ✅ |
| `person-list.html` | **0** | 12 | ✅ |
| `family-list.html` | **0** | 10 | ✅ |
| `source-list.html` | **0** | 6 | ✅ |
| `place-list.html` | **0** | 10 | ✅ |
| `settings.html` | **0** | 11 | ✅ |
| `statistics.html` | **0** | 13 | ✅ |
| `search-results.html` | **0** | 4 | ✅ |
| `media-gallery.html` | **0** | 24 | ✅ |
| `timeline.html` | **0** | 4 | ✅ |
| `repository-list.html` | **0** | 3 | ✅ |
| `gedcom-io.html` | **0** | 11 | ✅ |
| `source-modal.html` | **0** | 9 | ✅ |
| `diagnostics.html` | **0** | 12 | ✅ |
| `image-viewer.html` | **0** | 11 | ✅ |
| `media-add-modal.html` | **0** | 2 | ✅ |
| `place-modal.html` | **0** | 1 | ✅ |
| `update-settings.html` | **0** | 6 | ✅ |

---

## Komponenten-Einsatz pro Seite (Inkl. Häufigkeit)

| Seite/Feature | `app-page-container` | `app-page-header` | `app-card` | `app-entity-card` | `app-stat-card` | `app-modal-shell` | `btn-*` | `form-input` | `glass-card` | Gesamt |
|---|---|---|---|---|---|---|---|---|---|---|
| `activity-feed` | - | - | - | - | - | - | - | - | 3x | **3** |
| `dashboard` | 1x | 1x | - | - | 4x | - | - | - | 4x | **10** |
| `diagnostics` | 1x | 1x | - | - | - | - | 1x | - | - | **3** |
| `family-chart.component` | - | - | - | - | - | - | 1x | - | - | **1** |
| `family-detail` | 1x | 1x | - | - | - | 2x | 5x | 2x | 7x | **18** |
| `family-event-card` | - | - | - | - | - | - | 3x | 11x | 1x | **15** |
| `family-list` | 1x | 1x | - | 1x | - | - | - | - | 2x | **5** |
| `gedcom-io` | 1x | 1x | - | - | - | - | 2x | - | - | **4** |
| `image-cropper` | - | - | - | - | - | - | 5x | - | - | **5** |
| `login` | - | - | - | - | - | - | 1x | 2x | - | **3** |
| `map-view` | - | - | - | 1x | - | - | 2x | - | 4x | **7** |
| `media-add-modal` | - | - | - | - | - | 1x | 2x | 5x | - | **8** |
| `media-gallery` | 1x | 1x | - | 1x | - | 1x | 6x | 14x | 10x | **34** |
| `media-selector` | - | - | - | - | - | 1x | 1x | - | - | **2** |
| `person-create-modal` | - | - | - | - | - | 1x | 1x | 3x | 2x | **7** |
| `person-detail` | 1x | 1x | - | - | - | 4x | 2x | 12x | - | **20** |
| `person-expert-basics-tab` | - | - | - | - | - | 1x | - | 5x | 3x | **9** |
| `person-expert-relations-tab` | - | - | - | - | - | - | 1x | 4x | 2x | **7** |
| `person-expert-timeline-tab` | - | - | - | - | - | - | 2x | 6x | 3x | **11** |
| `person-list` | 1x | 1x | - | 1x | - | - | 1x | - | 3x | **7** |
| `person-tab-associations` | - | - | - | - | - | 2x | 1x | 12x | 2x | **17** |
| `person-tab-citations` | - | - | - | - | - | 2x | 1x | 7x | 2x | **12** |
| `person-tab-dna` | - | - | - | - | - | 2x | 1x | 10x | 2x | **15** |
| `person-tab-media` | - | - | - | - | - | 2x | 3x | 4x | 2x | **11** |
| `person-tab-names` | - | - | - | - | - | 2x | 1x | 6x | 2x | **11** |
| `person-tab-notes` | - | - | - | - | - | 2x | 1x | 8x | 2x | **13** |
| `place-list` | 1x | 1x | - | 1x | - | - | 1x | - | 1x | **5** |
| `place-modal` | - | - | - | - | - | 1x | 1x | 17x | 8x | **27** |
| `repository-list` | - | - | - | 1x | - | 1x | 1x | 5x | 1x | **9** |
| `search-results` | 1x | 1x | - | 1x | - | - | - | - | - | **3** |
| `settings` | 1x | 1x | - | - | - | - | 1x | - | - | **3** |
| `source-list` | 1x | 1x | - | 1x | - | - | 2x | - | 1x | **6** |
| `source-modal` | - | - | - | - | - | 1x | 1x | 7x | - | **9** |
| `statistics` | 1x | 1x | - | - | 4x | - | 1x | - | 4x | **11** |
| `timeline` | 1x | - | - | - | - | - | - | - | - | **1** |
| `tree-management` | 1x | 1x | - | - | - | - | 3x | 6x | 3x | **14** |
| `update-settings` | 1x | 1x | - | - | - | - | 3x | - | 4x | **9** |
| `user-management` | - | - | - | - | - | - | 1x | - | - | **1** |

---

## Verbliebene strukturelle Inkonsistenzen (Architektur)
Diese Punkte betreffen nicht die Farb-Tokens, sondern das grundsätzliche HTML-Layout und können bei zukünftigen Überarbeitungen der jeweiligen Seiten angegangen werden:

| Problem | Betroffene Seiten | Empfehlung |
|---|---|---|
| Struktur ohne cards | `settings.html` | Einstellungs-Sektionen langfristig in `app-card` wrappen |
| Fehlt `app-page-header` | `timeline.html` | `app-page-header` einfügen |
| Fehlt `app-page-container` | `repository-list.html` | Seiten-Shell angleichen |
| Empty States leicht variabel | diverse Listen | Einheitliches Empty-State-Pattern (Icon + Text + optionaler CTA) als eigene Komponente (`<app-empty-state>`) auslagern |

---

## Fazit: Ziel erreicht 🎯
- Erfolgreicher Abschluss der UI-Standardisierung 
- Alle Legacy-Klassen (`bg-surface-*`, `text-state-*`) aus den HTML-Templates entfernt
- Konsistente Anwendung von Glassmorphism und den Tailwing-Theme Farben (`ui-*`, `brand-*`, `accent-*`)

---

## UI-Komponenten Dokumentation

Hier ist eine Übersicht über die dedizierten, wiederverwendbaren Custom-Components (`app-*` und wesentliche CSS-Klassen) der Heritago-Anwendung:

### Layout & Struktur
- **`app-page-container`**: Wrapper für den Hauptinhalt einer Ansicht. Erzeugt ein responsives zentriertes Layout mit definierten seitlichen Abständen (`px-4 md:px-12`) und ordnet den Seitenbereich ein. Über den Input `[wide]="true"` kann die maximale Breite von `max-w-6xl` auf `max-w-[1600px]` erhöht werden.
- **`app-page-header`**: Der Standard-Seitenkopfbereich. Hebt den Haupttitel (`h1`) und eine optionale Beschreibung hervor. Über `<ng-content select="[actions]">` lassen sich außerdem globale Buttons für die Seite (z.B. "Neu anlegen") auf der rechten Seite einbetten.

### Cards & Container
- **`glass-card` (CSS-Klasse)**: Das zentrale Design-Element für strukturierte Flächen. Erzeugt einen Hintergrund mit Glassmorphism-Effekt und leichten Rahmen (`border-ui-border`). Diese Utility-Klasse wird im gesamten Projekt genutzt, um Bereiche einheitlich im Karteikarten-Gefühl erscheinen zu lassen.
- **`app-card` (@deprecated)**: Ursprüngliche Wrapper-Komponente. Wurde im März 2026 vollständig durch natives HTML mit der Klasse `.glass-card` ersetzt, um mehr Flexibilität in den Headern zu ermöglichen.
- **`app-section-card` (@deprecated)**: Ähnlich wie `app-card`, ebenfalls entfernt und durch `.glass-card` ersetzt.

### Listen & Datenanzeige
- **`app-entity-card`**: Die wichtigste Komponente zur Auflistung einzelner Datensätze (Person, Familie, Ort etc.). Sie liefert immer einen Titel, optional einen Avatar (oder Icon) auf der linken Seite sowie Untertitel (Subtitle und Meta). Die Entitäts-Karte wird hervorgehoben durch einen farbigen linken Rand (`badgeColor`), der semantische Stati oder Typen (`primary`, `highlight`, `success`, `danger`, `neutral`) visualisieren kann. Typischerweise leitet ein Klick via `routerLink` zum Detail-Datensatz weiter.
- **`app-stat-card`**: Wird auf Dashboards und Übersichten (z.B. Statistics) verwendet. Sie zeigt eine große Zahl (`value`) mit einem kleinen Label (z.B. "Personen" oder "Medien") an. Durch ein dezent gehaltenes Hintergrund-Icon sowie Hover-Effekte mit spezifischen Akzentfarben (`accent`: brand, emerald, amber, purple) wird sie optisch zu einem Blickfang gemacht.

### Overlays & Interaktion
- **`app-modal-shell`**: Das Grundgerüst für alle Dialoge/Modals (etwa "Person bearbeiten", "Medium löschen"). Diese Shell liefert automatisch den abgedunkelten, weichgezeichneten Hintergrund (`backdrop-blur-xl`), die weiße Modal-Karte inklusive Header (Titel und "X" zum Schließen) und ein Fußfenster mit den standardisierten Buttons ("Abbrechen", "Speichern", oder optional "Löschen"). Unterstützt Modal-Größen von `sm` bis `xl`.

### Formular & Aktionen (Altbestand, teilweise ersetzt)
- **`app-button` (@deprecated)**: Ursprüngliche Button-Komponente mit Inputs für `variant` (`primary`, `secondary`, `outline` etc.) und `size`. **Hinweis:** Im Rahmen des Design-Audits wurde festgestellt, dass an vielen Stellen inzwischen wieder direkt auf direkte Tailwind-Utility-Klassen (`.btn-primary`, `.btn-secondary`, `.btn-danger`) gesetzt wird statt auf diese Komponente.
- **`app-input` (@deprecated)**: Ursprünglicher Wrapper für Texteingabefelder mit Standard-Design und Label. **Hinweis:** Wird inzwischen ebenfalls zunehmend durch generisches HTML mit der CSS-Klasse `.form-input` anstelle des Component-Tags eingesetzt.

---

## Konsolidierungs- und Bereinigungspotenziale

Die Detailanalyse der im Projekt eingesetzten UI-Komponenten hat konkrete Überschneidungen und Ähnlichkeiten offengelegt. Um die Code-Basis weiter zu entschlacken und einheitlicher zu gestalten, ergeben sich folgende Handlungsfelder:

### ✅ 1. `app-card` vs. `app-section-card` vs. `glass-card` (Wrapper-Redundanz)
    - [x] Konsolidierung auf native `div` mit `.glass-card` (Abgeschlossen am 06.03.2026)
    - [x] Entfernung der obsoleten `app-card.ts` Komponente.
- **Das Problem:** Es existieren aktuell zwei sehr ähnliche Angular-Wrapper (`app-card` und `app-section-card`), deren einziger echter Unterschied die Formatierung ihres optionalen Headers (`h2` = "Standard-Card" vs. kleines `h3` uppercase = "Section-Card") ist. Beide nutzen intern einfach die CSS-Klasse `.glass-card`. Gleichzeitig nutzen stark angepasste Seiten häufig einfach direkt ein `div` mit der Klasse `glass-card`.
- **Lösung:** Man sollte einen Entschluss für **einen** Weg fassen. Eine saubere Lösung wäre es, beide Angular-Komponenten (`app-card` und `app-section-card`) zu **entfernen** und stattdessen überall direkt strukturiertes HTML mit der Klasse `.glass-card` und standardisierten Text-Klassen für den Header zu verwenden. Alternativ: Beide in eine neu überarbeitete, hochflexible `<app-card>` vereinen, die ein `headerVariant="large" | "small"` Property besitzt.

### ✅ 2. Tabellarische vs. Gekachelte Listen

- **Problem:** Die Darstellung von Auflistungen variiert stark. Personen und Familien verwenden Grid-Layouts mit speziellen Cards (`app-entity-card`), während Archive und Quellen teilweise andere Ansätze verwenden. Auch die Suchleisten, "Empty States" und Header-Strukturen sind oft kopiert und minimal inkonsistent eingefügt.
- **Lösung:** Es wurde eine zentrale `<app-list-view>` Architektur-Komponente eingeführt, die standardmäßig den Loading-State, das Empty-State Styling (`text-neutral-400` u. Icons) sowie den Grid-Wrapper (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3...`) kapselt. Diese Komponente wird nun von `person-list`, `family-list`, `place-list`, `source-list` und `media-gallery` einheitlich verwendet.

### 3. Veraltete Formular-Wrapper (`app-button` und `app-input`) ✅
- **Das Problem:** Tailwind CSS-Utility-Klassen (`.btn-primary`, `.form-input`) existieren nun funktionsgleich parallel zu den dedizierten Angular-Komponenten (`<app-button>`, `<app-input>`). Der Einsatz von nativen HTML-Inputs mit Utility-Klassen macht die Arbeit mit Angular Reactive Forms leichter, performanter und weniger fehleranfällig als eine zusätzliche Wrapper-Komponente.
- **Lösung (Erledigt):** Die Komponenten `app-button` und `app-input` wurden komplett aus dem Projekt (`src/app/ui/*`) gelöscht, da sie in den HTML-Templates nicht mehr referenziert wurden.

### 4. Inkonsistente Verwendung von Seiten-Shells
- **Das Problem:** Zwar nutzen die meisten Seiten erfolgreich `app-page-container` plus `app-page-header`, aber bei Detail-Ansichten mit Tabs (z.B. Person-Detail, Family-Detail) oder Sonderseiten (`repository-list`, `timeline`) bricht dieses Konstrukt zum Teil leicht aus oder wird weggelassen.
- **Lösung:** Ein globaler Master-Layout-Container (z.B. in der `app.component.html`), der den Page-Container und Router-Outlet strikt umschließt, würde die absolute Pflicht zum Einbinden des Wrappers auf Inhaltsseiten-Ebene beseitigen.
