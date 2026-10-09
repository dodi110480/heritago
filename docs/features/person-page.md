# Feature-Spezifikation – Seite /Person
(Neue Person anlegen & bestehende Person bearbeiten)

> **Typ:** Feature-Spezifikation/Vision – **keine** verbindliche Coding-Regel.
> Diese Datei beschreibt ein Zielbild. Sie liegt bewusst unter `docs/features/`, damit sie
> die tägliche Arbeit nicht mit Regeln belastet. Verbindliche Regeln stehen in `.clinerules/`.

> **Hinweis zur Umsetzung:** Mehrere Punkte sind bewusst visionär (Zwei-Modi-Ansatz, Undo/Redo,
> Gramps-ID-Editing, „Rohdaten"-Ansicht). Vor Umsetzung sind sie gegen die Architektur-Regeln
> (`.clinerules/backend-first.md`, `db-first.md`, `ui.md`, `api.md`) abzugleichen.
>
> **Offene Konflikte / zu klären:**
> - Der komplexe Datums-Parser ist hier im **Frontend** skizziert; `backend-first.md` verlangt
>   Parsing/Formatierung im Backend. → gegen Backend-First auflösen.
> - „Person nur für mich sichtbar" (Record-Level-Sichtbarkeit) existiert im Datenmodell noch nicht;
>   `api.md`/`db-first.md` kennen bisher nur Tree-Permissions. → Datenmodell-Erweiterung nötig.
> - Validierung: Das Projekt nutzt **TypeScript/Express + Angular**; genanntes `Pydantic` (Python)
>   ist nicht relevant, hier gilt TypeScript (z. B. Zod) bzw. serverseitige Validierung.

---

## Ausgangslage (ursprüngliche Notiz)


Ziel: Mächtige, Gramps-ähnliche Funktionalität, aber mit deutlich flacherer Einstiegshürde  
→ Zwei-Modi-Ansatz: **Einfacher Modus** (Default) vs. **Experten-Modus**

## 1. Allgemeine Seiten-Elemente (beide Modi)

- Seitentitel  
  „Person bearbeiten – [Bevorzugter Name]“  
  oder „Neue Person anlegen“

- Oben fixierter Aktionsbereich  
  Speichern    Abbrechen    Löschen    Duplikat prüfen / Zusammenführen  
  Undo / Redo (mind. 5 Schritte)

- Umschalter (oben rechts, sehr sichtbar)  
  Einfacher Modus  ⇄  Experten-Modus  
  Persistiert pro Benutzer  
  Default bei Erstnutzung: Einfacher Modus

- Privat-Checkbox  
  „Diese Person und alle verknüpften Daten nur für mich sichtbar“

- Live-Duplikatensuche  
  Während Eingabe von Name + Geburtsjahr (±5 Jahre)

## 2. Einfacher Modus (Default – intuitiv & geführt)

Zielgruppe: 80–90 % der Nutzer (Hobbyisten, Einsteiger, mobile Nutzer)

### Layout-Struktur (keine Tabs, vertikaler Fluss)

1. **Kopf-Bereich** (sticky beim Scrollen)  
   - Primärfoto / Foto-Upload (Drag & Drop, Quadrat \~200–300 px)  
   - Geschlecht (große anklickbare Icons: ♂ ♀ ⚧ ? )  
   - Bevorzugter Name (einzelnes Eingabefeld mit intelligenter Aufteilung)  
     Vorname(n)   Rufname   Nachname   Prefix   Suffix  
     → Checkbox „Rufname = erster Vorname?“ (Auto-Vorschlag)

2. **Lebenslauf / Chronologie** (Akkordeon oder einfache Timeline)  
   - Geburt  
     Datum (einfaches Datum + „ca.“ / „unsicher“-Checkbox)  
     Ort (Autocomplete-Suche + „Neuen Ort anlegen“)  
   - Tod  
     Datum + Ort (gleiches Format)  
   - + Großer Button: „+ Ereignis / Lebensstation hinzufügen“  
     → Einfaches Modal mit:  
       - Typ (Dropdown – Top-15 vordefiniert)  
       - Datum + Ort  
       - Kurze Beschreibung (1–2 Zeilen)  
       - Medien / Notiz / Quelle (je 1 Feld)

3. **Familien-Bereich** (Cards / Kacheln)  
   - Eltern  
     Vater ▸ Suche / Neu  
     Mutter ▸ Suche / Neu  
   - Partner / Ehen  
     Liste + „+ Partner / Ehe hinzufügen“  
   - Kinder  
     Liste (sortierbar per Drag & Drop) + „+ Kind“

4. **Weitere wichtige Infos** (Akkordeon, nur bei Bedarf sichtbar)  
   - Beruf / Konfession / Stand / Nationalität (vordefinierte Key-Value-Felder, max. 6–8)  
   - Notiz (großes Markdown-fähiges Textfeld)  
   - Quellen (kleine Liste + „+ Quelle“-Button)  
   - Galerie (Grid mit max. 6 Thumbnails → „Alle Fotos anzeigen“)

### Versteckte Komplexität im Einfachen Modus
- Gramps-ID → komplett unsichtbar  
- Mehrere Namen → nur bevorzugter Name sichtbar  
- Attribute, Adressen, Assoziationen, komplexe Rollen → ausgeblendet  
- Komplexe Datumsangaben → nur einfaches Datum + Unsicher-Flag

## 3. Experten-Modus (Gramps-ähnlich – volle Kontrolle)

Zielgruppe: Poweruser, Gramps-Umsteiger, komplexe Fälle

### Layout: Klassische Tabs (horizontal scrollbar-fähig)

- **Allgemein**  
  - Gramps-ID (sichtbar + editierbar, mit Warnung)  
  - Geschlecht (Select + Divers / Keine Angabe)  
  - Bevorzugter Name (vollständige Felder: Typ, Titel, Vorname(n), Rufname, Nachname, Suffix, Spitzname, Sortiername)  
  - Geburts- & Todesdatum/-ort (komplexer Parser: ca., vor, nach, between, calculated …)  

- **Namen**  
  Tabelle: Typ | Vollname | Zeitraum | Primär (Radio) | Aktionen

- **Ereignisse**  
  Tabelle: Typ | Rolle | Datum | Ort | Beschreibung | Quellen-Anz. | Medien-Anz.

- **Attribute**  
  Freie Key-Value-Liste (Beruf, Religion, Augenfarbe, Größe, …)

- **Adressen**  
  Historie mit Zeitraum (Straße, PLZ, Ort, Land, Telefon, E-Mail …)

- **Notizen**  
  Mehrere Notizen mit Typ (Forschung, Biografie, ToDo, Transkription …) + Rich-Text

- **Quellen**  
  Verknüpfte Zitationen + Seitenangabe + Confidence-Level

- **Galerie**  
  Erweiterte Medienverwaltung (Tags, Gesichts-Regionen, Reihenfolge, Primärfoto-Flag)

- **Assoziationen**  
  Nicht-familiale Beziehungen (Pate, Zeuge, Freund, Nachbar …)

- **(Optional) Rohdaten**  
  JSON-ähnliche Ansicht oder GEDCOM-Snippet der Person

### Nur im Expertenmodus verfügbar
- Manuelle Gramps-ID-Änderung  
- Benutzerdefinierte Ereignis-/Attribut-Typen  
- Vollständiger Datum-Parser („abt. 1700–1705“, „between …“ etc.)  
- Rollen bei Ereignissen frei wählbar  
- Erweiterte Validierungsregeln & Inkonsistenz-Report

## 4. Gemeinsame Funktionen (beide Modi)

- Undo / Redo (mindestens 5–10 Schritte)  
- „Person zusammenführen“-Assistent mit Vorschau  
- Export-Optionen: GEDCOM, PDF-Kurzbericht, JSON  
- Automatische Plausibilitätswarnungen  
  (Geburt > Tod, Alter < 10 bei Heirat, etc.)  
- Mobile-responsive Darstellung (besonders wichtig im Einfachen Modus)

## 5. Technische Grundsätze

- Backend speichert immer den vollständigen Datensatz  
  (Modi sind reine UI-Ansichten)  
- Conditional Rendering im Frontend (Tabs nur im Expertenmodus laden)  
- Validierung: client- + serverseitig (Zod / Pydantic / JSON Schema)  
- Datums-Parser: eigene Logik oder Bibliothek (ähnlich Gramps gedcomx / dateparser)  
- Ort: relationale Tabelle mit Hierarchie (Ort → Landkreis → Bundesland → Land)