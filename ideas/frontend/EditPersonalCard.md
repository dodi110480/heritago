Ein „Person bearbeiten“-Modal in einer modernen Genealogie-Web-App (Angular + Prisma + GEDCOM 7.0) sollte übersichtlich, kontextbezogen und nicht überladen sein. Die meisten Nutzer wollen schnell die wichtigsten Daten ändern können, ohne in 15 Tabs zu scrollen.
Hier ist ein realistischer, praxiserprobter Vorschlag für den Inhalt – priorisiert nach Häufigkeit der Bearbeitung und GEDCOM-Relevanz.
Empfohlene Registerkarten / Sections (Tabs oder Accordion)

Persönliche Daten (Standard-Ansicht beim Öffnen – am häufigsten bearbeitet)
Primärer Name (Vorname, Nachname, Rufname, Präfix, Suffix)
→ mit Sternchen-Markierung „ist primär“
Weitere Namen (Liste + Button „weiteren Namen hinzufügen“)
→ Typ (Birth / Married / Aka / Nick / Romanized / Other)
Geschlecht (Enum: M / F / O / U)
Privat / Living-Status (Checkbox „Diese Person als lebend markieren“ + „Privat / vertraulich“)
GEDCOM-ID (@I123@) – read-only + Copy-Button
Letzte Änderung (read-only: updatedAt)

Lebensdaten / Ereignisse (meistgenutzt nach Namen)
Geburt (BIRT)
Tod (DEAT)
Taufe / Christening (CHR / BAPM / ...)
Beerdigung / Kremation (BURI / CREM)
Für jedes Ereignis:
Datum (mit Fuzzy-Unterstützung: ABT / CAL / EST / BET / FROM-TO / AFT / BEF + Phrase-Feld)
Ort (Dropdown/Autocomplete mit Place-Suche + „neuen Ort anlegen“)
Altersangabe bei Ereignis (AGE-String, z. B. „73y 4m 12d“)
Notiz / Beschreibung (kleines Textfeld)
Primär-Flag („Haupt-Geburtsdatum“ usw.)

Button „weiteres Ereignis hinzufügen“ → Dropdown mit EventType-Enum + Custom-Typ-Feld

Familien & Beziehungen (sehr wichtig, aber oft separat wahrgenommen)
Eltern-Familien (Liste der Family-Records, in denen die Person als CHIL vorkommt)
→ Link zur Familie + Rolle (biological / adopted / foster / step)
Ehe-/Partnerschaft-Familien (Liste)
→ Rolle (HUSB / WIFE / PART) + Sortier-Datum der Familie
Kinder (Liste pro Familie)
Button „neue Partnerschaft / Elternschaft hinzufügen“ (öffnet ggf. Wizard)

Beruf, Titel, Ausbildung, Wohnorte (Facts – nicht zeitkritische Attribute)
OCCU (Beruf) – mehrere möglich, mit Zeitraum
TITL (Titel / Adelstitel)
EDUC (Ausbildung)
RESI (Wohnsitz) – mehrere mit Zeitraum
Dazugehörig: Datum low/high + Ort + Wert/Notiz

Quellen & Belege (Citation-Übersicht)
Liste aller Citations, die direkt an der Person hängen (nicht nur an Events)
Kurzansicht: Quelle + Seite + Datum + Qualität
Button „neue Quelle/Citation hinzufügen“

Medien (Fotos, Dokumente, …)
Primäres Profilbild (Drag & Drop / Auswahl)
Weitere Medien-Links (Liste mit Vorschaubild, Caption, Sort-Order, isPrimary)
Button „Medium hochladen / verknüpfen“

Notizen (meist unterschätzt, aber sehr mächtig)
Allgemeine Notiz(en) zur Person
Private Notiz (nur für den Benutzer sichtbar)
Shared Notes (verlinkt)

Erweiterungen / Custom (für Power-User & GEDCOM-Import-Reste)
Liste aller Extension-Einträge (_FSFTID, _THM, _MILT, …)
Einfaches Key-Value-Editor-Feld


UI/UX-Empfehlungen für Angular

Erstes Öffnen → Tab 1 (Persönliche Daten) + Tab 2 (Lebensdaten) direkt sichtbar
Automatisches Speichern nach 3–5 Sekunden Inaktivität (debounced) oder bei Tab-Wechsel
Undo/Redo Stack pro Person (mind. 5 Schritte) – sehr beliebt bei versehentlichen Löschungen
Validierung live:
Geburtsdatum > Tod → Warnung
Kind jünger als Eltern → Warnung
Unvollständiges Datum → gelbe Markierung

Tastatur-Shortcuts:
Strg+S → Speichern
Strg+N → neues Ereignis
Esc → abbrechen / schließen

Responsive: Auf Mobile → alle Tabs zu einem langen Accordion oder Stepper umwandeln
Loading-State & Error-Handling: Skeleton-Loader pro Tab + Toast bei Save-Fehlern

Was nicht direkt ins Modal gehört (sondern separat)

Komplette Ahnen-/Nachfahren-Ansicht (zu viel Daten → Tree-View oder separater Screen)
Vollständige Quellenverwaltung (besser in eigenem „Quellen“-Bereich)
Massen-Edit (mehrere Personen gleichzeitig) → extra Feature
GEDCOM-Export / Import pro Person → eher im Baum-Menü