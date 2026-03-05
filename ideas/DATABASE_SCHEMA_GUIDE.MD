# Genealogie-Datenbank – Schema Guide

## Tree
- **Beschreibung:** Stammbäume oder genealogische Projekte
- **Felder:**
  - `id` (PK)
  - `name` (unique)
  - `title?`
  - `description?`
  - `isPublic` (default: false)
  - `createdAt`
  - `updatedAt`
  - Header & GEDCOM-Infos: `gedcomVersion?`, `sourceSoftware?`, `copyright?`, `language?`, `placForm?`, `exportDate?`, `fileName?`, `destination?`, `sourceName?`, `sourceVers?`, `sourceData?`
  - `extensions?` (JSON)
  - `schemaExtensions?` (JSON)
- **Beziehungen:**
  - `persons` → Person[]
  - `families` → Family[]
  - `events` → Event[]
  - `facts` → Fact[]
  - `places` → Place[]
  - `sources` → Source[]
  - `repositories` → Repository[]
  - `media` → Media[]
  - `citations` → Citation[]
  - `noteLinks` → NoteLink[]
  - `mediaLinks` → MediaLink[]
  - `associations` → Association[]
  - `dnaMatches` → DnaMatch[]
  - `dnaSegments` → DnaSegment[]
  - `sharedNotes` → SharedNote[]
  - `researchLogs` → ResearchLog[]
  - `changeLogs` → ChangeLog[]
  - `permissions` → TreePermission[]
  - `submitters` → Submitter[]
  - `identifiers` → Identifier[]

---

## User
- **Beschreibung:** Systembenutzer
- **Felder:** `id`, `username`, `email?`, `password?`, `globalRole` (Enum: ADMIN, USER, GUEST)
- **Beziehungen:**
  - `permissions` → TreePermission[]
  - `researchLogs` → ResearchLog[]
  - `changeLogs` → ChangeLog[]

---

## TreePermission
- **Beschreibung:** Zugriffsrechte eines Benutzers auf einen Tree
- **Felder:** `id`, `treeId`, `userId`, `level` (Enum: OWNER, EDITOR, VIEWER, COMMENTER), `privacyOverride?`
- **Constraints:** Unique `[treeId, userId]`

---

## Person
- **Beschreibung:** Individuum im Stammbaum
- **Felder:** `id`, `gedcomId?`, `sex?` (Enum: M, F, X, U), `isLiving` (default: false), `privacyLevel` (Enum), `exid?`
- **Beziehungen:**
  - `names` → Name[]
  - `events` → Event[] (`PersonEvents`)
  - `facts` → Fact[] (`PersonFacts`)
  - `familyMembers` → FamilyMember[]
  - `associations` → Association[] (`PersonAssociations`)
  - `associatedWith` → Association[] (`AssociatedPerson`)
  - `mediaLinks` → MediaLink[]
  - `noteLinks` → NoteLink[]
  - `citations` → Citation[]
  - `identifiers` → Identifier[]
  - `dnaMatches` → DnaMatch[] (`PersonDnaMatches`)
  - `dnaMatchedBy` → DnaMatch[] (`PersonDnaMatchCounterparty`)
  - `dnaSegments` → DnaSegment[] (`PersonDnaSegments`)
  - `eventParticipants` → EventParticipant[]

---

## Family
- **Beschreibung:** Familien-Einheiten
- **Felder:** `id`, `gedcomId?`
- **Beziehungen:**
  - `familyMembers` → FamilyMember[]
  - `events` → Event[] (`FamilyEvents`)
  - `eventsLdsFamc` → Event[] (`FamilyLdsSealing`)
  - `facts` → Fact[] (`FamilyFacts`)
  - `mediaLinks`, `noteLinks`, `citations`

---

## FamilyMember
- **Beschreibung:** Verknüpfung Person ↔ Family
- **Felder:** `id`, `familyId`, `personId`, `role?` (Enum: SPOUSE, CHILD, PARENT), `marriageType?`, `pedigreeType?`, `sortOrder`
- **Constraints:** Unique `[familyId, personId]`

---

## Name
- **Felder:** `id`, `treeId`, `personId`, `full`, `given?`, `surname?`, `prefix?`, `suffix?`, `type?`, `isPrimary` (default: true), `sortOrder`
- **Beziehungen:** `validity` → NameValidity[]

---

## Event
- **Felder:** `id`, `treeId`, `importId?`, `type` (Enum EventType), `eventSubtype?`, `dateText?`, `dateStart?`, `dateEnd?`, `dateType?` (Enum), `sortDate?`, `sortOrder`, `placeId?`, `description?`, `isNegative?`, `customType?`, `minDate?`, `maxDate?`, LDS-Felder...
- **Beziehungen:** `personId?`, `familyId?`, `ldsFamcId?`, `citations`, `mediaLinks`, `noteLinks`, `associations`, `participants`, `extensions`

---

## Fact
- **Felder:** `id`, `treeId`, `type` (Enum FactType), `value?`, `dateText?`, `dateStart?`, `dateEnd?`, `dateType?`, `sortOrder`, `customType?`, `minDate?`, `maxDate?`, `placeId?`
- **Beziehungen:** `personId?`, `familyId?`, `citations`, `extensions`

---

## Place
- **Felder:** `id`, `treeId`, `name`, `form?`, `jurisdiction?`, `historicNames?`, `importId?`, `latitude?`, `longitude?`, `parentId?`, `level?`, `lang?`, `extensions?`
- **Beziehungen:** `translations` → PlaceTranslation[], `identifiers`, `events`, `facts`, `associations`, `noteLinks`

---

## Identifier
- **Beschreibung:** Externe IDs für Person, Place, Source, Citation etc.
- **Felder:** `id`, `treeId`, `entityType`, `entityId`, `value`, `type?`, optionale FKs `personId?`, `placeId?`, `sourceId?`, `citationId?`

---

## Source / Repository
- **Source-Felder:** `id`, `gedcomId?`, `treeId`, `importId?`, `title`, `shortTitle?`, `author?`, `publication?`, `repositoryId?`, `citations`, `mediaLinks`, `noteLinks`, `identifiers`
- **Repository-Felder:** `id`, `gedcomId?`, `treeId`, `importId?`, `name`, `address?`, `phone?`, `email?`, `website?`, `sources`

---

## Media
- **Felder:** `id`, `gedcomId?`, `treeId`, `importId?`, `title?`, `filePath?`, `remoteUrl?`, `mimeType?`, `mediaType?`, `fileSize?`, `dimensions?`, `sortOrder`
- **Beziehungen:** `links`, `citations`, `noteLinks`, `variants`

---

## Citation
- **Felder:** `id`, `treeId`, `sourceId`, `page?`, `dateText?`, `confidence?`, `quay?`, DATA-Felder, EVEN-Felder
- **Beziehungen:** `citationTexts`, `identifiers`, `mediaLinks`, `noteLinks`, polymorphe Links: `personId?`, `familyId?`, `eventId?`, `factId?`, `mediaId?`, `noteId?`, `associationId?`

---

## SharedNote / NoteLink / MediaLink / Association / DNA / ResearchLog / ChangeLog
- **SharedNote:** Mehrzeilige Notizen, verknüpfbar über NoteLink
- **NoteLink / MediaLink:** Polymorphe Verknüpfung zu Person/Family/Event/Source/Media/Submitter
- **Association:** Person ↔ Person Beziehungen (GODPARENT, FRIEND etc.)
- **DnaMatch / DnaSegment:** DNA-Verwandtschafts-Daten
- **ResearchLog / ChangeLog:** Historie & Änderungen, Verknüpfung mit Tree/User/Entity

---

## Import-Tabellen (temporär)
- `Import`, `ImportPerson`, `ImportFamily`, `ImportEvent`, `ImportSource`, `ImportSubmitter`, `ImportRepository`, `ImportMedia`, `ImportSharedNote`
- **Beschreibung:** Zwischenspeicher für GEDCOM/CSV/API-Importe

---

## Enums (Auswahl)
- `Sex` → M, F, X, U
- `GlobalRole` → ADMIN, USER, GUEST
- `TreeAccessLevel` → OWNER, EDITOR, VIEWER, COMMENTER
- `FamilyRole` → SPOUSE, CHILD, PARENT
- `MarriageType` → CIVIL, RELIGIOUS, COMMON_LAW, SAME_SEX, UNKNOWN
- `PedigreeType` → BIRTH, ADOPTED, FOSTER, STEP, SEALED
- `DatePrecision` → EXACT, ABOUT, CALCULATED, BEFORE, AFTER, BETWEEN, RANGE
- `ConfidenceLevel` → CERTAIN, VERY_LIKELY, LIKELY, POSSIBLE, UNLIKELY
- `ResearchStatus` → OPEN, IN_PROGRESS, DONE, BLOCKED
- `ChangeAction` → CREATE, UPDATE, DELETE
- `DnaTestProvider` → ANCESTRY, MYHERITAGE, GEDMATCH, TWENTY_THREE_AND_ME, FAMILY_TREE_DNA, LIVING_DNA
- `AssociationRole` → GODPARENT, WITNESS, CLERGY, EMPLOYER, FRIEND, OTHER
- `EntityType` → PERSON, FAMILY, EVENT, FACT, SOURCE, REPOSITORY, MEDIA, NOTE, PLACE, SUBMITTER, CITATION, OTHER
- `EventType` → BIRT, CHR, DEAT, BURI, MARR, DIV, RESI, CENS, OCCU, EDUC, EMIG, IMMI, NATU, MILI, WILL, PROB, BAPL, ENDO, SLGC, SLGS, OTHER
- `FactType` → OCCUPATION, EDUCATION, RELIGION, NATIONALITY, TITLE, RESIDENCE, PROPERTY, MILITARY_SERVICE, DESCRIPTION, OTHER
