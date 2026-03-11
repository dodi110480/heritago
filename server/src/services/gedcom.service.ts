import { PrismaClient } from '@prisma/client';
import { NotesService } from './notes.service';

export class GedcomManager {
    static isGedcomXref(id?: string | null): boolean {
        if (!id) return false;
        return /^@[^@\s]+@$/.test(id.trim());
    }

    private static fixMojibake(value?: string | null): string {
        if (!value) return '';
        const input = String(value);
        const badScore = (s: string) => (s.match(/[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßï¿½]/g) || []).length;

        const manualFixes: Array<[RegExp, string]> = [
            [/Ã¤/g, 'ä'], [/Ã¶/g, 'ö'], [/Ã¼/g, 'ü'],
            [/Ã„/g, 'Ä'], [/Ã–/g, 'Ö'], [/Ãœ/g, 'Ü'],
            [/ÃŸ/g, 'ß'], [/Ã¡/g, 'á'], [/Ãà/g, 'à'],
            [/Ã©/g, 'é'], [/Ã¨/g, 'è'], [/Ãê/g, 'ê'],
            [/Ãí/g, 'í'], [/Ãó/g, 'ó'], [/Ãº/g, 'ú'],
            [/Ä›/g, 'ě'], [/Å¾/g, 'ž'], [/Å¡/g, 'š'],
            [/Ä/g, 'č'], [/Å™/g, 'ř'], [/Å„/g, 'ń'],
            [/ï¿½/g, 'ß']
        ];

        let best = input;
        try {
            const latinToUtf8 = Buffer.from(input, 'latin1').toString('utf8');
            if (badScore(latinToUtf8) < badScore(best)) best = latinToUtf8;
        } catch { }

        let manuallyRepaired = best;
        for (const [pattern, repl] of manualFixes) {
            manuallyRepaired = manuallyRepaired.replace(pattern, repl);
        }
        if (badScore(manuallyRepaired) < badScore(best)) best = manuallyRepaired;

        // One additional pass can fix doubly-garbled strings in some datasets
        try {
            const secondPass = Buffer.from(best, 'latin1').toString('utf8');
            if (badScore(secondPass) < badScore(best)) best = secondPass;
        } catch { }

        for (const [pattern, repl] of manualFixes) {
            best = best.replace(pattern, repl);
        }

        return best.normalize('NFC');
    }

    private static cleanGedText(value?: string | null): string {
        return this.fixMojibake(value).replace(/\r?\n/g, ' ').trim();
    }

    private static parseGedcomCoordinate(value?: string | null): number | null {
        if (!value) return null;
        const raw = String(value).trim().toUpperCase();
        if (!raw) return null;

        // Accept both "N52.5200" and "52.5200N" as well as signed decimals.
        const prefix = raw.match(/^([NSEW])\s*([+-]?\d+(?:[.,]\d+)?)$/);
        if (prefix) {
            const n = parseFloat(prefix[2].replace(',', '.'));
            if (!Number.isFinite(n)) return null;
            const sign = (prefix[1] === 'S' || prefix[1] === 'W') ? -1 : 1;
            return sign * Math.abs(n);
        }

        const suffix = raw.match(/^([+-]?\d+(?:[.,]\d+)?)\s*([NSEW])$/);
        if (suffix) {
            const n = parseFloat(suffix[1].replace(',', '.'));
            if (!Number.isFinite(n)) return null;
            const sign = (suffix[2] === 'S' || suffix[2] === 'W') ? -1 : 1;
            return sign * Math.abs(n);
        }

        const plain = parseFloat(raw.replace(',', '.'));
        return Number.isFinite(plain) ? plain : null;
    }

    private static formatGedcomLatitude(value?: number | null): string | null {
        if (value === null || value === undefined || !Number.isFinite(value)) return null;
        const dir = value < 0 ? 'S' : 'N';
        return `${dir}${Math.abs(value).toFixed(6)}`;
    }

    private static formatGedcomLongitude(value?: number | null): string | null {
        if (value === null || value === undefined || !Number.isFinite(value)) return null;
        const dir = value < 0 ? 'W' : 'E';
        return `${dir}${Math.abs(value).toFixed(6)}`;
    }

    private static personEventOrder(tag?: string | null): number {
        if (!tag) return 999;
        const t = tag.toUpperCase();
        const order: Record<string, number> = {
            BIRT: 10,
            CHR: 20,
            ADOP: 30,
            MARR: 40,
            EVEN: 50,
            DEAT: 60,
            BURI: 70
        };
        return order[t] ?? 999;
    }

    private static familyEventOrder(tag?: string | null): number {
        if (!tag) return 999;
        const t = tag.toUpperCase();
        const order: Record<string, number> = {
            MARR: 10,
            DIV: 20,
            EVEN: 30
        };
        return order[t] ?? 999;
    }

    static async ensureMediaObject(prisma: PrismaClient, treeId: string, med: any) {
        if (med.id) {
            const existing = await prisma.media.findUnique({ where: { id: med.id } });
            if (existing) return existing;
        }

        if (med.url || med.remoteUrl || med.path) {
            let cleanUrl = med.remoteUrl || med.url || null;
            const mediaPath = med.path || (cleanUrl && cleanUrl.includes('/uploads/') ? cleanUrl.split('/uploads/')[1] : null);
            if (cleanUrl && cleanUrl.includes('/uploads/')) {
                cleanUrl = '/uploads/' + cleanUrl.split('/uploads/')[1];
            }
            let mediaObj = await prisma.media.findFirst({
                where: {
                    treeId,
                    OR: [
                        cleanUrl ? { remoteUrl: cleanUrl } : undefined,
                        mediaPath ? { path: mediaPath } : undefined
                    ].filter(Boolean) as any
                }
            });
            if (!mediaObj) {
                mediaObj = await prisma.media.create({
                    data: { treeId, remoteUrl: cleanUrl, path: mediaPath, title: med.title, mimeType: med.mimeType }
                });
            }
            return mediaObj;
        }
        return null;
    }

    static formatGedcomDate(dateStr: string): string {
        if (!dateStr) return '';
        const dmyMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (dmyMatch) {
            const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
            const day = parseInt(dmyMatch[1]).toString();
            const monthIdx = parseInt(dmyMatch[2]) - 1;
            const year = dmyMatch[3];
            if (monthIdx >= 0 && monthIdx < 12) {
                return `${day} ${months[monthIdx]} ${year}`;
            }
        }
        return dateStr.toUpperCase().trim();
    }

    private static parseDateStart(value: any): Date | null {
        if (!value || typeof value !== 'string') return null;
        const raw = value.trim();
        if (!raw) return null;

        // Accept only ISO-like formats for DateTime fields.
        const isoLike = /^\d{4}-\d{2}-\d{2}(T.*)?$/;
        if (!isoLike.test(raw)) return null;

        const parsed = new Date(raw);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    private static normalizeMarriageSubtype(value?: string | null): 'CIVIL' | 'RELIGIOUS' | null {
        if (!value) return null;
        const v = String(value).trim().toUpperCase();
        if (!v) return null;
        if (v === 'CIVIL' || v === 'STANDESAMTLICH') return 'CIVIL';
        if (v === 'RELIGIOUS' || v === 'KIRCHLICH' || v === 'CHURCH MARRIAGE') return 'RELIGIOUS';
        if (v.includes('CIVIL')) return 'CIVIL';
        if (v.includes('RELIG')) return 'RELIGIOUS';
        if (v.includes('CHURCH')) return 'RELIGIOUS';
        return null;
    }

    private static normalizeImportedEventSubtype(tag: string, value?: string | null): string | null {
        const clean = (value || '').trim();
        if (!clean) return null;
        if (tag.toUpperCase() === 'MARR') {
            return this.normalizeMarriageSubtype(clean);
        }
        return clean;
    }


    static async saveFamily(prisma: PrismaClient, treeId: string, data: any, currentUserId?: string) {
        const xref = (data?.id || '').trim();
        if (!xref) throw new Error("Family ID is required for save");
        if (!this.isGedcomXref(xref)) {
            throw new Error("Family ID must use GEDCOM format (e.g. @F123@)");
        }

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
            ? await prisma.person.findMany({
                where: { treeId, gedcomId: { in: referencedGedcomIds } },
                select: { id: true, gedcomId: true, sex: true }
            })
            : [];
        const personByGedcomId = new Map(referencedPeople.map(p => [p.gedcomId, p]));
        const missingIds = referencedGedcomIds.filter(id => !personByGedcomId.has(id));
        if (missingIds.length > 0) {
            throw new Error(`Referenced person(s) not found: ${missingIds.join(', ')}`);
        }

        return prisma.$transaction(async (tx) => {
            const family = await tx.family.upsert({
                where: { treeId_gedcomId: { treeId, gedcomId: xref } },
                update: {},
                create: { treeId, gedcomId: xref }
            });

            await tx.familyMember.deleteMany({ where: { familyId: family.id } });

            const memberCreates: any[] = [];
            if (husbandGedcomId) {
                const husband = personByGedcomId.get(husbandGedcomId)!;
                memberCreates.push({
                    familyId: family.id,
                    personId: husband.id,
                    role: 'SPOUSE',
                    sortOrder: 0
                });
            }
            if (wifeGedcomId) {
                const wife = personByGedcomId.get(wifeGedcomId)!;
                memberCreates.push({
                    familyId: family.id,
                    personId: wife.id,
                    role: 'SPOUSE',
                    sortOrder: 1
                });
            }

            childGedcomIds.forEach((childGedcomId, idx) => {
                const child = personByGedcomId.get(childGedcomId)!;
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

            const existingEventIds = (await tx.event.findMany({
                where: { familyId: family.id },
                select: { id: true }
            })).map(e => e.id);
            if (existingEventIds.length > 0) {
                await tx.citation.deleteMany({ where: { eventId: { in: existingEventIds } } });
                await tx.mediaLink.deleteMany({ where: { eventId: { in: existingEventIds } } });
                await tx.noteLink.deleteMany({ where: { eventId: { in: existingEventIds } } });
            }
            await tx.event.deleteMany({ where: { familyId: family.id } });
            if (Array.isArray(data?.events)) {
                for (const e of data.events) {
                    const placeName = (e?.place || '').trim();
                    const type = (e?.type || 'EVEN').trim() || 'EVEN';
                    const dateText = (e?.dateText || e?.date || '').trim();
                    const rawSubtype = (e?.subType || e?.eventSubtype || '').trim();
                    const eventSubtype = type === 'MARR'
                        ? this.normalizeMarriageSubtype(rawSubtype)
                        : null;
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
                            type,
                            dateStart: this.parseDateStart(e?.date ?? e?.dateStart),
                            dateText: dateText || null,
                            eventSubtype: eventSubtype,
                            placeId,
                            description: description || null
                        }
                    });

                    if (Array.isArray(e?.media)) {
                        for (const med of e.media) {
                            const mediaObj = await this.ensureMediaObject(tx as any, treeId, med);
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

                    if (e.notes) await NotesService.processSharedNotes(tx, treeId, e.notes, { eventId: createdEvent.id }, currentUserId);

                    if (Array.isArray(e?.citations)) {
                        for (const cit of e.citations) {
                            // Support direct sourceId OR legacy sourceTitle lookup
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

                    // Event Associations (Beteiligte)
                    if (Array.isArray(e.associations)) {
                        for (const assoc of e.associations) {
                            let associatedId: string | null = null;
                            if (assoc.associatedPersonId) {
                                const associated = await tx.person.findFirst({
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
                                family: { connect: { id: family.id } },
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
                            
                            await tx.association.create({
                                data: associationData
                            });
                        }
                    }
                }
            }

            // Family-Level Notes
            if (data.notes) await NotesService.processSharedNotes(tx, treeId, data.notes, { familyId: family.id }, currentUserId);

            const childCount = await tx.familyMember.count({ where: { familyId: family.id, role: 'CHILD' } });
            const eventCount = await tx.event.count({ where: { familyId: family.id } });

            if (childCount === 0 && eventCount === 0) {
                const spouseCount = await tx.familyMember.count({ where: { familyId: family.id, role: 'SPOUSE' } });
                if (spouseCount < 2) {
                    await tx.family.delete({ where: { id: family.id } });
                    return { deleted: true };
                }
            }

            return family;
        });
    }

    static formatFamily(fam: any): any {
        const spouseMembers = (fam.familyMembers || [])
            .filter((fm: any) => fm.role === 'SPOUSE' && fm.person)
            .sort((a: any, b: any) => {
                const byOrder = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
                if (byOrder !== 0) return byOrder;
                return (a.person?.gedcomId || '').localeCompare(b.person?.gedcomId || '');
            });
        const spouses = spouseMembers.map((fm: any) => fm.person);
        const maleSpouse = spouses.find((p: any) => p?.sex === 'M');
        const femaleSpouse = spouses.find((p: any) => p?.sex === 'F');
        const husband = maleSpouse || spouses[0] || undefined;
        const wife = femaleSpouse || spouses.find((p: any) => p?.gedcomId !== husband?.gedcomId) || undefined;

        const children = (fam.familyMembers || [])
            .filter((fm: any) => fm.role === 'CHILD' && fm.person)
            .sort((a: any, b: any) => {
                const byOrder = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
                if (byOrder !== 0) return byOrder;
                return (a.person?.gedcomId || '').localeCompare(b.person?.gedcomId || '');
            })
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
                    sourceId: c.source?.id,
                    sourceTitle: c.source?.title || '',
                    whereInSource: c.page || '',
                    date: c.dateText || '',
                    text: c.text || '',
                    quality: c.quality || 2
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
            husband: husband?.gedcomId,
            wife: wife?.gedcomId,
            children: children.map((p: any) => p.gedcomId).filter(Boolean),
            notes: (fam.noteLinks || []).filter((nl: any) => !nl.eventId).map((nl: any) => ({
                id: nl.note?.id,
                text: nl.note?.text || '',
                noteType: nl.note?.noteType || 'GENERAL',
                researchStatus: nl.note?.researchStatus || 'OPEN',
                privacyLevel: nl.note?.privacyLevel || 'PRIVATE'
            })).filter((n: any) => n.text)
        };
    }

    static mapConfidenceToQuay(confidence: string | null | undefined): string | null {
        if (!confidence) return null;
        switch (confidence) {
            case 'CERTAIN': return '3';
            case 'VERY_LIKELY': return '3';
            case 'LIKELY': return '2';
            case 'POSSIBLE': return '1';
            case 'UNLIKELY': return '0';
            default: return null;
        }
    }

    static mapQuayToConfidence(quay: string | null | undefined): any {
        if (!quay) return null;
        switch (quay.trim()) {
            case '3': return 'CERTAIN';
            case '2': return 'LIKELY';
            case '1': return 'POSSIBLE';
            case '0': return 'UNLIKELY';
            default: return null;
        }
    }

    static async exportTree(prisma: PrismaClient, treeId: string): Promise<string> {
        console.log(`[GedcomManager]: Exporting tree ${treeId}`);
        const individuals = await prisma.person.findMany({
            where: { treeId },
            include: {
                names: true,
                events: { include: { place: true, citations: { include: { source: true } } } },
                citations: { include: { source: true } }
            }
        });

        const families = await prisma.family.findMany({
            where: { treeId },
            include: {
                events: { include: { place: true, citations: { include: { source: true } } } },
                familyMembers: { include: { person: true } },
                citations: { include: { source: true } }
            }
        });

        const sources = await prisma.source.findMany({
            where: { treeId },
            include: { repository: true }
        });

        const repositories = await prisma.repository.findMany({
            where: { treeId }
        });

        const lines: string[] = [
            '0 HEAD',
            '1 GEDC',
            '2 VERS 7.0.0',
            '2 FORM LINEAGE-LINKED',
            '1 SOUR Heritago',
            '1 CHAR UTF-8',
            '1 SUBM @U1@'
        ];

        const dbToGedcomIdRepo: Record<string, string> = {};
        const dbToGedcomIdSource: Record<string, string> = {};
        let repoCounter = 1;
        let sourCounter = 1;

        // --- 1. Export Repositories ---
        for (const repo of repositories) {
            const gedcomId = `@R${repoCounter++}@`;
            dbToGedcomIdRepo[repo.id] = gedcomId;

            lines.push(`0 ${gedcomId} REPO`);
            if (repo.name) lines.push(`1 NAME ${this.cleanGedText(repo.name)}`);
        }

        // --- 2. Export Sources ---
        for (const source of sources) {
            const gedcomId = `@S${sourCounter++}@`;
            dbToGedcomIdSource[source.id] = gedcomId;

            lines.push(`0 ${gedcomId} SOUR`);
            if (source.title) lines.push(`1 TITL ${this.cleanGedText(source.title)}`);
            if (source.shortTitle) lines.push(`1 ABBR ${this.cleanGedText(source.shortTitle)}`);
            if (source.author) lines.push(`1 AUTH ${this.cleanGedText(source.author)}`);
            if (source.publication) lines.push(`1 PUBL ${this.cleanGedText(source.publication)}`);
            if (source.repository && dbToGedcomIdRepo[source.repository.id]) {
                lines.push(`1 REPO ${dbToGedcomIdRepo[source.repository.id]}`);
            }
        }

        // --- 3. Export Individuals ---
        for (const person of individuals) {
            lines.push(`0 ${person.gedcomId} INDI`);
            if (person.sex && person.sex !== 'U') lines.push(`1 SEX ${person.sex}`);

            const personNames = [...person.names].sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
            for (let i = 0; i < personNames.length; i++) {
                const name = personNames[i];
                const full = this.cleanGedText(name.full);
                const given = this.cleanGedText(name.given);
                const surname = this.cleanGedText(name.surname);
                lines.push(`1 NAME ${full}`);
                if (given) lines.push(`2 GIVN ${given}`);
                if (surname) lines.push(`2 SURN ${surname}`);
                const normalizedType = this.cleanGedText(name.type).toLowerCase();
                if (normalizedType) {
                    lines.push(`2 TYPE ${normalizedType}`);
                } else if (personNames.length > 1) {
                    lines.push(`2 TYPE ${i === 0 ? 'birth' : 'married'}`);
                }
            }

            const seenPersonEventKeys = new Set<string>();
            const sortedPersonEvents = (person.events || []).sort((a: any, b: any) => {
                const oa = this.personEventOrder(this.cleanGedText(a.type));
                const ob = this.personEventOrder(this.cleanGedText(b.type));
                if (oa !== ob) return oa - ob;
                return (this.cleanGedText(a.dateText)).localeCompare(this.cleanGedText(b.dateText));
            });
            for (const event of sortedPersonEvents) {
                const tag = this.cleanGedText(event.type).toUpperCase();
                const dateText = this.cleanGedText(event.dateText);
                const placeName = this.cleanGedText(event.place?.name);
                const description = this.cleanGedText(event.description);
                const evKey = `${tag}|${dateText}|${placeName}|${description}`;
                if (seenPersonEventKeys.has(evKey)) continue;
                seenPersonEventKeys.add(evKey);

                if ((tag === 'DEAT' || tag === 'DEATH') && !dateText && !placeName && description.toUpperCase() === 'Y') {
                    lines.push('1 DEAT Y');
                    continue;
                }

                lines.push(`1 ${tag}`);
                if (dateText) lines.push(`2 DATE ${dateText}`);
                if (placeName) lines.push(`2 PLAC ${placeName}`);
                const lat = this.formatGedcomLatitude(event.place?.latitude);
                const lon = this.formatGedcomLongitude(event.place?.longitude);
                if (lat && lon) {
                    lines.push('3 MAP');
                    lines.push(`4 LATI ${lat}`);
                    lines.push(`4 LONG ${lon}`);
                }
                if (description && description.toUpperCase() !== 'Y') lines.push(`2 NOTE ${description}`);

                // Export Event Citations
                for (const cit of event.citations || []) {
                    if (cit.sourceId && dbToGedcomIdSource[cit.sourceId]) {
                        lines.push(`2 SOUR ${dbToGedcomIdSource[cit.sourceId]}`);
                        if (cit.page) lines.push(`3 PAGE ${this.cleanGedText(cit.page)}`);
                        if (cit.dateText) lines.push(`3 DATE ${this.cleanGedText(cit.dateText)}`);
                        if (cit.confidence) lines.push(`3 QUAY ${cit.confidence}`);
                    }
                }
            }

            // Export Individual Citations (at the Person level)
            for (const cit of person.citations || []) {
                if (cit.sourceId && dbToGedcomIdSource[cit.sourceId]) {
                    lines.push(`1 SOUR ${dbToGedcomIdSource[cit.sourceId]}`);
                    if (cit.page) lines.push(`2 PAGE ${this.cleanGedText(cit.page)}`);
                    if (cit.dateText) lines.push(`2 DATE ${this.cleanGedText(cit.dateText)}`);
                    if (cit.confidence) {
                        const q = GedcomManager.mapConfidenceToQuay(cit.confidence);
                        if (q) lines.push(`2 QUAY ${q}`);
                    }
                }
            }

            // FAMC (Family as child)
            const birthFams = families.filter(f =>
                f.familyMembers.some((fm: any) => fm.personId === person.id && fm.role === 'CHILD')
            );
            const famcUnique = Array.from(new Set(birthFams.map((bf) => bf.gedcomId).filter(Boolean)));
            famcUnique.forEach((famcId, idx) => {
                lines.push(`1 FAMC ${famcId}`);
                if (famcUnique.length > 1 && idx > 0) lines.push('2 PEDI adopted');
            });

            // FAMS (Family as spouse)
            const spouseFams = families.filter(f =>
                f.familyMembers.some((fm: any) => fm.personId === person.id && fm.role === 'SPOUSE')
            );
            const famsUnique = Array.from(new Set(spouseFams.map((sf) => sf.gedcomId).filter(Boolean)));
            for (const famsId of famsUnique) {
                lines.push(`1 FAMS ${famsId}`);
            }
        }

        // --- 2. Export Families ---
        for (const fam of families) {
            lines.push(`0 ${fam.gedcomId} FAM`);

            const spouses = fam.familyMembers.filter((fm: any) => fm.role === 'SPOUSE').map((fm: any) => fm.person);
            const husb = spouses[0];
            const wife = spouses[1];
            const children = fam.familyMembers.filter((fm: any) => fm.role === 'CHILD').map((fm: any) => fm.person);

            if (husb) lines.push(`1 HUSB ${husb.gedcomId}`);
            if (wife) lines.push(`1 WIFE ${wife.gedcomId}`);
            for (const child of children) {
                if (child) lines.push(`1 CHIL ${child.gedcomId}`);
            }

            const seenFamilyEventKeys = new Set<string>();
            const normalizedFamilyEvents = [...fam.events].sort((a: any, b: any) => {
                const oa = this.familyEventOrder(this.cleanGedText(a.type));
                const ob = this.familyEventOrder(this.cleanGedText(b.type));
                if (oa !== ob) return oa - ob;
                return (this.cleanGedText(a.dateText)).localeCompare(this.cleanGedText(b.dateText));
            });
            for (const event of normalizedFamilyEvents) {
                const tag = this.cleanGedText(event.type).toUpperCase();
                const dateText = this.cleanGedText(event.dateText);
                const placeName = this.cleanGedText(event.place?.name);
                const description = this.cleanGedText(event.description);
                const eventSubtype = this.cleanGedText(event.eventSubtype);
                const evKey = `${tag}|${dateText}|${placeName}|${eventSubtype}|${description}`;
                if (seenFamilyEventKeys.has(evKey)) continue;
                seenFamilyEventKeys.add(evKey);

                lines.push(`1 ${tag}`);
                if (tag === 'MARR') {
                    const normalized = this.normalizeMarriageSubtype(eventSubtype);
                    if (normalized) lines.push(`2 TYPE ${normalized.toLowerCase()}`);
                } else if (eventSubtype) {
                    lines.push(`2 TYPE ${eventSubtype}`);
                }
                if (dateText) lines.push(`2 DATE ${dateText}`);
                if (placeName) lines.push(`2 PLAC ${placeName}`);
                const lat = this.formatGedcomLatitude(event.place?.latitude);
                const lon = this.formatGedcomLongitude(event.place?.longitude);
                if (lat && lon) {
                    lines.push('3 MAP');
                    lines.push(`4 LATI ${lat}`);
                    lines.push(`4 LONG ${lon}`);
                }
                if (description && description.toUpperCase() !== 'Y') lines.push(`2 NOTE ${description}`);

                // Export Event Citations
                for (const cit of event.citations || []) {
                    if (cit.sourceId && dbToGedcomIdSource[cit.sourceId]) {
                        lines.push(`2 SOUR ${dbToGedcomIdSource[cit.sourceId]}`);
                        if (cit.page) lines.push(`3 PAGE ${this.cleanGedText(cit.page)}`);
                        if (cit.dateText) lines.push(`3 DATE ${this.cleanGedText(cit.dateText)}`);
                        if (cit.confidence) lines.push(`3 QUAY ${cit.confidence}`);
                    }
                }
            }

            // Export Family Citations (at the Family level)
            for (const cit of fam.citations || []) {
                if (cit.sourceId && dbToGedcomIdSource[cit.sourceId]) {
                    lines.push(`1 SOUR ${dbToGedcomIdSource[cit.sourceId]}`);
                    if (cit.page) lines.push(`2 PAGE ${this.cleanGedText(cit.page)}`);
                    if (cit.dateText) lines.push(`2 DATE ${this.cleanGedText(cit.dateText)}`);
                    if (cit.confidence) {
                        const q = GedcomManager.mapConfidenceToQuay(cit.confidence);
                        if (q) lines.push(`2 QUAY ${q}`);
                    }
                }
            }
        }

        // --- 3. Trailer ---
        lines.push('0 @U1@ SUBM', '1 NAME Heritago Submitter', '0 TRLR');

        return lines.join('\n');
    }

    static async importGedcom(prisma: PrismaClient, treeId: string, content: string) {

        // --- Helper: Tree-based Parsing ---
        interface GedcomNode {
            level: number;
            xref?: string;
            tag: string;
            value?: string;
            children: GedcomNode[];
        }

        const parseToTree = (raw: string): GedcomNode[] => {
            const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
            const rootRecords: GedcomNode[] = [];
            const stack: GedcomNode[] = [];

            for (const line of lines) {
                const match = line.match(/^(\d+)\s+(@\S+@)?\s*(\S+)\s*(.*)?$/);
                if (!match) continue;

                const level = parseInt(match[1]);
                const xref = match[2];
                const tag = match[3];
                const value = match[4]?.trim();

                const node: GedcomNode = { level, xref, tag, value, children: [] };

                if (level === 0) {
                    rootRecords.push(node);
                    stack.length = 0;
                    stack[0] = node;
                } else {
                    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
                        stack.pop();
                    }
                    if (stack.length > 0) {
                        stack[stack.length - 1].children.push(node);
                    }
                    stack.push(node);
                }
            }
            return rootRecords;
        };

        const getFullValue = (node: GedcomNode): string => {
            let val = node.value || '';
            for (const child of node.children) {
                if (child.tag === 'CONT') {
                    val += '\n' + (child.value || '');
                } else if (child.tag === 'CONC') {
                    val += (child.value || '');
                }
            }
            return val;
        };

        const findChild = (node: GedcomNode, tag: string) => node.children.find(c => c.tag === tag);
        const findChildren = (node: GedcomNode, tag: string) => node.children.filter(c => c.tag === tag);

        const treeRecords = parseToTree(content);
        const report = {
            recordsParsed: treeRecords.length,
            personsCreated: 0,
            familiesCreated: 0,
            personEventsCreated: 0,
            familyEventsCreated: 0,
            familyEventsDeduplicated: 0,
            unresolvedHusbandRefs: [] as string[],
            unresolvedWifeRefs: [] as string[],
            unresolvedChildRefs: [] as string[],
        };

        // --- Pass 1: Clean Data ---
        await prisma.person.deleteMany({ where: { treeId } });
        await prisma.family.deleteMany({ where: { treeId } });
        await prisma.place.deleteMany({ where: { treeId } });
        await prisma.source.deleteMany({ where: { treeId } });
        await prisma.sharedNote.deleteMany({ where: { treeId } });
        await prisma.media.deleteMany({ where: { treeId } });

        // --- Pass 2: Create Identity Records (INDI, FAM, REPO, SOUR) ---
        // Map original GEDCOM IDs to internal database IDs
        const gedIdToDbId: Record<string, string> = {};

        for (const rec of treeRecords) {
            if (rec.tag === 'REPO' && rec.xref) {
                const nameNode = findChild(rec, 'NAME');
                const r = await prisma.repository.create({
                    data: {
                        treeId,
                        gedcomId: rec.xref,
                        name: nameNode?.value || 'Unbenanntes Repository',
                    }
                });
                gedIdToDbId[rec.xref] = r.id;
            } else if (rec.tag === 'SOUR' && rec.xref) {
                const titlNode = findChild(rec, 'TITL');
                const p = await prisma.source.create({
                    data: {
                        treeId,
                        gedcomId: rec.xref,
                        title: titlNode?.value || 'Unbenannte Quelle',
                    }
                });
                gedIdToDbId[rec.xref] = p.id;
            } else if (rec.tag === 'INDI' && rec.xref) {
                const p = await prisma.person.create({
                    data: { treeId, gedcomId: rec.xref, sex: 'U' }
                });
                gedIdToDbId[rec.xref] = p.id;
                report.personsCreated += 1;
            } else if (rec.tag === 'FAM' && rec.xref) {
                const f = await prisma.family.create({
                    data: { treeId, gedcomId: rec.xref }
                });
                gedIdToDbId[rec.xref] = f.id;
                report.familiesCreated += 1;
            }
        }

        // --- Pass 3: Details (Names, Events, Places, etc.) ---
        const gedEvents = ['BIRT', 'DEAT', 'MARR', 'BURI', 'CHR', 'ADOP', 'RETI', 'GRAD', 'EMIG', 'IMMI', 'CENS', 'EVEN'];

        for (const rec of treeRecords) {
            const dbId = rec.xref ? gedIdToDbId[rec.xref] : null;

            if (rec.tag === 'REPO' && dbId) {
                // Currently only name is imported from REPO during Pass 2.
                // Expand here if address or other REPO details are needed later.
            } else if (rec.tag === 'SOUR' && dbId) {
                const abbrNode = findChild(rec, 'ABBR');
                const authNode = findChild(rec, 'AUTH');
                const publNode = findChild(rec, 'PUBL');
                const repoNode = findChild(rec, 'REPO');
                const noteNode = findChild(rec, 'NOTE');

                const updateData: any = {};
                if (abbrNode) updateData.shortTitle = abbrNode.value;
                if (authNode) updateData.author = getFullValue(authNode);
                if (publNode) updateData.publication = getFullValue(publNode);

                if (repoNode && repoNode.value) {
                    const repoDbId = gedIdToDbId[repoNode.value];
                    if (repoDbId) updateData.repositoryId = repoDbId;
                }

                if (Object.keys(updateData).length > 0) {
                    await prisma.source.update({
                        where: { id: dbId },
                        data: updateData
                    });
                }
            } else if (rec.tag === 'INDI' && dbId) {
                // Sex
                const sexNode = findChild(rec, 'SEX');
                if (sexNode) {
                    await prisma.person.update({
                        where: { id: dbId },
                        data: { sex: sexNode.value === 'F' ? 'F' : (sexNode.value === 'M' ? 'M' : 'U') }
                    });
                }

                // Names
                for (const nameNode of findChildren(rec, 'NAME')) {
                    const full = getFullValue(nameNode);
                    const givenNode = findChild(nameNode, 'GIVN');
                    const surnNode = findChild(nameNode, 'SURN');

                    let given = givenNode?.value || '';
                    let surname = surnNode?.value || '';

                    if (!given && !surname) {
                        const parts = full.split('/');
                        given = parts[0]?.trim() || '';
                        surname = parts[1]?.trim() || '';
                    }

                    await prisma.name.create({
                        data: {
                            treeId,
                            personId: dbId,
                            full: full.replace(/\//g, '').trim(),
                            given,
                            surname,
                            isPrimary: nameNode === findChildren(rec, 'NAME')[0]
                        }
                    });
                }

                // Events
                for (const child of rec.children) {
                    if (gedEvents.includes(child.tag)) {
                        const dateNode = findChild(child, 'DATE');
                        const typeNode = findChild(child, 'TYPE');
                        const placeNode = findChild(child, 'PLAC');
                        const mapNode = findChild(child, 'MAP');
                        const latNode = (mapNode && findChild(mapNode, 'LATI')) || findChild(child, 'LATI');
                        const lonNode = (mapNode && findChild(mapNode, 'LONG')) || findChild(child, 'LONG');
                        const lat = this.parseGedcomCoordinate(latNode?.value);
                        const lon = this.parseGedcomCoordinate(lonNode?.value);

                        let dbPlaceId = null;
                        if (placeNode?.value) {
                            let p = await prisma.place.findFirst({ where: { treeId, name: placeNode.value, parentId: null } });
                            if (!p) {
                                p = await prisma.place.create({
                                    data: { treeId, name: placeNode.value, historicNames: [], latitude: lat, longitude: lon, level: 'CITY' }
                                });
                            } else if ((lat !== null || lon !== null) && (p.latitude === null || p.longitude === null)) {
                                p = await prisma.place.update({
                                    where: { id: p.id },
                                    data: {
                                        latitude: p.latitude ?? lat,
                                        longitude: p.longitude ?? lon
                                    }
                                });
                            }
                            dbPlaceId = p.id;
                        }

                        const createdEvent = await prisma.event.create({
                            data: {
                                treeId,
                                personId: dbId,
                                type: child.tag as any,
                                dateText: dateNode?.value || null,
                                placeId: dbPlaceId,
                                description: child.value || null,
                                eventSubtype: this.normalizeImportedEventSubtype(child.tag, typeNode?.value)
                            }
                        });
                        report.personEventsCreated += 1;

                        const sourNodes = findChildren(child, 'SOUR');
                        for (const sNode of sourNodes) {
                            if (!sNode.value) continue;
                            const sourceDbId = gedIdToDbId[sNode.value];
                            if (!sourceDbId) continue;

                            const pageNode = findChild(sNode, 'PAGE');
                            const dateNodeCit = findChild(sNode, 'DATE');
                            const quayNode = findChild(sNode, 'QUAY');

                            await prisma.citation.create({
                                data: {
                                    treeId,
                                    eventId: createdEvent.id,
                                    sourceId: sourceDbId,
                                    page: pageNode?.value || null,
                                    dateText: dateNodeCit?.value || null,
                                    confidence: GedcomManager.mapQuayToConfidence(quayNode?.value)
                                }
                            });
                        }
                    }
                }

                // Individual Citations
                const indivSourNodes = findChildren(rec, 'SOUR');
                for (const sNode of indivSourNodes) {
                    if (!sNode.value) continue;
                    const sourceDbId = gedIdToDbId[sNode.value];
                    if (!sourceDbId) continue;

                    const pageNode = findChild(sNode, 'PAGE');
                    const dateNodeCit = findChild(sNode, 'DATE');
                    const quayNode = findChild(sNode, 'QUAY');

                    await prisma.citation.create({
                        data: {
                            treeId,
                            personId: dbId,
                            sourceId: sourceDbId,
                            page: pageNode?.value || null,
                            dateText: dateNodeCit?.value || null,
                            confidence: GedcomManager.mapQuayToConfidence(quayNode?.value)
                        }
                    });
                }
            } else if (rec.tag === 'FAM' && dbId) {
                // Family Events (MARR etc)
                const seenFamilyEventKeys = new Set<string>();
                for (const child of rec.children) {
                    if (gedEvents.includes(child.tag)) {
                        const dateNode = findChild(child, 'DATE');
                        const typeNode = findChild(child, 'TYPE');
                        const placeNode = findChild(child, 'PLAC');
                        const mapNode = findChild(child, 'MAP');
                        const latNode = (mapNode && findChild(mapNode, 'LATI')) || findChild(child, 'LATI');
                        const lonNode = (mapNode && findChild(mapNode, 'LONG')) || findChild(child, 'LONG');
                        const lat = this.parseGedcomCoordinate(latNode?.value);
                        const lon = this.parseGedcomCoordinate(lonNode?.value);
                        const evKey = `${child.tag}|${dateNode?.value || ''}|${placeNode?.value || ''}|${typeNode?.value || ''}|${child.value || ''}`;
                        if (seenFamilyEventKeys.has(evKey)) {
                            report.familyEventsDeduplicated += 1;
                            continue;
                        }
                        seenFamilyEventKeys.add(evKey);

                        let dbPlaceId = null;
                        if (placeNode?.value) {
                            let p = await prisma.place.findFirst({ where: { treeId, name: placeNode.value, parentId: null } });
                            if (!p) {
                                p = await prisma.place.create({
                                    data: { treeId, name: placeNode.value, historicNames: [], latitude: lat, longitude: lon, level: 'CITY' }
                                });
                            } else if ((lat !== null || lon !== null) && (p.latitude === null || p.longitude === null)) {
                                p = await prisma.place.update({
                                    where: { id: p.id },
                                    data: {
                                        latitude: p.latitude ?? lat,
                                        longitude: p.longitude ?? lon
                                    }
                                });
                            }
                            dbPlaceId = p.id;
                        }

                        const createdEvent = await prisma.event.create({
                            data: {
                                treeId,
                                familyId: dbId,
                                type: child.tag as any,
                                dateText: dateNode?.value || null,
                                placeId: dbPlaceId,
                                description: child.value || null,
                                eventSubtype: this.normalizeImportedEventSubtype(child.tag, typeNode?.value)
                            }
                        });
                        report.familyEventsCreated += 1;

                        const sourNodes = findChildren(child, 'SOUR');
                        for (const sNode of sourNodes) {
                            if (!sNode.value) continue;
                            const sourceDbId = gedIdToDbId[sNode.value];
                            if (!sourceDbId) continue;

                            const pageNode = findChild(sNode, 'PAGE');
                            const dateNodeCit = findChild(sNode, 'DATE');
                            const quayNode = findChild(sNode, 'QUAY');

                            await prisma.citation.create({
                                data: {
                                    treeId,
                                    eventId: createdEvent.id,
                                    sourceId: sourceDbId,
                                    page: pageNode?.value || null,
                                    dateText: dateNodeCit?.value || null,
                                    confidence: GedcomManager.mapQuayToConfidence(quayNode?.value)
                                }
                            });
                        }
                    }
                }

                // Family Citations
                const famSourNodes = findChildren(rec, 'SOUR');
                for (const sNode of famSourNodes) {
                    if (!sNode.value) continue;
                    const sourceDbId = gedIdToDbId[sNode.value];
                    if (!sourceDbId) continue;

                    const pageNode = findChild(sNode, 'PAGE');
                    const dateNodeCit = findChild(sNode, 'DATE');
                    const quayNode = findChild(sNode, 'QUAY');

                    await prisma.citation.create({
                        data: {
                            treeId,
                            familyId: dbId,
                            sourceId: sourceDbId,
                            page: pageNode?.value || null,
                            dateText: dateNodeCit?.value || null,
                            confidence: GedcomManager.mapQuayToConfidence(quayNode?.value)
                        }
                    });
                }

                // Relationships
                const husb = findChild(rec, 'HUSB');
                const wife = findChild(rec, 'WIFE');
                const children = findChildren(rec, 'CHIL');

                const hId = husb?.value && gedIdToDbId[husb.value];
                const wId = wife?.value && gedIdToDbId[wife.value];
                if (husb?.value && !hId) report.unresolvedHusbandRefs.push(husb.value);
                if (wife?.value && !wId) report.unresolvedWifeRefs.push(wife.value);

                if (hId) {
                    await prisma.familyMember.upsert({
                        where: { familyId_personId: { familyId: dbId, personId: hId } },
                        update: { role: 'SPOUSE' },
                        create: { familyId: dbId, personId: hId, role: 'SPOUSE' }
                    });
                }
                if (wId) {
                    await prisma.familyMember.upsert({
                        where: { familyId_personId: { familyId: dbId, personId: wId } },
                        update: { role: 'SPOUSE' },
                        create: { familyId: dbId, personId: wId, role: 'SPOUSE' }
                    });
                }

                for (const childRec of children) {
                    const cId = childRec.value && gedIdToDbId[childRec.value];
                    if (cId) {
                        await prisma.familyMember.upsert({
                            where: { familyId_personId: { familyId: dbId, personId: cId } },
                            update: { role: 'CHILD' },
                            create: { familyId: dbId, personId: cId, role: 'CHILD' }
                        });
                    } else if (childRec.value) {
                        report.unresolvedChildRefs.push(childRec.value);
                    }
                }
            }
        }


        console.log(`[GedcomManager]: Import completed. Records parsed: ${treeRecords.length}`);
        report.unresolvedHusbandRefs = Array.from(new Set(report.unresolvedHusbandRefs));
        report.unresolvedWifeRefs = Array.from(new Set(report.unresolvedWifeRefs));
        report.unresolvedChildRefs = Array.from(new Set(report.unresolvedChildRefs));
        return report;
    }
}