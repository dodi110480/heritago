import { PrismaClient } from '@prisma/client';
import { NotesService } from './notes.service';

export class GedcomService {
    private notesService: NotesService;

    constructor(private prisma: PrismaClient) {
        this.notesService = new NotesService(prisma);
    }

    isGedcomXref(id?: string | null): boolean {
        if (!id) return false;
        return /^@[^@\s]+@$/.test(id.trim());
    }

    private fixMojibake(value?: string | null): string {
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
            [/Ä /g, 'č'], [/Å™/g, 'ř'], [/Å„/g, 'ń'],
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

    private cleanGedText(value?: string | null): string {
        return this.fixMojibake(value).replace(/\r?\n/g, ' ').trim();
    }

    private parseGedcomCoordinate(value?: string | null): number | null {
        if (!value) return null;
        const raw = String(value).trim().toUpperCase();
        if (!raw) return null;

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

    private formatGedcomLatitude(value?: number | null): string | null {
        if (value === null || value === undefined || !Number.isFinite(value)) return null;
        const dir = value < 0 ? 'S' : 'N';
        return `${dir}${Math.abs(value).toFixed(6)}`;
    }

    private formatGedcomLongitude(value?: number | null): string | null {
        if (value === null || value === undefined || !Number.isFinite(value)) return null;
        const dir = value < 0 ? 'W' : 'E';
        return `${dir}${Math.abs(value).toFixed(6)}`;
    }

    private personEventOrder(tag?: string | null): number {
        if (!tag) return 999;
        const t = tag.toUpperCase();
        const order: Record<string, number> = {
            BIRT: 10, CHR: 20, ADOP: 30, MARR: 40, EVEN: 50, DEAT: 60, BURI: 70
        };
        return order[t] ?? 999;
    }

    private familyEventOrder(tag?: string | null): number {
        if (!tag) return 999;
        const t = tag.toUpperCase();
        const order: Record<string, number> = {
            MARR: 10, DIV: 20, EVEN: 30
        };
        return order[t] ?? 999;
    }

    async ensureMediaObject(treeId: string, med: any) {
        if (med.id) {
            const existing = await this.prisma.media.findUnique({ where: { id: med.id } });
            if (existing) return existing;
        }

        if (med.url || med.remoteUrl || med.path) {
            let cleanUrl = med.remoteUrl || med.url || null;
            const mediaPath = med.path || (cleanUrl && cleanUrl.includes('/uploads/') ? cleanUrl.split('/uploads/')[1] : null);
            if (cleanUrl && cleanUrl.includes('/uploads/')) {
                cleanUrl = '/uploads/' + cleanUrl.split('/uploads/')[1];
            }
            let mediaObj = await this.prisma.media.findFirst({
                where: {
                    treeId,
                    OR: [
                        cleanUrl ? { remoteUrl: cleanUrl } : undefined,
                        mediaPath ? { path: mediaPath } : undefined
                    ].filter(Boolean) as any
                }
            });
            if (!mediaObj) {
                mediaObj = await this.prisma.media.create({
                    data: { treeId, remoteUrl: cleanUrl, path: mediaPath, title: med.title, mimeType: med.mimeType }
                });
            }
            return mediaObj;
        }
        return null;
    }

    formatGedcomDate(dateStr: string): string {
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

    async exportTree(treeId: string): Promise<string> {
        console.log(`[GedcomService]: Exporting tree ${treeId}`);
        const individuals = await this.prisma.person.findMany({
            where: { treeId },
            include: {
                names: true,
                events: { include: { place: true, citations: { include: { source: true } } } },
                citations: { include: { source: true } }
            }
        });

        const families = await this.prisma.family.findMany({
            where: { treeId },
            include: {
                events: { include: { place: true, citations: { include: { source: true } } } },
                familyMembers: { include: { person: true } },
                citations: { include: { source: true } }
            }
        });

        const sources = await this.prisma.source.findMany({
            where: { treeId },
            include: { repository: true }
        });

        const repositories = await this.prisma.repository.findMany({
            where: { treeId }
        });

        const lines: string[] = [
            '0 HEAD', '1 GEDC', '2 VERS 7.0.0', '2 FORM LINEAGE-LINKED', '1 SOUR Heritago', '1 CHAR UTF-8', '1 SUBM @U1@'
        ];

        const dbToGedcomIdRepo: Record<string, string> = {};
        const dbToGedcomIdSource: Record<string, string> = {};
        let repoCounter = 1;
        let sourCounter = 1;

        for (const repo of repositories) {
            const gedcomId = `@R${repoCounter++}@`;
            dbToGedcomIdRepo[repo.id] = gedcomId;
            lines.push(`0 ${gedcomId} REPO`);
            if (repo.name) lines.push(`1 NAME ${this.cleanGedText(repo.name)}`);
        }

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
                    lines.push('3 MAP'); lines.push(`4 LATI ${lat}`); lines.push(`4 LONG ${lon}`);
                }
                if (description && description.toUpperCase() !== 'Y') lines.push(`2 NOTE ${description}`);

                for (const cit of event.citations || []) {
                    if (cit.sourceId && dbToGedcomIdSource[cit.sourceId]) {
                        lines.push(`2 SOUR ${dbToGedcomIdSource[cit.sourceId]}`);
                        if (cit.page) lines.push(`3 PAGE ${this.cleanGedText(cit.page)}`);
                        if (cit.dateText) lines.push(`3 DATE ${this.cleanGedText(cit.dateText)}`);
                        if (cit.confidence) lines.push(`3 QUAY ${cit.confidence}`);
                    }
                }
            }

            for (const cit of person.citations || []) {
                if (cit.sourceId && dbToGedcomIdSource[cit.sourceId]) {
                    lines.push(`1 SOUR ${dbToGedcomIdSource[cit.sourceId]}`);
                    if (cit.page) lines.push(`2 PAGE ${this.cleanGedText(cit.page)}`);
                    if (cit.dateText) lines.push(`2 DATE ${this.cleanGedText(cit.dateText)}`);
                    if (cit.confidence) {
                        const q = this.mapConfidenceToQuay(cit.confidence);
                        if (q) lines.push(`2 QUAY ${q}`);
                    }
                }
            }

            const birthFams = families.filter(f => f.familyMembers.some((fm: any) => fm.personId === person.id && fm.role === 'CHILD'));
            const famcUnique = Array.from(new Set(birthFams.map((bf) => bf.gedcomId).filter(Boolean)));
            famcUnique.forEach((famcId, idx) => {
                lines.push(`1 FAMC ${famcId}`);
                if (famcUnique.length > 1 && idx > 0) lines.push('2 PEDI adopted');
            });

            const spouseFams = families.filter(f => f.familyMembers.some((fm: any) => fm.personId === person.id && fm.role === 'SPOUSE'));
            const famsUnique = Array.from(new Set(spouseFams.map((sf) => sf.gedcomId).filter(Boolean)));
            for (const famsId of famsUnique) lines.push(`1 FAMS ${famsId}`);
        }

        for (const fam of families) {
            lines.push(`0 ${fam.gedcomId} FAM`);
            const spouses = fam.familyMembers.filter((fm: any) => fm.role === 'SPOUSE').map((fm: any) => fm.person);
            const husb = spouses[0]; const wife = spouses[1];
            const children = fam.familyMembers.filter((fm: any) => fm.role === 'CHILD').map((fm: any) => fm.person);
            if (husb) lines.push(`1 HUSB ${husb.gedcomId}`);
            if (wife) lines.push(`1 WIFE ${wife.gedcomId}`);
            for (const child of children) if (child) lines.push(`1 CHIL ${child.gedcomId}`);

            const sortedFamilyEvents = [...fam.events].sort((a: any, b: any) => {
                const oa = this.familyEventOrder(this.cleanGedText(a.type));
                const ob = this.familyEventOrder(this.cleanGedText(b.type));
                if (oa !== ob) return oa - ob;
                return (this.cleanGedText(a.dateText)).localeCompare(this.cleanGedText(b.dateText));
            });
            for (const event of sortedFamilyEvents) {
                const tag = this.cleanGedText(event.type).toUpperCase();
                const dateText = this.cleanGedText(event.dateText);
                const placeName = this.cleanGedText(event.place?.name);
                const description = this.cleanGedText(event.description);
                const eventSubtype = this.cleanGedText(event.eventSubtype);

                lines.push(`1 ${tag}`);
                if (tag === 'MARR' && eventSubtype) {
                    const normalized = this.normalizeMarriageSubtype(eventSubtype);
                    if (normalized) lines.push(`2 TYPE ${normalized.toLowerCase()}`);
                } else if (eventSubtype) lines.push(`2 TYPE ${eventSubtype}`);
                
                if (dateText) lines.push(`2 DATE ${dateText}`);
                if (placeName) lines.push(`2 PLAC ${placeName}`);
                const lat = this.formatGedcomLatitude(event.place?.latitude);
                const lon = this.formatGedcomLongitude(event.place?.longitude);
                if (lat && lon) {
                    lines.push('3 MAP'); lines.push(`4 LATI ${lat}`); lines.push(`4 LONG ${lon}`);
                }
                if (description && description.toUpperCase() !== 'Y') lines.push(`2 NOTE ${description}`);

                for (const cit of event.citations || []) {
                    if (cit.sourceId && dbToGedcomIdSource[cit.sourceId]) {
                        lines.push(`2 SOUR ${dbToGedcomIdSource[cit.sourceId]}`);
                        if (cit.page) lines.push(`3 PAGE ${this.cleanGedText(cit.page)}`);
                        if (cit.dateText) lines.push(`3 DATE ${this.cleanGedText(cit.dateText)}`);
                        if (cit.confidence) lines.push(`3 QUAY ${cit.confidence}`);
                    }
                }
            }
        }

        lines.push('0 @U1@ SUBM', '1 NAME Heritago Submitter', '0 TRLR');
        return lines.join('\n');
    }

    private mapConfidenceToQuay(confidence: string): string | null {
        switch (confidence) {
            case 'CERTAIN': case 'VERY_LIKELY': return '3';
            case 'LIKELY': return '2';
            case 'POSSIBLE': return '1';
            case 'UNLIKELY': return '0';
            default: return null;
        }
    }

    private normalizeMarriageSubtype(value?: string | null): 'CIVIL' | 'RELIGIOUS' | null {
        if (!value) return null;
        const v = String(value).trim().toUpperCase();
        if (v === 'CIVIL' || v === 'STANDESAMTLICH') return 'CIVIL';
        if (v === 'RELIGIOUS' || v === 'KIRCHLICH' || v === 'CHURCH MARRIAGE') return 'RELIGIOUS';
        return null;
    }
}
