import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import multer from 'multer';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import axios from 'axios';

const execAsync = promisify(exec);

dotenv.config();

const app = express();
const UPLOADS_DIR = path.join(__dirname, '../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log('[server]: Created uploads directory');
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const uuid = crypto.randomUUID();
        cb(null, `${uuid}${ext}`);
    }
});
const upload = multer({ storage });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);
const port = process.env.PORT || 3000;

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl) 
        // or any origin for local development
        callback(null, true);
    },
    credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));

// --- Helper: Auth & User Seed ---
async function ensureDefaultUser() {
    const dodi = await prisma.user.findUnique({ where: { username: 'Dodi' } });
    if (!dodi) {
        await prisma.user.create({
            data: {
                username: 'Dodi',
                password: 'heritago123', // In production, use hashing!
            }
        });
        console.log('[server]: Default user Dodi created');
    }
}
ensureDefaultUser();

// --- Routes ---

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });

    if (user && user.password === password) {
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                realName: 'Dodi',
                isAdmin: true
            }
        });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});
// This will eventually handle the validation logic from the /rules folder
export class GedcomManager {
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

    private static personEventOrder(tag: string): number {
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

    private static familyEventOrder(tag: string): number {
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

        if (med.url || med.remoteUrl || med.filePath) {
            let cleanUrl = med.remoteUrl || med.url || null;
            const filePath = med.filePath || (cleanUrl && cleanUrl.includes('/uploads/') ? cleanUrl.split('/uploads/')[1] : null);
            if (cleanUrl && cleanUrl.includes('/uploads/')) {
                cleanUrl = '/uploads/' + cleanUrl.split('/uploads/')[1];
            }
            let mediaObj = await prisma.media.findFirst({
                where: {
                    treeId,
                    OR: [
                        cleanUrl ? { remoteUrl: cleanUrl } : undefined,
                        filePath ? { filePath } : undefined
                    ].filter(Boolean) as any
                }
            });
            if (!mediaObj) {
                mediaObj = await prisma.media.create({
                    data: { treeId, remoteUrl: cleanUrl, filePath, title: med.title, mimeType: med.mimeType }
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

    static async createPerson(prisma: PrismaClient, treeId: string, data: any) {
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
                        place = await prisma.place.create({ data: { treeId, name: e.place, historicNames: [] } });
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

                if (e.media && Array.isArray(e.media)) {
                    for (const med of e.media) {
                        const mediaObj = await this.ensureMediaObject(prisma, treeId, med);
                        if (mediaObj) {
                            await prisma.mediaLink.create({
                                data: { treeId, eventId: createdEvent.id, mediaId: mediaObj.id }
                            });
                        }
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
                        place = await prisma.place.create({ data: { treeId, name: f.place, historicNames: [] } });
                    }
                    placeId = place.id;
                }
                await prisma.fact.create({
                    data: {
                        treeId,
                        personId: person.id,
                        type: f.type || 'FACT',
                        value: f.value || '',
                        dateText: f.dateText || f.date || null,
                        placeId
                    }
                });
            }
        }

        // 4b. Associations
        await prisma.association.deleteMany({ where: { treeId, personId: person.id } });
        if (data.associations && Array.isArray(data.associations)) {
            for (const assoc of data.associations) {
                if (!assoc?.associatedPersonId) continue;
                const associated = await prisma.person.findUnique({
                    where: { treeId_gedcomId: { treeId, gedcomId: assoc.associatedPersonId } }
                });
                if (!associated) continue;
                await prisma.association.create({
                    data: {
                        treeId,
                        personId: person.id,
                        associatedPersonId: associated.id,
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

        // 5. Citations
        await prisma.citation.deleteMany({ where: { personId: person.id } });
        if (data.citations && Array.isArray(data.citations)) {
            for (const cit of data.citations) {
                let source = await prisma.source.findFirst({
                    where: { treeId, title: cit.source }
                });
                if (!source && cit.source) {
                    source = await prisma.source.create({
                        data: { treeId, title: cit.source }
                    });
                }
                if (source) {
                    await prisma.citation.create({
                        data: {
                            treeId,
                            personId: person.id,
                            sourceId: source.id,
                            page: cit.page || null,
                            dateText: cit.dateText || null,
                        }
                    });
                }
            }
        }

        // 6. Media
        await prisma.mediaLink.deleteMany({ where: { personId: person.id } });
        if (data.media && Array.isArray(data.media)) {
            for (const med of data.media) {
                const mediaObj = await this.ensureMediaObject(prisma, treeId, med);
                if (mediaObj) {
                    await prisma.mediaLink.create({
                        data: {
                            treeId,
                            personId: person.id,
                            mediaId: mediaObj.id,
                            isPrimary: !!med.isPrimary
                        }
                    });
                }
            }
        }

        // 7. Notes
        await prisma.noteLink.deleteMany({ where: { personId: person.id } });
        if (data.notes && Array.isArray(data.notes)) {
            for (const noteText of data.notes) {
                if (noteText && noteText.trim()) {
                    const note = await prisma.sharedNote.findFirst({
                        where: { treeId, text: noteText }
                    }) || await prisma.sharedNote.create({
                        data: { treeId, text: noteText }
                    });
                    await prisma.noteLink.create({
                        data: {
                            treeId,
                            personId: person.id,
                            noteId: note.id
                        }
                    });
                }
            }
        }

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
                events: { include: { place: true } },
                facts: { include: { place: true } },
                mediaLinks: { include: { media: true } },
                noteLinks: { include: { note: true } },
                citations: { include: { source: true } },
                familyMembers: { include: { family: true } },
                associations: { include: { associated: { include: { names: { where: { isPrimary: true } } } } } },
                dnaMatches: { include: { matchPerson: true, segments: true } },
                dnaSegments: true
            }
        });

        return finalPerson ? this.formatGedcom(finalPerson) : person;
    }

    static formatGedcom(person: any): any {
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
                description: e.description || ''
            })),
            facts: person.facts?.map((f: any) => ({
                type: f.type,
                value: f.value,
                date: f.dateText || '',
                dateText: f.dateText || '',
                place: f.place?.name || ''
            })) || [],
            media: person.mediaLinks?.map((ml: any) => ({
                id: ml.media?.id,
                url: ml.media?.remoteUrl || ml.media?.filePath,
                title: ml.media?.title || ml.media?.filePath,
                isPrimary: ml.isPrimary,
                mimeType: ml.media?.mimeType
            })) || [],
            notes: person.noteLinks?.map((nl: any) => nl.note?.text).filter(Boolean) || [],
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
            deathPlace: deathEvent?.place?.name || ''
        };
    }

    static formatFamily(fam: any): any {
        const spouses = (fam.familyMembers || []).filter((fm: any) => fm.role === 'SPOUSE').map((fm: any) => fm.person).filter(Boolean);
        const children = (fam.familyMembers || []).filter((fm: any) => fm.role === 'CHILD').map((fm: any) => fm.person).filter(Boolean);
        return {
            id: fam.gedcomId || fam.id,
            type: 'FAMILY',
            events: (fam.events || []).map((e: any) => ({
                type: e.type,
                date: e.dateText,
                place: e.place?.name,
                description: e.description
            })),
            husband: spouses[0]?.gedcomId,
            wife: spouses[1]?.gedcomId,
            children: children.map((p: any) => p.gedcomId).filter(Boolean)
        };
    }

    static async exportTree(prisma: PrismaClient, treeId: string): Promise<string> {
        console.log(`[GedcomManager]: Exporting tree ${treeId}`);
        const individuals = await prisma.person.findMany({
            where: { treeId },
            include: {
                names: true,
                events: { include: { place: true } }
            }
        });

        const families = await prisma.family.findMany({
            where: { treeId },
            include: {
                events: { include: { place: true } },
                familyMembers: { include: { person: true } }
            }
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

        // --- 1. Export Individuals ---
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
            const sortedPersonEvents = [...person.events].sort((a: any, b: any) => {
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
            let marrCount = 0;
            for (const event of normalizedFamilyEvents) {
                const tag = this.cleanGedText(event.type).toUpperCase();
                const dateText = this.cleanGedText(event.dateText);
                const placeName = this.cleanGedText(event.place?.name);
                const description = this.cleanGedText(event.description);
                const evKey = `${tag}|${dateText}|${placeName}|${description}`;
                if (seenFamilyEventKeys.has(evKey)) continue;
                seenFamilyEventKeys.add(evKey);

                let outTag = tag;
                if (tag === 'MARR') {
                    marrCount += 1;
                    if (marrCount > 1) outTag = 'EVEN';
                }

                lines.push(`1 ${outTag}`);
                if (tag === 'MARR' && marrCount > 1) lines.push('2 TYPE Church Marriage');
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

        // --- Pass 2: Create Identity Records (INDI & FAM) ---
        // Map original GEDCOM IDs to internal database IDs
        const gedIdToDbId: Record<string, string> = {};

        for (const rec of treeRecords) {
            if (rec.tag === 'INDI' && rec.xref) {
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

            if (rec.tag === 'INDI' && dbId) {
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
                                    data: { treeId, name: placeNode.value, historicNames: [], latitude: lat, longitude: lon }
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

                        await prisma.event.create({
                            data: {
                                treeId,
                                personId: dbId,
                                type: child.tag,
                                dateText: dateNode?.value || null,
                                placeId: dbPlaceId,
                                description: child.value || null
                            }
                        });
                        report.personEventsCreated += 1;
                    }
                }
            } else if (rec.tag === 'FAM' && dbId) {
                // Family Events (MARR etc)
                const seenFamilyEventKeys = new Set<string>();
                for (const child of rec.children) {
                    if (gedEvents.includes(child.tag)) {
                        const dateNode = findChild(child, 'DATE');
                        const placeNode = findChild(child, 'PLAC');
                        const mapNode = findChild(child, 'MAP');
                        const latNode = (mapNode && findChild(mapNode, 'LATI')) || findChild(child, 'LATI');
                        const lonNode = (mapNode && findChild(mapNode, 'LONG')) || findChild(child, 'LONG');
                        const lat = this.parseGedcomCoordinate(latNode?.value);
                        const lon = this.parseGedcomCoordinate(lonNode?.value);
                        const evKey = `${child.tag}|${dateNode?.value || ''}|${placeNode?.value || ''}|${child.value || ''}`;
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
                                    data: { treeId, name: placeNode.value, historicNames: [], latitude: lat, longitude: lon }
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

                        await prisma.event.create({
                            data: {
                                treeId,
                                familyId: dbId,
                                type: child.tag,
                                dateText: dateNode?.value || null,
                                placeId: dbPlaceId,
                                description: child.value || null
                            }
                        });
                        report.familyEventsCreated += 1;
                    }
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
                    console.log(`[GedcomManager]: Linked husband ${husb.value} to family ${rec.xref}`);
                }
                if (wId) {
                    await prisma.familyMember.upsert({
                        where: { familyId_personId: { familyId: dbId, personId: wId } },
                        update: { role: 'SPOUSE' },
                        create: { familyId: dbId, personId: wId, role: 'SPOUSE' }
                    });
                    console.log(`[GedcomManager]: Linked wife ${wife.value} to family ${rec.xref}`);
                }

                for (const childRec of children) {
                    const cId = childRec.value && gedIdToDbId[childRec.value];
                    if (cId) {
                        await prisma.familyMember.upsert({
                            where: { familyId_personId: { familyId: dbId, personId: cId } },
                            update: { role: 'CHILD' },
                            create: { familyId: dbId, personId: cId, role: 'CHILD' }
                        });
                        console.log(`[GedcomManager]: Linked child ${childRec.value} to family ${rec.xref}`);
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


// --- Routes ---

// Health & Info
app.get('/api/health', (req, res) => res.json({ status: 'ok', stack: 'TS/Postgres' }));

app.get('/api/trees', async (req, res) => {
    const trees = await prisma.tree.findMany();
    res.json({ success: true, trees });
});

app.post('/api/tree/create', async (req, res) => {
    const { name, title, firstName, lastName, gender, birthDate } = req.body;
    try {
        const tree = await prisma.tree.create({ data: { name, title } });

        // Create the initial person if data is provided
        if (firstName && lastName) {
            await GedcomManager.createPerson(prisma, tree.id, {
                firstName,
                lastName,
                gender,
                birthDate
            });
        }

        res.json({ success: true, tree });
    } catch (error) {
        console.error('Tree creation error:', error);
        res.status(400).json({ success: false, message: 'Tree already exists or invalid data' });
    }
});

app.put('/api/tree/:id', async (req, res) => {
    const { id } = req.params;
    const { title, description } = req.body;
    try {
        const tree = await prisma.tree.update({
            where: { id },
            data: { title, description }
        });
        res.json({ success: true, tree });
    } catch (error) {
        res.status(400).json({ success: false, message: 'Could not update tree' });
    }
});

app.delete('/api/tree/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Find media to delete files
        const media = await prisma.media.findMany({ where: { treeId: id } });
        for (const m of media) {
            const fname = m.filePath;
            if (fname) {
                const fullPath = path.join(UPLOADS_DIR, fname);
                if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
            }
        }

        await prisma.tree.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ success: false, message: 'Could not delete tree' });
    }
});

app.get('/api/tree/:tree', async (req, res) => {
    const { tree: treeName } = req.params;
    const tree = await prisma.tree.findUnique({
        where: { name: treeName },
        include: {
            persons: {
                include: {
                    names: true,
                    events: {
                        include: {
                            place: true,
                            mediaLinks: { include: { media: true } }
                        }
                    },
                    facts: {
                        include: {
                            place: true
                        }
                    },
                    citations: { include: { source: true } },
                    mediaLinks: { include: { media: true } },
                    noteLinks: { include: { note: true } },
                    familyMembers: { include: { family: true } },
                    associations: { include: { associated: { include: { names: { where: { isPrimary: true } } } } } },
                    dnaMatches: { include: { matchPerson: true, segments: true } },
                    dnaSegments: true
                }
            },
            families: {
                include: {
                    events: { include: { place: true } },
                    familyMembers: { include: { person: true } },
                    mediaLinks: { include: { media: true } }
                }
            }
        }
    });

    if (!tree) return res.status(404).json({ success: false });

    const individuals = tree.persons.map(i => GedcomManager.formatGedcom(i));
    const families = tree.families.map(f => GedcomManager.formatFamily(f));

    console.log(`[API]: Tree ${treeName} - Individuals: ${individuals.length}, Families: ${families.length}`);
    if (families.length > 0) {
        console.log(`[API]: Sample Family ${families[0].id}: husband=${families[0].husband}, wife=${families[0].wife}, children=${families[0].children.length}`);
    }

    res.json({ success: true, individuals, families, meta: { tree: treeName, treeId: tree.id } });
});

app.post('/api/tree/:tree/person', async (req, res) => {
    const { tree: treeName } = req.params;
    const { mode, id } = req.body;

    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false });

    if (mode === 'delete' && id) {
        const personToDelete = await prisma.person.findUnique({
            where: { treeId_gedcomId: { treeId: tree.id, gedcomId: id } }
        });

        if (personToDelete) {
            await prisma.person.delete({ where: { id: personToDelete.id } });
        }
        return res.json({ success: true });
    }

    const record = await GedcomManager.createPerson(prisma, tree.id, req.body);
    res.json({ success: true, person: record });
});

app.delete('/api/tree/:tree/person/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.person.delete({ where: { id } });
        res.json({ success: true });
    } catch (error: any) {
        console.error('Delete person error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/tree/:tree/search', async (req, res) => {
    const { tree: treeName } = req.params;
    const { q } = req.query;
    if (!q) return res.json({ success: true, results: [] });

    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false });

    const people = await prisma.person.findMany({
        where: {
            treeId: tree.id,
            names: {
                some: {
                    OR: [
                        { given: { contains: q as string, mode: 'insensitive' } },
                        { surname: { contains: q as string, mode: 'insensitive' } },
                        { full: { contains: q as string, mode: 'insensitive' } }
                    ]
                }
            }
        },
        include: {
            names: true,
            events: { include: { place: true } }
        },
        take: 20
    });

    const results = people.map(p => GedcomManager.formatGedcom(p));
    res.json({ success: true, results });
});

app.post('/api/tree/:tree/family', async (req, res) => {
    // Note: In the new relational model, "Family" is more of a grouping.
    // Relationships are stored in the Relationship model.
    // This route might need a significant rethink if we want to keep it.
    // For now, let's keep it minimal and just handle the legacy spouse/children logic.
    const { tree: treeName } = req.params;
    const data = req.body;

    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false });

    // Legacy support: if we receive husbands/wifes/children, we create family memberships
    if (data.husband && data.wife) {
        const h = await prisma.person.findUnique({ where: { treeId_gedcomId: { treeId: tree.id, gedcomId: data.husband } } });
        const w = await prisma.person.findUnique({ where: { treeId_gedcomId: { treeId: tree.id, gedcomId: data.wife } } });
        if (h && w) {
            const family = await prisma.family.create({ data: { treeId: tree.id } });
            await prisma.familyMember.createMany({
                data: [
                    { familyId: family.id, personId: h.id, role: 'SPOUSE' },
                    { familyId: family.id, personId: w.id, role: 'SPOUSE' },
                ]
            });
        }
    }

    res.json({ success: true });
});

app.get('/api/tree/:tree/place', async (req, res) => {
    const { tree: treeName } = req.params;
    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false });

    const places = await prisma.place.findMany({
        where: { treeId: tree.id },
        include: {
            parent: { select: { id: true, name: true } },
            _count: { select: { children: true } }
        },
        orderBy: { name: 'asc' }
    });

    const usage = await Promise.all(places.map(async (p) => {
        const [eventCount, factCount, associationCount] = await Promise.all([
            prisma.event.count({ where: { placeId: p.id } }),
            prisma.fact.count({ where: { placeId: p.id } }),
            prisma.association.count({ where: { placeId: p.id } })
        ]);
        return { id: p.id, eventCount, factCount, associationCount, total: eventCount + factCount + associationCount };
    }));
    const usageById = new Map(usage.map((u) => [u.id, u]));

    res.json({
        success: true, places: places.map(p => ({
            id: p.id,
            name: p.name,
            historicNames: p.historicNames || [],
            jurisdiction: p.jurisdiction,
            parentId: p.parentId,
            parentName: p.parent?.name || null,
            childrenCount: p._count?.children || 0,
            latitude: p.latitude,
            longitude: p.longitude,
            usage: usageById.get(p.id) || { eventCount: 0, factCount: 0, associationCount: 0, total: 0 }
        }))
    });
});

app.get('/api/tree/:tree/place/:id/usage', async (req, res) => {
    const { tree: treeName, id } = req.params;
    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false, message: 'Tree not found' });

    const place = await prisma.place.findFirst({ where: { id, treeId: tree.id } });
    if (!place) return res.status(404).json({ success: false, message: 'Place not found' });

    const [events, facts, associations, children] = await Promise.all([
        prisma.event.findMany({
            where: { placeId: id },
            include: {
                person: { include: { names: { where: { isPrimary: true }, take: 1 } } },
                family: true
            },
            orderBy: { sortDate: 'desc' }
        }),
        prisma.fact.findMany({
            where: { placeId: id },
            include: {
                person: { include: { names: { where: { isPrimary: true }, take: 1 } } },
                family: true
            },
            orderBy: { sortOrder: 'asc' }
        }),
        prisma.association.findMany({
            where: { placeId: id },
            include: {
                person: { include: { names: { where: { isPrimary: true }, take: 1 } } },
                associated: { include: { names: { where: { isPrimary: true }, take: 1 } } }
            },
            orderBy: { createdAt: 'desc' }
        }),
        prisma.place.findMany({
            where: { parentId: id },
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        })
    ]);

    const personLabel = (p: any) =>
        p ? `${p.names?.[0]?.given || ''} ${p.names?.[0]?.surname || ''}`.trim() || p.gedcomId || p.id : null;

    res.json({
        success: true,
        usage: {
            events: events.map((e) => ({
                id: e.id,
                type: e.type,
                dateText: e.dateText,
                personId: e.person?.gedcomId || e.person?.id || null,
                personName: personLabel(e.person),
                familyId: e.family?.id || null,
                familyGedcomId: e.family?.gedcomId || null
            })),
            facts: facts.map((f) => ({
                id: f.id,
                type: f.type,
                value: f.value,
                dateText: f.dateText,
                personId: f.person?.gedcomId || f.person?.id || null,
                personName: personLabel(f.person),
                familyId: f.family?.id || null,
                familyGedcomId: f.family?.gedcomId || null
            })),
            associations: associations.map((a) => ({
                id: a.id,
                role: a.role,
                personId: a.person?.gedcomId || a.person?.id || null,
                personName: personLabel(a.person),
                associatedPersonId: a.associated?.gedcomId || a.associated?.id || null,
                associatedPersonName: personLabel(a.associated)
            })),
            children
        }
    });
});

app.post('/api/tree/:tree/place/merge', async (req, res) => {
    const { tree: treeName } = req.params;
    const { sourceId, targetId } = req.body;
    if (!sourceId || !targetId || sourceId === targetId) {
        return res.status(400).json({ success: false, message: 'sourceId and targetId required and must differ' });
    }

    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false, message: 'Tree not found' });

    const [source, target] = await Promise.all([
        prisma.place.findFirst({ where: { id: sourceId, treeId: tree.id } }),
        prisma.place.findFirst({ where: { id: targetId, treeId: tree.id } })
    ]);
    if (!source || !target) return res.status(404).json({ success: false, message: 'Source or target not found' });

    await prisma.$transaction(async (tx) => {
        await tx.event.updateMany({ where: { placeId: source.id }, data: { placeId: target.id } });
        await tx.fact.updateMany({ where: { placeId: source.id }, data: { placeId: target.id } });
        await tx.association.updateMany({ where: { placeId: source.id }, data: { placeId: target.id } });
        await tx.place.updateMany({ where: { parentId: source.id }, data: { parentId: target.id } });
        await tx.place.delete({ where: { id: source.id } });
    });

    res.json({ success: true });
});

app.post('/api/tree/:tree/place', async (req, res) => {
    const { tree: treeName } = req.params;
    const {
        id,
        name,
        old_name,
        latitude,
        longitude,
        mode,
        jurisdiction,
        historicNames,
        parentId,
        reassignToId
    } = req.body;

    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false });

    try {
        if (mode === 'delete' && (name || id)) {
            const placeToDelete = await prisma.place.findFirst({
                where: id
                    ? { id, treeId: tree.id }
                    : { treeId: tree.id, name: name, parentId: null }
            });
            if (placeToDelete) {
                const [eventCount, factCount, associationCount, childCount] = await Promise.all([
                    prisma.event.count({ where: { placeId: placeToDelete.id } }),
                    prisma.fact.count({ where: { placeId: placeToDelete.id } }),
                    prisma.association.count({ where: { placeId: placeToDelete.id } }),
                    prisma.place.count({ where: { parentId: placeToDelete.id } })
                ]);
                const totalLinks = eventCount + factCount + associationCount;

                if ((totalLinks > 0 || childCount > 0) && !reassignToId) {
                    return res.status(409).json({
                        success: false,
                        message: 'Place is still in use. Provide reassignToId or merge first.',
                        usage: { eventCount, factCount, associationCount, childCount, totalLinks }
                    });
                }

                if (reassignToId) {
                    const target = await prisma.place.findFirst({ where: { id: reassignToId, treeId: tree.id } });
                    if (!target) {
                        return res.status(400).json({ success: false, message: 'Invalid reassignToId' });
                    }
                    if (target.id === placeToDelete.id) {
                        return res.status(400).json({ success: false, message: 'reassignToId must differ from deleting place' });
                    }

                    await prisma.$transaction(async (tx) => {
                        await tx.event.updateMany({ where: { placeId: placeToDelete.id }, data: { placeId: target.id } });
                        await tx.fact.updateMany({ where: { placeId: placeToDelete.id }, data: { placeId: target.id } });
                        await tx.association.updateMany({ where: { placeId: placeToDelete.id }, data: { placeId: target.id } });
                        await tx.place.updateMany({ where: { parentId: placeToDelete.id }, data: { parentId: target.id } });
                        await tx.place.delete({ where: { id: placeToDelete.id } });
                    });
                } else {
                    await prisma.place.delete({ where: { id: placeToDelete.id } });
                }
            }
            return res.json({ success: true });
        }

        const lat = (latitude !== undefined && latitude !== '') ? parseFloat(latitude) : null;
        const lng = (longitude !== undefined && longitude !== '') ? parseFloat(longitude) : null;
        const normalizedParentId = parentId || null;
        const normalizedHistoricNames = Array.isArray(historicNames)
            ? historicNames.filter((h: any) => typeof h === 'string' && h.trim()).map((h: string) => h.trim())
            : (typeof historicNames === 'string'
                ? historicNames.split(',').map((h) => h.trim()).filter(Boolean)
                : []);

        if (normalizedParentId) {
            const parent = await prisma.place.findFirst({ where: { id: normalizedParentId, treeId: tree.id } });
            if (!parent) {
                return res.status(400).json({ success: false, message: 'Invalid parentId for this tree.' });
            }
            if (id && normalizedParentId === id) {
                return res.status(400).json({ success: false, message: 'A place cannot be its own parent.' });
            }
        }

        if (id) {
            const existingById = await prisma.place.findFirst({ where: { id, treeId: tree.id } });
            if (!existingById) {
                return res.status(404).json({ success: false, message: 'Place not found.' });
            }
            await prisma.place.update({
                where: { id: existingById.id },
                data: {
                    name: name,
                    latitude: lat,
                    longitude: lng,
                    jurisdiction: jurisdiction || null,
                    historicNames: normalizedHistoricNames,
                    parentId: normalizedParentId
                }
            });
        } else if (old_name && old_name !== name) {
            const existingPlace = await prisma.place.findFirst({
                where: { treeId: tree.id, name: old_name, parentId: null }
            });
            if (existingPlace) {
                await prisma.place.update({
                    where: { id: existingPlace.id },
                    data: {
                        name: name,
                        latitude: lat,
                        longitude: lng,
                        jurisdiction: jurisdiction || null,
                        historicNames: normalizedHistoricNames
                    }
                });
            }
        } else {
            const existingPlace = await prisma.place.findFirst({
                where: { treeId: tree.id, name: name, parentId: normalizedParentId }
            });
            if (existingPlace) {
                await prisma.place.update({
                    where: { id: existingPlace.id },
                    data: {
                        latitude: lat,
                        longitude: lng,
                        jurisdiction: jurisdiction || null,
                        historicNames: normalizedHistoricNames
                    }
                });
            } else {
                await prisma.place.create({
                    data: {
                        treeId: tree.id,
                        name: name,
                        historicNames: normalizedHistoricNames,
                        jurisdiction: jurisdiction || null,
                        parentId: normalizedParentId,
                        latitude: lat,
                        longitude: lng
                    }
                });
            }
        }

        res.json({ success: true });
    } catch (error: any) {
        console.error('Place save error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/tree/:tree/places/search', async (req, res) => {
    const { tree: treeName } = req.params;
    const { q } = req.query;
    if (!q) return res.json({ success: true, results: [] });

    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false });

    const places = await prisma.place.findMany({
        where: {
            treeId: tree.id,
            name: { contains: q as string, mode: 'insensitive' }
        },
        take: 10
    });

    res.json({ success: true, results: places.map(p => p.name) });
});

app.get('/api/tree/:tree/statistics', async (req, res) => {
    const { tree: treeName } = req.params;
    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false });

    const counts = {
        individuals: await prisma.person.count({ where: { treeId: tree.id } }),
        families: await prisma.family.count({ where: { treeId: tree.id } }),
        media: await prisma.media.count({ where: { treeId: tree.id } }),
        places: await prisma.place.count({ where: { treeId: tree.id } }),
    };

    const gender = {
        male: await prisma.person.count({ where: { treeId: tree.id, sex: 'M' } }),
        female: await prisma.person.count({ where: { treeId: tree.id, sex: 'F' } }),
        unknown: await prisma.person.count({ where: { treeId: tree.id, sex: 'U' } }),
    };

    res.json({ success: true, counts, gender });
});

app.get('/api/tree/:tree/export', async (req, res) => {
    const treeName = req.params.tree as string;
    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false });

    const gedcom = await GedcomManager.exportTree(prisma, tree.id);
    res.json({ success: true, gedcom });
});

app.get('/api/tree/:tree/export.ged', async (req, res) => {
    const treeName = req.params.tree as string;
    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).send('Tree not found');

    const gedcom = await GedcomManager.exportTree(prisma, tree.id);
    const payload = Buffer.from(gedcom, 'utf8');

    res.setHeader('Content-Type', 'application/gedcom; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=\"${treeName}.ged\"`);
    res.send(payload);
});

app.post('/api/tree/:tree/import', upload.single('file'), async (req, res) => {
    const treeName = req.params.tree as string;
    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false });

    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    try {
        const content = fs.readFileSync(req.file.path, 'utf-8');
        const report = await GedcomManager.importGedcom(prisma, tree.id, content);
        fs.unlinkSync(req.file.path);
        res.json({ success: true, report });
    } catch (error: any) {
        console.error('Import error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- System & Update Routes ---

app.get('/api/system/info', async (req, res) => {
    try {
        const pkgPath = path.join(__dirname, '../../package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        res.json({
            success: true,
            version: pkg.version,
            nodeVersion: process.version,
            platform: process.platform
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Could not read version info' });
    }
});

app.get('/api/system/check-update', async (req, res) => {
    try {
        const token = process.env.GITHUB_TOKEN;
        const owner = process.env.GITHUB_OWNER || 'dodi110480';
        const repo = process.env.GITHUB_REPO || 'heritago';

        // Project root is one level up from server/
        const projectRoot = path.resolve(__dirname, '../../');

        // Ensure git trusts this directory (required for www-data user)
        try {
            await execAsync(`git config --global --add safe.directory ${projectRoot}`);
        } catch (e) {
            // Ignore if already set
        }

        // 1. Fetch latest release from GitHub API
        const headers: any = { 'Accept': 'application/vnd.github.v3+json' };
        if (token) {
            headers['Authorization'] = `token ${token}`;
        }

        const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
            headers
        });

        const latestRelease: any = response.data;
        const latestTag = latestRelease.tag_name;

        // 2. Get current local tag or hash
        let currentTag = '';
        try {
            const { stdout: tagStdout } = await execAsync('git describe --tags --abbrev=0', { cwd: projectRoot });
            currentTag = tagStdout.trim();
        } catch (e) {
            try {
                const { stdout: hashStdout } = await execAsync('git rev-parse --short HEAD', { cwd: projectRoot });
                currentTag = hashStdout.trim();
            } catch (e2) {
                currentTag = 'unknown';
            }
        }

        const hasUpdate = currentTag !== latestTag;

        res.json({
            success: true,
            hasUpdate,
            currentVersion: currentTag,
            latestVersion: latestTag,
            releaseName: latestRelease.name,
            details: latestRelease.body
        });
    } catch (error: any) {
        console.error('Update check error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to check for updates',
            error: error.response?.data?.message || error.message
        });
    }
});


app.post('/api/system/update', async (req, res) => {
    try {
        const { tag } = req.body;
        if (!tag) {
            return res.status(400).json({ success: false, message: 'No target tag provided' });
        }

        console.log(`[server]: Starting application update to ${tag}...`);

        // 1. Fetch tags from remote
        await execAsync('git fetch --tags');

        // 2. Checkout the specific tag
        const { stdout, stderr } = await execAsync(`git checkout tags/${tag}`);
        console.log('[server]: git checkout output:', stdout);

        if (stderr && !stderr.includes('HEAD is now at')) {
            console.warn('[server]: git checkout warning:', stderr);
        }

        res.json({
            success: true,
            message: `Update to ${tag} successful. Server might need a restart if backend code changed.`,
            output: stdout
        });
    } catch (error: any) {
        console.error('Update execution error:', error);
        res.status(500).json({ success: false, message: 'Update failed', error: error.message });
    }
});

// --- Media API ---

app.get('/api/media', async (req, res) => {
    try {
        const { treeId, type, search } = req.query;
        if (!treeId) return res.status(400).json({ success: false, message: 'treeId required' });

        const where: any = { treeId: treeId as string };

        if (type) {
            if (type === 'FOTOS') {
                where.OR = [
                    { mediaType: 'PHOTO' },
                    { AND: [{ mediaType: null }, { mimeType: { startsWith: 'image/' } }] }
                ];
            } else if (type === 'DOKUMENTE') {
                where.OR = [
                    { mediaType: { in: ['DOCUMENT', 'RECORD'] } },
                    { AND: [{ mediaType: null }, { mimeType: { in: ['application/pdf', 'text/plain'] } }] }
                ];
            }
        }

        if (search) {
            const searchOr = [
                { title: { contains: search as string, mode: 'insensitive' } },
                { filePath: { contains: search as string, mode: 'insensitive' } },
                { remoteUrl: { contains: search as string, mode: 'insensitive' } }
            ];
            if (where.OR) {
                where.AND = [{ OR: where.OR }, { OR: searchOr }];
                delete where.OR;
            } else {
                where.OR = searchOr;
            }
        }

        const media = await prisma.media.findMany({
            where,
            include: {
                links: {
                    include: {
                        person: { include: { names: { where: { isPrimary: true } } } },
                        family: { include: { mediaLinks: { include: { media: true } } } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // --- Helper for filename extraction ---
        const getFileName = (m: any) => {
            if (m.filePath) return m.filePath;
            return null;
        };

        // --- Sync/Pruning Logic ---
        const validMedia = [];
        const orphanedIds = [];

        for (const item of media) {
            let fileFound = true;
            const fname = getFileName(item);

            if (fname) {
                const fullPath = path.join(UPLOADS_DIR, fname);
                if (!fs.existsSync(fullPath)) {
                    fileFound = false;
                }
            }

            if (fileFound) {
                validMedia.push(item);
            } else {
                console.log(`[server]: Pruning orphaned media entry: ${item.id} (Filename: ${fname})`);
                orphanedIds.push(item.id);
            }
        }

        if (orphanedIds.length > 0) {
            await prisma.media.deleteMany({
                where: { id: { in: orphanedIds } }
            });
        }

        let orphanFiles: any[] = [];
        if (type === 'UNLINKED') {
            const knownFileNames = new Set(
                validMedia
                    .map((m: any) => m.filePath)
                    .filter((f: any) => typeof f === 'string' && f.length > 0)
            );

            const filesOnDisk = fs.readdirSync(UPLOADS_DIR).filter((f) => {
                const full = path.join(UPLOADS_DIR, f);
                return fs.statSync(full).isFile();
            });

            orphanFiles = filesOnDisk
                .filter((f) => !knownFileNames.has(f))
                .map((f) => {
                    const full = path.join(UPLOADS_DIR, f);
                    const ext = path.extname(f).toLowerCase();
                    const stats = fs.statSync(full);
                    const mimeType =
                        ext === '.pdf' ? 'application/pdf'
                            : ['.jpg', '.jpeg'].includes(ext) ? 'image/jpeg'
                                : ext === '.png' ? 'image/png'
                                    : ext === '.webp' ? 'image/webp'
                                        : ext === '.gif' ? 'image/gif'
                                            : 'application/octet-stream';
                    const mediaType = mimeType.startsWith('image/') ? 'PHOTO' : 'DOCUMENT';

                    return {
                        id: `orphan:${f}`,
                        treeId,
                        title: f,
                        filePath: f,
                        remoteUrl: `/uploads/${f}`,
                        mimeType,
                        mediaType,
                        fileSize: Math.min(Number.MAX_SAFE_INTEGER, stats.size),
                        links: [],
                        orphanFile: true,
                        createdAt: stats.birthtime ?? stats.mtime
                    };
                });
        }

        res.json({ success: true, media: [...validMedia, ...orphanFiles] });
    } catch (error: any) {
        console.error('Fetch media error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/media/adopt-orphan', async (req, res) => {
    try {
        const { treeId, filePath, title, mediaType } = req.body;
        if (!treeId || !filePath) {
            return res.status(400).json({ success: false, message: 'treeId and filePath required' });
        }
        if (filePath.includes('..') || path.isAbsolute(filePath)) {
            return res.status(400).json({ success: false, message: 'Invalid filePath' });
        }

        const fullPath = path.join(UPLOADS_DIR, filePath);
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ success: false, message: 'File not found on disk' });
        }

        const existing = await prisma.media.findFirst({
            where: { treeId, filePath }
        });
        if (existing) return res.json({ success: true, media: existing, duplicate: true });

        const ext = path.extname(filePath).toLowerCase();
        const mimeType =
            ext === '.pdf' ? 'application/pdf'
                : ['.jpg', '.jpeg'].includes(ext) ? 'image/jpeg'
                    : ext === '.png' ? 'image/png'
                        : ext === '.webp' ? 'image/webp'
                            : ext === '.gif' ? 'image/gif'
                                : 'application/octet-stream';
        const stats = fs.statSync(fullPath);

        const media = await prisma.media.create({
            data: {
                treeId,
                title: title || filePath,
                mediaType: mediaType || (mimeType.startsWith('image/') ? 'PHOTO' : 'DOCUMENT'),
                filePath,
                remoteUrl: `/uploads/${filePath}`,
                mimeType,
                fileSize: Math.min(Number.MAX_SAFE_INTEGER, stats.size)
            }
        });

        res.json({ success: true, media });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/media/orphan-file', async (req, res) => {
    try {
        const { filePath } = req.body;
        if (!filePath) return res.status(400).json({ success: false, message: 'filePath required' });
        if (filePath.includes('..') || path.isAbsolute(filePath)) {
            return res.status(400).json({ success: false, message: 'Invalid filePath' });
        }

        const fullPath = path.join(UPLOADS_DIR, filePath);
        if (!fs.existsSync(fullPath)) return res.status(404).json({ success: false, message: 'File not found' });

        fs.unlinkSync(fullPath);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/media/upload', upload.single('file'), async (req, res) => {
    try {
        console.log('[server]: Media upload request received');
        const file = req.file;
        const { treeId, title, mediaType } = req.body;

        if (!file || !treeId) {
            console.error('[server]: Missing file or treeId');
            return res.status(400).json({ success: false, message: 'File and treeId required' });
        }

        const tree = await prisma.tree.findUnique({ where: { id: treeId } });
        if (!tree) return res.status(404).json({ success: false, message: 'Tree not found' });

        const isImage = file.mimetype.startsWith('image/');
        let finalFilename = file.filename;
        let finalMimeType = file.mimetype;
        let finalPath = file.path;
        let width = undefined;
        let height = undefined;
        const fileBuffer = fs.readFileSync(file.path);

        const existing = await prisma.media.findFirst({
            where: { treeId, filePath: finalFilename }
        });
        if (existing) {
            fs.unlinkSync(file.path);
            return res.json({ success: true, media: existing, duplicate: true });
        }

        if (isImage) {
            // Processing with sharp: Resize, Convert to WebP, Rename to UUID.webp
            const sharpImg = sharp(fileBuffer);
            const metadata = await sharpImg.metadata();

            const uuid = crypto.randomUUID();
            finalFilename = `${uuid}.webp`;
            finalPath = path.join(UPLOADS_DIR, finalFilename);
            finalMimeType = 'image/webp';

            // Resize if too large, otherwise just convert
            let pipeline = sharpImg;
            if (metadata.width && metadata.width > 2000 || metadata.height && metadata.height > 2000) {
                pipeline = pipeline.resize(2000, 2000, { fit: 'inside', withoutEnlargement: true });
            }

            await pipeline.webp({ quality: 85 }).toFile(finalPath);

            // Get processed metadata
            const processedMetadata = await sharp(finalPath).metadata();
            width = processedMetadata.width;
            height = processedMetadata.height;

            // Delete temporary upload
            fs.unlinkSync(file.path);
        }

        const stats = fs.statSync(finalPath);

        const media = await prisma.media.create({
            data: {
                treeId,
                title: title || file.originalname,
                mediaType: mediaType || (isImage ? 'PHOTO' : 'DOCUMENT'),
                filePath: finalFilename,
                remoteUrl: `/uploads/${finalFilename}`,
                mimeType: finalMimeType,
                fileSize: Math.min(Number.MAX_SAFE_INTEGER, stats.size),
                dimensions: width && height ? `${width}x${height}` : null
            }
        });

        res.json({ success: true, media });
    } catch (error: any) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/media/:id', async (req, res) => {
    try {
        const media = await prisma.media.findUnique({
            where: { id: req.params.id },
            include: {
                links: true
            }
        });
        if (!media) return res.status(404).json({ success: false, message: 'Media not found' });
        res.json({ success: true, media });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/media/:id', async (req, res) => {
    try {
        const { title, mediaType } = req.body;
        const media = await prisma.media.update({
            where: { id: req.params.id },
            data: { title, mediaType }
        });
        res.json({ success: true, media });
    } catch (error: any) {
        console.error('Update media error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/media/:id/link', async (req, res) => {
    try {
        const { treeId, personId, familyId, sourceId, isPrimary } = req.body;
        const mediaId = req.params.id;
        if (!treeId) return res.status(400).json({ success: false, message: 'treeId required' });

        let resolvedPersonId: string | null = null;
        let resolvedFamilyId: string | null = null;
        let resolvedSourceId: string | null = null;

        if (personId) {
            const byId = await prisma.person.findUnique({ where: { id: personId } });
            if (byId) {
                resolvedPersonId = byId.id;
            } else {
                const byGedcom = await prisma.person.findFirst({
                    where: { treeId, gedcomId: personId }
                });
                if (!byGedcom) {
                    return res.status(400).json({ success: false, message: `Person not found for id ${personId}` });
                }
                resolvedPersonId = byGedcom.id;
            }
        }

        if (familyId) {
            const byId = await prisma.family.findUnique({ where: { id: familyId } });
            if (byId) {
                resolvedFamilyId = byId.id;
            } else {
                const byGedcom = await prisma.family.findFirst({
                    where: { treeId, gedcomId: familyId }
                });
                if (!byGedcom) {
                    return res.status(400).json({ success: false, message: `Family not found for id ${familyId}` });
                }
                resolvedFamilyId = byGedcom.id;
            }
        }

        if (sourceId) {
            const byId = await prisma.source.findUnique({ where: { id: sourceId } });
            if (byId) {
                resolvedSourceId = byId.id;
            } else {
                const byGedcom = await prisma.source.findFirst({
                    where: { treeId, gedcomId: sourceId }
                });
                if (!byGedcom) {
                    return res.status(400).json({ success: false, message: `Source not found for id ${sourceId}` });
                }
                resolvedSourceId = byGedcom.id;
            }
        }

        if (!resolvedPersonId && !resolvedFamilyId && !resolvedSourceId) {
            return res.status(400).json({ success: false, message: 'No valid link target provided' });
        }

        const existingLink = await prisma.mediaLink.findFirst({
            where: {
                treeId,
                mediaId,
                personId: resolvedPersonId,
                familyId: resolvedFamilyId,
                sourceId: resolvedSourceId
            }
        });
        if (existingLink) {
            return res.json({ success: true, duplicate: true, link: existingLink });
        }

        const link = await prisma.mediaLink.create({
            data: {
                treeId,
                mediaId,
                personId: resolvedPersonId,
                familyId: resolvedFamilyId,
                sourceId: resolvedSourceId,
                isPrimary: isPrimary || false
            }
        });

        res.json({ success: true, link });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/media/link/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const existing = await prisma.mediaLink.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ success: false, message: 'Link not found' });

        await prisma.mediaLink.delete({ where: { id } });
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/media/:id', async (req, res) => {
    try {
        const media = await prisma.media.findUnique({ where: { id: req.params.id } });
        if (!media) return res.status(404).json({ success: false, message: 'Media not found' });

        // Delete file logic (mirrors pruning)
        const fname = media.filePath;
        if (fname) {
            const fullPath = path.join(UPLOADS_DIR, fname);
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        }

        await prisma.media.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/tree/:tree/diagnostics', async (req, res) => {
    // For now, return empty errors to satisfy the frontend and avoid 404
    // Later this can integrate with a more deep syntactic check
    res.json({ success: true, errors: [] });
});

app.get('/api/tree/:tree/calendar', async (req, res) => {
    // Empty calendar for now to avoid 404
    res.json({ success: true, events: [] });
});

app.get('/api/tree/:tree/map', async (req, res) => {
    const { tree: treeName } = req.params;
    const tree = await prisma.tree.findUnique({
        where: { name: treeName },
        include: {
            places: {
                where: {
                    AND: [
                        { latitude: { not: null } },
                        { longitude: { not: null } }
                    ]
                }
            }
        }
    });

    if (!tree) return res.status(404).json({ success: false });

    const markers = tree.places.map(p => ({
        id: p.id,
        name: p.name,
        lat: p.latitude,
        lng: p.longitude
    }));

    res.json({ success: true, markers });
});

app.listen(port, () => {
    console.log(`[server]: Heritago GEDCOM-Compliant Backend running at http://localhost:${port}`);
});
