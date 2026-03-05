---
trigger: always_on
---

# Heritago DB-First Prinzipien

Dieses Regelwerk ersetzt alle vorherigen GEDCOM-fokussierten Entwicklungsmodelle. Der Fokus liegt auf der Effizienz der Arbeit mit der PostgreSQL/Prisma-Datenbank.

## 1. Das Schema ist das Gesetz
- Die Datei `schema.prisma` ist auf einem finalen Stand ("New Level") und darf **nicht mehr verändert werden**.
- Alle neuen Funktionen müssen so implementiert werden, dass sie mit den existierenden Tabellen und Relationen optimal funktionieren.

## 2. Prisma-native Entwicklung (Internal Source of Truth)
- Backend (NestJS/Node) und Frontend (Angular) kommunizieren direkt über die Strukturen, die durch das Prisma-Schema vorgegeben sind.
- Es werden keine künstlichen Konformitäts-Layer um die Daten gewickelt, wenn dies die Performance oder Entwicklungsgeschwindigkeit bremst.
- Nutze die relationalen Stärken von Prisma (Joins, Includes, Aggregationen) so direkt wie möglich.

## 3. Effizienz-Priorität
- Abfragen und Datenmanipulationen werden primär auf **SQL-Performance** und **Datenkonsistenz** optimiert.
- "Was die Datenbank kann" diktiert die Implementierung der Business-Logik.

## 4. GEDCOM als Exchange-Nebenprodukt (Secondary Concern)
- GEDCOM 7.0 bleibt das unterstützte Austauschformat für den Im-/Export.
- Die GEDCOM-Konformität wird ausschließlich im `GedcomManager` beim Konvertieren der Daten sichergestellt. 
- Das interne Modell muss sich **nicht** dem GEDCOM-Protokoll unterordnen.

## 5. Wartung & Data Integrity
- Nutze die vorhandenen Cleanup- und Konsistenz-Scripte als Referenz für die saubere Datenhaltung.
- Integrität in der DB steht über der Flexibilität beim Im-/Export.