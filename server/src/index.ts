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
    static async ensureMediaObject(prisma: PrismaClient, treeId: string, med: any) {
        if (med.id) {
            const existing = await prisma.media.findUnique({ where: { id: med.id } });
            if (existing) return existing;
        }

        if (med.url) {
            let cleanUrl = med.url;
            if (cleanUrl.includes('/uploads/')) {
                cleanUrl = '/uploads/' + cleanUrl.split('/uploads/')[1];
            }
            let mediaObj = await prisma.media.findFirst({
                where: { treeId, url: cleanUrl }
            });
            if (!mediaObj) {
                mediaObj = await prisma.media.create({
                    data: { treeId, url: cleanUrl, title: med.title }
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
            update: { sex: data.gender || 'U' },
            create: { treeId, gedcomId: xref, sex: data.gender || 'U' }
        });

        await prisma.name.deleteMany({ where: { personId: person.id } });
        if (data.names && Array.isArray(data.names)) {
            for (const n of data.names) {
                await prisma.name.create({
                    data: {
                        personId: person.id,
                        isPrimary: !!n.isPrimary,
                        type: n.type || 'BIRTH',
                        value: `${n.given || ''} /${n.surname || ''}/`.trim(),
                        given: n.given || '',
                        surname: n.surname || '',
                    }
                });
            }
        } else {
            await prisma.name.create({
                data: {
                    personId: person.id,
                    isPrimary: true,
                    type: 'BIRTH',
                    value: `${data.firstName || ''} /${data.lastName || ''}/`.trim(),
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
                    const place = await prisma.place.upsert({
                        where: { treeId_name: { treeId, name: e.place } },
                        update: {},
                        create: { treeId, name: e.place }
                    });
                    placeId = place.id;
                }
                const createdEvent = await prisma.event.create({
                    data: {
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
                                data: { eventId: createdEvent.id, mediaId: mediaObj.id }
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
                await prisma.fact.create({
                    data: {
                        personId: person.id,
                        type: f.type || 'FACT',
                        value: f.value || '',
                    }
                });
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
                            personId: person.id,
                            sourceId: source.id,
                            page: cit.page || null,
                            text: cit.text || null,
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
                    const note = await prisma.note.findFirst({
                        where: { treeId, text: noteText }
                    }) || await prisma.note.create({
                        data: { treeId, text: noteText }
                    });
                    await prisma.noteLink.create({
                        data: {
                            personId: person.id,
                            noteId: note.id
                        }
                    });
                }
            }
        }

        // 8. Extensions
        if (data.relations && Array.isArray(data.relations)) {
            await prisma.relationship.deleteMany({
                where: {
                    OR: [
                        { childId: person.id },
                        { parentId: person.id }
                    ]
                }
            });

            for (const rel of data.relations) {
                const target = await prisma.person.findUnique({
                    where: { treeId_gedcomId: { treeId, gedcomId: rel.personId } }
                });
                if (!target) continue;

                if (rel.type === 'FATHER' || rel.type === 'MOTHER' || rel.type === 'PARENT') {
                    await prisma.relationship.create({
                        data: { childId: person.id, parentId: target.id, type: 'parent' }
                    });
                } else if (rel.type === 'CHILD') {
                    await prisma.relationship.create({
                        data: { childId: target.id, parentId: person.id, type: 'parent' }
                    });
                } else if (rel.type === 'SPOUSE' || rel.type === 'PARTNER') {
                    const existing = await prisma.relationship.findFirst({
                        where: {
                            OR: [
                                { childId: person.id, parentId: target.id, type: 'spouse' },
                                { childId: target.id, parentId: person.id, type: 'spouse' }
                            ]
                        }
                    });
                    if (!existing) {
                        await prisma.relationship.create({
                            data: { childId: person.id, parentId: target.id, type: 'spouse' }
                        });
                    }
                }
            }
        }

        return person;
    }

    static formatGedcom(person: any): any {
        const primaryName = person.names.find((n: any) => n.isPrimary) || person.names[0] || {};
        const birthEvent = person.events.find((e: any) => e.type === 'BIRT' || e.type === 'BIRTH');
        const deathEvent = person.events.find((e: any) => e.type === 'DEAT' || e.type === 'DEATH');

        // Robust relationship extraction
        const parentFamilyIds = [
            ...(person.parentRelationships || []),
            ...(person.childRelationships || [])
        ].filter(r => r.type === 'parent' && r.role === 'child' && r.familyId)
            .map(r => r.family?.gedcomId)
            .filter(Boolean);

        const spouseFamilyIds = [
            ...(person.parentRelationships || []),
            ...(person.childRelationships || [])
        ].filter(r => r.type === 'spouse' && (r.role === 'husband' || r.role === 'wife' || !r.role) && r.familyId)
            .map(r => r.family?.gedcomId)
            .filter(Boolean);

        return {
            id: person.gedcomId,
            name: `${primaryName.given || ''} ${primaryName.surname || ''}`.trim(),
            firstName: primaryName.given || '',
            lastName: primaryName.surname || '',
            gender: person.sex || 'U',
            isAlive: !deathEvent,
            parents: Array.from(new Set(parentFamilyIds)),
            spouses: Array.from(new Set(spouseFamilyIds)),
            names: person.names.map((n: any) => ({
                given: n.given,
                surname: n.surname,
                isPrimary: n.isPrimary,
                type: n.type
            })),
            events: person.events.map((e: any) => ({
                type: e.type,
                date: e.dateText,
                place: e.place?.name,
                description: e.description || ''
            })),
            facts: person.facts?.map((f: any) => ({
                type: f.type,
                value: f.value
            })) || [],
            media: person.mediaLinks?.map((ml: any) => ({
                id: ml.media?.id,
                url: ml.media?.url,
                title: ml.media?.title || ml.media?.originalFileName,
                isPrimary: ml.isPrimary,
                mimeType: ml.media?.format
            })) || [],
            notes: person.noteLinks?.map((nl: any) => nl.note?.text).filter(Boolean) || [],
            birthDate: birthEvent?.dateText || '',
            birthPlace: birthEvent?.place?.name || '',
            deathDate: deathEvent?.dateText || '',
            deathPlace: deathEvent?.place?.name || ''
        };
    }

    static formatFamily(fam: any): any {
        return {
            id: fam.gedcomId || fam.id,
            type: fam.type,
            events: (fam.events || []).map((e: any) => ({
                type: e.type,
                date: e.dateText,
                place: e.place?.name,
                description: e.description
            })),
            husband: fam.relationships?.find((r: any) => r.role === 'husband' && r.parent?.gedcomId)?.parent?.gedcomId,
            wife: fam.relationships?.find((r: any) => r.role === 'wife' && r.parent?.gedcomId)?.parent?.gedcomId,
            children: fam.relationships
                ?.filter((r: any) => r.role === 'child' && r.child?.gedcomId)
                .map((r: any) => r.child.gedcomId) || []
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
                relationships: { include: { parent: true, child: true } }
            }
        });

        const lines: string[] = [
            '0 HEAD',
            '1 GEDC',
            '2 VERS 7.0',
            '1 SOUR Heritago',
            '1 CHAR UTF-8',
            '1 SUBM @U1@'
        ];

        // --- 1. Export Individuals ---
        for (const person of individuals) {
            lines.push(`0 ${person.gedcomId} INDI`);
            if (person.sex && person.sex !== 'U') lines.push(`1 SEX ${person.sex}`);

            for (const name of person.names) {
                lines.push(`1 NAME ${name.value}`);
                if (name.given) lines.push(`2 GIVN ${name.given}`);
                if (name.surname) lines.push(`2 SURN ${name.surname}`);
            }

            for (const event of person.events) {
                lines.push(`1 ${event.type}`);
                if (event.dateText) lines.push(`2 DATE ${event.dateText}`);
                if (event.place) lines.push(`2 PLAC ${event.place.name}`);
                if (event.description) lines.push(`2 NOTE ${event.description}`);
            }

            // FAMC (Family as child)
            const birthFams = families.filter(f =>
                f.relationships.some(r => r.childId === person.id && r.role === 'child')
            );
            for (const bf of birthFams) {
                lines.push(`1 FAMC ${bf.gedcomId}`);
            }

            // FAMS (Family as spouse)
            const spouseFams = families.filter(f =>
                f.relationships.some(r => r.parentId === person.id && (r.role === 'husband' || r.role === 'wife' || r.type === 'spouse'))
            );
            for (const sf of spouseFams) {
                lines.push(`1 FAMS ${sf.gedcomId}`);
            }
        }

        // --- 2. Export Families ---
        for (const fam of families) {
            lines.push(`0 ${fam.gedcomId} FAM`);

            const husb = fam.relationships.find(r => r.role === 'husband')?.parent;
            const wife = fam.relationships.find(r => r.role === 'wife')?.parent;
            const children = fam.relationships.filter(r => r.role === 'child').map(r => r.child);

            if (husb) lines.push(`1 HUSB ${husb.gedcomId}`);
            if (wife) lines.push(`1 WIFE ${wife.gedcomId}`);
            for (const child of children) {
                if (child) lines.push(`1 CHIL ${child.gedcomId}`);
            }

            for (const event of fam.events) {
                lines.push(`1 ${event.type}`);
                if (event.dateText) lines.push(`2 DATE ${event.dateText}`);
                if (event.place) lines.push(`2 PLAC ${event.place.name}`);
                if (event.description) lines.push(`2 NOTE ${event.description}`);
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

        // --- Pass 1: Clean Data ---
        await prisma.person.deleteMany({ where: { treeId } });
        await prisma.family.deleteMany({ where: { treeId } });
        await prisma.place.deleteMany({ where: { treeId } });
        await prisma.source.deleteMany({ where: { treeId } });
        await prisma.note.deleteMany({ where: { treeId } });
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
            } else if (rec.tag === 'FAM' && rec.xref) {
                const f = await prisma.family.create({
                    data: { treeId, gedcomId: rec.xref }
                });
                gedIdToDbId[rec.xref] = f.id;
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
                            personId: dbId,
                            value: full.replace(/\//g, '').trim(),
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

                        let dbPlaceId = null;
                        if (placeNode?.value) {
                            const p = await prisma.place.upsert({
                                where: { treeId_name: { treeId, name: placeNode.value } },
                                update: {},
                                create: { treeId, name: placeNode.value }
                            });
                            dbPlaceId = p.id;
                        }

                        await prisma.event.create({
                            data: {
                                personId: dbId,
                                type: child.tag,
                                dateText: dateNode?.value || null,
                                placeId: dbPlaceId,
                                description: child.value || null
                            }
                        });
                    }
                }
            } else if (rec.tag === 'FAM' && dbId) {
                // Family Events (MARR etc)
                for (const child of rec.children) {
                    if (gedEvents.includes(child.tag)) {
                        const dateNode = findChild(child, 'DATE');
                        const placeNode = findChild(child, 'PLAC');

                        let dbPlaceId = null;
                        if (placeNode?.value) {
                            const p = await prisma.place.upsert({
                                where: { treeId_name: { treeId, name: placeNode.value } },
                                update: {},
                                create: { treeId, name: placeNode.value }
                            });
                            dbPlaceId = p.id;
                        }

                        await prisma.event.create({
                            data: {
                                familyId: dbId,
                                type: child.tag,
                                dateText: dateNode?.value || null,
                                placeId: dbPlaceId,
                                description: child.value || null
                            }
                        });
                    }
                }

                // Relationships
                const husb = findChild(rec, 'HUSB');
                const wife = findChild(rec, 'WIFE');
                const children = findChildren(rec, 'CHIL');

                const hId = husb?.value && gedIdToDbId[husb.value];
                const wId = wife?.value && gedIdToDbId[wife.value];

                if (hId) {
                    await prisma.relationship.create({
                        data: { parentId: hId, familyId: dbId, type: 'spouse', role: 'husband' }
                    });
                    console.log(`[GedcomManager]: Linked husband ${husb.value} to family ${rec.xref}`);
                }
                if (wId) {
                    await prisma.relationship.create({
                        data: { parentId: wId, familyId: dbId, type: 'spouse', role: 'wife' }
                    });
                    console.log(`[GedcomManager]: Linked wife ${wife.value} to family ${rec.xref}`);
                }

                // Spouse-spouse direct link (no familyId) for some tree layouts
                if (hId && wId) {
                    await prisma.relationship.upsert({
                        where: { childId_parentId_type: { childId: wId, parentId: hId, type: 'spouse' } },
                        update: {},
                        create: { childId: wId, parentId: hId, type: 'spouse' }
                    });
                }

                for (const childRec of children) {
                    const cId = childRec.value && gedIdToDbId[childRec.value];
                    if (cId) {
                        // Link child to family record
                        await prisma.relationship.create({
                            data: { childId: cId, familyId: dbId, type: 'parent', role: 'child' }
                        });
                        console.log(`[GedcomManager]: Linked child ${childRec.value} to family ${rec.xref}`);

                        // Direct parent-child links for easier traversal/rendering
                        if (hId) {
                            await prisma.relationship.upsert({
                                where: { childId_parentId_type: { childId: cId, parentId: hId, type: 'parent' } },
                                update: {},
                                create: { childId: cId, parentId: hId, type: 'parent' }
                            });
                        }
                        if (wId) {
                            await prisma.relationship.upsert({
                                where: { childId_parentId_type: { childId: cId, parentId: wId, type: 'parent' } },
                                update: {},
                                create: { childId: cId, parentId: wId, type: 'parent' }
                            });
                        }
                    }
                }
            }
        }


        console.log(`[GedcomManager]: Import completed. Records parsed: ${treeRecords.length}`);
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
            const fname = (m.url?.includes('/uploads/') ? m.url.split('/uploads/').pop() : null);
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
                            media: { include: { media: true } }
                        }
                    },
                    facts: {
                        include: {
                            media: { include: { media: true } }
                        }
                    },
                    sources: { include: { source: true } },
                    mediaLinks: { include: { media: true } },
                    noteLinks: { include: { note: true } },
                    parentRelationships: { include: { family: true } },
                    childRelationships: { include: { family: true } }
                }
            },
            families: {
                include: {
                    events: { include: { place: true } },
                    relationships: {
                        include: {
                            parent: true,
                            child: true
                        }
                    },
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
                        { value: { contains: q as string, mode: 'insensitive' } }
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

    // Legacy support: if we receive husbands/wifes/children, we create relationships
    if (data.husband && data.wife) {
        const h = await prisma.person.findUnique({ where: { treeId_gedcomId: { treeId: tree.id, gedcomId: data.husband } } });
        const w = await prisma.person.findUnique({ where: { treeId_gedcomId: { treeId: tree.id, gedcomId: data.wife } } });
        if (h && w) {
            await prisma.relationship.upsert({
                where: { childId_parentId_type: { childId: h.id, parentId: w.id, type: 'spouse' } },
                update: {},
                create: { childId: h.id, parentId: w.id, type: 'spouse' }
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
        orderBy: { name: 'asc' }
    });

    res.json({
        success: true, places: places.map(p => ({
            name: p.name,
            latitude: p.latitude,
            longitude: p.longitude
        }))
    });
});

app.post('/api/tree/:tree/place', async (req, res) => {
    const { tree: treeName } = req.params;
    const { name, old_name, latitude, longitude, mode } = req.body;

    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false });

    try {
        if (mode === 'delete' && name) {
            const placeToDelete = await prisma.place.findUnique({
                where: { treeId_name: { treeId: tree.id, name: name } }
            });
            if (placeToDelete) {
                await prisma.place.delete({ where: { id: placeToDelete.id } });
            }
            return res.json({ success: true });
        }

        const lat = (latitude !== undefined && latitude !== '') ? parseFloat(latitude) : null;
        const lng = (longitude !== undefined && longitude !== '') ? parseFloat(longitude) : null;

        if (old_name && old_name !== name) {
            await prisma.place.update({
                where: { treeId_name: { treeId: tree.id, name: old_name } },
                data: {
                    name: name,
                    latitude: lat,
                    longitude: lng
                }
            });
        } else {
            await prisma.place.upsert({
                where: { treeId_name: { treeId: tree.id, name: name } },
                update: {
                    latitude: lat,
                    longitude: lng
                },
                create: {
                    treeId: tree.id,
                    name: name,
                    latitude: lat,
                    longitude: lng
                }
            });
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
        const content = fs.readFileSync(req.file.path, 'utf-8');
        await GedcomManager.importGedcom(prisma, tree.id, content);
        fs.unlinkSync(req.file.path);
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
            if (m.url?.includes('/uploads/')) {
                const parts = m.url.split('/uploads/');
                return parts[parts.length - 1];
            }
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

        res.json({ success: true, media: validMedia });
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
        const existing = await prisma.media.findFirst({
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

        const media = await prisma.media.create({
            data: {
                treeId,
                sha256: hash,
                title: title || file.originalname,
                originalFileName: file.originalname,
                url: `/uploads/${finalFilename}`,
                format: finalMimeType
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
        const { title } = req.body;
        const media = await prisma.media.update({
            where: { id: req.params.id },
            data: { title }
        });
        res.json({ success: true, media });
    } catch (error: any) {
        console.error('Update media error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/media/:id/link', async (req, res) => {
    try {
        const { personId, familyId, sourceId, isPrimary } = req.body;
        const mediaId = req.params.id;

        const link = await prisma.mediaLink.create({
            data: {
                mediaId,
                personId: personId || null,
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
        const media = await prisma.media.findUnique({ where: { id: req.params.id } });
        if (!media) return res.status(404).json({ success: false, message: 'Media not found' });

        // Delete file logic (mirrors pruning)
        const fname = (media.url?.includes('/uploads/') ? media.url.split('/uploads/').pop() : null);
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
