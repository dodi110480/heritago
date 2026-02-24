Stammbaum-Layout-Regelwerk
Pedigree- & Familienansicht – Deterministisches Grid-Layout
Version 1.6 · Stand: 24. Februar 2026, 14:47 (Europe/Berlin)
Formal abgeschlossen · Deterministisch · Edge-Case-resistent · Produktionsreif

Gültig für: Angular + Prisma + PostgreSQL + GEDCOM 7.0

0. Begriffe, Datenmodell & Normen (Layout-relevant)
0.1 Entitäten (abstrakt)
Person: eindeutige personId.
Union (Beziehung / Ehe / Partnerschaft): eindeutige unionId, verbindet genau zwei Personen (Partner A/B).
GEDCOM-Analog: Family (FAM) mit HUSB/WIFE bzw. Partnerrollen.
ChildLink: Zuordnung childId → unionId (Kind gehört zu genau einer Union als „Elternpaar“).
Adoption/biologisch wird über childLink.type modelliert (für Linienstil/Validierung), ändert aber nicht die Generation.
Fokusperson: focusId.
Wichtig: Dieses Regelwerk beschreibt ausschließlich Layout/Rendering, nicht genealogische „Wahrheit“. Wenn Daten mehrdeutig sind, gelten die deterministischen Tie-Breaker-Regeln unten.

0.2 Deterministische Tie-Breaker (global)
Wo immer eine Sortierung Gleichstand hat oder Werte fehlen, gilt als finaler Tie-Breaker immer:

explizite Sortierfelder (z. B. Datum)
dann personId asc (oder unionId asc bei Unions)
Damit ist jede Reihenfolge total bestimmt.

1. Grundprinzipien
1.1 Determinismus
Jede gerenderte Person erhält exakt berechnete (x, y)-Koordinaten.
Keine automatische Zentrierung.
Kein Balancing.
Keine Force-Directed-Algorithmen.
Gleiche Daten + gleiche Fokusperson + gleiche Ansicht + gleiche Config → pixelidentisches Layout.
1.2 Rundung / Pixelidentität
Um Subpixel-Abweichungen zu vermeiden:

Alle finalen Layoutwerte (minX/maxX/centerX/minY/maxY) werden nach vollständiger Berechnung gerundet gemäß:
layout.rounding = "round" → Math.round(value)
Linienpunkte werden ebenfalls gerundet.
2. Koordinatensystem
SVG-Standard
(0,0) oben links
x wächst nach rechts
y wächst nach unten
3. Generationen-Grid
3.1 Generationsvorzeichen (explizit)
Generation 0: Fokusperson
Vorfahren: negative Generationen
Eltern: gen = -1, Großeltern: -2, …
Nachfahren: positive Generationen
Kinder: gen = +1, Enkel: +2, …
3.2 Generationsformel
generationY(gen) = gen × spacing.generationVertical

Keine virtuellen oder zusätzlichen Generationsebenen
Partner, Geschwister, Halbgeschwister teilen exakt dieselbe generationY
4. Node-Definition
4.1 Node-Größen (generationsabhängig)
Typ	Breite	Höhe
Standard	150 px	240 px
Compact	120 px	200 px
Mini	100 px	160 px
4.2 Größenregel (vollständig)
Node-Größe ist ausschließlich generationsabhängig:

Breite


currentNodeWidth(gen):
- wenn abs(gen) ≥ generations.miniFromGen → node.miniWidth
- sonst wenn abs(gen) ≥ generations.compactFromGen → node.compactWidth
- sonst → node.defaultWidth
Höhe


currentNodeHeight(gen):
- wenn abs(gen) ≥ generations.miniFromGen → node.miniHeight
- sonst wenn abs(gen) ≥ generations.compactFromGen → node.compactHeight
- sonst → node.defaultHeight
4.3 NodeBox (vollständig)
Für jede gerenderte Person gilt:

node.minX
node.maxX = node.minX + currentNodeWidth(gen)
node.minY = generationY(gen)
node.maxY = node.minY + currentNodeHeight(gen)
node.centerX = (node.minX + node.maxX) / 2
node.centerY = (node.minY + node.maxY) / 2
5. PartnerBlock (visuelle Anordnung mehrerer Partner)
5.1 Definition
Ein PartnerBlock gehört zu genau einer „Primärperson“ P und besteht aus:

P (immer links)
allen sichtbaren Partnern von P in der aktuellen Ansichtstiefe
Hinweis: Kinder-Gruppen hängen nicht am PartnerBlock, sondern an CoupleBlocks (siehe §6).

5.2 Partner-Reihenfolge (deterministisch)
Partner von P werden sortiert nach:

union.startDate asc (Heirat/Beziehungsbeginn; fehlend = ∞)
unionId asc
partner.personId asc
5.3 Horizontale Positionierung (mit definierter Basis)
Für PartnerBlock mit k = partnerCount gilt:

block.width = (k × w) + ((k - 1) × spacing.spouseHorizontalGap) wobei w = currentNodeWidth(gen(P))
block.minX = block.centerX - block.width / 2
Node i (0-basiert, i=0 ist Primärperson):
node[i].minX = block.minX + i × (w + spacing.spouseHorizontalGap)
5.4 Block-Box
block.maxX = block.minX + block.width
block.centerX = (block.minX + block.maxX) / 2
Block wächst ausschließlich horizontal.
6. CoupleBlock (Layout-Anker für eine Union)
6.1 Definition
Ein CoupleBlock gehört zu genau einer Union U(PA, PB) und umfasst:

NodeBox von Partner A
NodeBox von Partner B (falls in Ansicht gerendert; sonst „offscreen“/nicht gerendert)
6.2 CoupleCenterX (entscheidend)
coupleBlock.centerX ist der Mittelpunkt zwischen den beiden Partner-CenterX, falls beide gerendert:


coupleCenterX =
  (PA.node.centerX + PB.node.centerX) / 2
Wenn nur ein Partner gerendert wird (der andere außerhalb Render-Tiefe / fehlt):


coupleCenterX = renderedPartner.node.centerX
Damit ist eindeutig: ChildrenGroups werden pro Union um den CoupleCenterX zentriert, nicht um den Gesamt-PartnerBlock.

7. ChildrenGroup (pro Union genau eine)
7.1 Definition
Pro Union genau eine ChildrenGroup.
Keine Vermischung verschiedener Unions.
7.2 Zentrierung
childrenGroup.centerX = coupleBlock.centerX (aus §6)

7.3 Reihenfolge der Kinder (deterministisch, robust)
Kinder einer Union werden sortiert nach:

child.birthDate asc (vollständiges Datum)
partielles Datum (YYYY-MM) asc
nur Jahr asc
unbekannt (last)
child.personId asc
8. Subtree-Berechnung (Width Bottom-Up)
8.1 Subtree-Objekt
Jede Primär-Node (siehe §11) besitzt einen Subtree:

subtree.width
subtree.minX, subtree.maxX (werden in §9 gesetzt)
subtree.blocksByGeneration[gen] (für Kollisionspass, optional aber empfohlen)
Referenz-Nodes haben subtree.width = 0 (siehe §11.2).

8.2 Leaf-Node
Wenn keine gerenderten Kinder-Gruppen vorhanden sind:
subtree.width = partnerBlock.width

8.3 Interne Node
Wenn es gerenderte ChildrenGroups gibt:


childrenTotalWidth =
  sum(child.subtree.width) +
  (childCount - 1) × spacing.siblingHorizontal

subtree.width =
  max(
    partnerBlock.width,
    childrenTotalWidth
  )
8.4 Clearance-Regel (formal)
Zwischen zwei benachbarten Kinder-Subtrees gilt nach Platzierung:
child[i].subtree.minX ≥ child[i-1].subtree.maxX + spacing.minBoxClearance

9. Positionsberechnung (Top-Down)
9.1 Fokusperson
gen(focus) = 0
focus.partnerBlock.centerX = 0
focus.node.minY = 0 (über §4.3)
Der gesamte Baum wird relativ zu (0,0) berechnet.
9.2 Subtree-Box an PartnerBlock koppeln
Für jede Primärperson P gilt:

P.subtree.centerX = P.partnerBlock.centerX
P.subtree.minX = P.subtree.centerX - P.subtree.width / 2
P.subtree.maxX = P.subtree.minX + P.subtree.width
9.3 Kinder-Platzierung innerhalb einer ChildrenGroup (voll deterministisch)
Für eine Union U mit n Kindern (sortiert nach §7.3):

childrenTotalWidth wie in §8.3
cursorX = childrenGroup.centerX - childrenTotalWidth / 2
Für jedes Kind C[i]:

C[i].subtree.minX = cursorX
C[i].subtree.maxX = C[i].subtree.minX + C[i].subtree.width
C[i].partnerBlock.centerX = (C[i].subtree.minX + C[i].subtree.maxX) / 2
cursorX += C[i].subtree.width + spacing.siblingHorizontal
Damit ist die X-Zuweisung eindeutig.

10. Elternpositionierung (Vorfahren)
10.1 Bezugspunkt
Eltern eines Kindes K werden an der Union ausgerichtet, aus der K stammt:

anchorX = parentUnion.coupleBlock.centerX
(wobei parentUnion die Union ist, in der K als Kind verlinkt ist)

10.2 Beide Eltern gerendert
Definiere w = currentNodeWidth(gen(parent)).

Offset:


offset = (w / 2) + (spacing.parentGapHorizontal / 2)
Dann:

parentA.node.centerX = anchorX - offset
parentB.node.centerX = anchorX + offset
parentA/parentB sind Rollen aus Daten (GEDCOM/DB). Falls nicht vorhanden: sortiere die beiden Eltern nach personId asc und mappe auf A/B.

10.3 Nur ein Elternteil gerendert
parent.node.centerX = anchorX

10.4 Eltern in PartnerBlocks
Wenn ein Elternteil mehrere Partner hat, wird sein PartnerBlock wie in §5 um seinen partnerBlock.centerX aufgebaut. partnerBlock.centerX wird dabei aus obigen Regeln übernommen.

11. Mehrfachvorkommen (Referenz-Nodes)
11.1 Primär-Node Auswahl (deterministisch)
Wenn eine Person über mehrere Pfade im Graphen erreichbar ist:

Es wird genau eine Darstellung als Primär-Node gewählt.
Alle weiteren Vorkommen sind Referenz-Nodes.
Regel (BFS-Priorität):

Führe eine BFS vom Fokus durch (Beziehungen: Eltern↔Kind, Partner↔Partner), aber mit Kantenpriorität:
Kinder/Eltern-Kanten (vertical) vor Partner-Kanten (horizontal)
Die erste gefundene Instanz einer personId wird Primär-Node.
Weitere Instanzen werden Referenzen.
Tie-Breaker bei BFS-Knotenreihenfolge: personId asc, unionId asc.
Damit ist primär vs. referenz eindeutig und stabil.

11.2 Referenz-Node Rendering
Wird an der strukturell korrekten Position gerendert
subtree.width = 0
Keine Kinderberechnung / keine Nachfahren
Opacity 60 %
Wiederholungsnummer ①②③… nach Reihenfolge des Auftretens im Traversal (BFS-Reihenfolge aus §11.1)
12. Render-Tiefen-Regel (Max Depth)
12.1 Definition
Wenn:
abs(generation) > generations.maxRenderDepth

Dann:

Die Person selbst wird nicht als normale Node gerendert.
Stattdessen wird ein CollapsedPlaceholder gerendert:
12.2 CollapsedPlaceholder
Größe: node.miniWidth/miniHeight
Enthält Expand-Icon
subtree.width = node.miniWidth
Keine Kinderberechnung darunter (abgeschnitten)
So bleibt Layout stabil und Interaktion möglich, ohne „Icon an nicht gerendertem Node“.

13. Kollisionsauflösung (formalisiert, stabil)
13.1 Kollisionsobjekte pro Generation
Für jede Generation g werden die folgenden „Blöcke“ berücksichtigt:

PartnerBlocks der in Generation g gerenderten Nodes
(optional) zusätzlich Subtree-Boxen, wenn du generationübergreifende Überlappungen vermeiden willst
→ Standard in diesem Regelwerk: nur PartnerBlocks in derselben Generation.
13.2 Sortierung (deterministisch)
In Generation g:

Sortiere Blöcke nach minX asc
Tie-Breaker: block.ownerPersonId asc
13.3 Scan & Shift (rechtsverschiebend, ohne Skalierung)
Für i = 1..n-1:
Wenn
block[i].minX < block[i-1].maxX + spacing.minBoxClearance
dann:


delta =
  (block[i-1].maxX + spacing.minBoxClearance)
  - block[i].minX
und verschiebe:

block[i] nach rechts um delta
sowie den gesamten Subtree der zugehörigen Primärperson rekursiv (alle Nachfahrenblöcke, PartnerBlocks, Nodes, Linienanker)
13.4 Iteration (Abschluss garantiert)
Da nur nach rechts verschoben wird und die Liste nach aktuellem minX sortiert ist:

ein links→rechts Pass pro Generation ist ausreichend, wenn vor dem Pass nach aktuellem minX sortiert wurde.
Falls deine Implementierung während des Passes Block-Reihenfolgen ändern könnte: dann nach dem Pass erneut sortieren und wiederholen bis keine Kollisionen mehr auftreten (Worst-Case, aber deterministisch).
14. Verbindungslinien (nur orthogonal)
14.1 Ehe-/Partnerlinie (Union-Linie)
yUnion = node.minY + (node.height / 2)
Zeichne horizontale Linie zwischen partnerA.node.centerX und partnerB.node.centerX auf yUnion
Wenn Partner nicht gerendert: keine Union-Linie
14.2 Eltern-Kind-Verbindung (pro Union)
Für Union U mit childrenGroup.centerX = Xc:

Vertikal von (Xc, childrenYTop) nach (Xc, yBus)
Horizontal Bus-Linie auf yBus von min(parentCenters) bis max(parentCenters)
Vertikal Stummel von yBus zu jedem Eltern-yUnion
Deterministische Offsets:

yBus = parentGenerationY + line.parentBusOffsetY
childrenYTop = childGenerationY (oder child.node.minY), plus optional line.childStemOffsetY
14.3 Sonderformen (Linienstil)
Scheidung → Union-Linie mit // Marker (mittig)
Adoption → Kind-Stummel gestrichelt (stroke-dasharray)
Verwandtenehe → Union-Linie doppelt (zwei parallele Linien mit line.doubleLineGap)
15. Wide-Generation-Regel
Für jede Generation:
generationWidth = maxX(generation) - minX(generation)

Wenn generationWidth > layout.wideGenerationThreshold:

setze layoutWarning = "wideGeneration"
Kein automatisches Skalieren.
16. Z-Index (SVG-Reihenfolge)
Eltern-/Kind-Linien
Union-/Ehe-Linien
Node-Karten
Warn-Icons
Interaktions-Icons (Expand, Menüs, etc.)
17. Validierung (Layout-nahe Checks)
Eltern-Kind-Alter < 13 → rotes Warnsymbol
Eltern-Kind-Alter > 55 → gelbes Hinweis-Icon
Zyklus erkannt → Fehlerstatus CYCLIC_GRAPH
WideGeneration → Warnflag wideGeneration
Zyklusregel (deterministisch):

Zyklus, wenn eine Person beim Traversal (für Primär-Nodes) erneut im aktuellen Pfad vorkommt → Abbruch & Flag.
18. Scroll- & Fokusverhalten
Fokuswechsel → vollständige Neuberechnung
Optionale CSS-Transition ≤ 400 ms
Kein implizites Rezentrieren
centerOnNode() nur explizit
19. Algorithmus-Pipeline (verbindlich)
Implementierungen müssen genau diese Reihenfolge einhalten:

Graph laden + Normalisierung (IDs, Unions, ChildLinks)
Generationen bestimmen relativ zu Fokus (mit Vorzeichenregel §3.1)
Primär-/Referenz-Entscheidung per BFS (§11.1)
Bottom-Up: subtree.width berechnen (§8)
Top-Down: partnerBlock.centerX setzen (Fokus) und rekursiv:
Subtree-Box setzen (§9.2)
CoupleCenterX ableiten (§6)
Kinder platzieren (§9.3)
Eltern positionieren (§10)
Kollisionspass je Generation (§13)
Finale Rundung (§1.2)
Linienrouting mit festen Offsets (§14)
20. Konfiguration (layout-config.ts)

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
spacing.parentGapHorizontal = 50 // neu, ersetzt implizite Nutzung von siblingHorizontal

generations.compactFromGen = 5
generations.miniFromGen = 9       // neu
generations.maxRenderDepth = 10

line.parentBusOffsetY = 120       // neu (deterministisch, keine Magic Numbers im Code)
line.childStemOffsetY = 0
line.doubleLineGap = 4

layout.wideGenerationThreshold = 5000
layout.rounding = "round"         // neu: "round" | "floor" | "ceil"
21. Governance
Änderungen an:

Formeln
Block-/CoupleBlock-/ChildrenGroup-Definitionen
Konstanten
Kollisionsalgorithmus
Traversal-/Primär-Node-Regeln
erfordern:

Versionsanhebung (1.7, …)
Review durch Lead-Entwickler
Anpassung aller Unit-Tests
Reproduzierbarkeitsprüfung (Pixel-Diff-Test)
Ende Regelwerk Version 1.6
