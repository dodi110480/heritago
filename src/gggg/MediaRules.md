Regelwerk: Medien-Handling in der Genealogie-Web-Anwendung
(Angular + Prisma + PostgreSQL + GEDCOM 7.0 konform – Stand Februar 2026)
Dieses Regelwerk fasst alle bisherigen Entscheidungen und Empfehlungen aus unserem Gespräch zusammen. Es dient als verbindliche Leitlinie für die Implementierung.


1. Speicherort der eigentlichen Mediendateien
→ Dateien liegen immer außerhalb der PostgreSQL-Datenbank.

2. Was wird in der PostgreSQL-Datenbank (via Prisma) gespeichert?
sha256 → zwingend bei Bildern/Dokumenten → Deduplizierung & Korruptionserkennung
publicUrl oder cdnUrl → direkt verwendbar im Frontend (img src=…)

3. Upload- & Bearbeitungs-Prozess (Browser-seitig)
Ziel: Möglichst viel Verarbeitung im Browser → Server nur finale Datei erhalten

Drag & Drop oder Dateiauswahl
Vorschau laden (Data-URL)
Beschneiden (Crop) mit ngx-image-cropper oder ngx-smart-cropper
Frei zuschneiden (für Dokumente, Gruppenfotos)
1:1 + runde Maske für Profilbilder/Avatare ([roundCropper]="true" [aspectRatio]="1")
Optional: Voreinstellungen 3:4 (Porträt), 4:3, frei

Auflösung / Qualität reduzieren mit browser-image-compression
Max-Auflösung: 1920–2560 px (längste Seite)
Max-Größe: 1–2 MB für normale Bilder, 300–600 KB für Profilbilder
Format: jpeg (Fotos), png (Grafiken mit Transparenz / Scans mit Text), webp (optional, wenn Browser + Backend unterstützen)

Optional: Thumbnail generieren (z. B. 300×300 oder 400×400)
SHA-256 Hash im Browser berechnen (subtle.crypto.digest)
Upload der finalen Datei(en) → Backend (Multipart/Form-Data oder presigned URL direkt zu S3/MinIO)
Original-Dateinamen nie als Speichername verwenden
App generiert immer einen neuen, zufälligen Namen (UUID + Extension)
Originalname optional in DB speichern (als originalFileName) → nur für Anzeige / Suche
Speicher-Key = organisatorischer Pfad + generierter Name
Extension nur aus echtem MIME-Typ ableiten (nicht aus User-Input!)
→ Originaldatei wird nicht mehr benötigt → nur die bearbeitete Version wird gespeichert.



4. Spezielle Regeln für Profilbilder (Avatare)
Muss quadratisch (1:1) sein
Runde Crop-Maske im Cropper aktivieren (roundCropper=true)
Nach Crop: CSS border-radius: 50% + object-fit: cover
Zielgröße nach Komprimierung: max. 400–512 px, ~200–500 KB
Flag isProfileImage = true in DB setzen
Optional: Fallback-Bild mit Initialen im Kreis

5. GEDCOM 7.0 Export / Import Kompatibilität
Export:
→ OBJE Record mit FILE → absolute oder relative URL/Pfad
→ FORM (Mime-Typ)
→ TITL (Titel)
→ NOTE (Beschreibung)
→ Bei Bedarf CROP (wenn Crop-Info persistent gespeichert werden soll)
Import:
→ Bei FILE mit http(s) → herunterladen und wie normalen Upload behandeln
→ Bei lokalen Pfaden → Warnung / manuelle Zuordnung notwendig
→ MULTIMEDIA_RECORD → in Media-Tabelle mappen

6. Zusammenfassung – verbindliche Leitlinien
Dateien → immer Object Storage (MinIO/S3/…) oder Dateisystem
DB → nur Metadaten + URL/Key + Hash + MIME + Größe
Upload-Flow → Drag&Drop → Crop (frei + runde Option) → Resize/Compress → Upload
Profilbilder → immer 1:1 + runde Maske + CSS-Kreis
Deduplizierung → via sha256 prüfen
GEDCOM → FILE mit URL/Pfad + FORM + TITL nutzen