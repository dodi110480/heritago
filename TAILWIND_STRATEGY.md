# Tailwind Design & Architektur-Strategie

Um Heritago konsistent und wartbar zu gestalten, nutzen wir einen hybriden Ansatz: **Utility-First für Layouts** und **Komponenten-Abstraktion für wiederkehrende UI-Elemente**.

## 1. Design Tokens (Die Basis)
Alle zentralen Design-Entscheidungen leben in der `tailwind.config.js`. Das garantiert, dass "Brand Blue" überall exakt gleich aussieht.

*   **Farben**: Definition von `brand`, `surface` und `slate` Paletten.
*   **Radii**: `4xl` (32px) für das charakteristische Glassmorphismus-Gefühl.
*   **Blurs**: `glass` (16px) für konsistente Tiefe.

## 2. Komponenten-Hierarchie
Wir strukturieren die UI in drei Ebenen:

### Ebene A: "Primitive" UI-Komponenten (`src/app/ui/`)
Das sind die kleinsten Bausteine. Sie kapseln Tailwind-Komplexität.
*   **Beispiele**: `app-button`, `app-input`, `app-badge`.
*   **Stil**: Verwenden `ViewEncapsulation.None` und `@apply` in ihrem CSS (oder Utilities direkt im Template), um ein konsistentes API nach außen zu bieten.

### Ebene B: Layout-Container
Struktur-Komponenten, die den Rahmen vorgeben.
*   **Beispiele**: `app-page-container`, `app-card`, `app-page-header`.
*   **Stil**: Definieren meist nur Gaps, Padding und Hintergrundeffekte (Glass).

### Ebene C: Features & Pages
Hier wird Utility-First gelebt.
*   **Beispiel**: `person-detail.html`.
*   **Stil**: Kombiniert Ebene A & B Bausteine und nutzt Utilities für das konkrete Page-Layout (`grid`, `flex`, `hidden md:block`).

## 3. Glassmorphismus-System
Da Heritago einen Premium-Look hat, nutzen wir ein festes Set an CSS-Klassen:
```css
/* In styles.css @layer components */
.glass-panel {
  @apply bg-slate-900/40 backdrop-blur-md border border-white/10 shadow-xl;
}
```

## 4. Best Practices
1.  **Utilities im HTML**: Standardweg für Layouts (Breiten, Gaps, Flex).
2.  **@apply im CSS**: NUR wenn ein Muster mehr als 5-mal identisch vorkommt (z.B. `.app-input`).
3.  **Keine Inline-Styles**: Farben/Abstände immer über Tailwind-Klassen beziehen.
4.  **ViewEncapsulation.None**: Für alle Komponenten, die Tailwind-Klassen im Template nutzen, um Selektor-Probleme zu vermeiden.

## Nächste Schritte
*   Bestehende UI-Elemente in `src/app/ui/` auf dieses Schema prüfen.
*   `styles.css` Schicht für Schicht von `@theme` (v4 Resten) auf v3 Struktur säubern.
*   Dashboard und Statistiken als nächste Kandidaten für die Konvertierung vormerken.
