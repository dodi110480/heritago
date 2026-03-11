import { PrismaClient } from '@prisma/client';
import { NotesService } from './notes.service';
import { GedcomManager } from './gedcom.service';

export class PersonService {
    static async savePerson(prisma: any, treeId: string, data: any, currentUserId?: string) {
        const xref = data.id || `@I${Date.now()}@`;

        const person = await prisma.person.upsert({
            where: { treeId_gedcomId: { treeId, gedcomId: xref } },
            update: {
                sex: data.gender || 'U',
                isLiving: typeof data.isLiving === 'boolean' ? data.isLiving : undefined,
                privacyLevel: data.privacyLevel || undefined,
                exid: data.exid || null
            },
            create: {
                treeId,
                gedcomId: xref,
                sex: data.gender || 'U',
                isLiving: !!data.isLiving,
                privacyLevel: data.privacyLevel || 'PRIVATE',
                exid: data.exid || null
            }
        });
 
        if (data.birthDate && !data.events?.some((e: any) => e.type === 'BIRT')) {
            if (!data.events) data.events = [];
            data.events.push({
                type: 'BIRT',
                dateText: data.birthDate,
                date: data.birthDate
            });
        }

        await prisma.name.deleteMany({ where: { personId: person.id } });
        if (data.names && Array.isArray(data.names)) {
            for (const n of data.names) {
                await prisma.name.create({
                    data: {
                        treeId,
                        personId: person.id,
                        isPrimary: !!n.isPrimary,
                        type: n.type || 'BIRTH',
                        full: n.full || `${n.given || ''} /${n.surname || ''}/`.trim(),
                        given: n.given || '',
                        surname: n.surname || '',
                        prefix: n.prefix || null,
                        suffix: n.suffix || null,
                        sortOrder: typeof n.sortOrder === 'number' ? n.sortOrder : 0
                    }
                });
            }
        } else {
            await prisma.name.create({
                data: {
                    treeId,
                    personId: person.id,
                    isPrimary: true,
                    type: 'BIRTH',
                    full: `${data.firstName || ''} /${data.lastName || ''}/`.trim(),
                    given: data.firstName || '',
                    surname: data.lastName || '',
                }
            });
        }

        // 3. Events
        await prisma.event.deleteMany({ where: { personId: person.id } });
        if (data.events && Array.isArray(data.events)) {
            for (const e of data.events) {
                let placeId: string | undefined = undefined;
                if (e.place) {
                    let place = await prisma.place.findFirst({ where: { treeId, name: e.place, parentId: null } });
                    if (!place) {
                        place = await prisma.place.create({ data: { treeId, name: e.place, historicNames: [], level: 'CITY' } });
                    }
                    placeId = place.id;
                }
                const createdEvent = await prisma.event.create({
                    data: {
                        treeId,
                        personId: person.id,
                        type: e.type || 'EVEN',
                        dateText: e.dateText || e.date || null,
                        placeId: placeId,
                        description: e.description || null
                    }
                });

                if (e.notes) await NotesService.processSharedNotes(prisma, treeId, e.notes, { eventId: createdEvent.id }, currentUserId);

                if (e.media && Array.isArray(e.media)) {
                    for (const med of e.media) {
                        const mediaObj = await GedcomManager.ensureMediaObject(prisma, treeId, med);
                        if (mediaObj) {
                            await prisma.mediaLink.create({
                                data: {
                                    treeId,
                                    eventId: createdEvent.id,
                                    mediaId: mediaObj.id,
                                    role: med.role || null,
                                    caption: med.caption || null
                                }
                            });
                        }
                    }
                }

                // Event Citations: support direct sourceId
                if (e.citations && Array.isArray(e.citations)) {
                    for (const cit of e.citations) {
                        let sourceId: string | null = cit.sourceId || null;
                        if (!sourceId && cit.source) {
                            let src = await prisma.source.findFirst({ where: { treeId, title: cit.source } });
                            if (!src) src = await prisma.source.create({ data: { treeId, title: cit.source } });
                            sourceId = src?.id || null;
                        }
                        if (sourceId) {
                            await prisma.citation.create({
                                data: {
                                    treeId,
                                    eventId: createdEvent.id,
                                    sourceId,
                                    page: cit.page || null,
                                    dateText: cit.dateText || null,
                                    confidence: cit.confidence || null
                                }
                            });
                        }
                    }
                }

                // Event Associations (Beteiligte)
                if (e.associations && Array.isArray(e.associations)) {
                    for (const assoc of e.associations) {
                        let associatedId: string | null = null;
                        if (assoc.associatedPersonId) {
                            const associated = await prisma.person.findUnique({
                                where: { treeId_gedcomId: { treeId, gedcomId: assoc.associatedPersonId } }
                            });
                            associatedId = associated?.id || null;
                        }
                        
                        const associationData: any = {
                            tree: { connect: { id: treeId } },
                            person: { connect: { id: person.id } },
                            event: { connect: { id: createdEvent.id } },
                            role: assoc.role || 'OTHER',
                            relationText: assoc.relationText || null,
                            dateText: assoc.dateText || null,
                            confidence: assoc.confidence || null,
                            notes: assoc.notes || null
                        };
                        if (associatedId) {
                            associationData.associated = { connect: { id: associatedId } };
                        }
                        
                        await prisma.association.create({
                            data: associationData
                        });
                    }
                }
            }
        }

        // 4. Facts
        await prisma.fact.deleteMany({ where: { personId: person.id } });
        if (data.facts && Array.isArray(data.facts)) {
            for (const f of data.facts) {
                let placeId: string | undefined = undefined;
                if (f.place) {
                    let place = await prisma.place.findFirst({ where: { treeId, name: f.place, parentId: null } });
                    if (!place) {
                        place = await prisma.place.create({ data: { treeId, name: f.place, historicNames: [], level: 'CITY' } });
                    }
                    placeId = place.id;
                }
                const createdFact = await prisma.fact.create({
                    data: {
                        treeId,
                        personId: person.id,
                        type: f.type || 'FACT',
                        value: f.value || '',
                        dateText: f.dateText || f.date || null,
                        placeId
                    }
                });

                // Fact Citations
                if (f.citations && Array.isArray(f.citations)) {
                    for (const cit of f.citations) {
                        let sourceId: string | null = cit.sourceId || null;
                        if (!sourceId && cit.source) {
                            let src = await prisma.source.findFirst({ where: { treeId, title: cit.source } });
                            if (!src) src = await prisma.source.create({ data: { treeId, title: cit.source } });
                            sourceId = src?.id || null;
                        }
                        if (sourceId) {
                            await prisma.citation.create({
                                data: {
                                    treeId,
                                    factId: createdFact.id,
                                    sourceId,
                                    page: cit.page || null,
                                    dateText: cit.dateText || null,
                                    confidence: cit.confidence || null
                                }
                            });
                        }
                    }
                }
                if (f.notes) await NotesService.processSharedNotes(prisma, treeId, f.notes, { factId: createdFact.id }, currentUserId);
                // Fact Associations (Beteiligte)
                if (f.associations && Array.isArray(f.associations)) {
                    for (const assoc of f.associations) {
                        let associatedId: string | null = null;
                        if (assoc.associatedPersonId) {
                            const associated = await prisma.person.findFirst({
                                where: { 
                                    treeId,
                                    OR: [
                                        { gedcomId: assoc.associatedPersonId },
                                        { id: assoc.associatedPersonId }
                                    ]
                                }
                            });
                            associatedId = associated?.id || null;
                        }
                        
                        const associationData: any = {
                            tree: { connect: { id: treeId } },
                            person: { connect: { id: person.id } },
                            fact: { connect: { id: createdFact.id } },
                            role: assoc.role || 'OTHER',
                            relationText: assoc.relationText || null,
                            dateText: assoc.dateText || null,
                            confidence: assoc.confidence || null,
                            notes: assoc.notes || null
                        };
                        if (associatedId) {
                            associationData.associated = { connect: { id: associatedId } };
                        }
                        
                        await prisma.association.create({
                            data: associationData
                        });
                    }
                }
            }
        }

        await prisma.association.deleteMany({ where: { treeId, personId: person.id, eventId: null } });
        if (data.associations && Array.isArray(data.associations)) {
            for (const assoc of data.associations) {
                if (!assoc?.associatedPersonId) continue;
                const associated = await prisma.person.findFirst({
                    where: { 
                        treeId,
                        OR: [
                            { gedcomId: assoc.associatedPersonId },
                            { id: assoc.associatedPersonId }
                        ]
                    }
                });
                if (!associated) continue;
                await prisma.association.create({
                    data: {
                        tree: { connect: { id: treeId } },
                        person: { connect: { id: person.id } },
                        associated: { connect: { id: associated.id } },
                        role: assoc.role || 'OTHER',
                        relationText: assoc.relationText || null,
                        dateText: assoc.dateText || null,
                        confidence: assoc.confidence || null,
                        notes: assoc.notes || null
                    }
                });
            }
        }

        // 4c. DNA matches + segments (owned by person)
        await prisma.dnaSegment.deleteMany({ where: { treeId, personId: person.id } });
        await prisma.dnaMatch.deleteMany({ where: { treeId, personId: person.id } });
        if (data.dnaMatches && Array.isArray(data.dnaMatches)) {
            for (const m of data.dnaMatches) {
                const matchPerson = m.matchPersonId
                    ? await prisma.person.findUnique({ where: { treeId_gedcomId: { treeId, gedcomId: m.matchPersonId } } })
                    : null;

                const created = await prisma.dnaMatch.create({
                    data: {
                        treeId,
                        personId: person.id,
                        matchPersonId: matchPerson?.id || null,
                        provider: m.provider || null,
                        totalCm: typeof m.totalCm === 'number' ? m.totalCm : null,
                        largestSegmentCm: typeof m.largestSegmentCm === 'number' ? m.largestSegmentCm : null,
                        segmentCount: typeof m.segmentCount === 'number' ? m.segmentCount : null,
                        predictedRelationship: m.predictedRelationship || null,
                        confidence: m.confidence || null,
                        testDate: m.testDate || null,
                        kitId: m.kitId || null
                    }
                });

                if (m.segments && Array.isArray(m.segments)) {
                    for (const s of m.segments) {
                        if (!s?.chromosome || typeof s.startPosition !== 'number' || typeof s.endPosition !== 'number' || typeof s.cm !== 'number') continue;
                        await prisma.dnaSegment.create({
                            data: {
                                treeId,
                                personId: person.id,
                                matchId: created.id,
                                chromosome: String(s.chromosome),
                                startPosition: s.startPosition,
                                endPosition: s.endPosition,
                                cm: s.cm,
                                snpCount: typeof s.snpCount === 'number' ? s.snpCount : null,
                                provider: s.provider || null,
                                build: s.build || null,
                                isTriangulated: !!s.isTriangulated
                            }
                        });
                    }
                }
            }
        }

        // 5. Citations (Person-Level)
        await prisma.citation.deleteMany({ where: { personId: person.id } });
        if (data.citations && Array.isArray(data.citations)) {
            for (const cit of data.citations) {
                // Support direct sourceId OR legacy title lookup
                let sourceId: string | null = cit.sourceId || null;
                if (!sourceId && cit.source) {
                    let src = await prisma.source.findFirst({ where: { treeId, title: cit.source } });
                    if (!src) src = await prisma.source.create({ data: { treeId, title: cit.source } });
                    sourceId = src?.id || null;
                }
                if (sourceId) {
                    await prisma.citation.create({
                        data: {
                            treeId,
                            personId: person.id,
                            sourceId,
                            page: cit.page || null,
                            dateText: cit.dateText || null,
                            confidence: cit.confidence || null,
                        }
                    });
                }
            }
        }

        // 6. Media
        await prisma.mediaLink.deleteMany({ where: { personId: person.id } });
        if (data.media && Array.isArray(data.media)) {
            for (const med of data.media) {
                const mediaObj = await GedcomManager.ensureMediaObject(prisma, treeId, med);
                if (mediaObj) {
                    await prisma.mediaLink.create({
                        data: {
                            treeId,
                            personId: person.id,
                            mediaId: mediaObj.id,
                            isPrimary: !!med.isPrimary,
                            role: med.role || null,
                            caption: med.caption || null
                        }
                    });
                }
            }
        }

        // 7. Notes (Person-Level, Standardized)
        if (data.notes) await NotesService.processSharedNotes(prisma, treeId, data.notes, { personId: person.id }, currentUserId);

        // 8. Family memberships (new schema)
        if (data.families && Array.isArray(data.families)) {
            for (const fam of data.families) {
                let dbFamily = fam.familyId ? await prisma.family.findUnique({ where: { id: fam.familyId } }) : null;
                if (!dbFamily && fam.spouseId) {
                    const spouse = await prisma.person.findUnique({
                        where: { treeId_gedcomId: { treeId, gedcomId: fam.spouseId } }
                    });
                    if (spouse) {
                        dbFamily = await prisma.family.findFirst({
                            where: {
                                treeId,
                                AND: [
                                    { familyMembers: { some: { personId: person.id, role: 'SPOUSE' } } },
                                    { familyMembers: { some: { personId: spouse.id, role: 'SPOUSE' } } }
                                ]
                            }
                        });
                    }
                }
                if (!dbFamily) dbFamily = await prisma.family.create({ data: { treeId } });

                await prisma.familyMember.upsert({
                    where: { familyId_personId: { familyId: dbFamily.id, personId: person.id } },
                    update: { role: 'SPOUSE' },
                    create: { familyId: dbFamily.id, personId: person.id, role: 'SPOUSE' }
                });

                if (fam.spouseId) {
                    const spouse = await prisma.person.findUnique({
                        where: { treeId_gedcomId: { treeId, gedcomId: fam.spouseId } }
                    });
                    if (spouse) {
                        await prisma.familyMember.upsert({
                            where: { familyId_personId: { familyId: dbFamily.id, personId: spouse.id } },
                            update: { role: 'SPOUSE' },
                            create: { familyId: dbFamily.id, personId: spouse.id, role: 'SPOUSE' }
                        });
                    }
                }

                if (fam.children && Array.isArray(fam.children)) {
                    for (const child of fam.children) {
                        const targetChild = await prisma.person.findUnique({
                            where: { treeId_gedcomId: { treeId, gedcomId: child.id } }
                        });
                        if (!targetChild) continue;
                        await prisma.familyMember.upsert({
                            where: { familyId_personId: { familyId: dbFamily.id, personId: targetChild.id } },
                            update: { role: 'CHILD' },
                            create: { familyId: dbFamily.id, personId: targetChild.id, role: 'CHILD' }
                        });
                    }
                }
            }
        }

        // Return fully formatted person for frontend
        const finalPerson = await prisma.person.findUnique({
            where: { id: person.id },
            include: {
                names: true,
                events: { include: { place: true, citations: { include: { source: true } }, mediaLinks: { include: { media: true } }, noteLinks: { include: { note: true } } } },
                facts: { include: { place: true, noteLinks: { include: { note: true } }, citations: { include: { source: true } } } },
                mediaLinks: { include: { media: true } },
                noteLinks: { include: { note: true } },
                citations: { include: { source: true } },
                familyMembers: { include: { family: true } },
                associations: { include: { associated: { include: { names: { where: { isPrimary: true } } } } } },
                dnaMatches: { include: { matchPerson: true, segments: true } },
                dnaSegments: true
            }
        });

        return finalPerson ? PersonService.formatPersonForClient(finalPerson) : person;
    }

    static formatPersonForClient(person: any): any {
        const primaryName = person.names.find((n: any) => n.isPrimary) || person.names[0] || {};
        const birthEvent = person.events.find((e: any) => e.type === 'BIRT' || e.type === 'BIRTH');
        const deathEvent = person.events.find((e: any) => e.type === 'DEAT' || e.type === 'DEATH');

        const parentFamilyIds = (person.familyMembers || [])
            .filter((fm: any) => fm.role === 'CHILD' && fm.family)
            .map((fm: any) => fm.family?.gedcomId || fm.family?.id)
            .filter(Boolean);

        const spouseFamilyIds = (person.familyMembers || [])
            .filter((fm: any) => fm.role === 'SPOUSE' && fm.family)
            .map((fm: any) => fm.family?.gedcomId || fm.family?.id)
            .filter(Boolean);

        return {
            id: person.gedcomId,
            name: `${primaryName.given || ''} ${primaryName.surname || ''}`.trim(),
            firstName: primaryName.given || '',
            lastName: primaryName.surname || '',
            gender: person.sex || 'U',
            isLiving: person.isLiving ?? !deathEvent,
            privacyLevel: person.privacyLevel || 'PRIVATE',
            exid: person.exid || '',
            isAlive: !deathEvent,
            parents: Array.from(new Set(parentFamilyIds)),
            spouses: Array.from(new Set(spouseFamilyIds)),
            names: person.names.map((n: any) => ({
                full: n.full,
                given: n.given,
                surname: n.surname,
                prefix: n.prefix,
                suffix: n.suffix,
                isPrimary: n.isPrimary,
                type: n.type,
                sortOrder: n.sortOrder
            })),
            events: person.events.map((e: any) => ({
                type: e.type,
                date: e.dateText,
                place: e.place?.name,
                description: e.description || '',
                media: (e.mediaLinks || []).map((ml: any) => ({
                    id: ml.media?.id,
                    url: ml.media?.remoteUrl || ml.media?.path,
                    title: ml.media?.title || ml.media?.path,
                    isPrimary: !!ml.isPrimary,
                    mimeType: ml.media?.mimeType
                })),
                notes: (e.noteLinks || []).map((nl: any) => ({
                    id: nl.note?.id,
                    text: nl.note?.text || '',
                    noteType: nl.note?.noteType || 'GENERAL',
                    researchStatus: nl.note?.researchStatus || 'OPEN',
                    privacyLevel: nl.note?.privacyLevel || 'PRIVATE'
                })).filter((n: any) => n.text),
                citations: (e.citations || []).map((c: any) => ({
                    sourceId: c.source?.id || c.sourceId || '',
                    sourceTitle: c.source?.title || '',
                    page: c.page || '',
                    confidence: c.confidence || '',
                    dateText: c.dateText || ''
                })),
                associations: (e.associations || []).map((a: any) => ({
                    associatedPersonId: a.associated?.gedcomId || a.associatedPersonId,
                    associatedName: a.associated ? `${a.associated.names?.[0]?.given || ''} ${a.associated.names?.[0]?.surname || ''}`.trim() : null,
                    role: a.role,
                    relationText: a.relationText,
                    notes: a.notes,
                    confidence: a.confidence,
                    dateText: a.dateText
                }))
            })),
            facts: person.facts?.map((f: any) => ({
                type: f.type,
                value: f.value,
                date: f.dateText || '',
                dateText: f.dateText || '',
                place: f.place?.name || '',
                notes: (f.noteLinks || []).map((nl: any) => ({
                    id: nl.note?.id,
                    text: nl.note?.text || '',
                    noteType: nl.note?.noteType || 'GENERAL',
                    researchStatus: nl.note?.researchStatus || 'OPEN',
                    privacyLevel: nl.note?.privacyLevel || 'PRIVATE'
                })).filter((n: any) => n.text),
                citations: (f.citations || []).map((c: any) => ({
                    sourceId: c.source?.id || c.sourceId || '',
                    sourceTitle: c.source?.title || '',
                    page: c.page || '',
                    confidence: c.confidence || '',
                    dateText: c.dateText || ''
                })),
                associations: (f.associations || []).map((a: any) => ({
                    associatedPersonId: a.associated?.gedcomId || a.associatedPersonId,
                    associatedName: a.associated ? `${a.associated.names?.[0]?.given || ''} ${a.associated.names?.[0]?.surname || ''}`.trim() : null,
                    role: a.role,
                    relationText: a.relationText,
                    notes: a.notes,
                    confidence: a.confidence,
                    dateText: a.dateText
                }))
            })) || [],
            media: person.mediaLinks?.map((ml: any) => ({
                id: ml.media?.id,
                url: ml.media?.remoteUrl || ml.media?.path,
                title: ml.media?.title || ml.media?.path,
                isPrimary: ml.isPrimary,
                role: ml.role || '',
                caption: ml.caption || '',
                mimeType: ml.media?.mimeType
            })) || [],
            notes: person.noteLinks?.map((nl: any) => ({
                id: nl.note?.id,
                text: nl.note?.text || '',
                noteType: nl.note?.noteType || 'GENERAL',
                researchStatus: nl.note?.researchStatus || 'OPEN',
                privacyLevel: nl.note?.privacyLevel || 'PRIVATE'
            })).filter((n: any) => n.text) || [],
            citations: (person.citations || []).map((c: any) => ({
                sourceId: c.source?.id || c.sourceId || '',
                sourceTitle: c.source?.title || '',
                page: c.page || '',
                confidence: c.confidence || '',
                dateText: c.dateText || ''
            })),
            associations: (person.associations || []).map((a: any) => ({
                role: a.role,
                associatedPersonId: a.associated?.gedcomId || '',
                associatedPersonName: `${a.associated?.names?.[0]?.given || ''} ${a.associated?.names?.[0]?.surname || ''}`.trim(),
                relationText: a.relationText || '',
                dateText: a.dateText || '',
                confidence: a.confidence || null,
                notes: a.notes || ''
            })),
            dnaMatches: (person.dnaMatches || []).map((m: any) => ({
                provider: m.provider,
                matchPersonId: m.matchPerson?.gedcomId || '',
                totalCm: m.totalCm,
                largestSegmentCm: m.largestSegmentCm,
                segmentCount: m.segmentCount,
                predictedRelationship: m.predictedRelationship,
                confidence: m.confidence,
                testDate: m.testDate,
                kitId: m.kitId,
                segments: (m.segments || []).map((s: any) => ({
                    chromosome: s.chromosome,
                    startPosition: s.startPosition,
                    endPosition: s.endPosition,
                    cm: s.cm,
                    snpCount: s.snpCount,
                    provider: s.provider,
                    build: s.build,
                    isTriangulated: s.isTriangulated
                }))
            })),
            birthDate: birthEvent?.dateText || '',
            birthPlace: birthEvent?.place?.name || '',
            deathDate: deathEvent?.dateText || '',
            deathPlace: deathEvent?.place?.name || '',
            profileImageUrl: person.mediaLinks?.find((ml: any) => ml.isPrimary)?.media?.id || 
                             person.mediaLinks?.[0]?.media?.id || '',
            createdAt: person.createdAt,
            updatedAt: person.updatedAt,
            chanDate: person.chanDate || null
        };
    }
}
