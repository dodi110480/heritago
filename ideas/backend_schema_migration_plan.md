# Backend migration plan for new `schema.prisma`

## Current status
The backend (`server/src/index.ts`) still contains logic for the old data model.
The new schema introduces structural changes that require endpoint and GEDCOM import/export refactors.

## Hard blockers to generate Prisma Client
`server/prisma/schema.prisma` references these models but does not define them:
- `SharedNote`
- `ResearchLog`
- `ChangeLog`
- `Association`
- `DnaMatch`
- `DnaSegment`
- `MediaLink`
- `NoteLink`

Until these are present in the schema, `prisma generate` cannot succeed.

## Backend incompatibilities found in `server/src/index.ts`

### 1. Relationship model removed
Old code uses `prisma.relationship` extensively.
New schema uses `FamilyMember` with `role: FamilyRole`.

Affected areas:
- `GedcomManager.createPerson` relationship write path
- `formatGedcom` and `formatFamily`
- `exportTree`
- `importGedcom`
- `/api/tree/:tree/family`
- `/api/tree/:tree` include graph (`parentRelationships`, `childRelationships`, `relationships`)

### 2. Name model shape changed
- Old code writes/reads `Name.value`
- New schema uses `Name.full`
- `Name.treeId` is now required

Affected areas:
- Person creation
- GEDCOM export (`NAME` line)
- Search query (currently searches `value`)
- GEDCOM import (name creation)

### 3. Event/Fact now require `treeId`
`Event` and `Fact` creation currently omits `treeId` in several places.

Affected areas:
- Person create flow
- GEDCOM import (INDI and FAM events)

### 4. Place uniqueness changed
Old code relies on unique `treeId_name` for `findUnique/upsert`.
New schema unique is `[treeId, name, parentId]`.

Affected areas:
- Person event place upsert
- GEDCOM import place upsert
- Place CRUD route (`findUnique`, `update`, `upsert` by `treeId_name`)

### 5. Media model renamed fields
Old code expects:
- `url`
- `format`
- `originalFileName`
- `sha256`
- `description`

New schema currently defines:
- `filePath`
- `remoteUrl`
- `mimeType`
- `mediaType`
- `fileSize`
- `dimensions`

Affected areas:
- Media upload
- Media search filters
- Media pruning / file deletion path extraction
- GEDCOM formatting of media objects

### 6. Notes model renamed in domain
Old code uses `prisma.note` and note links.
New schema references `SharedNote` and `NoteLink` (missing definition in file right now).

Affected areas:
- Person note creation/linking
- import cleanup

### 7. Enum migration
`Person.sex` changed from free string to enum `Sex`.
Current writes mostly compatible (`M/F/U`) but casts should be explicit.

## Proposed execution order
1. Finalize schema file (add missing model definitions so Prisma client is generatable)
2. Regenerate Prisma client and collect compile errors
3. Refactor server model usage in this order:
   - include graphs and formatter functions
   - family/relationship writes (`FamilyMember`)
   - import/export GEDCOM family mapping
   - place CRUD uniqueness strategy
   - media field mapping
   - notes mapping (`SharedNote`)
4. Run smoke tests on endpoints:
   - tree load
   - person create/edit
   - family create/edit
   - place CRUD
   - media upload/list/delete
   - GEDCOM import/export

## Notes
The frontend will require follow-up changes where response shape changes (especially families/relations/media fields).
