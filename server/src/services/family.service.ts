import { PrismaClient } from '@prisma/client';
import { DateUtils } from '../shared/date.utils';
import { NotesService } from './notes.service';
import { GedcomService } from './gedcom.service';
import { AuditService } from './audit.service';
import { PersonService } from './person.service';

export class FamilyService {
    private notesService: NotesService;
    private gedcomService: GedcomService;
    private auditService: AuditService;

    constructor(private prisma: PrismaClient) {
        this.notesService = new NotesService(prisma);
        this.gedcomService = new GedcomService(prisma);
        this.auditService = new AuditService(prisma);
    }
    async getFullProfile(familyId: string, treeId: string) {
        const isXref = FamilyService.isGedcomXref(familyId);
        const family = await this.prisma.family.findUnique({
            where: isXref ? { treeId_gedcomId: { treeId, gedcomId: familyId } } : { id: familyId },
            include: {
                events: {
                    include: {
                        place: true,
                        mediaLinks: { include: { media: true } },
                        citations: { include: { source: true } },
                        associations: {
                            include: {
                                associated: {
                                    include: { names: { where: { isPrimary: true } } }
                                }
                            }
                        }
                    }
                },
                mediaLinks: { include: { media: true } },
                citations: { include: { source: true } },
                noteLinks: { include: { note: true } },
                familyMembers: {
                    include: {
                        person: {
                            include: {
                                names: { where: { isPrimary: true } },
                                mediaLinks: { include: { media: true }, where: { isPrimary: true } }
                            }
                        }
                    }
                }
            }
        }) as any;

        if (!family) return null;

        const formattedFamily = FamilyService.formatFamilyForClient(family);
        const members = family.familyMembers.map((fm: any) => PersonService.formatPersonForClient(fm.person));

        return {
            family: formattedFamily,
            members
        };
    }

    private static getFamilyMetadata(fam: any) {
        const events = fam.events || [];
        const tags = events.map((e: any) => (e.type || '').toUpperCase());

        let status = 'UNKNOWN';
        let statusLabel = 'Partnerschaft/Familie';
        let statusIcon = '🤝';

        if (tags.includes('DIV')) { status = 'DIV'; statusLabel = 'Geschieden'; statusIcon = '💔'; }
        else if (tags.includes('DIVF')) { status = 'DIVF'; statusLabel = 'Scheidungsantrag'; statusIcon = '💔'; }
        else if (tags.includes('ANUL')) { status = 'ANUL'; statusLabel = 'Annulliert'; statusIcon = '⚖️'; }
        else if (tags.includes('ENGA')) { status = 'ENGA'; statusLabel = 'Verlobt'; statusIcon = '💞'; }
        else if (tags.includes('MARR')) { status = 'MARR'; statusLabel = 'Verheiratet'; statusIcon = '💍'; }

        const marrEvent = events.find((e: any) => e.type === 'MARR');
        const marriageLabel = marrEvent 
            ? `${marrEvent.dateText || ''}${marrEvent.place?.name ? ' in ' + marrEvent.place.name : ''}`.trim()
            : '';

        // Sortable marriage date
        const marriageDate = marrEvent?.date || null;

        const marriageSubtypeLabels: string[] = [];
        events.filter((e: any) => e.type === 'MARR').forEach((e: any) => {
            const sub = (e.eventSubtype || '').toUpperCase();
            if (sub === 'CIVIL') marriageSubtypeLabels.push('Standesamtlich');
            if (sub === 'RELIGIOUS') marriageSubtypeLabels.push('Kirchlich');
        });

        return {
            status,
            statusLabel,
            statusIcon,
            marriageLabel,
            marriageDate,
            marriageSubtypeLabels: Array.from(new Set(marriageSubtypeLabels)),
            childrenCount: (fam.familyMembers || []).filter((m: any) => m.role === 'CHILD').length
        };
    }

    static formatFamilyForClient(fam: any) {
        if (!fam) return null;
        
        const spouses = (fam.familyMembers || []).filter((m: any) => m.role === 'SPOUSE');
        const husband = spouses.find((m: any) => m.person?.sex === 'M')?.personId || spouses[0]?.personId;
        const wife = spouses.find((m: any) => m.person?.sex === 'F' && m.personId !== husband)?.personId || (spouses.length > 1 ? spouses[1].personId : null);
        const children = (fam.familyMembers || []).filter((m: any) => m.role === 'CHILD').map((m: any) => m.personId);

        const getName = (pId: string | null) => {
            if (!pId) return 'Unbekannt';
            const member = (fam.familyMembers || []).find((m: any) => m.personId === pId);
            const p = member?.person;
            if (!p) return 'Unbekannt';
            const primary = p.names?.find((n: any) => n.isPrimary) || p.names?.[0];
            return primary ? `${primary.given || ''} ${primary.surname || ''}`.trim() : (p.firstName || p.lastName ? `${p.firstName || ''} ${p.lastName || ''}`.trim() : 'Unbekannt');
        };

        const meta = FamilyService.getFamilyMetadata(fam);

        return {
            id: fam.id,
            gedcomId: fam.gedcomId,
            treeId: fam.treeId,
            husband,
            wife,
            husbandName: getName(husband),
            wifeName: getName(wife),
            profileImageUrl: FamilyService.getFamilyImage(fam),
            gender: FamilyService.getFamilyGender(fam),
            childNames: children.map((cId: string) => getName(cId)).join(', '),
            children,
            ...meta,
            events: (fam.events || []).map((e: any) => ({
                id: e.id,
                type: e.type,
                dateText: e.dateText,
                place: e.place?.name,
                description: e.description,
                subType: e.eventSubtype,
                associations: (e.associations || []).map((a: any) => ({
                    id: a.id,
                    role: a.role,
                    associatedPersonId: a.associatedPersonId,
                    associatedPersonName: a.associated?.names?.find((n: any) => n.isPrimary)?.full || 'Unbekannt',
                    relationText: a.relationText,
                    dateText: a.dateText,
                    confidence: a.confidence,
                    notes: a.notes
                }))
            })).sort((a: any, b: any) => DateUtils.compareTimelineItems(a, b)),
            media: (fam.mediaLinks || []).map((ml: any) => ({
                id: ml.media?.id,
                title: ml.media?.title,
                url: ml.media?.id,
                isPrimary: ml.isPrimary
            })),
            formattedCitations: FamilyService.formatCitationsForClient(fam.citations),
            formattedNotes: FamilyService.formatNotesForClient(fam.noteLinks),
            notes: (fam.noteLinks || []).map((nl: any) => nl.note?.text).filter(Boolean),
            updatedAt: fam.updatedAt,
            displayName: FamilyService.getFamilyDisplayName(fam)
        };
    }

    private static formatCitationForClient(cit: any) {
        if (!cit) return null;
        
        const confidenceLabels: Record<string, string> = {
            'CERTAIN': 'Sicher',
            'VERY_LIKELY': 'Sehr wahrscheinlich',
            'LIKELY': 'Wahrscheinlich',
            'POSSIBLE': 'Möglich',
            'UNLIKELY': 'Unwahrscheinlich'
        };

        const confidenceColorClasses: Record<string, string> = {
            'CERTAIN': 'badge-success',
            'VERY_LIKELY': 'bg-emerald-500/10 text-emerald-500',
            'LIKELY': 'badge-highlight',
            'POSSIBLE': 'badge-warn',
            'UNLIKELY': 'badge-danger'
        };

        const dateVal = cit.date || cit.dateText || cit.dataDateText;
        let dateLabel = '';
        if (dateVal) {
            const d = new Date(dateVal);
            if (!isNaN(d.getTime())) {
                dateLabel = d.toLocaleDateString('de-DE');
            }
        }

        return {
            ...cit,
            confidenceLabel: confidenceLabels[cit.confidence || ''] || 'Keine Angabe',
            confidenceColorClass: confidenceColorClasses[cit.confidence || ''] || 'bg-neutral-950/10 text-neutral-400',
            dateLabel,
            description: (cit.whereInSource || cit.page) ? `Fundstelle: ${cit.whereInSource || cit.page}` : '',
            title: cit.source?.title || 'Unbekannte Quelle',
            author: cit.source?.author,
            publication: cit.source?.publication
        };
    }

    private static formatCitationsForClient(citations: any[] = []) {
        return (citations || []).map(cit => FamilyService.formatCitationForClient(cit)).filter(Boolean);
    }

    private static formatNoteForClient(noteLink: any) {
        const n = noteLink.note;
        if (!n) return null;
        return {
            id: n.id,
            text: n.text || '',
            noteType: n.noteType || 'GENERAL',
            noteTypeLabel: PersonService.getNoteTypeLabel(n.noteType),
            createdAt: n.createdAt,
            updatedAt: n.updatedAt,
            isPrivate: n.privacyLevel === 'PRIVATE',
            createdBy: n.createdBy?.username || 'System',
            context: noteLink.context
        };
    }

    private static formatNotesForClient(noteLinks: any[] = []) {
        return (noteLinks || []).map(nl => FamilyService.formatNoteForClient(nl)).filter(Boolean);
    }

    private static getFamilyDisplayName(fam: any): string {
        const spouses = (fam.familyMembers || []).filter((m: any) => m.role === 'SPOUSE');
        const husbandMember = spouses.find((m: any) => m.person?.sex === 'M');
        const wifeMember = spouses.find((m: any) => m.person?.sex === 'F' && m.personId !== husbandMember?.personId);
        
        const getName = (p: any) => {
            if (!p) return 'Unbekannt';
            const primary = p.names?.find((n: any) => n.isPrimary) || p.names?.[0];
            return primary ? `${primary.given || ''} ${primary.surname || ''}`.trim() : (p.firstName || p.lastName ? `${p.firstName || ''} ${p.lastName || ''}`.trim() : 'Unbekannt');
        };

        const hName = getName(husbandMember?.person);
        const wName = getName(wifeMember?.person || (spouses.length > 1 && spouses[1] !== husbandMember ? spouses[1].person : null));
        
        return `${hName} & ${wName}`;
    }

    private static getFamilyImage(fam: any): string | undefined {
        const spouses = (fam.familyMembers || []).filter((m: any) => m.role === 'SPOUSE');
        const husband = spouses.find((m: any) => m.person?.sex === 'M')?.person;
        if (husband?.mediaLinks?.find((ml: any) => ml.isPrimary)?.media?.id) return husband.mediaLinks.find((ml: any) => ml.isPrimary).media.id;
        if (husband?.mediaLinks?.[0]?.media?.id) return husband.mediaLinks[0].media.id;

        const wife = spouses.find((m: any) => m.person?.sex === 'F')?.person;
        if (wife?.mediaLinks?.find((ml: any) => ml.isPrimary)?.media?.id) return wife.mediaLinks.find((ml: any) => ml.isPrimary).media.id;
        if (wife?.mediaLinks?.[0]?.media?.id) return wife.mediaLinks[0].media.id;

        return undefined;
    }

    private static getFamilyGender(fam: any): string {
        const spouses = (fam.familyMembers || []).filter((m: any) => m.role === 'SPOUSE');
        return spouses.find((m: any) => m.person?.sex === 'M')?.person?.sex || spouses[0]?.person?.sex || 'U';
    }


    static isGedcomXref(id?: string | null): boolean {
        if (!id) return false;
        return /^@[^@\s]+@$/.test(id.trim());
    }

    async deleteFamily(treeId: string, familyId: string, currentUserId?: string) {
        const isXref = FamilyService.isGedcomXref(familyId);
        
        const family = await this.prisma.family.findUnique({
            where: isXref ? { treeId_gedcomId: { treeId, gedcomId: familyId } } : { id: familyId },
            include: { familyMembers: { include: { person: { include: { names: { where: { isPrimary: true } } } } } } }
        });

        if (!family) return;

        await this.prisma.$transaction(async (tx) => {
            // Delete associated Citations, MediaLinks, NoteLinks, Associations of events
            const events = await tx.event.findMany({ where: { familyId: family.id }, select: { id: true } });
            const eventIds = events.map(e => e.id);
            if (eventIds.length > 0) {
                await tx.citation.deleteMany({ where: { eventId: { in: eventIds } } });
                await tx.mediaLink.deleteMany({ where: { eventId: { in: eventIds } } });
                await tx.noteLink.deleteMany({ where: { eventId: { in: eventIds } } });
                await tx.association.deleteMany({ where: { eventId: { in: eventIds } } });
            }
            await tx.event.deleteMany({ where: { familyId: family.id } });
            await tx.familyMember.deleteMany({ where: { familyId: family.id } });
            await tx.noteLink.deleteMany({ where: { familyId: family.id } });
            await tx.mediaLink.deleteMany({ where: { familyId: family.id } });
            await tx.citation.deleteMany({ where: { familyId: family.id } });
            await tx.association.deleteMany({ where: { familyId: family.id } });
            
            await tx.family.delete({ where: { id: family.id } });
        });

        // Audit
        const husband = family.familyMembers.find(m => m.role === 'SPOUSE' && m.person.sex === 'M')?.person;
        const wife = family.familyMembers.find(m => m.role === 'SPOUSE' && m.person.sex === 'F')?.person;
        const hName = husband ? (husband.names[0]?.surname || husband.gedcomId) : '?';
        const wName = wife ? (wife.names[0]?.surname || wife.gedcomId) : '?';

        await this.auditService.logChange({
            treeId,
            userId: currentUserId,
            action: 'DELETE',
            entityType: 'FAMILY',
            entityId: family.id,
            before: family,
            after: null,
            summary: `Familie ${hName} / ${wName} gelöscht`
        });
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
                update: {
                    restrictionNotice: data?.restrictionNotice || 'NONE'
                },
                create: { 
                    treeId, 
                    gedcomId: isXref ? familyId : undefined,
                    restrictionNotice: data?.restrictionNotice || 'NONE'
                }
            });

            await tx.familyMember.deleteMany({ where: { familyId: family.id } });

            const memberCreates: any[] = [];
            const seenPersonIds = new Set<string>();

            const addMember = (gedcomId: string, role: any, defaultSortOrder: number) => {
                const person = getPerson(gedcomId);
                if (!person || seenPersonIds.has(person.id)) return;
                
                // Get extra data from frontend data.familyMembers if available
                const extra = Array.isArray(data.familyMembers) 
                    ? data.familyMembers.find((m: any) => m.personId === person.id || m.personId === person.gedcomId)
                    : null;

                memberCreates.push({
                    familyId: family.id,
                    personId: person.id,
                    role: role,
                    marriageType: extra?.marriageType || null,
                    pedigreeType: extra?.pedigreeType || null,
                    isPrimary: !!extra?.isPrimary,
                    sortOrder: extra?.sortOrder !== undefined ? extra.sortOrder : defaultSortOrder
                });
                seenPersonIds.add(person.id);
            };

            if (husbandGedcomId) addMember(husbandGedcomId, 'SPOUSE', 0);
            if (wifeGedcomId) addMember(wifeGedcomId, 'SPOUSE', 1);

            childGedcomIds.forEach((childGedcomId, idx) => {
                addMember(childGedcomId, 'CHILD', 100 + idx);
            });

            if (memberCreates.length > 0) {
                await tx.familyMember.createMany({ data: memberCreates });
            }

            // Cleanup: If family has only one spouse and no children, delete it (unless it's a fixed GEDCOM XREF)
            const spouseCount = memberCreates.filter(m => m.role === 'SPOUSE').length;
            const childCount = memberCreates.filter(m => m.role === 'CHILD').length;
            if (spouseCount < 2 && childCount === 0 && !isXref) {
                await tx.family.delete({ where: { id: family.id } });
                return null;
            }

            const incomingEventIds = (data?.events || []).map((e: any) => e.id).filter((id: string) => id && !FamilyService.isGedcomXref(id));

            // Delete existing family-events not in incoming payload
            await tx.citation.deleteMany({
                where: { event: { familyId: family.id, id: { notIn: incomingEventIds } } }
            });
            await tx.mediaLink.deleteMany({
                where: { event: { familyId: family.id, id: { notIn: incomingEventIds } } }
            });
            await tx.noteLink.deleteMany({
                where: { event: { familyId: family.id, id: { notIn: incomingEventIds } } }
            });
            await tx.association.deleteMany({
                where: { event: { familyId: family.id, id: { notIn: incomingEventIds } } }
            });
            await tx.event.deleteMany({
                where: { familyId: family.id, id: { notIn: incomingEventIds } }
            });
            
            if (Array.isArray(data?.events)) {
                for (const e of data.events) {
                    const placeName = (e?.place || '').trim();
                    const type = (e?.type || 'EVEN').trim() || 'EVEN';
                    const dateText = (e?.dateText || e?.date || '').trim();
                    const description = (e?.description || '').trim();
                    let placeId = e?.placeId || null;

                    if (!type && !dateText && !placeName && !description) continue;

                    // Robust place handling
                    if (placeName) {
                        const existingPlace = placeId ? await tx.place.findUnique({ where: { id: placeId } }) : null;
                        if (!existingPlace || existingPlace.name !== placeName) {
                            let place = await tx.place.findFirst({ where: { treeId, name: placeName, parentId: null } });
                            if (!place) {
                                place = await tx.place.create({ data: { treeId, name: placeName, historicNames: [] } });
                            }
                            placeId = place.id;
                        }
                    } else {
                        placeId = null;
                    }

                    const eventData = {
                        type: type as any,
                        dateStart: this.parseDateStart(e?.date ?? e?.dateStart),
                        dateText: dateText || null,
                        dateType: e?.dateType || null,
                        eventSubtype: type === 'MARR' ? this.normalizeMarriageSubtype(e?.subType || e?.eventSubtype) : null,
                        placeId,
                        description: description || null,
                        isNegative: !!e?.isNegative,
                        cause: e?.cause || null,
                        ldsTemple: e?.ldsTemple || null,
                        ldsStatus: e?.ldsStatus || null
                    };

                    const createdEvent = e.id && !FamilyService.isGedcomXref(e.id)
                        ? await tx.event.update({ where: { id: e.id }, data: eventData })
                        : await tx.event.create({
                            data: {
                                ...eventData,
                                treeId,
                                familyId: family.id
                            }
                        });

                    if (Array.isArray(e?.media)) {
                        // Clear existing links to allow full sync
                        await tx.mediaLink.deleteMany({ where: { eventId: createdEvent.id } });
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
                            const createdCitation = await tx.citation.create({
                                data: {
                                    treeId,
                                    eventId: createdEvent.id,
                                    sourceId,
                                    page: cit?.page || cit?.whereInSource || null,
                                    dateText: cit?.date || cit?.dateText || null,
                                    dataDateText: cit?.date || cit?.dateText || null,
                                    confidence: cit?.confidence || null
                                }
                            });

                            if (cit?.text) {
                                await tx.citationText.create({
                                    data: {
                                        citationId: createdCitation.id,
                                        text: cit.text
                                    }
                                });
                            }
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

            // Media sync for the family entity
            if (Array.isArray(data.media)) {
                await tx.mediaLink.deleteMany({ where: { familyId: family.id } });
                for (const med of data.media) {
                    const mediaObj = await this.gedcomService.ensureMediaObject(treeId, med);
                    if (mediaObj) {
                        await tx.mediaLink.create({
                            data: {
                                treeId,
                                familyId: family.id,
                                mediaId: mediaObj.id,
                                isPrimary: !!med.isPrimary
                            }
                        });
                    }
                }
            }

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

        const invalidFamilies = families.filter(f => f.gedcomId && !FamilyService.isGedcomXref(f.gedcomId));
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

    async cleanupRedundantFamilies(treeId: string, currentUserId?: string) {
        const families = await this.prisma.family.findMany({
            where: { treeId },
            include: {
                familyMembers: true,
                events: true,
                citations: true,
                mediaLinks: true,
                noteLinks: true
            }
        });

        const toDelete: string[] = [];
        for (const fam of families) {
            const memberCount = fam.familyMembers.length;
            const spouseCount = fam.familyMembers.filter(m => m.role === 'SPOUSE').length;
            const childCount = fam.familyMembers.filter(m => m.role === 'CHILD').length;
            const eventCount = fam.events.length;
            const isGedcomXref = FamilyService.isGedcomXref(fam.gedcomId || '');

            // 1. No members at all -> definitely redundant shell
            if (memberCount === 0 && !isGedcomXref) {
                toDelete.push(fam.id);
                continue;
            }

            // 2. Only 1 member (spouse) AND no children AND no events -> orphaned placeholder
            if (memberCount === 1 && spouseCount === 1 && childCount === 0 && eventCount === 0 && !isGedcomXref) {
                toDelete.push(fam.id);
                continue;
            }
            
            // 3. 2 members (spouses) but NO children AND NO events AND NO media/citations
            // This effectively removes "placeholder families" where the spouses might have been deleted
            // or were never fully established.
            if (memberCount === 2 && spouseCount === 2 && childCount === 0 && eventCount === 0 && 
                fam.mediaLinks.length === 0 && fam.citations.length === 0 && !isGedcomXref) {
                toDelete.push(fam.id);
            }
        }

        if (toDelete.length > 0) {
            for (const id of toDelete) {
                await this.deleteFamily(treeId, id, currentUserId);
            }
        }
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
