import { PrismaClient, EntityType, NameType, RestrictionNotice, Sex } from '@prisma/client';

export class Phase4FinalInsert {
    private xrefMap: Map<string, string> = new Map();

    constructor(private prisma: PrismaClient, private treeId: string, private importId: string) { }

    async run() {
        console.log(`--- Phase 4: Final Insertion for import ${this.importId} ---`);

        // 1. Map laden
        await this.loadXrefMap();

        // 2. Submitter (SUBM)
        await this.insertSubmitters();

        // 3. Repositories (REPO)
        await this.insertRepositories();

        // 4. Sources (SOUR)
        await this.insertSources();

        // 5. Media (OBJE)
        await this.insertMedia();

        // 6. Notes (SNOTE / NOTE)
        await this.insertSharedNotes();

        // 7. Persons (INDI)
        await this.insertPersons();

        // 8. Families (FAM)
        await this.insertFamilies();

        console.log('--- Phase 4: Final Insertion Completed ---');
    }

    private async loadXrefMap() {
        // @ts-ignore - gedcomXrefMap existiert nach Migration
        const mappings = await this.prisma.gedcomXrefMap.findMany({
            where: { treeId: this.treeId }
        });
        for (const m of mappings) {
            this.xrefMap.set(`${m.entityType}:${m.xref}`, m.entityId);
        }
    }

    private getResolvedId(xref: string | undefined, type: EntityType): string | undefined {
        if (!xref) return undefined;
        return this.xrefMap.get(`${type}:${xref}`);
    }

    private async insertSubmitters() {
        // @ts-ignore
        const records = await this.prisma.importSubmitter.findMany({ where: { importId: this.importId } });
        for (const r of records) {
            const node = r.rawJson as any;
            const id = this.getResolvedId(r.gedcomXref, EntityType.SUBMITTER);
            if (!id) continue;

            const addrNode = this.findChild(node, 'ADDR');

            await this.prisma.submitter.create({
                data: {
                    id,
                    treeId: this.treeId,
                    gedcomId: r.gedcomXref,
                    name: node.value || 'Unknown Submitter',
                    language: this.findChild(node, 'LANG')?.value,
                    phone: this.findChildren(node, 'PHON').map(c => c.value).filter(Boolean) as string[],
                    email: this.findChildren(node, 'EMAIL').map(c => c.value).filter(Boolean) as string[],
                    www: this.findChildren(node, 'WWW').map(c => c.value).filter(Boolean) as string[],
                }
            });

            if (addrNode) {
                await this.insertAddress(addrNode, 'SUBMITTER', id);
            }
        }
    }

    private async insertRepositories() {
        // @ts-ignore
        const records = await this.prisma.importRepository.findMany({ where: { importId: this.importId } });
        for (const r of records) {
            const node = r.rawJson as any;
            const id = this.getResolvedId(r.gedcomXref, EntityType.REPOSITORY);
            if (!id) continue;

            const addrNode = this.findChild(node, 'ADDR');

            await this.prisma.repository.create({
                data: {
                    id,
                    treeId: this.treeId,
                    gedcomId: r.gedcomXref,
                    name: node.value || 'Unknown Repository',
                    address: this.getFullValue(addrNode),
                    phone: this.findChild(node, 'PHON')?.value,
                    email: this.findChild(node, 'EMAIL')?.value,
                    website: this.findChild(node, 'WWW')?.value,
                    callNumbers: this.findChildren(node, 'CALN').map(c => c.value).filter(Boolean) as string[],
                }
            });

            await this.insertIdentifiers(node, EntityType.REPOSITORY, id);
        }
    }

    private async insertSources() {
        // @ts-ignore
        const records = await this.prisma.importSource.findMany({ where: { importId: this.importId } });
        for (const r of records) {
            const node = r.rawJson as any;
            const id = this.getResolvedId(r.gedcomXref, EntityType.SOURCE);
            if (!id) continue;

            await this.prisma.source.create({
                data: {
                    id,
                    treeId: this.treeId,
                    gedcomId: r.gedcomXref,
                    title: node.value || 'Untitled Source',
                    publication: this.findChild(node, 'PUBL')?.value,
                    author: this.findChild(node, 'AUTH')?.value,
                }
            });

            await this.insertIdentifiers(node, EntityType.SOURCE, id);
        }
    }

    private async insertMedia() {
        // @ts-ignore
        const records = await this.prisma.importMedia.findMany({ where: { importId: this.importId } });
        for (const r of records) {
            const node = r.rawJson as any;
            const id = this.getResolvedId(r.gedcomXref, EntityType.MEDIA);
            if (!id) continue;

            const fileNode = this.findChild(node, 'FILE');

            await this.prisma.media.create({
                data: {
                    id,
                    treeId: this.treeId,
                    gedcomId: r.gedcomXref,
                    title: this.findChild(node, 'TITL')?.value,
                    mediaType: this.findChild(fileNode, 'FORM')?.value,
                }
            });

            await this.insertIdentifiers(node, EntityType.MEDIA, id);
        }
    }

    private async insertSharedNotes() {
        // @ts-ignore
        const records = await this.prisma.importSharedNote.findMany({ where: { importId: this.importId } });
        for (const r of records) {
            const node = r.rawJson as any;
            const id = this.getResolvedId(r.gedcomXref, EntityType.NOTE);
            if (!id) continue;

            await this.prisma.sharedNote.create({
                data: {
                    id,
                    treeId: this.treeId,
                    gedcomId: r.gedcomXref,
                    text: node.value || '',
                }
            });
        }
    }

    private async insertPersons() {
        // @ts-ignore
        const records = await this.prisma.importPerson.findMany({ where: { importId: this.importId } });
        for (const r of records) {
            const node = r.rawJson as any;
            const id = this.getResolvedId(r.gedcomXref, EntityType.PERSON);
            if (!id) continue;

            const sexNode = this.findChild(node, 'SEX');
            const sex = (sexNode?.value === 'F' ? Sex.F : (sexNode?.value === 'M' ? Sex.M : Sex.U)) as Sex;

            await this.prisma.person.create({
                data: {
                    id,
                    treeId: this.treeId,
                    gedcomId: r.gedcomXref,
                    sex,
                    restrictionNotice: this.mapRestrictionNotice(this.findChild(node, 'RESN')?.value),
                    www: this.findChildren(node, 'WWW').map(c => c.value).filter(Boolean) as string[],
                    religion: this.findChild(node, 'RELI')?.value,
                }
            });

            // Address
            const addrNode = this.findChild(node, 'ADDR');
            if (addrNode) {
                await this.insertAddress(addrNode, 'PERSON', id);
            }

            // Identifiers
            await this.insertIdentifiers(node, EntityType.PERSON, id);

            // Names
            const nameNodes = this.findChildren(node, 'NAME');
            for (let i = 0; i < nameNodes.length; i++) {
                const nameNode = nameNodes[i];
                const full = this.getFullValue(nameNode);
                const given = this.findChild(nameNode, 'GIVN')?.value || '';
                const surname = this.findChild(nameNode, 'SURN')?.value || '';

                await this.prisma.name.create({
                    data: {
                        treeId: this.treeId,
                        personId: id,
                        full: full.replace(/\//g, '').trim(),
                        given,
                        surname,
                        type: this.mapNameType(this.findChild(nameNode, 'TYPE')?.value),
                        religion: this.findChild(nameNode, 'RELI')?.value,
                        isPrimary: i === 0
                    }
                });
            }

            // Events & Facts
            const eventTags = ['BIRT', 'DEAT', 'BURI', 'CHR', 'ADOP', 'EMIG', 'IMMI', 'CENS', 'EVEN', 'WILL', 'NATU', 'MILI', 'PROB', 'BAPL', 'ENDO', 'SLGC', 'SLGS'];
            const factTags = ['OCCU', 'EDUC', 'RESI', 'RELI', 'NATI', 'TITL', 'PROP', 'DSCR'];

            for (const child of node.children || []) {
                const isEvent = eventTags.includes(child.tag);
                const isFact = factTags.includes(child.tag);

                if (isEvent || child.tag === 'EVEN') {
                    const date = this.findChild(child, 'DATE')?.value;
                    const placNode = this.findChild(child, 'PLAC');
                    const { min, max } = this.calculateDateRange(date);

                    let placeId = undefined;
                    if (placNode?.value) {
                        let place = await this.prisma.place.findFirst({
                            where: { treeId: this.treeId, name: placNode.value, parentId: null }
                        });
                        if (!place) {
                            place = await this.prisma.place.create({
                                data: { treeId: this.treeId, name: placNode.value }
                            });
                        }
                        placeId = place.id;
                    }

                    const eventTypeEnums = ['BIRT', 'CHR', 'DEAT', 'BURI', 'MARR', 'DIV', 'RESI', 'CENS', 'OCCU', 'EDUC', 'EMIG', 'IMMI', 'NATU', 'MILI', 'WILL', 'PROB', 'BAPL', 'ENDO', 'SLGC', 'SLGS'];
                    const type = eventTypeEnums.includes(child.tag) ? (child.tag as any) : 'OTHER';
                    const customType = type === 'OTHER' ? child.tag : undefined;

                    await this.prisma.event.create({
                        data: {
                            treeId: this.treeId,
                            personId: id,
                            type,
                            customType,
                            dateText: date,
                            minDate: min,
                            maxDate: max,
                            placeId,
                            cause: this.findChild(child, 'CAUS')?.value,
                            age: this.findChild(child, 'AGE')?.value,
                            ldsFamcId: this.getResolvedId(this.findChild(child, 'FAMC')?.value, EntityType.FAMILY),
                        }
                    });
                } else if (isFact) {
                    const tagMap: Record<string, string> = {
                        'OCCU': 'OCCUPATION', 'EDUC': 'EDUCATION', 'RELI': 'RELIGION', 'NATI': 'NATIONALITY',
                        'TITL': 'TITLE', 'RESI': 'RESIDENCE', 'PROP': 'PROPERTY', 'DSCR': 'DESCRIPTION'
                    };
                    const date = this.findChild(child, 'DATE')?.value;
                    const { min, max } = this.calculateDateRange(date);

                    await this.prisma.fact.create({
                        data: {
                            treeId: this.treeId,
                            personId: id,
                            type: (tagMap[child.tag] || 'OTHER') as any,
                            customType: tagMap[child.tag] ? undefined : child.tag,
                            value: child.value,
                            dateText: date,
                            minDate: min,
                            maxDate: max,
                        }
                    });
                }
            }
        }
    }

    private async insertFamilies() {
        // @ts-ignore
        const records = await this.prisma.importFamily.findMany({ where: { importId: this.importId } });
        for (const r of records) {
            const node = r.rawJson as any;
            const id = this.getResolvedId(r.gedcomXref, EntityType.FAMILY);
            if (!id) continue;

            await this.prisma.family.create({
                data: {
                    id,
                    treeId: this.treeId,
                    gedcomId: r.gedcomXref,
                    restrictionNotice: this.mapRestrictionNotice(this.findChild(node, 'RESN')?.value),
                    childCount: this.findChild(node, 'NCHI')?.value ? parseInt(this.findChild(node, 'NCHI')?.value) : null,
                }
            });

            // Identifiers
            await this.insertIdentifiers(node, EntityType.FAMILY, id);

            // Members
            const husbNode = this.findChild(node, 'HUSB');
            const wifeNode = this.findChild(node, 'WIFE');

            if (husbNode?.value) {
                const husbId = this.getResolvedId(husbNode.value, EntityType.PERSON);
                if (husbId) {
                    await this.prisma.familyMember.create({
                        data: { familyId: id, personId: husbId, role: 'SPOUSE' }
                    });
                }
            }

            if (wifeNode?.value) {
                const wifeId = this.getResolvedId(wifeNode.value, EntityType.PERSON);
                if (wifeId) {
                    await this.prisma.familyMember.create({
                        data: { familyId: id, personId: wifeId, role: 'SPOUSE' }
                    });
                }
            }

            for (const childNode of this.findChildren(node, 'CHIL')) {
                const childId = this.getResolvedId(childNode.value, EntityType.PERSON);
                if (childId) {
                    await this.prisma.familyMember.create({
                        data: { familyId: id, personId: childId, role: 'CHILD' }
                    });
                }
            }

            // Events
            const eventTags = ['MARR', 'DIV', 'EVEN', 'ANUL', 'DIVF', 'ENGA', 'MARB', 'MARC', 'MARL', 'MARS'];
            for (const eveNode of (node.children || []).filter((c: any) => eventTags.includes(c.tag))) {
                const date = this.findChild(eveNode, 'DATE')?.value;
                const placNode = this.findChild(eveNode, 'PLAC');
                const { min, max } = this.calculateDateRange(date);

                let placeId = undefined;
                if (placNode?.value) {
                    let place = await this.prisma.place.findFirst({
                        where: { treeId: this.treeId, name: placNode.value, parentId: null }
                    });
                    if (!place) {
                        place = await this.prisma.place.create({
                            data: { treeId: this.treeId, name: placNode.value }
                        });
                    }
                    placeId = place.id;
                }

                const eventTypeEnums = ['BIRT', 'CHR', 'DEAT', 'BURI', 'MARR', 'DIV', 'RESI', 'CENS', 'OCCU', 'EDUC', 'EMIG', 'IMMI', 'NATU', 'MILI', 'WILL', 'PROB', 'BAPL', 'ENDO', 'SLGC', 'SLGS'];
                const type = eventTypeEnums.includes(eveNode.tag) ? (eveNode.tag as any) : 'OTHER';
                const customType = type === 'OTHER' ? eveNode.tag : undefined;

                await this.prisma.event.create({
                    data: {
                        treeId: this.treeId,
                        familyId: id,
                        type,
                        customType,
                        dateText: date,
                        minDate: min,
                        maxDate: max,
                        placeId,
                        cause: this.findChild(eveNode, 'CAUS')?.value,
                        age: this.findChild(eveNode, 'AGE')?.value,
                    }
                });
            }
        }
    }

    // --- Helpers ---
    private async insertAddress(node: any, parentType: 'PERSON' | 'SUBMITTER', parentId: string) {
        if (!node) return;

        // GEDCOM ADDR structure: The value can be the street, or ADR1 sub-tag.
        // PHON and EMAIL can be siblings of ADDR (handled in insertSubmitters/insertPersons) 
        // or sometimes nested (handled here).
        await this.prisma.address.create({
            data: {
                street: this.findChild(node, 'ADR1')?.value || node.value || undefined,
                city: this.findChild(node, 'CITY')?.value,
                state: this.findChild(node, 'STAE')?.value,
                postal: this.findChild(node, 'POST')?.value,
                country: this.findChild(node, 'CTRY')?.value,
                phone: this.findChild(node, 'PHON')?.value,
                email: this.findChild(node, 'EMAIL')?.value,
                isPrimary: true,
                personId: parentType === 'PERSON' ? parentId : undefined,
                submitterId: parentType === 'SUBMITTER' ? parentId : undefined,
            }
        });
    }

    private async insertIdentifiers(node: any, entityType: EntityType, entityId: string) {
        const identifierTags = ['REFN', 'EXID'];
        for (const tag of identifierTags) {
            const children = this.findChildren(node, tag);
            for (const c of children) {
                await this.prisma.identifier.create({
                    data: {
                        treeId: this.treeId,
                        entityType,
                        entityId,
                        value: c.value || '',
                        type: this.findChild(c, 'TYPE')?.value || tag,
                        personId: entityType === EntityType.PERSON ? entityId : undefined,
                        sourceId: entityType === EntityType.SOURCE ? entityId : undefined,
                        citationId: entityType === EntityType.CITATION ? entityId : undefined,
                        mediaId: entityType === EntityType.MEDIA ? entityId : undefined,
                        familyId: entityType === EntityType.FAMILY ? entityId : undefined,
                        repositoryId: entityType === EntityType.REPOSITORY ? entityId : undefined,
                        submitterId: entityType === EntityType.SUBMITTER ? entityId : undefined,
                    }
                });
            }
        }
    }

    private calculateDateRange(dateText: string | undefined): { min: Date | null; max: Date | null } {
        if (!dateText) return { min: null, max: null };
        const clean = dateText.toUpperCase().trim();
        const yearMatch = clean.match(/\b(1\d{3}|20\d{2})\b/);
        if (yearMatch) {
            const year = parseInt(yearMatch[1]);
            if (clean.includes('BET') || clean.includes('AND')) {
                const years = clean.match(/\b(1\d{3}|20\d{2})\b/g);
                if (years && years.length >= 2) {
                    return {
                        min: new Date(parseInt(years[0]), 0, 1),
                        max: new Date(parseInt(years[1]), 11, 31)
                    };
                }
            }
            if (clean.includes('ABT') || clean.includes('ABOUT')) {
                return { min: new Date(year - 1, 0, 1), max: new Date(year + 1, 11, 31) };
            }
            if (clean.includes('BEF')) return { min: null, max: new Date(year, 11, 31) };
            if (clean.includes('AFT')) return { min: new Date(year, 0, 1), max: null };
            return { min: new Date(year, 0, 1), max: new Date(year, 11, 31) };
        }
        return { min: null, max: null };
    }

    private findChild(node: any, tag: string) {
        return node?.children?.find((c: any) => c.tag === tag);
    }

    private findChildren(node: any, tag: string) {
        return (node?.children?.filter((c: any) => c.tag === tag) || []) as any[];
    }

    private getFullValue(node: any): string {
        if (!node) return '';
        let val = node.value || '';
        for (const child of node.children || []) {
            if (child.tag === 'CONT') {
                val += '\n' + (child.value || '');
            } else if (child.tag === 'CONC') {
                val += (child.value || '');
            }
        }
        return val;
    }

    private mapNameType(typeStr: string | undefined): NameType | null {
        if (!typeStr) return null;
        const s = typeStr.toLowerCase();
        if (s.includes('birth')) return NameType.BIRTH;
        if (s.includes('married')) return NameType.MARRIED;
        if (s.includes('aka') || s.includes('also')) return NameType.ALSO_KNOWN_AS;
        if (s.includes('immig')) return NameType.IMMIGRANT;
        if (s.includes('maiden')) return NameType.MAIDEN;
        return NameType.OTHER;
    }

    private mapRestrictionNotice(resnStr: string | undefined): RestrictionNotice {
        if (!resnStr) return RestrictionNotice.NONE;
        const s = resnStr.toLowerCase();
        if (s.includes('confidential')) return RestrictionNotice.CONFIDENTIAL;
        if (s.includes('locked')) return RestrictionNotice.LOCKED;
        if (s.includes('privacy')) return RestrictionNotice.PRIVACY;
        return RestrictionNotice.NONE;
    }
}
