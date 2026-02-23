# Konzept: Stammbaum-Layouting à la "bundle.js"

## 1. Ausgangslage & Motivation
Das bisherige Layout in `tree.ts` basierte auf `d3.hierarchy`, was im Hintergrund einen Algorithmus nutzt, um die "Mitte" eines Baumes und die Äste automatisch zu verteilen. Das ist oft unflexibel und resultierte in überlagerten Linien sowie einem schwer kontrollierbaren Verhalten bei komplexen Ahnentafeln (z.B. Mehrfachehen, große Verwandtschaftsverhältnisse, Schwiegereltern).

Das neue Konzept orientiert sich an der Architektur branchenführender Stammbäume (z.B. Ancestry): **Explizite Koordinatenberechnung in einem festgelegten Grid**.

## 2. Kernarchitektur: Manuelles Grid statt d3-Magie
Anstatt D3 zu übergeben, "ordne diese Objekte logisch an", berechnen wir die `(x, y)`-Koordinaten für jedes Elternteil, jedes Kind und jeden Partner absolut anhand fester Box-Größen (`nodeWidth`, `nodeHeight`).

### 2.1 Die `PedigreeLayoutEngine`
Wir lagern die Logik in eine dedizierte Klasse aus (oder implementieren sie dediziert in der Komponente), die nur berechnet und nichts direkt in das DOM zeichnet.

- **Eingabe:** GEDCOM-Daten (`individuals`, `families`), eine Anker-Person (`focusId`)
- **Ausgabe (generierte Objekte):**
  - Listen von Knoten (`Nodes`): Mit `x`, `y`, `width`, `height`, Typ etc.
  - Listen von Pfaden (`Lines`): SVG Path-Strings (z.B. `M 0 0 h 50 v -100`), die strikt horizontal/vertikal verlaufen.

### 2.2 Zyklen des Algorithmus (Pedigree View / Ahnentafel)
Der Algorithmus beginnt beim Fokus-Individuum (Wurzel/Anker) und arbeitet sich rekursiv zurück:
1. `drawNode(person, x, y)` berechnet die Box und fügt sie in die Node-Liste ein.
2. `drawParents(personId, x, y, generation)` sucht Vater und Mutter via GEDCOM `FAMC`. 
   - Geht ein fester Offset nach links oder nach rechts (z.B. rechts, wenn Ahnenansicht wie in Ancestry).
   - Generiert T-förmige SVG-Linien, die von der Mitte des Kindes zu den Elternboxen führen.
   - Ruft rekursiv `drawNode` für Vater und Mutter auf.

### 2.3 Vorteile der neuen Vorgehensweise
- **Präzise Verzweigungen (Tree Forks):** Eltern-Linien können im typischen eckigen "Haken-Muster" gezeichnet werden (`drawTreeForkLines`).
- **Geringere Komplexität beim Erweitern:** Ein Zweig hat eine bestimmte Anzahl "Höheneinheiten" reserviert. Wir wissen exakt, wo eine Box liegt, und es passieren keine plötzlichen Sprünge des gesamten Baumes.
- **Isoliertes Caching:** Ein einmal durchgerechneter Ast behält seine Position.

## 3. Umsetzungsphasen

### Phase 1: Die Layout-Klasse (ohne UI)
- Wir entfernen zunächst `d3.hierarchy` und alle abhängigen Linienberechnungen.
- Erstellung der Layout-Logik (z.B. `TreeLayouter`), die reines JSON zurückgibt: `{ nodes: [...], paths: [...] }`.

### Phase 2: Frontend-Rendering
- Wir behalten `d3` nur für das **Zoomen & Panning** und eventuell um die Knoten ins SVG zu pushen (`.data(...).enter()`).
- Statt einer komplexen Logik zeichnet D3 einfach dumme SVG-Rechtecke auf die `(x, y)` Koordinaten, die der Layouter vorgibt.

### Phase 3: Äste erweitern & Fokus wechseln
- Hinzufügen von "Branching": Wenn beim Zeichnen der Eltern keine weiteren Ahnen aufgedeckt werden sollen (z.B. nach der 4. Generation), erhält die Node ein kleines Plus-Icon (`expandId`), welches onClick rekursiv weitere Generationen berechnet und ins Grid hinzufügt.

## 4. Definitionen

- `NodeSize`: Festgelegt auf z.B. 240x110 (wie im aktuellen Design).
- `SmallNodeSize`: Wird verwendet, falls wir entfernte Ahnen kleiner zeichnen wollen (spart Platz ab Gen. 5).
- `Offset`: Horizontaler Abstand (z.B. 40px) und vertikaler Abstand pro Generation.

Dieses Konzept bringt uns eine konsistente, reproduzierbare Layout-Logik, die auch für große Exporte und saubere Ausdrucke perfekt geeignet ist.
