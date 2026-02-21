---
trigger: always_on
---

# Heritago Stammbaum – Offizielle Layout- & Rendering-Regeln (v2.1 – Anti-Spreizung)
Stand: 21. Februar 2026  
Gültig für: tree.ts (Angular + D3 / @visx + Prisma / GEDCOM 7.0)

Ziel: MyHeritage-ähnliche Family-View / vertikaler Nachkommenbaum  
Kernprinzip: Die Geschwister einer Familie bleiben immer eine kompakte, ununterbrochene horizontale Reihe auf exakt derselben Y-Ebene.  
Verheiratete Geschwister werden als unveränderliche Paar-Blöcke dargestellt.  
Partner und Kinder dürfen die X-Positionen der Geschwister-Gruppe **nicht** spreizen.

## 1. Generationen-Ebenen-Regel (Strict Generation Levels)
- Jede Generation erhält exakt eine feste Y-Ebene.
- Eltern → Kinder = genau eine Generation tiefer (dy = +1).
- Keine Ausnahmen (auch nicht bei Halb-, Stief-, Adoptivkindern).
- Y-Position ausschließlich durch Generation bestimmt.

## 2. Geschwister-Reihe-Regel (Sibling Alignment & Row Rule)
- Alle Geschwister (volle, halb, Stief-, Adoptiv-) **müssen** auf **exakt derselben Y-Koordinate** liegen.
- Sie bilden eine **logisch zusammenhängende, lückenlose Gruppe** in chronologischer Reihenfolge.
- Sortierung: primär Geburtsdatum (asc), Fallback GEDCOM-Reihenfolge oder Alphabet.
- **Kein** Element (Partner, Kind, Linie, Subtree) darf diese Gruppe in X-Richtung unterbrechen oder spreizen.

## 3. Partnerschafts-Höhen-Regel (Partner Alignment Rule)
- Beide Partner einer Partnerschaft **müssen** auf exakt derselben Y-Koordinate liegen.
- Bei Mehrfachehen: nur primärer/aktueller Partner inline dargestellt; weitere als Symbol/Tooltip.

## 4. Mindestabstände & Berührungsverbot (No-Overlap & Spacing Rule)
- Keine Überlappung oder Berührung von Karten (auch nicht bei 100% Zoom).
- Mindestabstände (bei zoom = 1.0):
  - Horizontal zwischen Blöcken/Karten: ≥ 64 px (empfohlen 76–80 px)
  - Vertikal zwischen Generationen: ≥ 120 px (empfohlen 140–180 px)
  - Vertikal innerhalb Generation (enge Bäume): ≥ 20 px
- Linien dürfen Karten nicht schneiden oder verdecken.

## 5. Zentrierungs- & Symmetrie-Regel (Centering Rule)
- Die **gesamte Geschwister-Gruppe** (Singles + Paar-Blöcke) wird als Einheit symmetrisch unter dem Mittelpunkt der Eltern zentriert.
  - Bei zwei Eltern: Mittelpunkt = (left.x + right.x + cardWidth) / 2
  - Bei einem Elternteil: Mitte der Elternkarte
- Jeder Paar-Block ist eine unveränderliche Einheit.
- Kinder/Subtrees eines Blocks werden **ausschließlich vertikal** unter der Mitte des Blocks platziert.
- Subtrees dürfen **nicht rückwirkend** die X-Positionen der Geschwister-Gruppe verändern.

## 6. Layout-Pipeline (maßgebliche Reihenfolge)
1. **Datenaufbereitung**  
   Partner **nie** in children-Liste der Hierarchie aufnehmen!  
   Partner als separates Feld `primaryPartner` speichern.

2. **Manuelle X-Positionierung der Geschwister-Gruppe (vor Tree-Layout)**  
   - Berechne Breite jedes Blocks: Single = CARD_WIDTH, Paar = 2×CARD_WIDTH + PARTNER_GAP  
   - Berechne Gesamtgruppenbreite + interne Gaps  
   - Zentriere Gruppe unter Eltern-Mittelpunkt  
   - Weise **fixe x-Koordinaten** jedem Block/Person zu → diese Werte sind final!

3. **Subtree-Layout (nur lokal & vertikal)**  
   Für jeden Paar-Block: separater kleiner Tree nur für Nachkommen  
   Kinder zentriert unter Block-Mitte platzieren  
   Horizontale Ausdehnung nur nach außen erlauben (fächerförmig), nie zurück in die Geschwisterreihe.

4. **Globales Post-Processing**  
   Kollisionserkennung und Shifts **nur zwischen** verschiedenen Sibling-Gruppen (verschiedene Eltern).  
   Innerhalb einer Gruppe: **kein** Shift – x-Werte bleiben fix.

5. **Linien-Routing**  
   Orthogonale Linien bevorzugt  
   Partner-Verbindung: horizontale Linie zwischen den Karten des Blocks  
   Eltern-Kind-Linie: startet aus der Mitte des Paar-Blocks

## 7. Linien-Rendering-Regeln (Connector Rules)
- Orthogonale Linien (horizontal + vertikal)
- Zeichnungsreihenfolge: ältere Generationen zuerst
- Bei Kreuzungen: ältere Linie hinten
- Partnerverbindung: doppelte horizontale Linie oder Ring-Symbol
- Eltern-Kind-Verbindung: vertikale Linie, die sich horizontal aufspaltet

## 8. Unvollständige Familien & Sonderfälle
- Nur ein Elternteil: Kind mittig darunter
- Keine Eltern: Wurzel oben
- Mehrere Partnerschaften: nur primäre inline
- Gleichgeschlechtliche Paare: gleiche Regeln
- Unbekanntes Geschlecht: neutrale Darstellung

## 9. Zoom- & Responsivität-Regeln
- Zoom < 80%: vereinfachte Karten (kein Foto, nur Name+Jahre)
- Mobile: Top-down + horizontales Scrollen
- Breite > 3000 px: Compressed Mode (engerer Abstand, kleinere Karten)

## 10. Visuelle Hierarchie & Hervorhebung
- Fokus-Person: stärkster Highlight
- Direkte Linie zur Fokusperson: dicker/farbig
- Optionale Farbcodierung (väterlich/mütterlich)

## 11. Paar-Block-Regel (hart)
- Paar-Block = unveränderliche Einheit mit fester Breite
- Interne Struktur (Person + Partner) bleibt fix
- Subtrees dürfen Block-Breite **nicht** rückwirkend vergrößern und Geschwisterreihe spreizen

## 12. Partner-Positionierungs-Regel
- Partner liegt auf gleicher Y wie Hauptperson
- Horizontal: fix rechts (oder links) mit konstanter Distanz
- Verbindungslinie horizontal zwischen Karten
- X-Position relativ zur Hauptperson fixiert – keine Anpassung durch Subtrees

## 13. Post-Processing-Regel (reduziert)
- Nur Kollisionsauflösung **zwischen** verschiedenen Sibling-Gruppen
- Innerhalb einer Gruppe: **keine** automatische Verschiebung

## Empfohlene Konstanten (px bei zoom=1.0)
CARD_WIDTH          = 240
CARD_HEIGHT         = 110
PARTNER_GAP         = 50
H_GAP               = 76
GEN_VERTICAL_GAP    = 168
SIBLING_MIN_GAP     = 24
LINE_STROKE         = 2.4