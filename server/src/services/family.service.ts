import { PrismaClient } from '@prisma/client';
import { NotesService } from './notes.service';
import { GedcomService } from './gedcom.service';
import { AuditService } from './audit.service';

export class FamilyService {
    private notesService: NotesService;
    private gedcomService: GedcomService;
    private auditService: AuditService;

    constructor(private prisma: PrismaClient) {
        this.notesService = new NotesService(prisma);
        this.gedcomService = new GedcomService(prisma);
        this.auditService = new AuditService(prisma);
    }

    static isGedcomXref(id?: string | null): boolean {
        if (!id) return false;
        return /^@[^@\s]+@$/.test(id.trim());
    }

    async saveFamily(treeId: string, data: any, currentUserId?: string) {
        const familyId = (data?.id || '').trim();
        if (!familyId) throw new Error("Family ID is required for save");

        const husbandGedcomId = (data?.husband || '').trim();
        const wifeGedcomId = (data?.wife || '').trim();
        if (husbandGedcomId && wifeGedcomId && husbandGedcomId === wifeGedcomId) {
            throw new Error('Husband and wife cannot be the same person');
        }

        const childGedcomIds: string[] = Array.isArray(data?.children)
            ? Array.from(new Set(data.children.map((c: any) => (c || '').trim()).filter(Boolean)))
            : [];
        if (husbandGedcomId && childGedcomIds.includes(husbandGedcomId)) {
            throw new Error('A spouse cannot be added as child in the same family');
        }
        if (wifeGedcomId && childGedcomIds.includes(wifeGedcomId)) {
            throw new Error('A spouse cannot be added as child in the same family');
        }

        const referencedGedcomIds = Array.from(
            new Set([husbandGedcomId, wifeGedcomId, ...childGedcomIds].filter(Boolean))
        );
        const referencedPeople = referencedGedcomIds.length > 0
            ? await this.prisma.person.findMany({
                where: { 
                    treeId, 
                    OR: [
                        { gedcomId: { in: referencedGedcomIds } },
                        { id: { in: referencedGedcomIds } }
                    ]
                },
                select: { id: true, gedcomId: true, sex: true }
            })
            : [];

        const personMap = new Map<string, any>();
        referencedPeople.forEach(p => {
            if (p.id) personMap.set(p.id, p);
            if (p.gedcomId) personMap.set(p.gedcomId, p);
        });

        const missingIds = referencedGedcomIds.filter(id => !personMap.has(id));
        if (missingIds.length > 0) {
            throw new Error(`Referenced person(s) not found: ${missingIds.join(', ')}`);
        }
        
        const getPerson = (id: string) => personMap.get(id);

        return this.prisma.$transaction(async (tx) => {
            const isXref = FamilyService.isGedcomXref(familyId);
            const family = await tx.family.upsert({
                where: isXref 
                    ? { treeId_gedcomId: { treeId, gedcomId: familyId } }
                    : { id: familyId },
                update: {},
                create: { 
                    treeId, 
                    gedcomId: isXref ? familyId : undefined 
                }
            });

            await tx.familyMember.deleteMany({ where: { familyId: family.id } });

            const memberCreates: any[] = [];
            if (husbandGedcomId) {
                const husband = getPerson(husbandGedcomId)!;
                memberCreates.push({
                    familyId: family.id,
                    personId: husband.id,
                    role: 'SPOUSE',
                    sortOrder: 0
                });
            }
            if (wifeGedcomId) {
                const wife = getPerson(wifeGedcomId)!;
                memberCreates.push({
                    familyId: family.id,
                    personId: wife.id,
                    role: 'SPOUSE',
                    sortOrder: 1
                });
            }

            childGedcomIds.forEach((childGedcomId, idx) => {
                const child = getPerson(childGedcomId)!;
                memberCreates.push({
                    familyId: family.id,
                    personId: child.id,
                    role: 'CHILD',
                    sortOrder: 100 + idx
                });
            });

            if (memberCreates.length > 0) {
                await tx.familyMember.createMany({ data: memberCreates });
            }

            const existingEvents = await tx.event.findMany({
                where: { familyId: family.id },
                select: { id: true }
            });
            const eventIds = existingEvents.map(e => e.id);
            if (eventIds.length > 0) {
                await tx.citation.deleteMany({ where: { eventId: { in: eventIds } } });
                await tx.mediaLink.deleteMany({ where: { eventId: { in: eventIds } } });
                await tx.noteLink.deleteMany({ where: { eventId: { in: eventIds } } });
                await tx.association.deleteMany({ where: { eventId: { in: eventIds } } });
            }
            await tx.event.deleteMany({ where: { familyId: family.id } });
            
            if (Array.isArray(data?.events)) {
                for (const e of data.events) {
                    const placeName = (e?.place || '').trim();
                    const type = (e?.type || 'EVEN').trim() || 'EVEN';
                    const dateText = (e?.dateText || e?.date || '').trim();
                    const description = (e?.description || '').trim();

                    if (!type && !dateText && !placeName && !description) continue;

                    let placeId: string | undefined = undefined;
                    if (placeName) {
                        let place = await tx.place.findFirst({ where: { treeId, name: placeName, parentId: null } });
                        if (!place) {
                            place = await tx.place.create({ data: { treeId, name: placeName, historicNames: [] } });
                        }
                        placeId = place.id;
                    }

                    const createdEvent = await tx.event.create({
                        data: {
                            treeId,
                            familyId: family.id,
                            type: type as any,
                            dateStart: this.parseDateStart(e?.date ?? e?.dateStart),
                            dateText: dateText || null,
                            eventSubtype: type === 'MARR' ? this.normalizeMarriageSubtype(e?.subType || e?.eventSubtype) : null,
                            placeId,
                            description: description || null
                        }
                    });

                    if (Array.isArray(e?.media)) {
                        for (const med of e.media) {
                            const mediaObj = await this.gedcomService.ensureMediaObject(treeId, med);
                            if (mediaObj) {
                                await tx.mediaLink.create({
                                    data: {
                                        treeId,
                                        eventId: createdEvent.id,
                                        mediaId: mediaObj.id,
                                        isPrimary: !!med?.isPrimary
                                    }
                                });
                            }
                        }
                    }

                    if (e.notes) await this.notesService.processSharedNotes(tx, treeId, e.notes, { eventId: createdEvent.id }, currentUserId);

                    if (Array.isArray(e?.citations)) {
                        for (const cit of e.citations) {
                            let sourceId: string | null = cit?.sourceId || null;
                            if (!sourceId) {
                                const sourceTitle = (cit?.sourceTitle || cit?.source || '').trim();
                                if (sourceTitle) {
                                    let src = await tx.source.findFirst({ where: { treeId, title: sourceTitle } });
                                    if (!src) src = await tx.source.create({ data: { treeId, title: sourceTitle } });
                                    sourceId = src?.id || null;
                                }
                            }
                            if (!sourceId) continue;
                            await tx.citation.create({
                                data: {
                                    treeId,
                                    eventId: createdEvent.id,
                                    sourceId,
                                    page: cit?.page || cit?.whereInSource || null,
                                    dateText: cit?.date || cit?.dateText || null,
                                    confidence: cit?.confidence || null
                                }
                            });
                        }
                    }

                    if (Array.isArray(e.associations)) {
                        for (const assoc of e.associations) {
                            let associatedId: string | null = null;
                            if (assoc.associatedPersonId) {
                                const associated = await tx.person.findFirst({
                                    where: { 
                                        treeId,
                                        OR: [{ gedcomId: assoc.associatedPersonId }, { id: assoc.associatedPersonId }]
                                    }
                                });
                                associatedId = associated?.id || null;
                            }
                            
                            await tx.association.create({
                                data: {
                                    treeId,
                                    familyId: family.id,
                                    eventId: createdEvent.id,
                                    associatedPersonId: associatedId || undefined,
                                    role: assoc.role || 'OTHER',
                                    relationText: assoc.relationText || null,
                                    dateText: assoc.dateText || null,
                                    confidence: assoc.confidence || null,
                                    notes: assoc.notes || null
                                }
                            });
                        }
                    }
                }
            }

            if (data.notes) await this.notesService.processSharedNotes(tx, treeId, data.notes, { familyId: family.id }, currentUserId);

            // Audit
            const familyAfter = await tx.family.findUnique({
                where: { id: family.id },
                include: { familyMembers: { include: { person: { include: { names: { where: { isPrimary: true } } } } } } }
            });

            if (familyAfter) {
                const husband = familyAfter.familyMembers.find(m => m.role === 'SPOUSE' && m.person.sex === 'M')?.person;
                const wife = familyAfter.familyMembers.find(m => m.role === 'SPOUSE' && m.person.sex === 'F')?.person;
                const hName = husband ? (husband.names[0]?.surname || husband.gedcomId) : '?';
                const wName = wife ? (wife.names[0]?.surname || wife.gedcomId) : '?';
                const action = data.beforeState ? 'UPDATE' : 'CREATE';

                await this.auditService.logChange({
                    treeId,
                    userId: currentUserId,
                    action,
                    entityType: 'FAMILY',
                    entityId: familyAfter.id,
                    before: data.beforeState,
                    after: familyAfter,
                    summary: `Familie ${hName} / ${wName} ${action === 'CREATE' ? 'erstellt' : 'aktualisiert'}`
                });
            }

            return family;
        });
    }

    private parseDateStart(value: any): Date | null {
        if (!value || typeof value !== 'string') return null;
        const raw = value.trim();
        if (!raw) return null;
        const isoLike = /^\d{4}-\d{2}-\d{2}(T.*)?$/;
        if (!isoLike.test(raw)) return null;
        const parsed = new Date(raw);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    private normalizeMarriageSubtype(value?: string | null): 'CIVIL' | 'RELIGIOUS' | null {
        if (!value) return null;
        const v = String(value).trim().toUpperCase();
        if (!v) return null;
        if (v === 'CIVIL' || v === 'STANDESAMTLICH') return 'CIVIL';
        if (v === 'RELIGIOUS' || v === 'KIRCHLICH') return 'RELIGIOUS';
        return null;
    }

    async analyzeInvalidFamilyIds(treeId: string) {
        const families = await this.prisma.family.findMany({
            where: { treeId },
            include: { familyMembers: { include: { person: true } } }
        });

        const signatureToFamilies = new Map<string, any[]>();
        for (const family of families) {
            const spouseIds = family.familyMembers
                .filter(fm => fm.role === 'SPOUSE')
                .map(fm => fm.person?.gedcomId || '')
                .filter(Boolean)
                .sort();
            const childIds = family.familyMembers
                .filter(fm => fm.role === 'CHILD')
                .map(fm => fm.person?.gedcomId || '')
                .filter(Boolean)
                .sort();
            const signature = `S:${spouseIds.join('|')}|C:${childIds.join('|')}`;
            if (!signatureToFamilies.has(signature)) signatureToFamilies.set(signature, []);
            signatureToFamilies.get(signature)!.push(family);
        }

        const invalidFamilies = families.filter(f => !FamilyService.isGedcomXref(f.gedcomId || ''));
        const invalidIds = invalidFamilies.map(f => f.id);
        const duplicateCleanupCandidates: any[] = [];

        for (const [signature, grouped] of signatureToFamilies.entries()) {
            if (grouped.length < 2) continue;
            const canonical = grouped.find(f => FamilyService.isGedcomXref(f.gedcomId || ''));
            if (!canonical) continue;
            const deleteIds = grouped
                .filter(f => f.id !== canonical.id && !FamilyService.isGedcomXref(f.gedcomId || ''))
                .map(f => f.id);
            if (deleteIds.length > 0) {
                duplicateCleanupCandidates.push({
                    canonicalId: canonical.id,
                    deleteIds,
                    signature
                });
            }
        }

        return { invalidIds, duplicateCleanupCandidates };
    }

    static formatFamily(fam: any): any {
        const spouseMembers = (fam.familyMembers || [])
            .filter((fm: any) => fm.role === 'SPOUSE' && fm.person)
            .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        const spouses = spouseMembers.map((fm: any) => fm.person);
        const husband = spouses.find((p: any) => p?.sex === 'M') || spouses[0];
        const wife = spouses.find((p: any) => p?.sex === 'F') || spouses.find((p: any) => p?.id !== husband?.id);

        const children = (fam.familyMembers || [])
            .filter((fm: any) => fm.role === 'CHILD' && fm.person)
            .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .map((fm: any) => fm.person);

        return {
            id: fam.gedcomId || fam.id,
            type: 'FAMILY',
            events: (fam.events || []).map((e: any) => ({
                type: e.type,
                date: e.dateText,
                place: e.place?.name,
                description: e.description,
                subType: e.eventSubtype,
                media: (e.mediaLinks || []).map((ml: any) => ({
                    id: ml.media?.id,
                    url: ml.media?.remoteUrl || ml.media?.path,
                    title: ml.media?.title || ml.media?.path,
                    isPrimary: !!ml.isPrimary
                }))
            })),
            husband: husband?.gedcomId,
            wife: wife?.gedcomId,
            children: children.map((p: any) => p.gedcomId).filter(Boolean),
            notes: (fam.noteLinks || []).filter((nl: any) => !nl.eventId).map((nl: any) => ({
                id: nl.note?.id,
                text: nl.note?.text || ''
            }))
        };
    }
}
