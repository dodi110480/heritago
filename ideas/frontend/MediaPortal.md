Die Seite soll übersichtlich, suchbar und auf die Bedürfnisse von Ahnenforschern zugeschnitten sein (viele Fotos, Scans, PDFs, Gruppenbilder, Deduplizierung, Zuordnung zu Personen/Quellen/Familien).
Seiten-Name & Navigation

Titel der Seite: Medienverwaltung / Medien-Galerie
Pfad (Beispiel): /media oder /gallery
Im Hauptmenü: Eintrag „Medien“ (neben „Stammbaum“, „Personen“, „Quellen“, „Suche“ …)

Gesamtaufbau (Layout – Responsive, Dark/Light-Modus unterstützend)
Typisches Layout (ähnlich wie moderne Media-Manager in Ancestry, MyHeritage, Gramps oder Family Tree Maker):

Obere Leiste (Header / Toolbar) – fixiert beim Scrollen
Großer „+ Medien hochladen“-Button (primär, blau/grün)
Suchfeld: „Suche nach Titel, Dateiname, Person, Ort, Datum, Notiz …“ (mit Clear-Button)
Filter-Dropdowns / Chips (kombinierbar):
Typ: Alle | Fotos | Dokumente (PDF) | Audio | Video
Verknüpft mit: Alle | Personen | Familien | Quellen | Ohne Zuordnung
Status: Alle | Profilbilder | Verarbeitet | Unverarbeitet | Duplikate
Sortierung: Neueste zuerst | Älteste zuerst | Titel A–Z | Größe absteigend | Letzte Änderung

Ansichts-Buttons: Grid (Standard) | Liste (mit mehr Metadaten) | Compact-Grid

Hauptbereich – Inhaltsbereich
Grid-Ansicht (Standard – Masonry- oder Fixed-Column-Layout):
Jede Karte zeigt:
Vorschaubild / Thumbnail (300×300 oder 4:3, zentriert, object-fit: cover)
Bei PDFs/Audio/Video: Icon-Overlay (PDF-Symbol, Play-Button, Noten-Symbol)
Titel (erste Zeile, fett, max. 2 Zeilen)
Untertitel / kleine Infos (grau):
Datum (falls vorhanden)
Verknüpfte Person(en) oder „Ohne Zuordnung“
Dateigröße (z. B. „1,2 MB“)
MIME-Typ-Icon oder Text (jpg, pdf …)

Kleine Badges / Tags:
„Profilbild“ (rundes Icon)
„Duplikat?“ (wenn sha256-Match)
„Unverarbeitet“ (gelb)

Hover-Effekte: Schatten, leichter Zoom, schnelle Aktionen (Bearbeiten | Löschen | Herunterladen | Zuordnen)

Unendliches Scrollen (Infinite Scroll) oder Pagination (mit „Mehr laden“-Button)

Listen-Ansicht (alternativ, für Power-User):
Tabellen-ähnlich: Spalten für Thumbnail (klein), Titel, Typ, Größe, Datum, Verknüpfte Entitäten, Letzte Änderung, Aktionen
Sortierbar per Klick auf Spaltenkopf


Seitenleiste rechts (optional, aufklappbar oder fix bei Desktop)
Schnellfilter / Facetten (ähnlich wie bei modernen Galerien):
Nach Personen (Top 10 häufigste + „Weitere“)
Nach Jahrzehnt/Jahr (z. B. 1900–1909, 1910–1919 …)
Nach Ort (wenn in Metadaten vorhanden)

Statistik-Box (optional):
Gesamt: 1.248 Medien | 3,4 GB
Fotos: 892 | PDFs: 214 | Audio: 42
Ohne Zuordnung: 67


Bulk-Aktionen (bei markierten Elementen)
Checkboxen in Grid/List + Bulk-Bar oben oder unten:
Zu Person/Familie/Quelle zuordnen
Titel/Beschreibung batch-editieren
Löschen (mit Bestätigung)
Als Profilbild setzen (nur 1:1-Bilder)
Export (ZIP mit ausgewählten Dateien)



Wichtige Detail-Ansichten / Modals (per Klick auf Karte öffnen)

Vollbild-Modal / Lightbox (Hauptansicht beim Klicken):
Großes Bild / PDF-Vorschau / Audio-Player / Video-Player
Metadaten-Panel rechts oder unten:
Titel (editierbar)
Beschreibung / Notiz (editierbar, Markdown-fähig?)
Original-Dateiname
Generierter Speichername + Storage-Key
SHA-256 (verkürzt anzeigen)
MIME-Typ, Größe, Auflösung/Dauer
Verknüpfte Entitäten (Personen, Familien, Quellen) – mit Links + Entfernen-Button
Hochladedatum, Letzte Bearbeitung

Aktionen: Bearbeiten | Erneut zuschneiden/optimieren | Herunterladen | Löschen | Als Profilbild setzen | GEDCOM-Export-Vorschau

Zuordnungs-Modal („Zu Person/Familie/Quelle zuordnen“):
Suche nach Personen/Familien/Quellen
Multi-Select möglich (Bulk)
Optional: Rolle angeben (z. B. „Hauptfoto“, „Grabstein“, „Heiratsurkunde“)


Zusätzliche Features (nice-to-have, später erweiterbar)

Duplikat-Scanner-Button: „Duplikate suchen“ → zeigt Gruppen mit gleichem sha256
Exif- / IPTC-Anzeige (falls vorhanden: Aufnahmedatum, Kamera, GPS → Ort vorschlagen)
AI-Tagging-Vorschläge (später: Gesichtserkennung, Objekterkennung für Automatisierung)
Album-/Ordner-System (virtuell in DB, nicht physisch im Storage)

Technische Hinweise für Angular-Umsetzung

Komponente: MediaGalleryComponent (standalone)
State-Management: Signals + toSignal(http.get<Media[]>) oder NgRx/Cache-Service
Grid: CSS Grid + ng-container oder ngx-masonry / Angular Material Grid List
Infinite Scroll: @angular/cdk Scroll Dispatcher oder ngx-infinite-scroll
Lightbox: ngx-lightbox oder eigene MatDialog mit großem Bild + Metadaten-Split
Upload-Integration: Drag & Drop Zone + Cropper wie zuvor besprochen