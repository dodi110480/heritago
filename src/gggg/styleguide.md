# Heritago Styleguide

Dieses Dokument definiert die Design-Prinzipien und UI-Komponenten für die Heritago Web-App. Zukünftige Erweiterungen müssen diesem Stil folgen.

## 1. Globales Layout & Hintergrund
- **Hintergrund**: Dunkles Design mit radialen Verläufen (Slate-Palette).
- **Zentraler Content**: Alle Hauptinhalte liegen in einer `.glass-card` mit starkem Blur-Effekt (16px+).
- **Typografie**: 'Inter' oder System-Sans-Serif.

## 2. Glass-Cards
- **Desktop**: Großzügiges Padding (4rem), abgerundete Ecken (32px).
- **Farbe**: `rgba(30, 41, 59, 0.7)` (Slate 800 semi-transparent).
- **Schatten**: Große, weiche Schatten für Tiefe.

## 3. Modals & Dialoge
- **Backdrop**: Stark abgedunkelt (`rgba(15, 23, 42, 0.8)`) mit Backdrop-Filter Blur (8px).
- **Modal-Card**:
    - **Hintergrund**: Reinweiß (`#ffffff`).
    - **Ecken**: Stark abgerundet (24px - 32px).
    - **Header/Footer**: Abgehobener Hintergrund (`#f8fafc`), klare Trennung durch 1px Border (`#e2e8f0`).
- **Abstände**: Konsistentes Padding (24px).

## 4. Buttons
- **Primary**: Blau (`#3b82f6`), bei Hover dunkler.
- **Secondary**: Weiß mit Border (`#cbd5e1`), bei Hover leichter Grauton.
- **Danger**: Sanftes Rot (`#fee2e2`) mit tiefrotem Text (`#b91c1c`).
- **Radius**: Alle Buttons haben einen Radius von 10px - 12px.

## 5. Formular-Elemente
- **Inputs**: 12px Border-Radius, Fokus-Ring in Primärfarbe (Blue).
- **Labels**: Fettgedruckt, Slate 600 - 700.

## 6. Stammbaum-Ansicht
- **Hintergrund**: KEINE OSM-Karte. Stattdessen der globale Dashboard-Hintergrund.
- **Karten**: Slate 100 Basis, farbige Rahmen je nach Geschlecht (Blau/Rot/Violett).
