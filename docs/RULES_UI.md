# RULES_UI.md – Heritago UI-Regeln

## 1. Komponenten & Struktur
- Alle UI-Komponenten → `src/app/ui`
- Keine business-Logik in UI
- Wiederverwendbare, zustandsarme Komponenten
- AppShell als Root-Layout, kein manuelles `<app-page-container>`

## 2. Farben & Tokens
- Nur Tailwind-Tokens (keine Hex-Codes)
- Dark Mode: alle Komponenten mit `dark:` Varianten
- Tokens:
  - `brand` → primary actions
  - `canvas` → backgrounds
  - `accent-highlight` → focus/selected
  - `accent-danger` → errors/delete
  - `neutral` → secondary text/borders

## 3. Layout & Spacing
- Mobile-first + progressive enhancement
- max-w-7xl, zentriert, auto-padding
- Wide-Layouts via `data: { wide: true }` in Routes
- Standard-Padding:
  - Card: p-6 (default), p-8 (large)
  - Sections: mt-8 / mt-12
  - Stack: space-y-4 / space-y-6

## 4. Typografie
- Font: Inter / system-ui
- Scale: xs 0.8125rem → 3xl 2.25rem
- Line-height: 1.5–1.625
- Weights: 400 / 500-600 / 700

## 5. Listen & Tabellen
- Listen → `app-list-view` (grid/list switch, loading, empty state)
- Tabellen: overflow-x-auto, sticky header optional, text-sm
- Keine Inline-Styling oder random Klassen

## 6. Animationen
- 140–220 ms, ease-out
- Nur opacity / transform / scale / filter
- Hover/Focus: scale-102 oder brightness-105
- Focus-visible: outline-2 brand-500 offset-2
- Keine size/margin/padding-Animationen

## 7. Buttons & Touch
- **Button-Hierarchie**: Buttons zum Hinzufügen, Erstellen oder Bearbeiten von Inhalten gehören (innerhalb von Sektionen) ausschließlich in den Header oben rechts (`app-section-header`).
- **Keine Redundanz**: Vermeide doppelte Buttons innerhalb von `app-empty-state` Komponenten, wenn bereits ein Button im Header vorhanden ist.
- Buttons min-h-44 (Touch-friendly)
- Icon-Buttons: Default 20px, Header 24px, EmptyState 32–40px
- Kein Inline-Event-Handling, alles via Angular-Events

## 8. Glass & Cards
- `.glass-card` → blur 12–16px, bg-canvas/65–75, border-white/18, dark:border-black/14, shadow-sm
- Fallback: bg-canvas/90 + shadow-md
- Kontrast immer ≥4.5:1

## 9. Bilder & Avatare
- `app-avatar`: imageUrl?, gender(M/F/O), size(xs–2xl)
- Originalbilder → unverändert, Crops nur für Varianten
- Variantenerzeugung asynchron

## 10. REST & API
- Keine Pfade oder interne IDs in UI
- Alle Endpunkte → authentifiziert, rate-limited
- UI greift nur auf DTOs / Metadaten zu

## 11. Merksatz für Entwickler
> „UI-Komponenten + Tokens only. Glass mit Kontrast/Fallback. Dark nicht vergessen. Mobile first. Listen = app-list-view. Padding/Spacing konsistent. Keine business-Logik in UI.“