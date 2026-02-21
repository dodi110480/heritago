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

        // 1. Upsert Individual
        const person = await prisma.individual.upsert({
            where: { treeId_gedcomId: { treeId, gedcomId: xref } },
            update: {
                sex: (data.gender || 'U') as any,
            },
            create: {
                treeId,
                gedcomId: xref,
                sex: (data.gender || 'U') as any,
            }
        });

        // 2. Names
        await prisma.name.deleteMany({ where: { individualId: person.id } });
        if (data.names && Array.isArray(data.names)) {
            for (const n of data.names) {
                await prisma.name.create({
                    data: {
                        individualId: person.id,
                        isPrimary: !!n.isPrimary,
                        type: (n.type || 'BIRTH') as any,
                        full: `${n.given || ''} /${n.surname || ''}/`.trim(),
                        given: n.given || '',
                        surname: n.surname || '',
                    }
                });
            }
        }

        // 3. Events (includes BIRT, DEAT, etc.)
        await prisma.event.deleteMany({ where: { indiOwnerId: person.id } });
        if (data.events && Array.isArray(data.events)) {
            for (const e of data.events) {
                let placeId = undefined;
                if (e.place) {
                    const place = await prisma.place.upsert({
                        where: { treeId_gedcomName: { treeId, gedcomName: e.place } },
                        update: {},
                        create: { treeId, gedcomName: e.place }
                    });
                    placeId = place.id;
                }
                await prisma.event.create({
                    data: {
                        indiOwnerId: person.id,
                        type: (e.type || 'EVEN') as any,
                        dateText: e.date ? this.formatGedcomDate(e.date) : null,
                        placeId: placeId
                    }
                });
            }
        }

        // 4. Facts
        await prisma.fact.deleteMany({ where: { indiOwnerId: person.id } });
        if (data.facts && Array.isArray(data.facts)) {
            for (const f of data.facts) {
                await prisma.fact.create({
                    data: {
                        indiOwnerId: person.id,
                        type: f.type || 'FACT',
                        value: f.value || '',
                    }
                });
            }
        }

        // 5. Citations
        await prisma.citation.deleteMany({ where: { indiId: person.id } });
        if (data.citations && Array.isArray(data.citations)) {
            for (const cit of data.citations) {
                // Find or create source
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
                            indiId: person.id,
                            sourceId: source.id,
                            page: cit.page || null,
                            quotation: cit.text || null,
                        }
                    });
                }
            }
        }

        // 6. Media
        await prisma.mediaLink.deleteMany({ where: { individualId: person.id } });
        if (data.media && Array.isArray(data.media)) {
            for (const med of data.media) {
                let mediaObj = await prisma.mediaObject.findFirst({
                    where: { treeId, url: med.url }
                });
                if (!mediaObj && med.url) {
                    mediaObj = await prisma.mediaObject.create({
                        data: { treeId, url: med.url, title: med.title }
                    });
                }
                if (mediaObj) {
                    await prisma.mediaLink.create({
                        data: {
                            individualId: person.id,
                            mediaId: mediaObj.id,
                            isPrimary: !!med.isPrimary
                        }
                    });
                }
            }
        }

        // 7. Notes
        await prisma.noteLink.deleteMany({ where: { individualId: person.id } });
        if (data.notes && Array.isArray(data.notes)) {
            for (const noteText of data.notes) {
                if (noteText && noteText.trim()) {
                    const note = await prisma.note.create({
                        data: { treeId, text: noteText }
                    });
                    await prisma.noteLink.create({
                        data: {
                            individualId: person.id,
                            noteId: note.id
                        }
                    });
                }
            }
        }

        // 8. Extensions
        await prisma.extension.deleteMany({ where: { ownerId: person.id, ownerType: 'INDI' } });
        // Also delete by individualId for safety with the new relation
        await prisma.extension.deleteMany({ where: { individualId: person.id } });

        if (data.extensions && Array.isArray(data.extensions)) {
            for (const ext of data.extensions) {
                await prisma.extension.create({
                    data: {
                        treeId,
                        ownerType: 'INDI',
                        ownerId: person.id,
                        individualId: person.id, // Fill new field
                        tag: ext.key,
                        value: ext.value
                    }
                });
            }
        }

        // 9. Relations (Sync Enabled)
        const processRel = async (targetGedcomId: string, type: string) => {
            const target = await prisma.individual.findUnique({ where: { treeId_gedcomId: { treeId, gedcomId: targetGedcomId } } });
            if (!target) return;

            const relType = type.toUpperCase();

            if (relType === 'FATHER' || relType === 'MOTHER') {
                // person is child, target is parent
                let fam = await prisma.family.findFirst({
                    where: { treeId, members: { some: { individualId: person.id, role: 'CHIL' } } }
                });
                if (!fam) {
                    fam = await prisma.family.create({ data: { treeId, gedcomId: `@F${Date.now()}_${Math.floor(Math.random() * 1000)}@` } });
                    await prisma.familyMember.create({ data: { familyId: fam.id, individualId: person.id, role: 'CHIL' } });
                }
                const role = relType === 'FATHER' ? 'HUSB' : 'WIFE';
                const existingParent = await prisma.familyMember.findFirst({ where: { familyId: fam.id, role } });
                if (existingParent) {
                    await prisma.familyMember.update({ where: { id: existingParent.id }, data: { individualId: target.id } });
                } else {
                    await prisma.familyMember.create({ data: { familyId: fam.id, individualId: target.id, role } });
                }
            } else if (relType === 'SPOUSE' || relType === 'PARTNER') {
                // Check if they are ALREADY in a family together
                const existingFam = await prisma.family.findFirst({
                    where: {
                        treeId,
                        AND: [
                            { members: { some: { individualId: person.id } } },
                            { members: { some: { individualId: target.id } } }
                        ]
                    }
                });
                if (!existingFam) {
                    // Create new family
                    const fam = await prisma.family.create({ data: { treeId, gedcomId: `@F${Date.now()}_${Math.floor(Math.random() * 1000)}@` } });

                    // Assign roles intelligently: if genders match or are missing, use HUSB/WIFE as slots
                    const pRole = person.sex === 'F' ? 'WIFE' : 'HUSB';
                    let tRole = target.sex === 'F' ? 'WIFE' : 'HUSB';

                    if (pRole === tRole) {
                        tRole = pRole === 'HUSB' ? 'WIFE' : 'HUSB'; // Force distinct slots for same-sex partners in current DB schema
                    }

                    await prisma.familyMember.create({ data: { familyId: fam.id, individualId: person.id, role: pRole as any } });
                    await prisma.familyMember.create({ data: { familyId: fam.id, individualId: target.id, role: tRole as any } });
                }
            } else if (relType === 'CHILD') {
                // target is child, person is parent
                let fam = await prisma.family.findFirst({
                    where: { treeId, members: { some: { individualId: person.id, role: { in: ['HUSB', 'WIFE'] } } } }
                });
                if (!fam) {
                    fam = await prisma.family.create({ data: { treeId, gedcomId: `@F${Date.now()}_${Math.floor(Math.random() * 1000)}@` } });
                    await prisma.familyMember.create({ data: { familyId: fam.id, individualId: person.id, role: (person.sex === 'F' ? 'WIFE' : 'HUSB') } });
                }
                const existingChild = await prisma.familyMember.findFirst({ where: { familyId: fam.id, individualId: target.id, role: 'CHIL' } });
                if (!existingChild) {
                    await prisma.familyMember.create({ data: { familyId: fam.id, individualId: target.id, role: 'CHIL' } });
                }
            }
        };

        // SYNC: Identify and remove relationships not in incoming payload
        if (data.relations && Array.isArray(data.relations)) {
            const incoming = data.relations.filter((r: any) => r.personId);
            const currentMemberships = await prisma.familyMember.findMany({
                where: { individualId: person.id },
                include: { family: { include: { members: { include: { person: true } } } } }
            });

            for (const membership of currentMemberships) {
                const fam = membership.family;
                let removeMembership = false;

                if (membership.role === 'CHIL') {
                    const father = fam.members.find(m => m.role === 'HUSB')?.person?.gedcomId;
                    const mother = fam.members.find(m => m.role === 'WIFE')?.person?.gedcomId;
                    const fatherStillExists = father && incoming.some((r: any) => r.type === 'FATHER' && r.personId === father);
                    const motherStillExists = mother && incoming.some((r: any) => r.type === 'MOTHER' && r.personId === mother);

                    if ((father && !fatherStillExists) || (mother && !motherStillExists)) {
                        removeMembership = true;
                    }
                } else if (membership.role === 'HUSB' || membership.role === 'WIFE') {
                    // Check Spouse
                    const otherRole = membership.role === 'HUSB' ? 'WIFE' : 'HUSB';
                    const spouse = fam.members.find(m => m.role === otherRole)?.person?.gedcomId;
                    const spouseStillExists = spouse && incoming.some((r: any) => (r.type === 'SPOUSE' || r.type === 'PARTNER') && r.personId === spouse);
                    if (spouse && !spouseStillExists) {
                        removeMembership = true;
                    }

                    // Check Children
                    const childMembers = fam.members.filter(m => m.role === 'CHIL');
                    for (const cm of childMembers) {
                        const cid = cm.person?.gedcomId;
                        if (cid && !incoming.some((r: any) => r.type === 'CHILD' && r.personId === cid)) {
                            await prisma.familyMember.delete({ where: { id: cm.id } });
                        }
                    }
                }

                if (removeMembership) {
                    await prisma.familyMember.delete({ where: { id: membership.id } });
                }
            }

            // Process new/updated relations
            for (const rel of incoming) {
                await processRel(rel.personId, rel.type);
            }
        }

        // Handle legacy targetId/relationType from "Add Mode"
        if (data.targetId && data.relationType) {
            let mappedType = data.relationType;
            if (mappedType === 'son' || mappedType === 'daughter') mappedType = 'CHILD';
            if (mappedType === 'partner') mappedType = 'SPOUSE';
            await processRel(data.targetId, mappedType);
        }

        // 10. Media (Sync Enabled)
        await prisma.mediaLink.deleteMany({ where: { individualId: person.id } });
        if (data.media && Array.isArray(data.media)) {
            for (const med of data.media) {
                if (!med.id) continue;
                await prisma.mediaLink.create({
                    data: {
                        individualId: person.id,
                        mediaId: med.id,
                        isPrimary: !!med.isPrimary
                    }
                });
            }
        }

        // Clean up empty families 
        const familiesToCheck = await prisma.family.findMany({
            where: { treeId },
            include: { members: true }
        });
        for (const f of familiesToCheck) {
            if (f.members.length === 0 || (f.members.length === 1 && f.members[0].role !== 'CHIL')) {
                await prisma.family.delete({ where: { id: f.id } });
            }
        }
        return person;
    }

    static formatGedcom(person: any): any {
        const primaryName = person.names.find((n: any) => n.isPrimary) || person.names[0] || {};
        const birthEvent = person.events.find((e: any) => e.type === 'BIRT' || e.type === 'BIRTH');
        const deathEvent = person.events.find((e: any) => e.type === 'DEAT' || e.type === 'DEATH');

        return {
            id: person.gedcomId,
            name: `${primaryName.given || ''} ${primaryName.surname || ''}`.trim(),
            firstName: primaryName.given || '',
            lastName: primaryName.surname || '',
            gender: person.sex || 'U',
            isAlive: !deathEvent,
            // Rich data arrays for the new modal
            names: person.names.map((n: any) => ({
                given: n.given,
                surname: n.surname,
                isPrimary: n.isPrimary,
                type: n.type
            })),
            events: person.events.map((e: any) => ({
                type: e.type,
                date: e.dateText,
                place: e.place?.gedcomName,
                description: e.description || ''
            })),
            facts: person.facts?.map((f: any) => ({
                type: f.type,
                value: f.value
            })) || [],
            citations: person.citations?.map((c: any) => ({
                source: c.source?.title,
                page: c.page,
                text: c.quotation,
                quality: '3' // Default
            })) || [],
            media: person.media?.map((m: any) => ({
                id: m.media?.id,
                url: m.media?.url,
                title: m.media?.title || m.media?.originalFileName,
                isPrimary: m.isPrimary,
                mimeType: m.media?.mimeType,
                originalFileName: m.media?.originalFileName,
                fileSize: m.media?.fileSize
            })) || [],
            notes: person.notes?.map((n: any) => n.note?.text) || [],
            extensions: person.extensions?.map((ex: any) => ({
                key: ex.tag,
                value: ex.value
            })) || [],
            // Backward compatibility
            birthDate: birthEvent?.dateText || '',
            birthPlace: birthEvent?.place?.gedcomName || '',
            deathDate: deathEvent?.dateText || '',
            deathPlace: deathEvent?.place?.gedcomName || ''
        };
    }

    static formatFamily(fam: any): any {
        const partnerMembers = fam.members.filter((m: any) => m.role === 'HUSB' || m.role === 'WIFE' || m.role === 'PART');

        let husband = null;
        let wife = null;

        if (partnerMembers.length > 0) {
            husband = partnerMembers[0].person?.gedcomId;
        }
        if (partnerMembers.length > 1) {
            wife = partnerMembers[1].person?.gedcomId;
        }

        const children = fam.members.filter((m: any) => m.role === 'CHIL').map((m: any) => m.person?.gedcomId);

        return {
            id: fam.gedcomId || fam.id,
            husband,
            wife,
            children,
            events: fam.events.map((e: any) => ({
                type: e.type,
                date: e.dateText,
                place: e.place?.gedcomName,
                description: e.description || ''
            })),
            media: fam.media?.map((m: any) => ({
                id: m.media?.id,
                url: m.media?.url,
                title: m.media?.title || m.media?.originalFileName,
                isPrimary: m.isPrimary,
                mimeType: m.media?.mimeType,
                originalFileName: m.media?.originalFileName,
                fileSize: m.media?.fileSize
            })) || []
        };
    }

    static async exportTree(prisma: PrismaClient, treeId: string): Promise<string> {
        const individuals = await prisma.individual.findMany({
            where: { treeId },
            include: { names: true, events: { include: { place: true } } }
        });
        const families = await prisma.family.findMany({
            where: { treeId },
            include: { members: { include: { person: true } }, events: { include: { place: true } } }
        });

        const lines: string[] = ['0 HEAD', '1 GEDC', '2 VERS 7.0', '1 SOUR Heritago', '1 SUBM @U1@'];
        for (const person of individuals) {
            lines.push(`0 ${person.gedcomId} INDI`);
            if (person.sex && person.sex !== 'U') lines.push(`1 SEX ${person.sex}`);
            for (const name of person.names) {
                lines.push(`1 NAME ${name.full || (name.given + ' /' + name.surname + '/')}`);
                if (name.given) lines.push(`2 GIVN ${name.given}`);
                if (name.surname) lines.push(`2 SURN ${name.surname}`);
            }
            for (const event of person.events) {
                lines.push(`1 ${event.type}`);
                if (event.dateText) lines.push(`2 DATE ${event.dateText}`);
                if (event.place) lines.push(`2 PLAC ${event.place.gedcomName}`);
            }
            const familyMemberships = await prisma.familyMember.findMany({ where: { individualId: person.id }, include: { family: true } });
            for (const membership of familyMemberships) {
                const tag = membership.role === 'CHIL' ? 'FAMC' : 'FAMS';
                lines.push(`1 ${tag} ${membership.family.gedcomId}`);
            }
        }
        for (const fam of families) {
            lines.push(`0 ${fam.gedcomId} FAM`);
            for (const member of fam.members) {
                const tag = member.role === 'HUSB' ? 'HUSB' : member.role === 'WIFE' ? 'WIFE' : 'CHIL';
                lines.push(`1 ${tag} ${member.person.gedcomId}`);
            }
            for (const event of fam.events) {
                lines.push(`1 ${event.type}`);
                if (event.dateText) lines.push(`2 DATE ${event.dateText}`);
                if (event.place) lines.push(`2 PLAC ${event.place.gedcomName}`);
            }
        }
        lines.push('0 @U1@ SUBM', '1 NAME Heritago Submitter', '0 TRLR');
        return lines.join('\n');
    }

    static async importGedcom(prisma: PrismaClient, treeId: string, content: string) {
        console.log(`[GedcomManager]: Starting import for tree ${treeId}, length: ${content.length}`);
        const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);

        await prisma.individual.deleteMany({ where: { treeId } });
        await prisma.family.deleteMany({ where: { treeId } });

        console.log(`[GedcomManager]: Pass 1: Creating skeletons...`);
        for (const line of lines) {
            const match = line.match(/^0\s+(@\S+@)\s+(INDI|FAM)\s*$/);
            if (match) {
                const xref = match[1], tag = match[2];
                if (tag === 'INDI') await prisma.individual.create({ data: { treeId, gedcomId: xref } });
                else if (tag === 'FAM') await prisma.family.create({ data: { treeId, gedcomId: xref } });
            }
        }

        console.log(`[GedcomManager]: Pass 2: Filling details...`);
        let currentIndiId: string | null = null, currentFamId: string | null = null, currentEventId: string | null = null;
        for (const line of lines) {
            const match = line.match(/^(\d+)\s+(@\S+@)?\s*(\S+)\s*(.*)?$/);
            if (!match) continue;
            const level = parseInt(match[1]), xref = match[2], tag = match[3], payload = match[4]?.trim();

            if (level === 0) {
                currentEventId = null;
                if (tag === 'INDI' && xref) {
                    const indi = await prisma.individual.findUnique({ where: { treeId_gedcomId: { treeId, gedcomId: xref } } });
                    currentIndiId = indi?.id || null; currentFamId = null;
                } else if (tag === 'FAM' && xref) {
                    const fam = await prisma.family.findUnique({ where: { treeId_gedcomId: { treeId, gedcomId: xref } } });
                    currentFamId = fam?.id || null; currentIndiId = null;
                } else { currentIndiId = null; currentFamId = null; }
            } else if (level === 1 && currentIndiId) {
                currentEventId = null;
                if (tag === 'NAME' && payload) {
                    const parts = payload.split('/');
                    const given = parts[0]?.trim() || '';
                    const surname = parts[1]?.trim() || '';
                    const cleanFull = payload.replace(/\//g, '').trim();
                    await prisma.name.create({ data: { individualId: currentIndiId, isPrimary: true, full: cleanFull, given, surname } });
                } else if (tag === 'SEX') {
                    await prisma.individual.update({ where: { id: currentIndiId }, data: { sex: (payload === 'F' ? 'F' : payload === 'M' ? 'M' : 'U') as any } });
                } else if (['BIRT', 'DEAT', 'CHR', 'BURI'].includes(tag)) {
                    const event = await prisma.event.create({ data: { indiOwnerId: currentIndiId, type: tag as any } });
                    currentEventId = event.id;
                }
            } else if (level === 1 && currentFamId) {
                currentEventId = null;
                if (['HUSB', 'WIFE', 'CHIL'].includes(tag)) {
                    const person = await prisma.individual.findUnique({ where: { treeId_gedcomId: { treeId, gedcomId: payload } } });
                    if (person) {
                        const role = tag === 'CHIL' ? 'CHIL' : (tag === 'HUSB' ? 'HUSB' : 'WIFE');
                        await prisma.familyMember.create({ data: { familyId: currentFamId, individualId: person.id, role } });
                    }
                } else if (['MARR', 'DIV'].includes(tag)) {
                    const event = await prisma.event.create({ data: { famOwnerId: currentFamId, type: tag as any } });
                    currentEventId = event.id;
                }
            } else if (level === 2 && currentEventId) {
                if (tag === 'DATE') await prisma.event.update({ where: { id: currentEventId }, data: { dateText: payload } });
                else if (tag === 'PLAC') {
                    await prisma.event.update({
                        where: { id: currentEventId },
                        data: {
                            place: {
                                connectOrCreate: {
                                    where: { treeId_gedcomName: { treeId, gedcomName: payload } },
                                    create: { treeId, gedcomName: payload }
                                }
                            }
                        }
                    });
                }
            }
        }
        console.log(`[GedcomManager]: Import completed successfully.`);
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

app.get('/api/tree/:tree', async (req, res) => {
    const { tree: treeName } = req.params;
    const tree = await prisma.tree.findUnique({
        where: { name: treeName },
        include: {
            individuals: {
                include: {
                    names: true,
                    events: { include: { place: true } },
                    facts: true,
                    citations: { include: { source: true } },
                    media: { include: { media: true } },
                    notes: { include: { note: true } },
                    extensions: true
                }
            },
            families: {
                include: {
                    members: { include: { person: true } },
                    events: { include: { place: true } },
                    media: { include: { media: true } }
                }
            }
        },
        // @ts-ignore - Prisma 7 specific preview feature
        relationLoadStrategy: 'join'
    });

    if (!tree) return res.status(404).json({ success: false });

    const individuals = tree.individuals.map(i => GedcomManager.formatGedcom(i));
    const families = tree.families.map(f => GedcomManager.formatFamily(f));

    res.json({
        success: true,
        meta: { tree: tree.name, treeId: tree.id, title: tree.title },
        individuals,
        families
    });
});

app.post('/api/tree/:tree/person', async (req, res) => {
    const { tree: treeName } = req.params;
    const { mode, id } = req.body;

    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false });

    if (mode === 'delete' && id) {
        const personToDelete = await prisma.individual.findUnique({
            where: { treeId_gedcomId: { treeId: tree.id, gedcomId: id } }
        });

        if (personToDelete) {
            await prisma.individual.delete({ where: { id: personToDelete.id } });

            // Clean up potentially empty families
            const emptyFams = await prisma.family.findMany({
                where: {
                    treeId: tree.id,
                    members: { none: {} }
                }
            });

            if (emptyFams.length > 0) {
                await prisma.family.deleteMany({
                    where: { id: { in: emptyFams.map(f => f.id) } }
                });
            }
        }
        return res.json({ success: true });
    }

    const record = await GedcomManager.createPerson(prisma, tree.id, req.body);
    res.json({ success: true, person: record });
});

app.get('/api/tree/:tree/search', async (req, res) => {
    const { tree: treeName } = req.params;
    const { q } = req.query;
    if (!q) return res.json({ success: true, results: [] });

    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false });

    const people = await prisma.individual.findMany({
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
    const { tree: treeName } = req.params;
    const data = req.body;

    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false });

    const gedcomId = data.id;
    let fam;
    if (gedcomId) {
        fam = await prisma.family.findUnique({ where: { treeId_gedcomId: { treeId: tree.id, gedcomId } } });
    }

    if (!fam) {
        fam = await prisma.family.create({ data: { treeId: tree.id, gedcomId: gedcomId || `@F${Date.now()}@` } });
    }

    // Update members
    await prisma.familyMember.deleteMany({ where: { familyId: fam.id } });

    if (data.husband) {
        const indi = await prisma.individual.findUnique({ where: { treeId_gedcomId: { treeId: tree.id, gedcomId: data.husband } } });
        if (indi) await prisma.familyMember.create({ data: { familyId: fam.id, individualId: indi.id, role: 'HUSB' } });
    }
    if (data.wife) {
        const indi = await prisma.individual.findUnique({ where: { treeId_gedcomId: { treeId: tree.id, gedcomId: data.wife } } });
        if (indi) await prisma.familyMember.create({ data: { familyId: fam.id, individualId: indi.id, role: 'WIFE' } });
    }
    if (data.children) {
        for (const childId of data.children) {
            const indi = await prisma.individual.findUnique({ where: { treeId_gedcomId: { treeId: tree.id, gedcomId: childId } } });
            if (indi) await prisma.familyMember.create({ data: { familyId: fam.id, individualId: indi.id, role: 'CHIL' } });
        }
    }

    // Update events (Multiple events sync)
    await prisma.event.deleteMany({ where: { famOwnerId: fam.id } });
    if (data.events && Array.isArray(data.events)) {
        for (const e of data.events) {
            let placeId = undefined;
            if (e.place) {
                const place = await prisma.place.upsert({
                    where: { treeId_gedcomName: { treeId: tree.id, gedcomName: e.place } },
                    update: {},
                    create: { treeId: tree.id, gedcomName: e.place }
                });
                placeId = place.id;
            }
            await prisma.event.create({
                data: {
                    famOwnerId: fam.id,
                    type: (e.type || 'EVEN') as any,
                    dateText: e.date || null,
                    placeId: placeId,
                    description: e.description || null
                }
            });
        }
    }

    // Update media
    await prisma.mediaLink.deleteMany({ where: { familyId: fam.id } });
    if (data.media && Array.isArray(data.media)) {
        for (const med of data.media) {
            if (!med.id) continue;
            await prisma.mediaLink.create({
                data: {
                    familyId: fam.id,
                    mediaId: med.id,
                    isPrimary: !!med.isPrimary
                }
            });
        }
    }

    res.json({ success: true, family: fam });
});

app.get('/api/tree/:tree/statistics', async (req, res) => {
    const { tree: treeName } = req.params;
    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false });

    const counts = {
        individuals: await prisma.individual.count({ where: { treeId: tree.id } }),
        families: await prisma.family.count({ where: { treeId: tree.id } }),
        media: await prisma.mediaObject.count({ where: { treeId: tree.id } }),
    };

    res.json({ success: true, counts });
});

app.get('/api/tree/:tree/export', async (req, res) => {
    const treeName = req.params.tree as string;
    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false });

    const gedcom = await GedcomManager.exportTree(prisma, tree.id);
    res.json({ success: true, gedcom });
});

app.post('/api/tree/:tree/import', upload.single('file'), async (req, res) => {
    const treeName = req.params.tree as string;
    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false });

    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    try {
        const content = req.file.buffer.toString('utf-8');
        await GedcomManager.importGedcom(prisma, tree.id, content);
        res.json({ success: true });
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
        // Fetch latest info from remote
        await execAsync('git fetch origin main');

        // Compare local main with origin/main
        const { stdout: localHash } = await execAsync('git rev-parse HEAD');
        const { stdout: remoteHash } = await execAsync('git rev-parse origin/main');

        const hasUpdate = localHash.trim() !== remoteHash.trim();

        let updateDetails = '';
        if (hasUpdate) {
            const { stdout: diff } = await execAsync('git log HEAD..origin/main --oneline -n 5');
            updateDetails = diff;
        }

        res.json({
            success: true,
            hasUpdate,
            currentHash: localHash.trim().substring(0, 7),
            remoteHash: remoteHash.trim().substring(0, 7),
            details: updateDetails
        });
    } catch (error: any) {
        console.error('Update check error:', error);
        res.status(500).json({ success: false, message: 'Git command failed. Is git installed?' });
    }
});

app.post('/api/system/update', async (req, res) => {
    try {
        console.log('[server]: Starting application update...');
        const { stdout, stderr } = await execAsync('git pull origin main');
        console.log('[server]: git pull output:', stdout);

        if (stderr && !stderr.includes('From https://github.com')) {
            console.error('[server]: git pull stderr:', stderr);
        }

        res.json({
            success: true,
            message: 'Update successful. Server might need a restart if backend code changed.',
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
            if (type === 'FOTOS') where.mimeType = { startsWith: 'image/' };
            else if (type === 'DOKUMENTE') where.mimeType = { in: ['application/pdf', 'text/plain'] };
        }

        if (search) {
            where.OR = [
                { title: { contains: search as string, mode: 'insensitive' } },
                { description: { contains: search as string, mode: 'insensitive' } },
                { originalFileName: { contains: search as string, mode: 'insensitive' } }
            ];
        }

        const media = await prisma.mediaObject.findMany({
            where,
            include: {
                links: {
                    include: {
                        individual: { include: { names: { where: { isPrimary: true } } } },
                        family: { include: { members: { include: { person: { include: { names: { where: { isPrimary: true } } } } } } } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ success: true, media });
    } catch (error: any) {
        console.error('Fetch media error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/media/upload', upload.single('file'), async (req, res) => {
    try {
        console.log('[server]: Media upload request received');
        const file = req.file;
        const { treeId, title, description } = req.body;

        if (!file || !treeId) {
            console.error('[server]: Missing file or treeId');
            return res.status(400).json({ success: false, message: 'File and treeId required' });
        }

        const tree = await prisma.tree.findUnique({ where: { id: treeId } });
        if (!tree) return res.status(404).json({ success: false, message: 'Tree not found' });

        // Calculate initial hash of the uploaded file
        const fileBuffer = fs.readFileSync(file.path);
        const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // Check for duplicates based on hash
        const existing = await prisma.mediaObject.findFirst({
            where: { treeId, sha256: hash }
        });

        if (existing) {
            fs.unlinkSync(file.path);
            return res.json({ success: true, media: existing, duplicate: true });
        }

        const isImage = file.mimetype.startsWith('image/');
        let finalFilename = file.filename;
        let finalMimeType = file.mimetype;
        let finalPath = file.path;
        let width = undefined;
        let height = undefined;

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

        const media = await prisma.mediaObject.create({
            data: {
                treeId,
                sha256: hash,
                title: title || file.originalname,
                description: description || null,
                originalFileName: file.originalname,
                filePath: finalFilename,
                url: `/uploads/${finalFilename}`,
                mimeType: finalMimeType,
                fileSize: stats.size,
                width,
                height
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
        const media = await prisma.mediaObject.findUnique({
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

app.post('/api/media/:id/link', async (req, res) => {
    try {
        const { individualId, familyId, sourceId, isPrimary } = req.body;
        const mediaId = req.params.id;

        const link = await prisma.mediaLink.create({
            data: {
                mediaId,
                individualId: individualId || null,
                familyId: familyId || null,
                sourceId: sourceId || null,
                isPrimary: isPrimary || false
            }
        });

        res.json({ success: true, link });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/media/:id', async (req, res) => {
    try {
        const media = await prisma.mediaObject.findUnique({ where: { id: req.params.id } });
        if (!media) return res.status(404).json({ success: false, message: 'Media not found' });

        // Delete file
        if (media.filePath) {
            const fullPath = path.join(UPLOADS_DIR, media.filePath);
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        }

        await prisma.mediaObject.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.listen(port, () => {
    console.log(`[server]: Heritago GEDCOM-Compliant Backend running at http://localhost:${port}`);
});
