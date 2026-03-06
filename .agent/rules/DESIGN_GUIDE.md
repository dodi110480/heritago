---
trigger: always_on
---

# Heritago Design Guide – ultra-kompakt

**Prinzipien**  
- Nur `src/app/ui`-Komponenten + Tailwind-Tokens (keine Hex-Codes)  
- Mobile-first + progressive enhancement (Desktop = wide-Features)  
- Dark Mode: alle Komponenten mit `dark:`-Varianten  
- Animation: 140–220 ms ease-out, nur opacity/transform/scale/filter  
- Kontrast: ≥4.5:1 überall  

**Layout**  
- Alles via `AppShellComponent`  
- Kein manuelles `<app-page-container>`  
- Standard: max-w-7xl zentriert, auto-padding  
- Wide: `data: { wide: true }` in routes (Stammbaum/Karte/Stats)  

**Kern-Komponenten**  
- `app-page-header` — title, desc | slots: breadcrumbs, actions  
- `app-section-header` — title, icon?, desc?, accent?  
- `.glass-card` — p-6/p-8, blur(12–16px), bg-canvas/65–75, border-white/18 dark:border-black/14, shadow-sm  
  Fallback: bg-canvas/90 + shadow-md  
- `app-empty-state` — icon, title, message | slot: actions  
- `app-avatar` — imageUrl?, gender(M/F/O), size(xs–2xl)  

**Farben** (Tokens)  
brand           → primary actions  
canvas          → backgrounds  
accent-highlight → focus/selected  
accent-danger   → errors/delete  
neutral         → secondary text/borders  

**Listen**  
- Immer `app-list-view` (Personen/Familien/Orte/…)  
  → Loading + Empty + Grid/List-Switch + Enter-Anim  

**Typo** (Empfehlung)  
- Font: Inter / system-ui  
- Scale 1.25: xs 0.8125rem → 3xl 2.25rem  
- Line-height 1.5–1.625 | Weights 400/500-600/700  

**Regeln kurz**  
- Keine size/margin/padding-Animationen  
- Hover/Focus: scale-102 oder brightness-105  
- Focus-visible: outline-2 brand-500 offset-2  
- Buttons: min-h-44 (Touch)  

**Merksatz**  
„ui-Komponenten + Tokens only. Glass mit Kontrast/Fallback. Dark nicht vergessen. Mobile first. Listen = app-list-view.“