# Stammbaum-Layout-Regelwerk
## Pedigree- & Familienansicht – Deterministisches Grid-Layout

Version 1.5 · Stand: 24. Februar 2026  
Formal abgeschlossen · Deterministisch · Edge-Case-resistent · Produktionsreif

Gültig für: Angular + Prisma + PostgreSQL + GEDCOM 7.0

---

# 1. Grundprinzipien

## 1.1 Determinismus
- Jede Person erhält exakt berechnete (x, y)-Koordinaten.
- Keine automatische Zentrierung.
- Kein Balancing.
- Keine Force-Directed-Algorithmen.
- Gleiche Daten + gleiche Fokusperson + gleiche Ansicht → pixelidentisches Layout.

---

# 2. Koordinatensystem

- SVG-Standard
- (0,0) oben links
- x wächst nach rechts
- y wächst nach unten

---

# 3. Generationen-Grid

## 3.1 Generationsformel

generationY(gen) = gen × spacing.generationVertical

- Generation 0 = Fokusperson
- Keine virtuellen oder zusätzlichen Generationsebenen
- Partner, Geschwister, Halbgeschwister teilen exakt dieselbe generationY

---

# 4. Node-Definition

## 4.1 Node-Größen (generationsabhängig)

| Typ | Breite | Höhe |
|------|--------|------|
| Standard | 150 px | 240 px |
| Compact  | 120 px | 200 px |
| Mini     | 100 px | 160 px |

## 4.2 Größenregel

currentNodeWidth(gen):
- wenn abs(gen) ≥ generations.compactFromGen → node.compactWidth
- sonst → node.defaultWidth

Node-Größe ist ausschließlich generationsabhängig.

---

## 4.3 NodeBox

Jede Node besitzt:

- minX
- maxX
- minY
- maxY
- centerX = (minX + maxX) / 2
- centerY = (minY + maxY) / 2

---

# 5. PartnerBlock

## 5.1 Definition

Ein PartnerBlock besteht aus:
- Primärperson (immer links)
- allen sichtbaren Partnern

## 5.2 Horizontale Positionierung

partnerX[i] = baseX + i × (currentNodeWidth + spacing.spouseHorizontalGap)

## 5.3 Breitenberechnung

partnerBlock.width =
(partnerCount × currentNodeWidth) +
((partnerCount - 1) × spacing.spouseHorizontalGap)

block.minX = min aller Node.minX  
block.maxX = max aller Node.maxX  
block.centerX = (block.minX + block.maxX) / 2  

Block wächst ausschließlich horizontal.

---

# 6. ChildrenGroup

## 6.1 Definition

- Pro Ehe genau eine ChildrenGroup
- Keine Vermischung verschiedener Ehen

## 6.2 Zentrierung

childrenGroup.centerX = parentPartnerBlock.centerX

## 6.3 Reihenfolge

Strikt nach Geburtsdatum (älter → jünger)

---

# 7. Subtree-Berechnung

## 7.1 Leaf-Node

subtree.width = partnerBlock.width

## 7.2 Interne Node

subtree.width =
max(
    partnerBlock.width,
    sum(child.subtree.width) +
    (childCount - 1) × spacing.siblingHorizontal
)

## 7.3 Clearance-Regel

Zwischen zwei benachbarten Subtrees gilt:

child[i].minX ≥ child[i-1].maxX + spacing.minBoxClearance

---

# 8. Positionsberechnung

## 8.1 Fokusperson

generation = 0  
x = 0  
y = 0  

Der gesamte Baum wird relativ zu (0,0) berechnet.

---

## 8.2 Elternposition

Eltern beziehen sich auf childPartnerBlock.centerX.

### Beide Eltern vorhanden

offset =
(parentNodeWidth / 2) +
(spacing.siblingHorizontal / 2)

father.centerX = childBlock.centerX - offset  
mother.centerX = childBlock.centerX + offset  

### Nur ein Elternteil

centerX = childBlock.centerX

Keine Magic Numbers erlaubt.

---

# 9. Kollisionsauflösung (formalisiert)

Innerhalb einer Generation:

Für i von 1 bis n:

Wenn block[i].minX <
block[i-1].maxX + spacing.minBoxClearance

Dann:

delta =
(block[i-1].maxX + spacing.minBoxClearance)
- block[i].minX

block[i] und gesamter Subtree werden um delta nach rechts verschoben.

Diese Verschiebung wird rekursiv auf alle Nachfahren angewendet.

Keine Skalierung. Keine Überlappung.

---

# 10. Mehrfachvorkommen (Referenz-Nodes)

## 10.1 Primär-Node
- Wird normal gerendert
- Enthält Subtree

## 10.2 Referenz-Node

- Wird an der strukturell korrekten Position gerendert
- subtree.width = 0
- Keine Kinderberechnung
- Opacity 60 %
- Wiederholungsnummer (①②③)

Referenz-Nodes teilen keine Koordinaten mit Primär-Node.

---

# 11. Render-Tiefen-Regel

Wenn:

abs(generation) > maxRenderDepth

Dann:

- Node wird nicht gerendert
- subtree.width = 0
- Expand-Icon wird angezeigt

---

# 12. Verbindungslinien (nur orthogonal)

## 12.1 Ehe-Linie

y = node.minY + (node.height / 2)

Horizontale Linie zwischen centerX der Partner.

## 12.2 Eltern-Kind-Verbindung

1. Vertikale Linie von childBlock.centerX
2. Horizontale Sammellinie auf parentY + parentHeight / 2
3. Vertikale Stummel zu Eltern

## 12.3 Sonderformen

- Scheidung → horizontale Linie mit //
- Adoption → gestrichelte Linie
- Verwandtenehe → doppelte Linie

---

# 13. Wide-Generation-Regel

generationWidth =
maxX(generation) - minX(generation)

Wenn generationWidth >
layout.wideGenerationThreshold

Dann:

layoutWarning = "wideGeneration"

Kein automatisches Skalieren.

---

# 14. Z-Index (SVG-Reihenfolge)

1. Eltern-/Kind-Linien
2. Ehe-Linien
3. Node-Karten
4. Warn-Icons
5. Interaktions-Icons

---

# 15. Validierung

- Eltern-Kind-Alter < 13 → rotes Warnsymbol
- Eltern-Kind-Alter > 55 → gelbes Hinweis-Icon
- Zyklus erkannt → Fehlerstatus CYCLIC_GRAPH
- WideGeneration → Warnflag

---

# 16. Scroll- & Fokusverhalten

- Fokuswechsel → vollständige Neuberechnung
- Optionale CSS-Transition ≤ 400 ms
- Kein implizites Rezentrieren
- centerOnNode() nur explizit

---

# 17. Konfiguration (layout-config.ts)

node.defaultWidth: 150  
node.defaultHeight: 240  
node.compactWidth: 120  
node.compactHeight: 200  
node.miniWidth: 100  
node.miniHeight: 160  

spacing.generationVertical: 260  
spacing.siblingHorizontal: 50  
spacing.spouseHorizontalGap: 30  
spacing.minBoxClearance: 40  

generations.compactFromGen: 5  
generations.maxRenderDepth: 10  

layout.wideGenerationThreshold: 5000  

---

# 18. Governance

Änderungen an:
- Formeln
- Blockdefinitionen
- Konstanten
- Kollisionsalgorithmus

erfordern:

1. Versionsanhebung (1.6, …)
2. Review durch Lead-Entwickler
3. Anpassung aller Unit-Tests
4. Reproduzierbarkeitsprüfung (Pixel-Diff-Test)

---

Ende Regelwerk Version 1.5