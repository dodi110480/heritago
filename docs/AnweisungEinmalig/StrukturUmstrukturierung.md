Anweisung: Umstrukturierung der Backend-Services
Ziel:

Die bestehenden *.service.ts-Dateien sollen nach dem Repository-Pattern umstrukturiert werden, um Redundanzen zu reduzieren, die Testbarkeit zu verbessern und die Wartbarkeit zu erhöhen.

1. Vorbereitung

Verzeichnisstruktur anlegen:

Erstelle folgende Verzeichnisse im src-Ordner:
Kopieren

src/
├── repositories/
├── services/
│   ├── person/
│   ├── family/
│   ├── media/
│   └── shared/
└── interfaces/



2. Repository-Schicht erstellen
Aufgabe: Erstelle für jeden Service eine Repository-Klasse, die alle Prisma-Aufrufe und include-Strukturen zentralisiert.
Beispiel für PersonRepository:

Erstelle die Datei src/repositories/person.repository.ts.
Kopiere folgenden Code und passe ihn an die Anforderungen an:
typescript
Kopieren

// src/repositories/person.repository.ts
import { PrismaClient } from '@prisma/client';
import { includeStandardRelations } from '../shared/relations.utils';

export class PersonRepository {
    constructor(private prisma: PrismaClient) {}

    async getPersonWithRelations(id: string) {
        return this.prisma.person.findUnique({
            where: { id },
            include: {
                ...includeStandardRelations(),
                facts: { include: { place: true, citations: true, noteLinks: true, mediaLinks: true } },
                familyMembers: { include: { family: { include: { events: true } } } },
            }
        });
    }

    async savePerson(data: any) {
        return this.prisma.person.upsert({
            where: { id: data.id || '' },
            create: data,
            update: data,
        });
    }

    async deletePerson(id: string) {
        return this.prisma.person.delete({ where: { id } });
    }
}

Wiederhole dies für:

FamilyRepository
MediaRepository
SourceRepository
PlaceRepository
TreeRepository

3. Service-Schicht umstrukturieren
Aufgabe: Teile jeden Service in kleinere, fokussierte Services auf.
Beispiel für PersonReadService:

Erstelle die Datei src/services/person/person.read.service.ts.
Kopiere folgenden Code und passe ihn an die Anforderungen an:
typescript
Kopieren

// src/services/person/person.read.service.ts
import { PersonRepository } from '../../repositories/person.repository';

export class PersonReadService {
    constructor(private personRepository: PersonRepository) {}

    async getFullProfile(id: string) {
        return this.personRepository.getPersonWithRelations(id);
    }
}

Wiederhole dies für:

PersonWriteService
PersonValidationService
FamilyReadService
FamilyWriteService
MediaReadService
MediaWriteService

4. Utility-Schicht für include-Strukturen erstellen
Aufgabe: Erstelle eine Utility-Klasse, die die häufig verwendeten include-Strukturen zentralisiert.

Erstelle die Datei src/shared/relations.utils.ts.
Kopiere folgenden Code:
typescript
Kopieren

// src/shared/relations.utils.ts
export function includeStandardRelations() {
    return {
        noteLinks: { include: { note: { include: { createdBy: true } } } },
        citations: { include: { source: true, citationTexts: true } },
        mediaLinks: { include: { media: true } },
    };
}

export function includeEventRelations() {
    return {
        place: true,
        citations: includeStandardRelations().citations,
        noteLinks: includeStandardRelations().noteLinks,
        mediaLinks: includeStandardRelations().mediaLinks,
    };
}


5. Dependency Injection (DI) einführen
Aufgabe: Verwende Interfaces und Dependency Injection, um Services flexibler und testbarer zu machen.
Beispiel für Interfaces:

Erstelle die Datei src/interfaces/notes.service.interface.ts.
Kopiere folgenden Code:
typescript
Kopieren

// src/interfaces/notes.service.interface.ts
export interface INotesService {
    getNotesForEntity(entityId: string): Promise<Note[]>;
}

Beispiel für DI in Services:

Passe die Services an, um Interfaces zu verwenden:
typescript
Kopieren

// src/services/person/person.read.service.ts
import { INotesService } from '../../interfaces/notes.service.interface';

export class PersonReadService {
    constructor(
        private personRepository: PersonRepository,
        private notesService: INotesService
    ) {}
}


6. Integration in bestehende Anwendung
Aufgabe: Integriere die neuen Services in die bestehende Anwendung.

Ersetze die direkten Prisma-Aufrufe in den Controllern/Routern durch die neuen Services.
Stelle sicher, dass die neuen Services korrekt instanziiert und injiziert werden.

7. Testen
Aufgabe: Teste die neuen Services gründlich.

Schreibe Unit-Tests für die neuen Repository- und Service-Klassen.
Teste die Integration in die bestehende Anwendung.
