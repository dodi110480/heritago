Stammbaum-Layout-Regelwerk  
Pedigree- & Familienansicht – Deterministisches Grid-Layout  
Version 1.7 · Stand: 24. Februar 2026  
Formal abgeschlossen · Deterministisch · Traversal-definiert · Produktionsreif

Gültig für: Angular + Prisma + PostgreSQL + GEDCOM 7.0

────────────────────────────────────────────────────────────

0. Begriffe, Datenmodell & Normen (Layout-relevant)

0.1 Entitäten

Person
- eindeutige personId

Union
- eindeutige unionId
- verbindet genau zwei Personen

ChildLink
- childId → unionId
- childLink.type (biologisch/adoptiert) beeinflusst nur Linienstil

Fokusperson
- focusId

Dieses Regelwerk beschreibt ausschließlich Layout/Rendering.

────────────────────────────────────────────────────────────

0.2 Deterministische Tie-Breaker (global)

Wenn Sortierkriterien Gleichstand haben:

1. explizite Sortierfelder (Datum etc.)
2. personId asc
3. unionId asc

Damit ist jede Reihenfolge total bestimmt.

────────────────────────────────────────────────────────────

1. Grundprinzipien

1.1 Determinismus
- Jede Person erhält exakt berechnete (x, y)-Koordinaten.
- Keine automatische Zentrierung.
- Kein Balancing.
- Kein Force-Directed-Algorithmus.
- Gleiche Daten + gleiche Fokusperson + gleiche Config → pixelidentisch.

1.2 Pixel-Rundung

Alle finalen Koordinaten werden nach vollständiger Berechnung gerundet:

layout.rounding = "round"

Math.round() auf:
- node.minX / maxX / centerX
- node.minY / maxY / centerY
- alle Linienpunkte

Rundung erfolgt NACH Kollisionspass.

────────────────────────────────────────────────────────────

2. Koordinatensystem

- SVG-Standard
- (0,0) oben links
- x → rechts
- y → unten

────────────────────────────────────────────────────────────

3. Generationen-Grid

3.1 Vorzeichenregel

Generation 0 → Fokus  
Negative → Vorfahren  
Positive → Nachfahren  

3.2 Formel

generationY(gen) = gen × spacing.generationVertical

Keine virtuellen Ebenen.

────────────────────────────────────────────────────────────

4. Node-Definition

4.1 Größenregel

currentNodeWidth(gen):
- abs(gen) ≥ miniFromGen → miniWidth
- abs(gen) ≥ compactFromGen → compactWidth
- sonst defaultWidth

currentNodeHeight(gen):
analog zur Breite

4.2 NodeBox

node.minX  
node.maxX = node.minX + width  
node.minY = generationY(gen)  
node.maxY = node.minY + height  
node.centerX = (minX + maxX) / 2  
node.centerY = (minY + maxY) / 2  

────────────────────────────────────────────────────────────

5. PartnerBlock

5.1 Definition

Ein PartnerBlock gehört zu genau einer Primärperson.

5.2 Zuweisung von centerX (wichtig)

partnerBlock.centerX wird ausschließlich im Top-Down-Pass (§19) gesetzt.

Vor diesem Schritt existiert kein valider centerX.

5.3 Breite

block.width =
(k × width) +
((k - 1) × spacing.spouseHorizontalGap)

5.4 Positionierung

block.minX = block.centerX - block.width / 2

node[i].minX =
block.minX + i × (width + spacing.spouseHorizontalGap)

Block wächst nur horizontal.

────────────────────────────────────────────────────────────

6. CoupleBlock (Union-Anker)

6.1 Definition

CoupleBlock gehört zu genau einer Union.

6.2 centerX

Wenn beide Partner gerendert:
coupleCenterX = (centerX_A + centerX_B) / 2

Wenn nur einer gerendert:
coupleCenterX = centerX_rendered

ChildrenGroups beziehen sich ausschließlich auf coupleCenterX.

────────────────────────────────────────────────────────────

7. ChildrenGroup

7.1 Definition

Genau eine ChildrenGroup pro Union.

7.2 Reihenfolge

Sortierung:
birthDate asc
teilweise Datum asc
Jahr asc
unknown last
personId asc

7.3 childrenYTop (eindeutig)

childrenYTop = child.node.minY

Keine Alternativen.

────────────────────────────────────────────────────────────

8. Subtree (Bottom-Up)

8.1 Leaf

subtree.width = partnerBlock.width

8.2 Interne Node

childrenTotalWidth =
sum(child.subtree.width) +
(childCount - 1) × spacing.siblingHorizontal

subtree.width =
max(partnerBlock.width, childrenTotalWidth)

────────────────────────────────────────────────────────────

9. Subtree-Box (Top-Down)

subtree.centerX = partnerBlock.centerX
subtree.minX = centerX - subtree.width / 2
subtree.maxX = subtree.minX + subtree.width

────────────────────────────────────────────────────────────

10. Elternpositionierung

anchorX = parentUnion.coupleBlock.centerX

offset =
(currentNodeWidth(gen) / 2) +
(spacing.parentGapHorizontal / 2)

Beide Eltern:
A.centerX = anchorX - offset
B.centerX = anchorX + offset

Nur ein Elternteil:
centerX = anchorX

────────────────────────────────────────────────────────────

11. Mehrfachvorkommen

11.1 BFS-Strategie (vollständig definiert)

Traversal:
- BFS vom Fokus
- Kantenpriorität:
  1. Eltern/Kind (vertikal)
  2. Partner (horizontal)

Traversalrichtung:
- BFS arbeitet symmetrisch in beide Richtungen,
  aber Priorität bestimmt Reihenfolge im Queue.

Tie-Breaker:
personId asc
unionId asc

Erste Instanz → Primär-Node
Weitere → Referenz-Nodes

11.2 Referenz-Node

- subtree.width = 0
- keine Kinder
- opacity 60 %
- Nummerierung nach BFS-Reihenfolge

────────────────────────────────────────────────────────────

12. Render-Tiefen-Regel

Wenn abs(gen) > maxRenderDepth:

→ CollapsedPlaceholder

subtree.width = miniWidth

────────────────────────────────────────────────────────────

13. Kollisionsauflösung (1D pro Generation)

13.1 Scope

Kollisionen werden ausschließlich innerhalb derselben Generation geprüft.

Keine 2D-Inter-Generations-Kollisionserkennung.

13.2 Algorithmus

Sortiere Blocks nach minX asc.

Für i = 1..n-1:

Wenn block[i].minX <
block[i-1].maxX + spacing.minBoxClearance

delta =
(block[i-1].maxX + spacing.minBoxClearance)
- block[i].minX

Verschiebe gesamten Subtree nach rechts um delta.

Ein links→rechts-Pass ist ausreichend,
da nur nach rechts verschoben wird.

────────────────────────────────────────────────────────────

14. Linienrouting

14.1 Union-Linie

yUnion =
node.minY + (node.height / 2)

14.2 Eltern-Kind-Bus

parentHeight = currentNodeHeight(parentGen)

yBus =
parent.node.minY +
(parentHeight × line.parentBusOffsetFactor)

line.parentBusOffsetFactor ∈ [0,1]

Standard:
0.5 (Mitte der Box)

childrenYTop =
child.node.minY

────────────────────────────────────────────────────────────

15. Wide-Generation

generationWidth =
maxX - minX

Wenn >
wideGenerationThreshold

→ layoutWarning = "wideGeneration"

────────────────────────────────────────────────────────────

16. Algorithmus-Pipeline (verbindlich)

1. Graph laden & normalisieren
2. Generationen berechnen
3. BFS Primär-/Referenz
4. Bottom-Up subtree.width
5. Top-Down centerX setzen
6. Kinder platzieren
7. Eltern positionieren
8. Kollisionspass
9. Rundung
10. Linienrouting

Diese Reihenfolge ist verpflichtend.

────────────────────────────────────────────────────────────

17. Konfiguration

node.defaultWidth = 150
node.defaultHeight = 240
node.compactWidth = 120
node.compactHeight = 200
node.miniWidth = 100
node.miniHeight = 160

spacing.generationVertical = 260
spacing.siblingHorizontal = 50
spacing.spouseHorizontalGap = 30
spacing.minBoxClearance = 40
spacing.parentGapHorizontal = 50

generations.compactFromGen = 5
generations.miniFromGen = 9
generations.maxRenderDepth = 10

line.parentBusOffsetFactor = 0.5
line.doubleLineGap = 4

layout.wideGenerationThreshold = 5000
layout.rounding = "round"

────────────────────────────────────────────────────────────

18. Governance

Änderungen an:
- Formeln
- Blockdefinitionen
- Traversalregeln
- Konstanten

erfordern:
1. Versionsanhebung
2. Review
3. Unit-Test-Anpassung
4. Pixel-Diff-Prüfung

Ende Regelwerk Version 1.7