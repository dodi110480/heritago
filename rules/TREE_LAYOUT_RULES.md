# Heritago Stammbaum Layout-Regeln

Dieses Dokument definiert die offiziellen Regeln für die Visualisierung des Stammbaums in Heritago. Diese Regeln sind im Frontend (`tree.ts`) fest programmiert, um eine konsistente und übersichtliche Darstellung zu gewährleisten.

## 1. Geschwister-Zeilen-Regel (Sibling Row Rule)
Alle Kinder einer Familie **MÜSSEN** auf exakt derselben vertikalen Ebene (Y-Koordinate) liegen. Dies verhindert kaskadierende Treppen-Effekte und macht Generationen sofort erkennbar.

## 2. Geschwister-Nähe-Regel (Sibling Proximity Rule)
Geschwister werden so nah wie möglich zusammen gruppiert, um ihre Zusammengehörigkeit visuell zu betonen, ohne dass sie sich berühren.

## 3. Partner-Ebenen-Regel (Partner Level Rule)
Ehepartner oder Partner innerhalb einer Familie **MÜSSEN** auf exakt derselben vertikalen Ebene (Y-Koordinate) liegen.

## 4. Berührungsverbot (No-Touch Rule)
Karten dürfen sich unter keinen Umständen berühren oder überlappen.
- **Minimaler horizontaler Abstand**: 60px.
- **Minimaler vertikaler Abstand**: Mindestens eine halbe Kartenhöhe (**50px**). In der Praxis wird oft ein voller Kartenhöhen-Abstand (100px) für die Lesbarkeit der Linien verwendet.

## 5. Generationen-Tiefen-Regel (Generation Depth Rule)
Die Karten der Kinder **MÜSSEN** immer exakt eine Ebene (Generation) tiefer gerendert werden als die Karten ihrer Eltern. Dies gilt auch für komplexe Verschachtelungen.

## 6. Symmetrie-Regel (Symmetry Rule)
Kindergruppen werden automatisch unter dem Mittelpunkt ihrer Eltern zentriert. Wenn nur ein Elternteil vorhanden ist, werden die Kinder direkt darunter ausgerichtet.

## 7. Überlagerungs-Prävention (Overlap Prevention)
Nach der initialen Berechnung durch den Layout-Algorithmus (D3-Tree) werden alle Knoten in einem Post-Processing-Pass geprüft und bei Bedarf verschoben, um die oben genannten Abstände und Ausrichtungen zu erzwingen.
