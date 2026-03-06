# Design-Audit — Stand März 2026 (FINAL)

## Zusammenfassung
Das gesamte Fronend-Projekt wurde erfolgreich auf das neue semantische Design-System umgestellt. 
**Es existieren keine alten Hintergrund- oder Fehlerfarben (`bg-surface-dark`, `text-state-error` etc.) mehr in den HTML-Dateien.** Alle Sektionen nutzen konsequent `glass-card`, `AppCardComponent` oder die passenden semantischen Tokens (`bg-ui-panel`, `text-accent-danger-500` etc.).

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
| `family-detail` | 1x | 1x | 4x | - | - | 2x | 5x | 2x | 3x | **18** |
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
| `person-expert-basics-tab` | - | - | 1x | - | - | 1x | - | 5x | 2x | **9** |
| `person-expert-relations-tab` | - | - | 1x | - | - | - | 1x | 4x | 1x | **7** |
| `person-expert-timeline-tab` | - | - | 1x | - | - | - | 2x | 6x | 2x | **11** |
| `person-list` | 1x | 1x | - | 1x | - | - | 1x | - | 3x | **7** |
| `person-tab-associations` | - | - | 1x | - | - | 2x | 1x | 12x | 1x | **17** |
| `person-tab-citations` | - | - | 1x | - | - | 2x | 1x | 7x | 1x | **12** |
| `person-tab-dna` | - | - | 1x | - | - | 2x | 1x | 10x | 1x | **15** |
| `person-tab-media` | - | - | 1x | - | - | 2x | 3x | 4x | 1x | **11** |
| `person-tab-names` | - | - | 1x | - | - | 2x | 1x | 6x | 1x | **11** |
| `person-tab-notes` | - | - | 1x | - | - | 2x | 1x | 8x | 1x | **13** |
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
