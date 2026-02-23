Warum GEDCOM 7.0 nicht direkt als Datenbankstruktur für eine moderne Genealogie-Webapp nutzen?
GEDCOM 7.0 ist ein Austausch- und Archivierungsformat, das für den Import/Export zwischen Genealogie-Programmen entwickelt wurde – nicht als effizientes, skalierbares Datenmodell für eine produktive Web-Anwendung wie deine Angular-App mit Prisma und PostgreSQL. Hier die wichtigsten Gründe, warum es sich nicht eignet (basierend auf meiner vorherigen Erklärung, aber detaillierter):

Schlechte Performance bei Queries:
GEDCOM ist hierarchisch und tag-basiert (z. B. INDI mit Unterstrukturen wie NAME, BIRT, FAMS). In einer DB würde das zu einer generischen "Key-Value"-Struktur führen (z. B. eine Tabelle für Records und eine für Tags/Values), was viele Joins und rekursive Queries erfordert. Für Ahnenforschungs-Features wie "Alle Nachfahren finden" oder "Volltextsuche über Namen/Orte" würde das langsam werden – PostgreSQL kann das besser mit optimierten Indizes und CTEs handhaben.
Fehlende Flexibilität für moderne Features:
GEDCOM 7.0 ist starr: Es unterstützt z. B. keine direkte Integration von DNA-Daten, kollaborativen Edits, Benutzerkonten oder KI-gestützte Matches (wie bei Ancestry). Du könntest Erweiterungen (Extensions) hinzufügen, aber das macht den Export inkompatibel. In einer eigenen DB-Struktur kannst du nahtlos Features wie User-Collaboration, Audit-Logs oder Geo-Mapping (mit PostGIS) einbauen.
Skalierbarkeitsprobleme:
Bei großen Stammbäumen (z. B. 100.000+ Personen) ist GEDCOM's flache Struktur ineffizient. Es fehlen native Unterstützung für Indizes, Constraints oder Relations (z. B. Foreign Keys). Prisma + PostgreSQL erlauben dir, das mit relationalen Tabellen zu optimieren, z. B. durch Materialized Views für Ahnenpfade.
Wartbarkeit und Zukunftssicherheit:
GEDCOM ändert sich langsam (7.0 ist seit 2020 stabil, aber Adoption ist 2026 noch niedrig). Wenn du direkt darauf baust, bist du an veraltete Konzepte gebunden (z. B. begrenzte Namensstrukturen). Ein eigenes Modell lässt dich unabhängig evolieren, während GEDCOM nur für I/O bleibt.
Praktische Beispiele aus der Industrie:
Plattformen wie FamilySearch oder MyHeritage speichern intern relational/graph-basiert und mappen nur bei Bedarf zu GEDCOM. Deine App würde bei direkter GEDCOM-Nutzung Import/Export-Probleme haben, da viele Dateien noch 5.5.1 sind.

Zusammenfassend: GEDCOM ist super für Kompatibilität, aber für eine 2026-moderne App (mit Angular-Frontend für interaktive Bäume, Suchen und Kollaboration) ist es ein Engpass. Stattdessen: Internes relationales Modell mit Prisma, das GEDCOM 7.0 als "Brücke" nutzt.
Die allerbeste, modernste Lösung für dein Setup (Angular + Prisma + PostgreSQL, GEDCOM 7.0-kompatibel)
Die optimalste Architektur 2026 für eine Genealogie-Webapp ist ein hybrides relationales Modell mit Graph-Elementen, das PostgreSQL's Stärken (z. B. JSONB für flexible Daten, ltree für Hierarchien, PostGIS für Orte) ausnutzt. Hier der Überblick:

Internes Datenmodell: Relational mit 1:n/m:n-Relationen für Personen, Ereignisse, Beziehungen, Quellen etc. Verwende JSONB für GEDCOM-spezifische Unsicherheiten (z. B. Datums-Modifier wie ABT/EST). Das erlaubt schnelle Queries und Skalierung.
GEDCOM-Integration:
Import: Parse GEDCOM-Dateien (z. B. mit einer Lib wie gedcom.js in Angular oder einem Node.js-Backend) und mappe zu deinem Schema. Handle Extensions und Unsicherheiten (z. B. ABT → JSONB-Feld).
Export: Generiere GEDCOM 7.0 aus der DB (z. B. mit einer Prisma-Query, die Strukturen rekonstruiert).
Ziel: 100% Kompatibilität mit Tools wie Gramps oder FamilySearch.

Moderne Features einbauen:
Ahnen-/Nachfahrensuchen: Nutze PostgreSQL's rekursive CTEs oder ltree-Extension für effiziente Pfade (z. B. "A > B > C" als String-Pfad).
Suche: Volltext mit tsvector + pg_trgm für fuzzy Matches (Namen, Orte).
Kollaboration: Füge User-Modelle hinzu (z. B. mit Auth via Prisma), Audit-Logs und Versioning.
Frontend (Angular): RxJS für reaktive Bäume, NG-Zorro oder PrimeNG für Diagramme (z. B. Pedigree-Charts). Integriere File-Uploads für GEDCOM-Import.
Skalierung: PostgreSQL mit Sharding (falls groß), Prisma für ORM-Sicherheit.
Zukunftssicher: Erweiterbar für AI (z. B. via Prisma + LangChain für Match-Vorschläge) oder DNA-Integration (z. B. Tabellen für SNPs).


Das ist besser als GEDCOM-direkt, da es performanter, erweiterbarer und nutzerfreundlicher ist – und immer noch GEDCOM-kompatibel. Implementiere es schrittweise: Starte mit Core (Personen + Familien), dann Events/Quellen, dann Import/Export.
Detailliertes Prisma-Schema für deine Genealogie-App
Hier ein umfassendes, detailliertes Prisma-Schema (datasource: PostgreSQL), das GEDCOM 7.0-konform ist (z. B. Mapping von INDI/FAM/EVEN/SOUR). Es ist modular, skalierbar und nutzt JSONB für Flexibilität. Kopiere es in deine schema.prisma-Datei, passe bei Bedarf an (z. B. UUID vs. Int-IDs).
prismagenerator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Erweiterungen aktivieren (in PostgreSQL einrichten: CREATE EXTENSION ltree; CREATE EXTENSION postgis;)
model Config {
  // Placeholder für App-Konfig, falls nötig
}

// Kern-Model: Person (entspricht INDI in GEDCOM)
model Person {
  id            String       @id @default(uuid())  // UUID für globale Einzigartigkeit
  sex           String?      // M/F/X/U (aus GEDCOM SEX)
  restriction   String?      // PRIVACY aus GEDCOM (z. B. "locked")
  rin           String?      // Record Identification Number (GEDCOM RIN)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  createdById   String?      // User-ID für Kollaboration
  updatedById   String?      // User-ID

  names         Name[]       // Mehrere Namen (birth, aka, married...)
  events        Event[]      // BIRT, DEAT, CHR, BURI etc.
  facts         Fact[]       // OCCU, EDUC, NATI etc. (nicht-ereignisbasierte Facts)
  attributes    Attribute[]  // Physische Beschreibungen (z. B. HAIR, EYES) als JSONB
  associations  Association[] // ASSO zu anderen Personen (z. B. Godparent)
  sources       Citation[]   // Quellen-Zitate
  media         MediaLink[]  // Verknüpfte Medien
  notes         NoteLink[]   // Notizen
  submissions   SubmissionLink[] // SUBM-Verknüpfungen

  // Beziehungen (Graph-ähnlich)
  parentRelationships Relationship[] @relation("ChildToParent")  // Als Kind
  childRelationships  Relationship[] @relation("ParentToChild")  // Als Elternteil
  spouseRelationships Relationship[] @relation("Spouse")         // Ehen/Partnerschaften

  // Ahnenpfad für schnelle Queries (ltree: z. B. 'root.personId.parentId')
  ancestorPath  ltree?       // Erfordert PostgreSQL ltree-Extension

  // JSONB für GEDCOM-Extensions oder custom Daten (z. B. DNA-Matches)
  extensions    Json?

  // Relations zu Users (für Kollaboration)
  createdBy     User?        @relation("CreatedPersons", fields: [createdById], references: [id])
  updatedBy     User?        @relation("UpdatedPersons", fields: [updatedById], references: [id])
}

// Name-Modell (GEDCOM NAME mit Pieces)
model Name {
  id         String   @id @default(uuid())
  personId   String
  value      String   // Haupt-Payload: "John /Doe/" (mit Slashes für Surname)
  type       String?  // birth | aka | married | immigrant | maiden (GEDCOM TYPE)
  lang       String?  // Für TRAN (z. B. "de" für deutsche Variante)
  prefix     String?  // NPFX (z. B. "Dr.")
  given      String?  // GIVN (Komma-separiert für mehrere Vornamen)
  surname    String?  // SURN
  surPrefix  String?  // SPFX (z. B. "von" in "von Goethe")
  suffix     String?  // NSFX (z. B. "Jr.")
  nick       String?  // NICK
  sortValue  String?  // Für Sortierung (autogeneriert?)

  // Quellen/Notizen für diesen Namen
  sources    Citation[]
  notes      NoteLink[]

  person     Person   @relation(fields: [personId], references: [id], onDelete: Cascade)
}

// Event-Modell (GEDCOM-Ereignisse wie BIRT, MARR)
model Event {
  id          String   @id @default(uuid())
  personId    String?  // Für individuelle Events
  familyId    String?  // Für Familienevents (z. B. MARR)
  type        String   // BIRT | DEAT | CHR | BURI | MARR | DIV | ANUL etc.
  date        Json?    // { modifier: "ABT", value: "1855", phrase: "um 1855" } – JSONB für ABT/CAL/EST/BEF/AFT/BET
  placeId     String?  // Verknüpfung zu Place
  address     Json?    // ADDR-Struktur als JSONB
  cause       String?  // CAUS
  age         String?  // AGE (z. B. "23y 5m")
  husbandAge  String?  // Für MARR etc.
  wifeAge     String?  // Für MARR etc.
  description String?  // Beschreibung

  sources     Citation[]
  notes       NoteLink[]
  media       MediaLink[]

  person      Person?  @relation(fields: [personId], references: [id], onDelete: Cascade)
  family      Family?  @relation(fields: [familyId], references: [id], onDelete: Cascade)
  place       Place?   @relation(fields: [placeId], references: [id])
}

// Fact-Modell (GEDCOM-Facts wie OCCU, RELI)
model Fact {
  id          String   @id @default(uuid())
  personId    String
  type        String   // OCCU | EDUC | NATI | CAST | PHYS | IDNO etc.
  value       String?  // Haupt-Wert (z. B. "Schmied")
  date        Json?    // Wie bei Event
  placeId     String?
  description String?

  sources     Citation[]
  notes       NoteLink[]

  person      Person   @relation(fields: [personId], references: [id], onDelete: Cascade)
  place       Place?   @relation(fields: [placeId], references: [id])
}

// Family/Relationship-Modell (GEDCOM FAM + erweitert für nicht-eheliche Beziehungen)
model Family {
  id          String   @id @default(uuid())
  type        String?  // marriage | partnership | adoption etc.
  rin         String?  // GEDCOM RIN

  events      Event[]  // MARR, DIV etc.
  sources     Citation[]
  notes       NoteLink[]

  // Beziehungen über Relationship-Model (für Flexibilität: biologisch/adoptiv etc.)
}

model Relationship {
  id             String   @id @default(uuid())
  childId        String?  // Kind
  parentId       String?  // Elternteil (kann HUSB/WIFE sein)
  familyId       String?  // Optionale Verknüpfung zu Family
  type           String   // parent | spouse | sibling | adopted | foster etc. (GEDCOM PEDI/RELA)
  status         String?  // challenged | disproven | proven (GEDCOM STAT)
  primary        Boolean? // Primäre Beziehung?

  // Für Spouse: HUSB/WIFE-Rolle
  role           String?  // husband | wife | partner

  notes          NoteLink[]

  child          Person?  @relation("ChildToParent", fields: [childId], references: [id], onDelete: Cascade)
  parent         Person?  @relation("ParentToChild", fields: [parentId], references: [id], onDelete: Cascade)
  spouseFrom     Person?  @relation("Spouse", fields: [childId], references: [id])  // Hack für m:n-Spouses
  spouseTo       Person?  @relation("Spouse", fields: [parentId], references: [id])
  family         Family?  @relation(fields: [familyId], references: [id], onDelete: Cascade)
}

// Place-Modell (GEDCOM PLAC mit Hierarchie)
model Place {
  id          String   @id @default(uuid())
  name        String   // "Munich, Germany"
  hierarchy   Json?    // { country: "Germany", state: "Bavaria", city: "Munich" } – für Suche
  latitude    Float?
  longitude   Float?   // Für PostGIS: geometry(Point, 4326)?
  jurisdiction String?  // JURI
  notes       NoteLink[]

  events      Event[]
  facts       Fact[]
}

// Source- und Citation-Model (GEDCOM SOUR/REPO)
model Source {
  id          String   @id @default(uuid())
  title       String
  author      String?
  publication String?
  repositoryId String?
  callNumber  String?  // CALN
  mediaType   String?  // MEDI
  quality     String?  // QUAY (0-3)
  text        String?  // DATA/TEXT
  rin         String?

  citations   Citation[]
  notes       NoteLink[]
  media       MediaLink[]
  repository  Repository? @relation(fields: [repositoryId], references: [id])
}

model Citation {
  id          String   @id @default(uuid())
  sourceId    String
  personId    String?
  eventId     String?
  factId      String?
  nameId      String?
  familyId    String?
  page        String?  // PAGE
  quality     String?  // QUAY
  text        String?  // TEXT
  date        DateTime? // EVEN/DATE (Citation-Datum)

  source      Source   @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  person      Person?  @relation(fields: [personId], references: [id])
  event       Event?   @relation(fields: [eventId], references: [id])
  fact        Fact?    @relation(fields: [factId], references: [id])
  name        Name?    @relation(fields: [nameId], references: [id])
  family      Family?  @relation(fields: [familyId], references: [id])
}

model Repository {
  id          String   @id @default(uuid())
  name        String
  address     Json?    // ADDR als JSONB

  sources     Source[]
}

// Media-Modell (GEDCOM OBJE)
model Media {
  id          String   @id @default(uuid())
  file        String   // Pfad/URL zum File
  format      String?  // FORM (jpg, pdf etc.)
  title       String?
  primary     Boolean? // PRIM

  links       MediaLink[]
  notes       NoteLink[]
}

model MediaLink {
  id          String   @id @default(uuid())
  mediaId     String
  personId    String?
  eventId     String?
  sourceId    String?

  media       Media    @relation(fields: [mediaId], references: [id], onDelete: Cascade)
  person      Person?  @relation(fields: [personId], references: [id])
  event       Event?   @relation(fields: [eventId], references: [id])
  source      Source?  @relation(fields: [sourceId], references: [id])
}

// Note-Modell (GEDCOM NOTE)
model Note {
  id          String   @id @default(uuid())
  text        String
  rin         String?

  links       NoteLink[]
}

model NoteLink {
  id          String   @id @default(uuid())
  noteId      String
  personId    String?
  eventId     String?
  factId      String?
  nameId      String?
  placeId     String?
  sourceId    String?
  mediaId     String?
  familyId    String?
  relationshipId String?

  note        Note     @relation(fields: [noteId], references: [id], onDelete: Cascade)
  person      Person?  @relation(fields: [personId], references: [id])
  event       Event?   @relation(fields: [eventId], references: [id])
  fact        Fact?    @relation(fields: [factId], references: [id])
  name        Name?    @relation(fields: [nameId], references: [id])
  place       Place?   @relation(fields: [placeId], references: [id])
  source      Source?  @relation(fields: [sourceId], references: [id])
  media       Media?   @relation(fields: [mediaId], references: [id])
  family      Family?  @relation(fields: [familyId], references: [id])
  relationship Relationship? @relation(fields: [relationshipId], references: [id])
}

// Association-Modell (GEDCOM ASSO)
model Association {
  id          String   @id @default(uuid())
  personId    String
  associatedPersonId String
  relation    String   // RELA (z. B. "godparent")
  type        String?  // TYPE

  person      Person   @relation(fields: [personId], references: [id], onDelete: Cascade)
  associated  Person   @relation("Associated", fields: [associatedPersonId], references: [id])
}

// Submission-Modell (GEDCOM SUBM/SUBN)
model Submission {
  id          String   @id @default(uuid())
  submitter   String   // NAME
  description String?

  links       SubmissionLink[]
}

model SubmissionLink {
  id            String   @id @default(uuid())
  submissionId  String
  personId      String?

  submission    Submission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  person        Person?    @relation(fields: [personId], references: [id])
}

// User-Modell (für Kollaboration, nicht in GEDCOM)
model User {
  id            String   @id @default(uuid())
  email         String   @unique
  name          String
  role          String?  // admin | user

  createdPersons Person[] @relation("CreatedPersons")
  updatedPersons Person[] @relation("UpdatedPersons")
}

// Attribute-Modell (GEDCOM DSCR/PHYS etc.)
model Attribute {
  id          String   @id @default(uuid())
  personId    String
  type        String   // DSCR | CAST | EDUC (erweitert)
  value       Json?    // Flexibel als JSONB

  person      Person   @relation(fields: [personId], references: [id], onDelete: Cascade)
}
Erläuterungen zum Schema:

Flexibilität: JSONB für Datums (z. B. { "modifier": "ABT", "year": 1855 }) – perfekt für GEDCOM-Modifier.
GEDCOM-Mapping: INDI → Person, FAM → Family + Relationship, EVEN → Event/Fact, SOUR → Source/Citation.
Optimierungen: ltree für Ahnenpfade (schnelle Queries wie SELECT * WHERE ancestorPath <@ 'root.yourId').
Erweiterungen: Füge PostGIS für Geodaten hinzu (geometry-Felder in Place).
Migration: npx prisma migrate dev nach Anpassungen.
Import-Beispiel: In deinem Backend (z. B. NestJS mit Prisma) parse GEDCOM und erstelle Records via Prisma-Client.