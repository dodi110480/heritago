# Design-Audit — Stand März 2026 (nach PersonDetail & FamilyDetail Refaktorierung)

## Legende
- ✅ = voll konform (semantische Tokens, AppCard/glass-card, btn-* Utilities)
- ⚠️ = teilweise konform (Mischung aus Legacy & semantisch)
- ❌ = größere Inkonsistenzen, Legacy-Klassen dominant

## Farbtoken-Status (Legacy vs. Semantisch)
> **Legacy** = `bg-surface-dark`, `bg-surface-darkest`, `text-state-error`, `text-[#…]`  
> **Semantisch** = `bg-ui-*`, `text-ui-*`, `text-brand-*`, `text-accent-*`

| Seite | Zeilen | Legacy | Semantisch | Status |
|---|---|---|---|---|
| `person-detail.html` | 290 | 0 | 2 | ✅ |
| `family-detail.html` | 185 | 0 | 32 | ✅ |
| `dashboard.html` | 168 | 0 | 13 | ✅ |
| `person-list.html` | 109 | 0 | 12 | ✅ |
| `family-list.html` | 62 | **4** | 2 | ⚠️ |
| `source-list.html` | 106 | **1** | 6 | ⚠️ |
| `place-list.html` | 171 | 0 | 10 | ✅ |
| `settings.html` | 92 | 0 | 11 | ✅ |
| `statistics.html` | 95 | **4** | 2 | ⚠️ |
| `search-results.html` | 41 | 0 | 4 | ✅ |
| `media-gallery.html` | 308 | **5** | 17 | ⚠️ |
| `timeline.html` | 79 | **2** | 2 | ⚠️ |
| `repository-list.html` | ~80 | **1** | 2 | ⚠️ |
| `gedcom-io.html` | ~90 | 0 | 10 | ✅ |
| `source-modal.html` | ~120 | **7** | 0 | ❌ |
| `diagnostics.html` | ~100 | **4** | 7 | ⚠️ |
| `image-viewer.html` | ~50 | **1** | 11 | ⚠️ |
| `media-add-modal.html` | ~80 | **1** | 1 | ⚠️ |
| `place-modal.html` | ~60 | **1** | 0 | ⚠️ |
| `update-settings.html` | ~90 | **1** | 5 | ⚠️ |

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
| `statistics` | ✅ | ✅ | – | – | – | ✅ | – |
| `search-results` | ✅ | ✅ | – | – | – | – | – |
| `media-gallery` | ✅ | ✅ | – | ✅ x4 | – | ✅ | ✅ |
| `timeline` | ✅ | – | – | – | – | – | – |
| `repository-list` | – | – | – | ✅ x1 | ✅ x2 | ✅ | ✅ |
| `gedcom-io` | ✅ | ✅ | – | – | – | ✅ | – |

---

## Priorisierte Inkonsistenzen

### 🔴 Priorität 1 — Sofort beheben (kritisch)

**`source-modal.html`** — 7 Legacy-Tokens, 0 semantische
- Kein einziger `ui-*` Token, noch komplett auf alten `bg-surface-*` Klassen
- Wahrscheinlich noch nie überarbeitet worden
- Fix: `form-input`, `glass-card`, semantische Farbtokens eintragen

**`statistics.html`** — 4 Legacy-Tokens
- Nutzt `bg-surface-lightest`, `bg-surface-light`, `bg-surface-darkest`, `bg-surface-dark` für Stat-Karten
- Kein `app-card` oder `glass-card` verwendet
- Fix: Stat-Karten in `glass-card` wrappen, Farbklassen ersetzen

### 🟡 Priorität 2 — Mittelfristig

**`family-list.html`** — 4 Legacy-Tokens (`bg-surface-dark`, `bg-surface-darkest`)
- Familienkarten nutzen rohe divs statt `glass-card`
- Konsistenz mit `person-list.html` herstellen (die ist bereits sauber)

**`media-gallery.html`** — 5 Legacy-Tokens, größte Datei (308 Zeilen)
- `bg-surface-darkest` für Thumbnails und Modal-Bereiche
- Teilweise schon `glass-card`, aber inkonsistent angewendet

**`diagnostics.html`** — 4 Legacy-Tokens
- Technische Seite, niedriger Traffic; dennoch inkonsistente Darstellung

**`timeline.html`** — 2 Legacy-Tokens (`bg-surface-dark`)
- Zeitstrahl-Karten nutzen noch alte Klassen

### 🟢 Priorität 3 — Bei nächster Bearbeitung mitnehmen

- `image-viewer.html`: 1 Legacy-Token
- `media-add-modal.html`: 1 Legacy-Token
- `place-modal.html`: 1 Legacy-Token
- `repository-list.html`: 1 Legacy-Token
- `source-list.html`: 1 Legacy-Token
- `update-settings.html`: 1 Legacy-Token

---

## Strukturelle Inkonsistenzen

| Problem | Betroffene Seiten | Empfehlung |
|---|---|---|
| `settings.html` hat keine cards | `settings.html` | Einstellungs-Sektionen in `app-card` wrappen |
| `statistics.html` hat keine cards | `statistics.html` | Stat-Grid in `glass-card`/`app-card` |
| `timeline.html` ohne `app-page-header` | `timeline.html` | `app-page-header` einfügen |
| `repository-list.html` ohne `app-page-container` | `repository-list.html` | Seiten-Shell angleichen |
| Leere Zustände (Empty States) nicht überall gleich | `source-list`, `statistics`, `search-results` | Einheitliches Empty-State-Pattern (Icon + Text + optionaler CTA) |

---

## Was sich seit letztem Audit verbessert hat

| Bereich | Vorher | Jetzt |
|---|---|---|
| `person-detail.html` | 1180 Zeilen, alles inline | 290 Zeilen, 6 Subkomponenten |
| `family-detail.html` | Rohe `div`-Sektionen, `prompt()` | 4× `AppCard`, `glass-card`, Modals, 0 Legacy-Tokens |
| `person-tab-*` (×6) | — existierten nicht | Neue standalone Komponenten mit semantischen Tokens |
| `family-event-card` | — existierte nicht | Neue standalone Subkomponente |
| `prompt()` / `alert()` / `confirm()` | In `family-detail.ts` | Ersetzt durch `AppModalShell`-Dialoge |
