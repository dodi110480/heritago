# Backend-First-Architektur (Lean Frontend)

> **Verbindlichkeit:** verbindlich · **Geltungsbereich:** gesamtes Projekt · **Aktivierung:** immer

Alle Datenverarbeitung, Formatierung und komplexe Logik findet im **Backend** statt. Das Frontend
dient rein als View-Layer („Lean Frontend").

## Kernregeln

- **Keine Berechnungen im Frontend:** Müssen Daten für die Anzeige kombiniert, aggregiert, sortiert
  oder transformiert werden, geschieht dies im Backend-Service.
- **Pre-formatted Display Data:** Datumsangaben, Labels (z. B. „Heute", „Gestern") und Status-Texte
  werden vom Backend bereits übersetzt und formatiert geliefert (z. B. `formattedNotes`,
  `formattedCitations`). Das Frontend formatiert **nicht** erneut (kein eigenes `DatePipe`-Format für
  Geschäftslogik).
- **Semantische Metadaten statt Präsentation:** Das Backend liefert **semantische** Angaben
  (z. B. `status: 'TODO'`, `severity: 'danger'`, `noteType`). Das **Mapping auf Tokens, Icons und
  CSS-Klassen** erfolgt im Frontend (`ui.md`). Das Backend liefert **keine** CSS-Klassen oder Hex-Codes.
- **Kein Client-side Date-Handling:** Kein `new Date()` im Frontend für geschäftslogische
  Berechnungen oder Formatierungen. Nutze die vom Backend bereitgestellten Strings.

## Erlaubte Aufgaben des Frontends (Abgrenzung)

Erlaubt sind rein präsentationsnahe Aufgaben:

- Rendern, Routing, Formular-Bindung, Fehler-/Ladezustände.
- **Lokaler UI-Zustand:** offen/geschlossen, aktiver Tab, Auswahl, Hover, Expand.
- **Komfort-Suche/-Filter über eine bereits geladene, kleine Liste** (z. B. in `app-notes-list`,
  `app-sources-list`). Sobald eine Menge erst **serverseitig ausgewählt** werden muss (große
  Datenmengen, Pagination, Volltextsuche über den gesamten Bestand), gehört die Filterung ins Backend.

## Ziel

Ein schlankes Frontend, das stabil gegenüber Änderungen der Datenstruktur bleibt und keine
Geschäftslogik enthält.
