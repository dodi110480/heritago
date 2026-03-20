// server/src/services/person/person.write.service.ts
import { PersonRepository } from "../../repositories/person.repository";
import { IAuditService } from "../../interfaces/audit.service.interface";
import { PersonService as LegacyPersonService } from "../person.service";

const EVENT_TAGS = ["BIRT", "CHR", "DEAT", "BURI", "CREM", "EMIG", "IMMI", "BAPM", "MARR", "DIV", "ANUL", "ENGA", "ADOP", "EVEN", "OTHER"];
const FACT_TYPE_MAPPING: { [key: string]: string } = {
    OCCU: "OCCUPATION",
    EDUC: "EDUCATION",
    RELI: "RELIGION",
    RESI: "RESIDENCE",
    TITL: "TITLE",
    NATI: "NATIONALITY",
    PROP: "PROPERTY",
    MILI: "MILITARY_SERVICE",
    DSCR: "DESCRIPTION",
    FACT: "OTHER"
};
const VALID_ASSOCIATION_ROLES = new Set([
    "GODPARENT",
    "WITNESS",
    "CLERGY",
    "INFORMANT",
    "EMPLOYER",
    "FRIEND",
    "OTHER",
    "SPOUSE",
    "PARTNER"
]);
const PAIR_EVENT_TAGS = ["MARR", "DIV", "ANUL", "ENGA", "DIVF"];

export class PersonWriteService {
    private legacyPersonService: any;

    constructor(
        private personRepository: PersonRepository,
        private auditService: IAuditService,
        private notesService: any
    ) {}

    async updatePerson(data: any, userId?: string) {
        const treeId = data.treeId;
        if (!treeId) throw new Error("Tree ID is required");

        return await (this.personRepository as any).prisma.$transaction(async (tx: any) => {
            const result = await this.personRepository.savePerson(data, tx);
            const personId = result.id;

            await this.syncNames(tx, treeId, personId, data);
            await this.syncPersonNesteds(tx, treeId, personId, data, userId);

            let touchedFamilyIds = new Set<string>();
            if (Array.isArray(data.timeline)) {
                touchedFamilyIds = await this.syncTimeline(tx, treeId, personId, data.timeline, userId);
            }
 
            if (Array.isArray(data.relations) || data.fatherId || data.motherId || Array.isArray(data.families) || touchedFamilyIds.size > 0) {
                await this.syncRelations(tx, treeId, result, data, touchedFamilyIds, userId);
            }

            if (Array.isArray(data.dnaMatches)) {
                await this.syncDnaMatches(tx, treeId, personId, data.dnaMatches);
            }

            if (userId) {
                await this.auditService.logAction(
                    treeId,
                    userId,
                    data.id ? "UPDATE" : "CREATE",
                    "PERSON",
                    personId,
                    { before: data.beforeState || null }
                );
            }

            return result;
        });
    }

    private getLegacyPersonService() {
        if (!this.legacyPersonService) {
            this.legacyPersonService = new LegacyPersonService((this.personRepository as any).prisma);
        }
        return this.legacyPersonService;
    }

    private async syncNames(tx: any, treeId: string, personId: string, data: any) {
        const names = this.normalizeNames(data);
        if (!names.length) return;

        await this.personRepository.deleteNames(personId, tx);
        for (const name of names) {
            await tx.name.create({
                data: {
                    treeId,
                    personId,
                    full: name.full,
                    given: name.given || "",
                    surname: name.surname || "",
                    prefix: name.prefix || null,
                    suffix: name.suffix || null,
                    type: name.type || null,
                    religion: name.religion || null,
                    isPrimary: !!name.isPrimary,
                    sortOrder: typeof name.sortOrder === "number" ? name.sortOrder : 0
                }
            });
        }
    }

    private normalizeNames(data: any) {
        if (Array.isArray(data.names) && data.names.length > 0) {
            return data.names
                .map((name: any, index: number) => {
                    const given = String(name?.given || "").trim();
                    const surname = String(name?.surname || "").trim();
                    const full = String(name?.full || [given, surname].filter(Boolean).join(" ")).trim();
                    if (!full && !given && !surname) return null;

                    return {
                        ...name,
                        full: full || "Unbekannt",
                        given,
                        surname,
                        isPrimary: index === 0 ? true : !!name?.isPrimary,
                        sortOrder: typeof name?.sortOrder === "number" ? name.sortOrder : index
                    };
                })
                .filter(Boolean);
        }

        const given = String(data.firstName || "").trim();
        const surname = String(data.lastName || "").trim();
        const full = String(data.displayName || [given, surname].filter(Boolean).join(" ")).trim();
        if (!full && !given && !surname) return [];

        return [{
            full: full || "Unbekannt",
            given,
            surname,
            isPrimary: true,
            sortOrder: 0
        }];
    }

    private async syncPersonNesteds(tx: any, treeId: string, personId: string, data: any, userId?: string) {
        if (Array.isArray(data.notes)) {
            await this.notesService.processSharedNotes(tx, treeId, data.notes, { personId }, userId);
        }

        if (Array.isArray(data.citations)) {
            await tx.citationText.deleteMany({
                where: { citation: { personId, eventId: null, factId: null } }
            });
            await tx.citation.deleteMany({
                where: { personId, eventId: null, factId: null }
            });
            await this.createCitations(tx, treeId, { personId }, data.citations, userId);
        }

        if (Array.isArray(data.media)) {
            await tx.mediaLink.deleteMany({
                where: { personId, eventId: null, factId: null }
            });

            for (const media of data.media) {
                const mediaId = media.id || media.mediaId;
                if (!mediaId) continue;

                await tx.mediaLink.create({
                    data: {
                        treeId,
                        personId,
                        mediaId,
                        isPrimary: !!media.isPrimary,
                        caption: media.caption || null,
                        role: media.role || null
                    }
                });
            }
        }
    }

    private async syncTimeline(tx: any, treeId: string, personId: string, timeline: any[], userId?: string): Promise<Set<string>> {
        const touchedFamilyIds = new Set<string>();
        const allTimelineItems = Array.isArray(timeline) ? timeline : [];
        const timelineSummary = allTimelineItems.map((item: any) => ({
            id: item.id,
            tag: item.tag,
            originalType: item.originalType,
            citations: Array.isArray(item.citations) ? item.citations.length : 0,
            notes: Array.isArray(item.notes) ? item.notes.length : 0,
            media: Array.isArray(item.media) ? item.media.length : 0,
            associations: Array.isArray(item.associations) ? item.associations.length : 0
        }));

        const currentState = await tx.person.findUnique({
            where: { id: personId },
            select: {
                events: { select: { id: true } },
                facts: { select: { id: true } },
                familyMembers: {
                    include: {
                        family: { include: { events: { select: { id: true } } } }
                    }
                }
            }
        });

        const existingEventIds = new Set<string>((currentState?.events || []).map((event: any) => String(event.id)));
        const existingFactIds = new Set<string>((currentState?.facts || []).map((fact: any) => String(fact.id)));
        const existingFamilyEventIds = new Set<string>(
            (currentState?.familyMembers || [])
                .flatMap((member: any) => member.family?.events || [])
                .map((event: any) => String(event.id))
        );

        const incomingEvents: any[] = [];
        const incomingFacts: any[] = [];
        const incomingFamilyEventIds = new Set<string>();

        for (const item of allTimelineItems) {
            if (item.isDerived) continue; // Skip derived items purely for display
            if (item.originalType === "family-event") {
                if (item.id && existingFamilyEventIds.has(String(item.id))) {
                    incomingFamilyEventIds.add(String(item.id));
                }
                await this.syncFamilyEvent(tx, treeId, item, userId);
                continue;
            }

            const normalizedItem = this.normalizeTimelineItem(item);
            if (normalizedItem.isEvent) incomingEvents.push(normalizedItem);
            else incomingFacts.push(normalizedItem);
        }

        const incomingEventIds: string[] = incomingEvents
            .map((event) => event.id)
            .filter((id): id is string => typeof id === "string" && existingEventIds.has(id));
        const incomingFactIds: string[] = incomingFacts
            .map((fact) => fact.id)
            .filter((id): id is string => typeof id === "string" && existingFactIds.has(id));

        const staleEventIds: string[] = [...existingEventIds].filter((id) => !incomingEventIds.includes(id));
        const staleFactIds: string[] = [...existingFactIds].filter((id) => !incomingFactIds.includes(id));
        const staleFamilyEventIds: string[] = [...existingFamilyEventIds].filter((id) => !incomingFamilyEventIds.has(id));

        await this.deleteEntityBatch(tx, "EVENT", staleEventIds, personId);
        await this.deleteEntityBatch(tx, "FACT", staleFactIds, personId);
        await this.deleteFamilyEvents(tx, staleFamilyEventIds);

        for (const event of incomingEvents) {
            const placeId = await this.resolvePlaceId(tx, treeId, event.place, event.placeId);

            if (PAIR_EVENT_TAGS.includes(event.tag)) {
                let targetFamilyId = null;
                const spouseAssociation = Array.isArray(event.associations)
                    ? event.associations.find((a: any) => a.role === "SPOUSE")
                    : null;

                if (spouseAssociation) {
                    const partnerId = await this.resolveRelatedPersonId(tx, treeId, spouseAssociation);
                    if (partnerId) {
                        targetFamilyId = await this.findOrCreateFamilyForSpouses(tx, treeId, personId, partnerId);
                    }
                } else if (event.familyId) {
                    targetFamilyId = event.familyId;
                } else {
                    // Fallback: Auto-promote if the person has exactly one family where they are a spouse
                    const families = await tx.familyMember.findMany({
                        where: { personId, role: "SPOUSE" },
                        select: { familyId: true }
                    });
                    if (families.length === 1) {
                        targetFamilyId = families[0].familyId;
                    }
                }

                if (targetFamilyId) {
                    const familyEvent = event.id && (existingFamilyEventIds.has(String(event.id)) || existingEventIds.has(String(event.id)))
                        ? await tx.event.update({
                            where: { id: event.id },
                            data: {
                                treeId,
                                familyId: targetFamilyId,
                                personId: null,
                                type: event.tag,
                                dateText: event.dateText,
                                description: event.description,
                                placeId
                            }
                        })
                        : await tx.event.create({
                            data: {
                                treeId,
                                familyId: targetFamilyId,
                                type: event.tag,
                                dateText: event.dateText,
                                description: event.description,
                                placeId
                            }
                        });

                    if (familyEvent.id) {
                        incomingFamilyEventIds.add(String(familyEvent.id));
                    }
                    touchedFamilyIds.add(targetFamilyId);
                    await this.syncEventFactNesteds(tx, treeId, personId, familyEvent.id, "EVENT", event, userId);
                    continue;
                }
            }

            const eventRecord = event.id && existingEventIds.has(event.id)
                ? await tx.event.update({
                    where: { id: event.id },
                    data: {
                        type: event.tag,
                        dateText: event.dateText,
                        description: event.description,
                        placeId
                    }
                })
                : await tx.event.create({
                    data: {
                        treeId,
                        personId,
                        type: event.tag,
                        dateText: event.dateText,
                        description: event.description,
                        placeId
                    }
                });

            await this.syncEventFactNesteds(tx, treeId, personId, eventRecord.id, "EVENT", event, userId);
        }

        for (const fact of incomingFacts) {
            const placeId = await this.resolvePlaceId(tx, treeId, fact.place, fact.placeId);
            const factType = FACT_TYPE_MAPPING[fact.tag] || fact.tag;
            const factRecord = fact.id && existingFactIds.has(fact.id)
                ? await tx.fact.update({
                    where: { id: fact.id },
                    data: {
                        type: factType,
                        value: fact.value || fact.description || null,
                        dateText: fact.dateText,
                        placeId
                    }
                })
                : await tx.fact.create({
                    data: {
                        treeId,
                        personId,
                        type: factType,
                        value: fact.value || fact.description || null,
                        dateText: fact.dateText,
                        placeId
                    }
                });

            await this.syncEventFactNesteds(tx, treeId, personId, factRecord.id, "FACT", fact, userId);
        }

        return touchedFamilyIds;
    }

    private normalizeTimelineItem(item: any) {
        const isEvent = EVENT_TAGS.includes(item.tag) || item.type === "event" || item.originalType === "event";
        return {
            ...item,
            id: typeof item.id === "string" ? item.id : undefined,
            isEvent,
            tag: item.tag || (isEvent ? "EVEN" : "FACT"),
            dateText: item.dateText || item.date || null,
            description: item.description || null,
            value: item.value || null,
            place: item.place || item.placeName || null,
            placeId: item.placeId || null,
            media: Array.isArray(item.media) ? item.media : [],
            notes: Array.isArray(item.notes) ? item.notes : [],
            citations: Array.isArray(item.citations) ? item.citations : [],
            associations: Array.isArray(item.associations) ? item.associations : []
        };
    }

    private async syncFamilyEvent(tx: any, treeId: string, item: any, userId?: string) {
        if (!item.familyId) return;

        const placeId = await this.resolvePlaceId(tx, treeId, item.place || item.placeName || null, item.placeId || null);
        const eventData = {
            type: item.tag,
            dateText: item.dateText || item.date || null,
            description: item.description || null,
            placeId
        };

        const familyEvent = item.id
            ? await tx.event.update({
                where: { id: item.id },
                data: eventData
            })
            : await tx.event.create({
                data: {
                    ...eventData,
                    treeId,
                    familyId: item.familyId
                }
            });

        await this.clearNestedEntityData(tx, "EVENT", familyEvent.id);
        await this.notesService.processSharedNotes(tx, treeId, Array.isArray(item.notes) ? item.notes : [], { eventId: familyEvent.id }, userId);

        if (Array.isArray(item.citations)) {
            await this.createCitations(tx, treeId, { eventId: familyEvent.id }, item.citations, userId);
        }

        if (Array.isArray(item.media)) {
            for (const media of item.media) {
                const mediaId = media.id || media.mediaId;
                if (!mediaId) continue;
                await tx.mediaLink.create({
                    data: {
                        treeId,
                        eventId: familyEvent.id,
                        mediaId,
                        isPrimary: !!media.isPrimary,
                        caption: media.caption || null,
                        role: media.role || null
                    }
                });
            }
        }

        if (Array.isArray(item.associations)) {
            await this.createAssociations(tx, treeId, { familyId: item.familyId, eventId: familyEvent.id }, item.associations);
        }
    }

    private async syncRelations(tx: any, treeId: string, person: any, data: any, touchedFamilyIds: Set<string>, userId?: string) {
        const incomingRelations = [...(Array.isArray(data.relations) ? data.relations : [])];
        if (data.fatherId) incomingRelations.push({ type: "FATHER", personId: data.fatherId });
        if (data.motherId) incomingRelations.push({ type: "MOTHER", personId: data.motherId });

        if (Array.isArray(data.families)) {
            for (const family of data.families) {
                if (family.spouseId) {
                    incomingRelations.push({
                        type: "SPOUSE",
                        personId: family.spouseId,
                        familyId: family.familyId,
                        familyMemberId: family.familyMemberId,
                        pedigreeType: family.pedigreeType,
                        isPrimary: !!family.isPrimary
                    });
                }
                if (Array.isArray(family.children)) {
                    for (const child of family.children) {
                        incomingRelations.push({
                            type: "CHILD",
                            personId: child.id,
                            familyId: family.familyId,
                            familyMemberId: child.familyMemberId,
                            pedigreeType: child.pedigreeType,
                            isPrimary: !!child.isPrimary
                        });
                    }
                }
            }
        }

        const uniqueRelations = incomingRelations.filter((relation: any, index: number, self: any[]) =>
            index === self.findIndex((candidate: any) => (
                candidate.personId === relation.personId && candidate.type === relation.type && candidate.familyId === relation.familyId
            ))
        );

        const bioMothers = uniqueRelations.filter((relation: any) => relation.type === "MOTHER" && (relation.pedigreeType === "BIRTH" || relation.pedigreeType === "null" || !relation.pedigreeType));
        if (bioMothers.length > 1) {
            throw new Error("Genealogie-Konflikt: Eine Person kann nur EINE leibliche Mutter haben.");
        }

        const bioFathers = uniqueRelations.filter((relation: any) => relation.type === "FATHER" && (relation.pedigreeType === "BIRTH" || relation.pedigreeType === "null" || !relation.pedigreeType));
        if (bioFathers.length > 1) {
            throw new Error("Genealogie-Konflikt: Eine Person kann nur EINEN leiblichen Vater haben.");
        }

        for (const relation of uniqueRelations) {
            if (relation.type === "FATHER" || relation.type === "MOTHER") {
                const isCycle = await this.getLegacyPersonService().isAncestor(tx, person.id, relation.personId);
                if (isCycle) {
                    const name = relation.personName || relation.personId;
                    throw new Error(`Zirkelschluss erkannt: ${name} kann nicht als Elternteil hinzugefügt werden, da diese Person bereits ein Nachfahre von dir ist.`);
                }
            }
        }

        const birthYear = this.parseYear(data.birthDate || this.findTimelineDate(data.timeline, "BIRT") || "");
        const deathYear = this.parseYear(data.deathDate || this.findTimelineDate(data.timeline, "DEAT") || "");
        if (birthYear && deathYear && deathYear < birthYear) {
            throw new Error("Chronologie-Konflikt: Das Sterbedatum liegt vor dem Geburtsdatum.");
        }

        const currentFamilyMembers = await tx.familyMember.findMany({
            where: {
                OR: [
                    { personId: person.id },
                    {
                        role: "CHILD",
                        family: { familyMembers: { some: { personId: person.id, role: "SPOUSE" } } }
                    }
                ],
                NOT: { familyId: { in: Array.from(touchedFamilyIds) } }
            }
        });

        const incomingFamilyMemberIds = uniqueRelations.map((relation: any) => relation.familyMemberId).filter(Boolean);
        const toDelete = currentFamilyMembers.filter((familyMember: any) => !incomingFamilyMemberIds.includes(familyMember.id));
        for (const familyMember of toDelete) {
            await tx.familyMember.delete({ where: { id: familyMember.id } });
        }

        for (const relation of uniqueRelations) {
            await this.getLegacyPersonService().processRelationUpdate(tx, treeId, person, relation, uniqueRelations, userId);
        }

        const finalFamilies = await tx.family.findMany({
            where: { treeId },
            include: { 
                familyMembers: true,
                events: { select: { id: true } },
                facts: { select: { id: true } }
            }
        });

        for (const family of finalFamilies) {
            const hasChildren = family.familyMembers.some((m: any) => m.role === "CHILD");
            const hasEvents = (family.events || []).length > 0;
            const hasFacts = (family.facts || []).length > 0;

            if (family.familyMembers.length === 0 || (!hasChildren && !hasEvents && !hasFacts)) {
                await tx.citationText.deleteMany({ where: { citation: { event: { familyId: family.id } } } });
                await tx.citation.deleteMany({ where: { event: { familyId: family.id } } });
                await tx.event.deleteMany({ where: { familyId: family.id } });
                await tx.fact.deleteMany({ where: { familyId: family.id } });
                await tx.noteLink.deleteMany({ where: { familyId: family.id } });
                await tx.mediaLink.deleteMany({ where: { familyId: family.id } });
                await tx.citation.deleteMany({ where: { familyId: family.id } });
                await tx.association.deleteMany({ where: { familyId: family.id } });
                await tx.familyMember.deleteMany({ where: { familyId: family.id } });
                await tx.family.delete({ where: { id: family.id } });
            }
        }
    }

    private async syncDnaMatches(tx: any, treeId: string, personId: string, dnaMatches: any[]) {
        await tx.dnaSegment.deleteMany({ where: { personId } });
        await tx.dnaMatch.deleteMany({ where: { personId } });

        for (const match of dnaMatches) {
            const rawMatchPersonId = String(match.matchPersonId || "").trim();
            let resolvedMatchPersonId: string | null = null;

            if (rawMatchPersonId) {
                const byIdOrGedcom = await tx.person.findFirst({
                    where: { treeId, OR: [{ id: rawMatchPersonId }, { gedcomId: rawMatchPersonId }] },
                    select: { id: true }
                });

                if (byIdOrGedcom?.id) {
                    resolvedMatchPersonId = byIdOrGedcom.id;
                } else {
                    const byExactName = await tx.person.findFirst({
                        where: { treeId, names: { some: { full: { equals: rawMatchPersonId, mode: "insensitive" } } } },
                        select: { id: true }
                    });

                    if (byExactName?.id) {
                        resolvedMatchPersonId = byExactName.id;
                    } else {
                        const byPrefixName = await tx.person.findMany({
                            where: { treeId, names: { some: { full: { startsWith: rawMatchPersonId, mode: "insensitive" } } } },
                            select: { id: true },
                            take: 2
                        });

                        if (byPrefixName.length === 1) {
                            resolvedMatchPersonId = byPrefixName[0].id;
                        } else {
                            const err: any = new Error(
                                byPrefixName.length > 1
                                    ? "DNA Match: matchPersonId \"" + rawMatchPersonId + "\" ist nicht eindeutig. Bitte UUID oder GEDCOM-ID verwenden."
                                    : "DNA Match: matchPersonId \"" + rawMatchPersonId + "\" nicht gefunden. Bitte UUID, GEDCOM-ID (@I...@) oder eindeutigen Personennamen verwenden."
                            );
                            err.statusCode = 400;
                            err.code = "DNA_MATCH_INVALID_MATCH_PERSON";
                            throw err;
                        }
                    }
                }
            }
            const dnaMatch = await tx.dnaMatch.create({
                data: {
                    treeId,
                    personId,
                    matchPersonId: resolvedMatchPersonId,
                    provider: match.provider || null,
                    totalCm: match.totalCm !== null && match.totalCm !== "" ? Number(match.totalCm) : null,
                    largestSegmentCm: match.largestSegmentCm !== null && match.largestSegmentCm !== "" ? Number(match.largestSegmentCm) : null,
                    segmentCount: match.segmentCount !== null && match.segmentCount !== "" ? Number(match.segmentCount) : null,
                    predictedRelationship: match.predictedRelationship || null,
                    confidence: match.confidence || null,
                    testDate: match.testDate ? new Date(match.testDate) : null,
                    kitId: match.kitId || null
                }
            });

            if (Array.isArray(match.segments)) {
                for (const segment of match.segments) {
                    await tx.dnaSegment.create({
                        data: {
                            treeId,
                            personId,
                            matchId: dnaMatch.id,
                            chromosome: String(segment.chromosome || ""),
                            startPosition: Number(segment.startPosition || 0),
                            endPosition: Number(segment.endPosition || 0),
                            cm: Number(segment.cm || 0),
                            snpCount: segment.snpCount !== null && segment.snpCount !== "" ? Number(segment.snpCount) : null,
                            provider: segment.provider || null,
                            build: segment.build || null,
                            isTriangulated: !!segment.isTriangulated
                        }
                    });
                }
            }
        }
    }

    private findTimelineDate(timeline: any[], tag: string) {
        if (!Array.isArray(timeline)) return null;
        const item = timeline.find((entry: any) => entry.tag === tag);
        return item?.dateText || item?.date || null;
    }

    private parseYear(dateText: string): number | null {
        if (!dateText) return null;
        const match = String(dateText).match(/\d{4}/);
        return match ? parseInt(match[0], 10) : null;
    }

    private async syncEventFactNesteds(tx: any, treeId: string, personId: string, entityId: string, entityType: "EVENT" | "FACT", item: any, userId?: string) {
        console.log(
            `[PersonWriteService] Sync nested for ${entityType} ${entityId}: notes=${Array.isArray(item.notes) ? item.notes.length : 0}, citations=${Array.isArray(item.citations) ? item.citations.length : 0}, media=${Array.isArray(item.media) ? item.media.length : 0}, associations=${Array.isArray(item.associations) ? item.associations.length : 0}`
        );

        await this.clearNestedEntityData(tx, entityType, entityId);

        const entityLinks = entityType === "EVENT"
            ? { eventId: entityId }
            : { factId: entityId };

        await this.notesService.processSharedNotes(tx, treeId, Array.isArray(item.notes) ? item.notes : [], entityLinks, userId);

        if (Array.isArray(item.citations)) {
            await this.createCitations(tx, treeId, entityLinks, item.citations, userId);
        }

        if (Array.isArray(item.media)) {
            for (const media of item.media) {
                const mediaId = media.id || media.mediaId;
                if (!mediaId) continue;
                await tx.mediaLink.create({
                    data: {
                        treeId,
                        mediaId,
                        ...entityLinks,
                        caption: media.caption || null,
                        isPrimary: !!media.isPrimary,
                        role: media.role || null
                    }
                });
            }
        }

        if (Array.isArray(item.associations)) {
            await this.createAssociations(tx, treeId, { personId, ...entityLinks }, item.associations);
        }
    }

    private async createCitations(tx: any, treeId: string, entityLinks: any, citations: any[], userId?: string) {
        for (const citation of citations) {
            if (!citation?.sourceId) continue;

            const createdCitation = await tx.citation.create({
                data: {
                    treeId,
                    ...entityLinks,
                    sourceId: citation.sourceId,
                    page: citation.page || citation.whereInSource || null,
                    dateText: citation.dateText || citation.date || null,
                    confidence: citation.confidence || null,
                    citationTexts: (citation.text || citation.dataText) ? {
                        create: [{ text: citation.text || citation.dataText }]
                    } : undefined
                }
            });

            if (Array.isArray(citation.notes)) {
                await this.notesService.processSharedNotes(tx, treeId, citation.notes, { citationId: createdCitation.id }, userId);
            }
        }
    }

    private normalizePersonLabel(rawValue: string) {
        let current = String(rawValue || "").trim();
        if (!current) return "";

        // Remove a trailing "(uuid|gedcom|date)" segment, then optional life-date suffix.
        current = current.replace(/\s*\(([^)]+)\)\s*$/, "").trim();
        current = current.replace(/\s*\(\s*\d{3,4}\s*(?:[-–]\s*\d{3,4}\s*)?\)\s*$/, "").trim();
        current = current.replace(/\s*\(\s*[\*\+]\s*\d{3,4}\s*\)\s*$/, "").trim();
        return current;
    }

    private extractTrailingParenthetical(rawValue: string) {
        const match = String(rawValue || "").trim().match(/\(([^)]+)\)\s*$/);
        return match ? match[1].trim() : "";
    }

    private async findPersonByIdOrGedcom(tx: any, treeId: string, value: string) {
        const candidate = String(value || "").trim();
        if (!candidate) return null;

        return tx.person.findFirst({
            where: {
                treeId,
                OR: [
                    { id: candidate },
                    { gedcomId: candidate }
                ]
            },
            select: { id: true }
        });
    }

    private async resolveRelatedPersonId(tx: any, treeId: string, association: any) {
        const rawId = String(association?.associatedPersonId || association?.personId || "").trim();
        const rawName = String(association?.associatedPersonName || "").trim();
        const rawLabelTail = this.extractTrailingParenthetical(rawName);
        const cleanedName = this.normalizePersonLabel(rawName);

        const idCandidates = [rawId, rawLabelTail];
        for (const candidate of idCandidates) {
            const byIdOrGedcom = await this.findPersonByIdOrGedcom(tx, treeId, candidate);
            if (byIdOrGedcom?.id) {
                return byIdOrGedcom.id as string;
            }
        }

        const nameCandidates = [rawName, cleanedName].filter(Boolean);
        for (const candidate of nameCandidates) {
            const byExactName = await tx.person.findFirst({
                where: {
                    treeId,
                    names: {
                        some: {
                            full: {
                                equals: candidate,
                                mode: "insensitive"
                            }
                        }
                    }
                },
                select: { id: true }
            });

            if (byExactName?.id) {
                return byExactName.id as string;
            }
        }

        for (const candidate of nameCandidates) {
            const byPrefixName = await tx.person.findMany({
                where: {
                    treeId,
                    names: {
                        some: {
                            full: {
                                startsWith: candidate,
                                mode: "insensitive"
                            }
                        }
                    }
                },
                select: { id: true },
                take: 2
            });

            if (byPrefixName.length === 1) {
                return byPrefixName[0].id as string;
            }
        }

        return null;
    }

    private async createAssociations(tx: any, treeId: string, baseLinks: any, associations: any[]) {
        for (const association of associations) {
            const associatedPersonId = await this.resolveRelatedPersonId(tx, treeId, association);
            if (!associatedPersonId) {
                console.warn("[PersonWriteService] Association skipped: no related person could be resolved", {
                    eventId: baseLinks?.eventId || null,
                    factId: baseLinks?.factId || null,
                    associatedPersonId: association?.associatedPersonId || association?.personId || null,
                    associatedPersonName: association?.associatedPersonName || null,
                    role: association?.role || null
                });
                continue;
            }

            const role = this.validateAssociationRole(association?.role);
            await this.validateAssociationChronology(tx, associatedPersonId, baseLinks, association);

            await tx.association.create({
                data: {
                    treeId,
                    ...baseLinks,
                    associatedPersonId,
                    role,
                    relationText: association.relationText || "",
                    dateText: association.dateText || "",
                    confidence: association.confidence || null,
                    notes: association.notes || ""
                }
            });
        }
    }

    private validateAssociationRole(role: any): string {
        const normalizedRole = typeof role === "string" && role.trim() ? role.trim().toUpperCase() : "OTHER";
        if (VALID_ASSOCIATION_ROLES.has(normalizedRole)) {
            return normalizedRole;
        }

        const err: any = new Error(
            "Beteiligten-Rolle \"" + normalizedRole + "\" ist nicht zulaessig. Erlaubt sind: "
            + Array.from(VALID_ASSOCIATION_ROLES).join(", ")
            + "."
        );
        err.statusCode = 400;
        err.code = "ASSOCIATION_INVALID_ROLE";
        throw err;
    }

    private async validateAssociationChronology(tx: any, associatedPersonId: string, baseLinks: any, association: any) {
        const subjectDateText = await this.getAssociationSubjectDateText(tx, baseLinks);
        const subjectRange = this.parseDateRange(subjectDateText);
        if (!subjectRange) {
            return;
        }

        const associatedPerson = await tx.person.findUnique({
            where: { id: associatedPersonId },
            select: {
                id: true,
                names: {
                    where: { isPrimary: true },
                    select: { full: true },
                    take: 1
                },
                events: {
                    where: { type: { in: ["BIRT", "DEAT"] } },
                    select: { type: true, dateText: true },
                    take: 2
                }
            }
        });

        if (!associatedPerson) {
            return;
        }

        const personName = associatedPerson.names?.[0]?.full || association?.associatedPersonName || associatedPersonId;
        const birthDateText = associatedPerson.events?.find((event: any) => event.type === "BIRT")?.dateText || null;
        const deathDateText = associatedPerson.events?.find((event: any) => event.type === "DEAT")?.dateText || null;
        const birthRange = this.parseDateRange(birthDateText);
        const deathRange = this.parseDateRange(deathDateText);

        if (birthRange && subjectRange.max < birthRange.min) {
            const err: any = new Error(
                "Chronologie-Konflikt: Beteiligte Person \"" + personName + "\" war zum Zeitpunkt des Ereignisses/Fakts noch nicht geboren"
                + (birthDateText ? " (Geburtsdatum: " + birthDateText + ")" : "")
                + (subjectDateText ? " (Datum: " + subjectDateText + ")." : ".")
            );
            err.statusCode = 400;
            err.code = "ASSOCIATION_CHRONOLOGY_BEFORE_BIRTH";
            throw err;
        }

        if (deathRange && subjectRange.min > deathRange.max) {
            const err: any = new Error(
                "Chronologie-Konflikt: Beteiligte Person \"" + personName + "\" war zum Zeitpunkt des Ereignisses/Fakts bereits verstorben"
                + (deathDateText ? " (Sterbedatum: " + deathDateText + ")" : "")
                + (subjectDateText ? " (Datum: " + subjectDateText + ")." : ".")
            );
            err.statusCode = 400;
            err.code = "ASSOCIATION_CHRONOLOGY_AFTER_DEATH";
            throw err;
        }
    }

    private async getAssociationSubjectDateText(tx: any, baseLinks: any): Promise<string | null> {
        if (baseLinks?.eventId) {
            const event = await tx.event.findUnique({
                where: { id: baseLinks.eventId },
                select: { dateText: true }
            });
            return event?.dateText || null;
        }

        if (baseLinks?.factId) {
            const fact = await tx.fact.findUnique({
                where: { id: baseLinks.factId },
                select: { dateText: true }
            });
            return fact?.dateText || null;
        }

        return null;
    }

    private parseDateRange(dateText: string | null | undefined): { min: number; max: number } | null {
        if (!dateText) return null;

        const normalized = String(dateText).trim();
        if (!normalized) return null;

        const exactDotMatch = normalized.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (exactDotMatch) {
            const day = Number(exactDotMatch[1]);
            const month = Number(exactDotMatch[2]);
            const year = Number(exactDotMatch[3]);
            const exact = this.toValidUtcDate(year, month, day);
            if (exact !== null) {
                return { min: exact, max: exact };
            }
        }

        const exactIsoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (exactIsoMatch) {
            const year = Number(exactIsoMatch[1]);
            const month = Number(exactIsoMatch[2]);
            const day = Number(exactIsoMatch[3]);
            const exact = this.toValidUtcDate(year, month, day);
            if (exact !== null) {
                return { min: exact, max: exact };
            }
        }

        const monthYearMatch = normalized.match(/^(\d{1,2})\.(\d{4})$/);
        if (monthYearMatch) {
            const month = Number(monthYearMatch[1]);
            const year = Number(monthYearMatch[2]);
            if (month >= 1 && month <= 12) {
                const min = Date.UTC(year, month - 1, 1);
                const max = Date.UTC(year, month, 0);
                return { min, max };
            }
        }

        const yearOnlyMatch = normalized.match(/^(\d{4})$/);
        if (yearOnlyMatch) {
            const year = Number(yearOnlyMatch[1]);
            return {
                min: Date.UTC(year, 0, 1),
                max: Date.UTC(year, 11, 31)
            };
        }

        const fallbackYear = this.parseYear(normalized);
        if (fallbackYear) {
            return {
                min: Date.UTC(fallbackYear, 0, 1),
                max: Date.UTC(fallbackYear, 11, 31)
            };
        }

        return null;
    }

    private toValidUtcDate(year: number, month: number, day: number): number | null {
        if (month < 1 || month > 12 || day < 1 || day > 31) {
            return null;
        }

        const utc = Date.UTC(year, month - 1, day);
        const date = new Date(utc);
        if (
            date.getUTCFullYear() !== year
            || date.getUTCMonth() !== month - 1
            || date.getUTCDate() !== day
        ) {
            return null;
        }

        return utc;
    }

    private async clearNestedEntityData(tx: any, entityType: "EVENT" | "FACT", entityId: string) {
        if (entityType === "EVENT") {
            await tx.citationText.deleteMany({ where: { citation: { eventId: entityId } } });
            await tx.citation.deleteMany({ where: { eventId: entityId } });
            await tx.mediaLink.deleteMany({ where: { eventId: entityId } });
            await tx.noteLink.deleteMany({ where: { eventId: entityId } });
            await tx.association.deleteMany({ where: { eventId: entityId } });
            return;
        }

        await tx.citationText.deleteMany({ where: { citation: { factId: entityId } } });
        await tx.citation.deleteMany({ where: { factId: entityId } });
        await tx.mediaLink.deleteMany({ where: { factId: entityId } });
        await tx.noteLink.deleteMany({ where: { factId: entityId } });
        await tx.association.deleteMany({ where: { factId: entityId } });
    }

    private async deleteEntityBatch(tx: any, entityType: "EVENT" | "FACT", ids: string[], personId: string) {
        if (!ids.length) return;

        if (entityType === "EVENT") {
            await tx.citationText.deleteMany({ where: { citation: { eventId: { in: ids } } } });
            await tx.citation.deleteMany({ where: { eventId: { in: ids } } });
            await tx.mediaLink.deleteMany({ where: { eventId: { in: ids } } });
            await tx.noteLink.deleteMany({ where: { eventId: { in: ids } } });
            await tx.association.deleteMany({ where: { eventId: { in: ids } } });
            await tx.event.deleteMany({ where: { personId, id: { in: ids } } });
            return;
        }

        await tx.citationText.deleteMany({ where: { citation: { factId: { in: ids } } } });
        await tx.citation.deleteMany({ where: { factId: { in: ids } } });
        await tx.mediaLink.deleteMany({ where: { factId: { in: ids } } });
        await tx.noteLink.deleteMany({ where: { factId: { in: ids } } });
        await tx.association.deleteMany({ where: { factId: { in: ids } } });
        await tx.fact.deleteMany({ where: { personId, id: { in: ids } } });
    }

    private async deleteFamilyEvents(tx: any, ids: string[]) {
        if (!ids.length) return;
        await tx.citationText.deleteMany({ where: { citation: { eventId: { in: ids } } } });
        await tx.citation.deleteMany({ where: { eventId: { in: ids } } });
        await tx.mediaLink.deleteMany({ where: { eventId: { in: ids } } });
        await tx.noteLink.deleteMany({ where: { eventId: { in: ids } } });
        await tx.association.deleteMany({ where: { eventId: { in: ids } } });
        await tx.event.deleteMany({ where: { id: { in: ids } } });
    }

    private async resolvePlaceId(tx: any, treeId: string, rawPlaceName?: string | null, currentPlaceId?: string | null) {
        const placeName = String(rawPlaceName || "").trim();
        if (!placeName) return null;

        const existingPlace = currentPlaceId
            ? await tx.place.findUnique({ where: { id: currentPlaceId } })
            : null;
        if (existingPlace?.name === placeName) {
            return existingPlace.id;
        }

        let place = await tx.place.findFirst({
            where: { treeId, name: placeName, parentId: null }
        });

        if (!place) {
            place = await tx.place.create({
                data: { treeId, name: placeName, historicNames: [] }
            });
        }

        return place.id;
    }

    async deletePerson(id: string, treeId: string, userId?: string) {
        const result = await this.personRepository.deletePerson(id, treeId);

        if (userId) {
            await this.auditService.logAction(
                treeId,
                userId,
                "DELETE",
                "PERSON",
                id
            );
        }

        return result;
    }
    private async findOrCreateFamilyForSpouses(tx: any, treeId: string, personAId: string, personBId: string) {
        // Find existing family where BOTH are spouses
        const existingFamily = await tx.family.findFirst({
            where: {
                treeId,
                AND: [
                    { familyMembers: { some: { personId: personAId, role: "SPOUSE" } } },
                    { familyMembers: { some: { personId: personBId, role: "SPOUSE" } } }
                ]
            },
            select: { id: true }
        });

        if (existingFamily) {
            return existingFamily.id;
        }

        // Create new family
        const newFamily = await tx.family.create({
            data: {
                treeId,
                familyMembers: {
                    create: [
                        { personId: personAId, role: "SPOUSE", sortOrder: 0 },
                        { personId: personBId, role: "SPOUSE", sortOrder: 1 }
                    ]
                }
            }
        });

        return newFamily.id;
    }
}
