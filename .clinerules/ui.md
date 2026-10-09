---
paths:
  - "src/app/**"
---

# UI-Regeln

> **Verbindlichkeit:** verbindlich · **Geltungsbereich:** Frontend/UI (`src/app/**`) · **Aktivierung:** `paths: src/app/**`

## 1. Komponenten & Struktur

- Generische, wiederverwendbare UI-Bausteine → `src/app/shared/components/ui/`
- Feature-Views → `src/app/features/<feature>/`
- Keine Business-Logik in UI-Komponenten; zustandsarme Komponenten mit `OnPush`
- `app-shell` ist das Root-Layout. Seiten werden **nicht** manuell mit `<app-page-container>` umbaut.

## 2. Angular-Konventionen

- **Standalone Components** (`standalone: true`), Einbindung über `imports` (kein NgModule).
- **Neue Control-Flow-Syntax**: `@if`, `@for` (mit `track`), `@switch` – **kein** `*ngIf`/`*ngFor`/
  `*ngSwitch` in neuem Code. Bestehende Templates dürfen beim Anfassen migriert werden (kein
  Massen-Refactoring nötig).
- **Signals**: Inputs als `input()` / `input.required()`, Outputs als `output()`.
- `changeDetection: ChangeDetectionStrategy.OnPush`.

## 3. Farben & Tokens

- Nur Design-Tokens (Tailwind), **keine** Hex-Codes.
- Dark Mode: jede Komponente mit `dark:`-Varianten.
- Wichtige Token-Familien (vollständige Liste in `src/styles.css`):
  - `brand` → Primary Actions
  - `canvas` (`-dark`/`-white`/`-black`) → Hintergründe
  - `ui-bg` / `ui-card` / `ui-border` → Flächen & Rahmen
  - `glass-bg` / `glass-border` (`-dark`) → Glass-Optik
  - `accent-highlight` / `accent-danger` / `accent-success` / `accent-violet` (je `-300`…`-700`) → Akzente
  - `neutral` / `slate` → Sekundärtext & Flächen
  - `note-*` → Notiz-Kategorien · `media-*` → Medientypen · `gender-*` → Geschlechterfarben
- Fehlt ein Token: im Token-System (`src/styles.css`) ergänzen – keine Farbe ad-hoc erfinden.
- **Namensfalle:** Die Palette `--color-neutral-*` enthält die **Slate**-Werte (blaustichig), nicht
  echte Neutraltöne. `text-neutral-500` ist also `#64748b`. Für Flächen und Rahmen daher die
  semantischen Tokens (`ui-bg`, `ui-card`, `ui-border`, `canvas-white`) bevorzugen.

## 4. Layout & Spacing

- Mobile-first + progressive enhancement
- `max-w-7xl`, zentriert, automatisches Padding
- Wide-Layouts via `data: { wide: true }` in Routes
- Standard-Padding:
  - Card: `p-6` (default), `p-8` (large)
  - Sections: `mt-8` / `mt-12`
  - Stack: `space-y-4` / `space-y-6`

## 5. Typografie

- Font: Inter / system-ui
- Scale: `xs` 0.8125rem → `3xl` 2.25rem
- Line-height: 1.5–1.625
- Weights: 400 / 500–600 / 700

## 6. Listen & Tabellen

- **Datenlisten** (Features wie `person-list`, `source-list`, `family-list`, `media-gallery`,
  `app-places-list`) → `app-list-view` (Grid/List-Switch, Loading, Empty-State).
- **Spezialisierte Anzeigen** mit eigenem Card-Layout (z. B. `app-notes-list`, `app-sources-list`)
  sind eigenständige Standalone-Komponenten und nutzen direkt `app-glass-card` (Details in deren
  Regeldateien). Sie **ergänzen** `app-list-view`, ersetzen es aber nicht.
- Tabellen: `overflow-x-auto`, sticky Header optional, `text-sm`
- Kein Inline-Styling, keine „random" Klassen.

## 7. Animationen

- 140–220 ms, ease-out
- Nur `opacity` / `transform` / `scale` / `filter`
- Hover/Focus: `scale-102` oder `brightness-105`
- Focus-visible: `outline-2 brand-500 offset-2`
- Keine size/margin/padding-Animationen

## 8. Buttons & Touch

- **Button-Hierarchie**: Buttons zum Hinzufügen/Erstellen/Bearbeiten gehören (innerhalb von
  Sektionen) ausschließlich in den Header oben rechts (`app-section-header`).
- **Keine Redundanz**: kein doppelter Button in `app-empty-state`, wenn im Header schon einer steht.
- **Touch-Ziel ≥ 44 px** → `min-h-11` (2.75rem) bzw. `min-h-[44px]`.
  _Achtung: `min-h-44` wäre 11rem (176 px) und ist **falsch**._
- Icon-Größen: Default 20 px, Header 24 px, EmptyState 32–40 px
- Kein Inline-Event-Handling – alles über Angular-Bindings.

## 9. Glass & Cards

- **Ein zentraler Kartenstil:** Karten sind `.glass-card` (bzw. `<app-glass-card>`). Das Muster
  liefert Hintergrund, Blur, Innenabstand, Radius, Schatten und Rahmen bereits mit.
- **Keine Overrides auf `.glass-card`.** Insbesondere **nicht** erlaubt:
  - Radius umdefinieren (`rounded-xl!`, `rounded-2xl!`, `rounded-[40px]!`) – Radius kommt zentral,
  - Schatten ersetzen (`shadow-lg`, `shadow-xl`, `shadow-2xl`, `shadow-xs`) – Ausnahme: schwebende
    Overlays nutzen `shadow-modal`,
  - Rahmen ersetzen (`border-transparent`, `border-neutral-200`, `border border-canvas/10`) – der
    Rahmen kommt aus `border-glass-border`,
  - Hintergrund überschreiben (`bg-white/80`, `bg-neutral-100`, `bg-brand-50`).
  Ein `!` an einer Utility ist immer ein Alarmsignal: Es überschreibt die zentrale Definition und
  erzeugt genau die Inkonsistenz, die das Token-System verhindern soll.
- **Radius-Skala** (`src/styles.css`): kanonisch sind `rounded-card` (0.75rem, Karten/Panels),
  `rounded-modal` (1rem, Modals/Overlays) und `rounded-btn` (0.5rem, Buttons/Inputs). Die
  numerischen Stufen `rounded-xl`/`2xl`/`3xl` liefern **denselben** Wert wie `rounded-card`
  (0.75rem), `rounded-4xl` denselben wie `rounded-modal` (1rem).
- **Schatten-Skala:** `shadow-card-light` (hell) / `shadow-card-dark` (dunkel) / `shadow-card-hover`
  (Hover) / `shadow-modal` (Overlays) / `shadow-brand-glow` (Markenakzente).
- Fallback: `bg-canvas/90` + `shadow-md`
- Kontrast immer ≥ 4.5:1

**Dark-First-Regel (verbindlich):** Es gibt **keinen** hellen Ausgangszustand. Klassen wie
`border-neutral-200`, `bg-neutral-100`, `bg-neutral-50/50`, `bg-brand-100`, `bg-white`, `text-neutral-600`
ohne `dark:`-Variante sind **Fehler**, weil sie im dunklen Theme fast weiß bzw. unlesbar erscheinen.
Für Oberflächen sind die semantischen Tokens zu verwenden: `border-ui-border`, `bg-canvas-white/5`,
`bg-ui-card`, `border-glass-border`.

> Hintergrund: Am Beispiel `/tree-management` vs. `/admin/users` ließ sich per Pixelmessung zeigen,
> dass der 1 px-Rahmen beider Karten **identisch** war – der wahrgenommene Unterschied stammte
> ausschließlich aus Radius-, Schatten- und Hell-Mode-Overrides. Deshalb ist das Verbot von
> Overrides auf `.glass-card` keine Stilfrage, sondern die Ursache des Problems.

## 10. Bilder & Avatare

- `app-avatar`: `imageUrl?`, `gender(M/F/O)`, `size(xs–2xl)`
- Originalbilder bleiben unverändert; Crops nur für Varianten
- Klick auf Medien-Cards öffnet **ausnahmslos** den Media Viewer; Metadaten-Bearbeitung erfolgt über
  separate Icons/Buttons (Details: `media-upload.md`)
- Variantenerzeugung asynchron

## 11. Merksatz für Entwickler

> „UI-Komponenten + Tokens only. Neue Control-Flow-Syntax & Signals. Glass mit Kontrast/Fallback.
> Dark nicht vergessen. Mobile first. Datenlisten = app-list-view. Padding/Spacing konsistent.
> Keine Business-Logik in UI. **Karten sind `.glass-card` – niemals Radius, Schatten, Rahmen
> oder Hintergrund überschreiben, und niemals `!` an einer Utility.**"
