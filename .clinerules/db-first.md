# DB-First-Prinzipien

> **Verbindlichkeit:** verbindlich · **Geltungsbereich:** Datenbank, Prisma-Schema, Backend ·
> **Aktivierung:** immer

Der Fokus liegt auf der Effizienz der Arbeit mit der PostgreSQL/Prisma-Datenbank.

## 1. Das Schema ist die Source of Truth

`schema.prisma` ist die zentrale Referenz für Datenstrukturen. **Additive** Änderungen (neue Felder,
Modelle, Relationen) sind ausdrücklich erlaubt, solange sie Bestehendes nicht brechen.
**Destruktive** Änderungen (Löschen/Umbenennen von Feldern, Typänderungen) nur nach Migration und
kurzer Rücksprache. Jede Änderung kurz dokumentieren und Migrationen testen (siehe `workflow.md`).

## 2. Prisma-native Entwicklung (intern)

- Backend (**Node/Express**) und Frontend (**Angular**) arbeiten über die Strukturen, die das
  Prisma-Schema vorgibt. **Intern** arbeitet das Backend direkt mit Prisma-Modellen; **nach außen**
  gibt es DTOs/View-Models aus (siehe Datenvertrag in `common.md` und `api.md`).
- Es werden keine künstlichen Konformitäts-Layer um die Daten gewickelt, wenn dies Performance oder
  Entwicklungsgeschwindigkeit bremst.
- Nutze die relationalen Stärken von Prisma (Joins, Includes, Aggregationen) so direkt wie möglich.

## 3. Effizienz-Priorität

- Abfragen und Datenmanipulationen werden primär auf **SQL-Performance** und **Datenkonsistenz** optimiert.
- „Was die Datenbank kann" diktiert die Implementierung der Business-Logik.

## 4. GEDCOM als Exchange-Nebenprodukt (Secondary Concern)

- GEDCOM 7.0 bleibt das unterstützte Austauschformat für Im-/Export.
- Die GEDCOM-Konformität wird ausschließlich im `GedcomManager` beim Konvertieren sichergestellt.
- Das interne Modell muss sich **nicht** dem GEDCOM-Protokoll unterordnen.

## 5. Wartung & Data Integrity

- Nutze die vorhandenen Cleanup- und Konsistenz-Skripte als Referenz für saubere Datenhaltung.
- Integrität in der DB steht über der Flexibilität beim Im-/Export.
