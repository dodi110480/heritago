import { PrismaClient } from '@prisma/client';
import { NotesService } from './notes.service';
import { GedcomService } from './gedcom.service';
import { AuditService } from './audit.service';

export class PersonService {
    private notesService: NotesService;
    private gedcomService: GedcomService;
    private auditService: AuditService;

    constructor(private prisma: PrismaClient) {
        this.notesService = new NotesService(prisma);
        this.gedcomService = new GedcomService(prisma);
        this.auditService = new AuditService(prisma);
    }

    async savePerson(treeId: string, data: any, currentUserId?: string) {
        const isGedcomId = (val?: string) =>
            typeof val === 'string' && /^@I\d+@$/i.test(val.trim());
        const isUuid = (val?: string) =>
            typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

        const incomingGedcomId = isGedcomId(data.gedcomId) ? data.gedcomId : (isGedcomId(data.id) ? data.id : undefined);
        const incomingUuid = isUuid(data.id) ? data.id : undefined;

        let person;
        if (incomingUuid) {
            const existingById = await this.prisma.person.findUnique({ where: { id: incomingUuid } });
            if (existingById) {
                person = await this.prisma.person.update({
                    where: { id: incomingUuid },
                    data: { sex: data.gender || 'U', gedcomId: incomingGedcomId || existingById.gedcomId }
                });
            } else {
                const gedcomId = incomingGedcomId || `@I${Math.floor(Math.random() * 1000000)}@`;
                person = await this.prisma.person.create({
                    data: { id: incomingUuid, treeId, gedcomId, sex: data.gender || 'U' }
                });
            }
        } else {
            const gedcomId = incomingGedcomId || `@I${Date.now()}${Math.floor(Math.random() * 1000)}@`;
            person = await this.prisma.person.upsert({
                where: { treeId_gedcomId: { treeId, gedcomId } },
                update: { sex: data.gender || 'U' },
                create: { treeId, gedcomId, sex: data.gender || 'U' }
            });
        }

        // 1. Primary Name
        if (data.firstName !== undefined || data.lastName !== undefined) {
            const primaryName = await this.prisma.name.findFirst({
                where: { personId: person.id, isPrimary: true }
            });
            if (primaryName) {
                await this.prisma.name.update({
                    where: { id: primaryName.id },
                    data: {
                        given: data.firstName || '',
                        surname: data.lastName || '',
                        full: `${data.firstName || ''} ${data.lastName || ''}`.trim()
                    }
                });
            } else {
                await this.prisma.name.create({
                    data: {
                        treeId,
                        personId: person.id,
                        given: data.firstName || '',
                        surname: data.lastName || '',
                        full: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
                        isPrimary: true
                    }
                });
            }
        }

        // 2. Events & Facts
        if (data.events && Array.isArray(data.events)) {
            for (const e of data.events) {
                let targetEvent = null;
                if (e.id) {
                    targetEvent = await this.prisma.event.findFirst({
                        where: { id: e.id, personId: person.id }
                    });
                }
                if (!targetEvent) {
                    targetEvent = await this.prisma.event.findFirst({
                        where: {
                            personId: person.id,
                            type: e.type,
                            dateText: e.dateText || null,
                            placeId: e.placeId || null,
                            description: e.description || null
                        }
                    });
                }

                const createdEvent = targetEvent
                    ? await this.prisma.event.update({
                        where: { id: targetEvent.id },
                        data: {
                            type: e.type,
                            dateText: e.dateText || null,
                            description: e.description || null,
                            placeId: e.placeId || null
                        }
                    })
                    : await this.prisma.event.create({
                        data: {
                            treeId,
                            personId: person.id,
                            type: e.type,
                            dateText: e.dateText || null,
                            description: e.description || null,
                            placeId: e.placeId || null
                        }
                    });

                if (e.notes) await this.notesService.processSharedNotes(this.prisma, treeId, e.notes, { eventId: createdEvent.id }, currentUserId);

                if (e.media && Array.isArray(e.media)) {
                    for (const med of e.media) {
                        const mediaObj = await this.gedcomService.ensureMediaObject(treeId, med);
                        if (mediaObj) {
                            const existingLink = await this.prisma.mediaLink.findFirst({
                                where: { eventId: createdEvent.id, mediaId: mediaObj.id }
                            });
                            if (!existingLink) {
                                await this.prisma.mediaLink.create({
                                    data: { treeId, eventId: createdEvent.id, mediaId: mediaObj.id }
                                });
                            }
                        }
                    }
                }
            }
        }

        // Facts
        if (data.facts && Array.isArray(data.facts)) {
            for (const f of data.facts) {
                let targetFact = null;
                if (f.id) {
                    targetFact = await this.prisma.fact.findFirst({
                        where: { id: f.id, personId: person.id }
                    });
                }
                if (!targetFact) {
                    targetFact = await this.prisma.fact.findFirst({
                        where: {
                            personId: person.id,
                            type: f.type,
                            value: f.value || null,
                            dateText: f.dateText || null,
                            placeId: f.placeId || null
                        }
                    });
                }

                const createdFact = targetFact
                    ? await this.prisma.fact.update({
                        where: { id: targetFact.id },
                        data: {
                            type: f.type,
                            value: f.value || null,
                            dateText: f.dateText || null,
                            placeId: f.placeId || null
                        }
                    })
                    : await this.prisma.fact.create({
                        data: {
                            treeId,
                            personId: person.id,
                            type: f.type,
                            value: f.value || null,
                            dateText: f.dateText || null,
                            placeId: f.placeId || null
                        }
                    });
                if (f.notes) await this.notesService.processSharedNotes(this.prisma, treeId, f.notes, { factId: createdFact.id }, currentUserId);
            }
        }

        // 7. Notes (Person-Level, Standardized)
        if (data.notes) await this.notesService.processSharedNotes(this.prisma, treeId, data.notes, { personId: person.id }, currentUserId);

        // 8. Audit Log (moved from routes)
        const afterState = await this.prisma.person.findUnique({
            where: { id: person.id },
            include: {
                names: true,
                events: { include: { place: true } },
                facts: { include: { place: true } }
            }
        });

        const action = data.id ? 'UPDATE' : 'CREATE';
        await this.auditService.logChange({
            treeId,
            userId: currentUserId,
            action: action,
            entityType: 'PERSON',
            entityId: person.id,
            before: data.beforeState, // Passed from route if needed for perfect precision, or handled here
            after: afterState,
            summary: `Person ${data.firstName || ''} ${data.lastName || ''} ${action === 'CREATE' ? 'erstellt' : 'aktualisiert'}`.trim()
        });

        return person;
    }

    async deletePerson(id: string, treeId: string) {
        const person = await this.prisma.person.findUnique({
            where: { id },
            include: { names: { where: { isPrimary: true } } }
        });
        if (!person) throw new Error('Person not found');

        const primaryName = person.names[0];
        await this.auditService.logChange({
            treeId,
            action: 'DELETE',
            entityType: 'PERSON',
            entityId: person.id,
            before: person,
            summary: `Person ${primaryName?.given || ''} ${primaryName?.surname || ''} gelöscht`.trim()
        });

        await this.prisma.person.delete({ where: { id } });
    }

    async getChildren(personId: string) {
        const familyMembers = await this.prisma.familyMember.findMany({
            where: { personId, role: 'SPOUSE' },
            select: { familyId: true }
        });
        const familyIds = familyMembers.map(fm => fm.familyId);
        
        return this.prisma.familyMember.findMany({
            where: {
                familyId: { in: familyIds },
                role: 'CHILD'
            },
            include: {
                person: {
                    include: {
                        names: { where: { isPrimary: true } }
                    }
                }
            }
        });
    }

    async getParents(personId: string) {
        return this.prisma.familyMember.findMany({
            where: { personId, role: 'CHILD' },
            include: {
                family: {
                    include: {
                        familyMembers: {
                            include: {
                                person: {
                                    include: {
                                        names: { where: { isPrimary: true } }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    async getSpouses(personId: string) {
        return this.prisma.familyMember.findMany({
            where: { personId, role: 'SPOUSE' },
            include: {
                family: {
                    include: {
                        events: { include: { place: true } },
                        familyMembers: {
                            include: {
                                person: {
                                    include: {
                                        names: { where: { isPrimary: true } }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    static formatPersonForClient(person: any) {
        const primaryName = person.names?.find((n: any) => n.isPrimary) || person.names?.[0];
        const fullName = primaryName ? `${primaryName.given || ''} ${primaryName.surname || ''}`.trim() : '';
        const finalName = fullName || person.gedcomId || 'Unbekannt';
        
        const birthEvent = person.events?.find((e: any) => e.type === 'BIRT');
        const deathEvent = person.events?.find((e: any) => e.type === 'DEAT');
        
        const primaryMediaLink = person.mediaLinks?.find((ml: any) => ml.isPrimary) || person.mediaLinks?.[0];

        return {
            id: person.id,
            gedcomId: person.gedcomId,
            name: finalName,
            firstName: primaryName?.given || '',
            lastName: primaryName?.surname || '',
            gender: person.sex || 'U',
            isLiving: !deathEvent,
            birthDate: birthEvent?.dateText || '',
            birthPlace: birthEvent?.place?.name || '',
            deathDate: deathEvent?.dateText || '',
            deathPlace: deathEvent?.place?.name || '',
            profileImageUrl: primaryMediaLink?.media?.id || '',
            
            names: person.names || [],
            events: (person.events || []).map((e: any) => ({
                id: e.id,
                type: e.type,
                dateText: e.dateText,
                place: e.place?.name,
                placeId: e.placeId,
                description: e.description,
                isPrimary: e.type === 'BIRT' || e.type === 'DEAT'
            })),
            facts: (person.facts || []).map((f: any) => ({
                id: f.id,
                type: f.type,
                value: f.value,
                dateText: f.dateText,
                placeId: f.placeId,
                placeName: f.place?.name
            })),
            media: (person.mediaLinks || []).map((ml: any) => ({
                id: ml.media.id,
                title: ml.media.title,
                mimeType: ml.media.mimeType,
                isPrimary: ml.isPrimary
            })),
            citations: (person.citations || []).map((c: any) => ({
                id: c.id,
                sourceId: c.sourceId,
                sourceTitle: c.source?.title,
                whereInSource: c.page,
                date: c.dateText,
                text: c.dataText
            })),
            notes: [], // Will be handled by separate notes fetching if needed
            extensions: []
        };
    }
}
