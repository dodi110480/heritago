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

## Komponenten-Einsatz pro Seite

| Seite | app-page-container | app-page-header | app-card | glass-card | app-modal-shell | btn-* | form-input |
|---|---|---|---|---|---|---|---|
| `person-detail` | ✅ | ✅ | – | via Tabs | ✅ | ✅ | ✅ |
| `family-detail` | ✅ | ✅ | ✅ x4 | ✅ | ✅ x2 | ✅ | ✅ |
| `dashboard` | ✅ | ✅ | – | ✅ x5 | – | – | – |
| `person-list` | ✅ | ✅ | – | ✅ x3 | – | ✅ | – |
| `family-list` | ✅ | ✅ | – | ✅ x2 | – | – | – |
| `source-list` | ✅ | ✅ | – | ✅ x1 | – | ✅ | – |
| `place-list` | ✅ | ✅ | – | ✅ x5 | ✅ x3 | ✅ | ✅ |
| `settings` | ✅ | ✅ | – | – | – | ✅ | – |
| `statistics` | ✅ | ✅ | – | ✅ x4 | – | ✅ | – |
| `search-results` | ✅ | ✅ | – | – | – | – | – |
| `media-gallery` | ✅ | ✅ | – | ✅ x4 | – | ✅ | ✅ |
| `timeline` | ✅ | – | – | – | – | – | – |
| `repository-list` | – | – | – | ✅ x1 | ✅ x2 | ✅ | ✅ |
| `gedcom-io` | ✅ | ✅ | – | – | – | ✅ | – |

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
