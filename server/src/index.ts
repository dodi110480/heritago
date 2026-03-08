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
import { GedcomImportEngine } from './import-phases/GedcomImportEngine.service';

const execAsync = promisify(exec);

dotenv.config();

const app = express();

// --- STORAGE CONFIGURATION ---
let STORAGE_ROOT = '/var/heri/media';
try {
    if (!fs.existsSync(STORAGE_ROOT)) {
        fs.mkdirSync(STORAGE_ROOT, { recursive: true });
    }
} catch (e) {
    console.warn(`[server]: Could not use /var/heri/media (permission denied). Using local fallback.`);
    STORAGE_ROOT = path.join(__dirname, '../media-storage');
}

const USERS_DIR = path.join(STORAGE_ROOT, 'users');
const MEDIA_ROOT = path.join(STORAGE_ROOT, 'uploads');
const TEMP_DIR = path.join(STORAGE_ROOT, 'temp');

// Ensure root directories exist
[STORAGE_ROOT, USERS_DIR, MEDIA_ROOT, TEMP_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[server]: Created directory ${dir}`);
    }
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, MEDIA_ROOT);
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

export class MediaService {
    static formatUserId(userId: string | number): string {
        if (typeof userId === 'string' && userId.includes('-')) {
            // It's a UUID, just use it safely
            return userId.replace(/[^a-zA-Z0-9-]/g, '');
        }
        const id = typeof userId === 'number' ? userId : parseInt(userId, 10);
        return isNaN(id) ? String(userId).replace(/[^a-zA-Z0-9-]/g, '') : id.toString().padStart(8, '0');
    }

    static async validateImage(file: Express.Multer.File): Promise<{ width: number; height: number }> {
        const metadata = await sharp(file.path).metadata();
        if (!metadata.width || !metadata.height) {
            throw new Error('pixel_limit_exceeded');
        }
        if (metadata.width * metadata.height > 40000000) {
            throw new Error('pixel_limit_exceeded');
        }
        return { width: metadata.width, height: metadata.height };
    }

    static async stripExifAndSave(inputPath: string, outputPath: string): Promise<void> {
        await sharp(inputPath)
            .withMetadata({
                exif: {
                    IFD0: {
                        Software: 'Heritago',
                        ImageUniqueID: path.basename(outputPath, path.extname(outputPath))
                    }
                }
            })
            .toFile(outputPath);
    }

    static async generateVariants(mediaId: string): Promise<void> {
        const media = await prisma.media.findUnique({ where: { id: mediaId } });
        if (!media || !media.path) return;

        const originalPath = path.join(STORAGE_ROOT, media.path);
        const userDir = path.dirname(path.dirname(path.dirname(originalPath))); // ../../../
        const thumbsDir = path.join(userDir, 'thumbs');
        const mediumDir = path.join(userDir, 'medium');

        [thumbsDir, mediumDir].forEach(dir => {
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        });

        const ext = '.webp';
        const uuid = path.basename(media.path, path.extname(media.path));
        const thumbPath = path.join(thumbsDir, `${uuid}${ext}`);
        const mediumPath = path.join(mediumDir, `${uuid}${ext}`);

        let image = sharp(originalPath);
        if (media.cropX !== null && media.cropY !== null && media.cropWidth !== null && media.cropHeight !== null) {
            image = image.extract({ left: media.cropX, top: media.cropY, width: media.cropWidth, height: media.cropHeight });
        }

        // Generate Thumb
        await image.clone().resize(200, 200, { fit: 'cover' }).webp().toFile(thumbPath);
        // Generate Medium
        await image.clone().resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).webp().toFile(mediumPath);

        // Update Media Variants in DB
        await prisma.mediaVariant.deleteMany({ where: { mediaId } });
        await prisma.mediaVariant.createMany({
            data: [
                { mediaId, variant: 'thumbs', path: path.relative(STORAGE_ROOT, thumbPath), mimeType: 'image/webp' },
                { mediaId, variant: 'medium', path: path.relative(STORAGE_ROOT, mediumPath), mimeType: 'image/webp' }
            ]
        });
        console.log(`[server]: Variants generated for media ${mediaId} (Crop: ${media.cropX}, ${media.cropY}, ${media.cropWidth}x${media.cropHeight})`);
    }
}

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl) 
        // or any origin for local development
        callback(null, true);
    },
    credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(MEDIA_ROOT));

// --- Helper: Auth & User Seed ---
async function ensureDefaultUser() {
    const dodi = await prisma.user.findUnique({ where: { username: 'Dodi' } });
    if (!dodi) {
        await prisma.user.create({
            data: {
                username: 'Dodi',
                email: 'admin@heritago.de',
                password: 'heritago123', // In production, use hashing!
                globalRole: 'ADMIN',
                isEmailVerified: true
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
                email: user.email,
                isAdmin: user.globalRole === 'ADMIN'
            }
        });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ success: false, message: 'Alle Felder müssen ausgefüllt sein.' });
    }

    try {
        const existingUser = await prisma.user.findFirst({
            where: { OR: [{ username }, { email }] }
        });

        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Benutzername oder Email bereits vergeben.' });
        }

        const user = await prisma.user.create({
            data: {
                username,
                email,
                password, // In production, hash this!
                globalRole: 'USER'
            }
        });

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                isAdmin: false
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Serverfehler bei der Registrierung.' });
    }
});

// Admin User Management
app.get('/api/admin/users', async (req, res) => {
    // Basic auth check should be here, but for now we list all
    try {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                username: true,
                email: true,
                globalRole: true,
                createdAt: true,
                _count: {
                    select: { permissions: { where: { level: 'OWNER' } } }
                }
            }
        });
        res.json({ success: true, users });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Fehler beim Laden der Benutzer.' });
    }
});

app.delete('/api/admin/users/:id', async (req, res) => {
    try {
        await prisma.user.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ success: false, message: 'Benutzer konnte nicht gelöscht werden.' });
    }
});

app.patch('/api/admin/users/:id/role', async (req, res) => {
    const { role } = req.body;
    try {
        await prisma.user.update({
            where: { id: req.params.id },
            data: { globalRole: role }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ success: false, message: 'Rolle konnte nicht aktualisiert werden.' });
    }
});
// This will eventually handle the validation logic from the /rules folder
export class GedcomManager {
    static isGedcomXref(id?: string | null): boolean {
        if (!id) return false;
        return /^@[^@\s]+@$/.test(id.trim());
    }

    static async processSharedNotes(tx: any, treeId: string, notes: any[], entityLinks: any, currentUserId?: string) {
        if (!notes || !Array.isArray(notes)) return;

        try {
            console.log('[API] processSharedNotes called', { treeId, entityLinks, notesCount: Array.isArray(notes) ? notes.length : 0, currentUserId });
        } catch (e) {
            // ignore logging errors
        }

        // Clean existing note links for this entity (except for events/facts which are usually recreated)
        if (entityLinks.personId && !entityLinks.eventId && !entityLinks.factId) {
            await tx.noteLink.deleteMany({ where: { treeId, personId: entityLinks.personId, eventId: null, factId: null } });
        } else if (entityLinks.familyId && !entityLinks.eventId) {
            await tx.noteLink.deleteMany({ where: { treeId, familyId: entityLinks.familyId, eventId: null } });
        } else if (entityLinks.sourceId) {
            await tx.noteLink.deleteMany({ where: { treeId, sourceId: entityLinks.sourceId } });
        } else if (entityLinks.placeId) {
            await tx.noteLink.deleteMany({ where: { treeId, placeId: entityLinks.placeId } });
        }

        for (const noteData of notes) {
            const isString = typeof noteData === 'string';
            const noteText = isString ? noteData : (noteData?.text || '');
            if (!noteText.trim()) continue;

            const noteType = isString ? 'OTHER' : (noteData?.noteType || 'OTHER');
            const pLevel: 'PRIVATE' | 'PUBLIC' = (!isString && (noteData?.isPrivate || noteData?.privacyLevel === 'PRIVATE')) ? 'PRIVATE' : 'PUBLIC';
            
            let note;
            // Attempt to update by ID if available
            if (!isString && noteData?.id && !noteData.id.startsWith('note-')) {
                note = await tx.sharedNote.findUnique({ where: { id: noteData.id } });
                if (note) {
                    note = await tx.sharedNote.update({
                        where: { id: note.id },
                        data: { 
                            text: noteText, 
                            noteType, 
                            privacyLevel: pLevel,
                            updatedAt: new Date()
                        }
                    });
                }
            }

            if (!note) {
                note = await tx.sharedNote.create({
                    data: {
                        treeId,
                        text: noteText,
                        noteType,
                        privacyLevel: pLevel,
                        userId: currentUserId || null
                    }
                });
            }

            try {
                console.log('[API] processSharedNotes - created/updated note summary', {
                    noteId: note?.id || null,
                    isString,
                    textPreview: String(noteText).slice(0, 200),
                    noteType,
                    privacyLevel: pLevel
                });
            } catch (e) {}

            await tx.noteLink.create({
                data: {
                    treeId,
                    ...entityLinks,
                    noteId: note.id
                }
            });
        }
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

    static async createPerson(prisma: PrismaClient, treeId: string, data: any, currentUserId?: string) {
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

                if (e.notes) await this.processSharedNotes(prisma, treeId, e.notes, { eventId: createdEvent.id }, currentUserId);

                if (e.media && Array.isArray(e.media)) {
                    for (const med of e.media) {
                        const mediaObj = await this.ensureMediaObject(prisma, treeId, med);
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
                if (f.notes) await this.processSharedNotes(prisma, treeId, f.notes, { factId: createdFact.id }, currentUserId);
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
            console.log("Saving media objects for person: ", JSON.stringify(data.media, null, 2));
            for (const med of data.media) {
                const mediaObj = await this.ensureMediaObject(prisma, treeId, med);
                if (mediaObj) {
                    console.log(`Creating MediaLink for ${mediaObj.id} with role: ${med.role}, caption: ${med.caption}`);
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
        if (data.notes) await this.processSharedNotes(prisma, treeId, data.notes, { personId: person.id }, currentUserId);

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

                    if (e.notes) await this.processSharedNotes(tx, treeId, e.notes, { eventId: createdEvent.id }, currentUserId);

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
            if (data.notes) await this.processSharedNotes(tx, treeId, data.notes, { familyId: family.id }, currentUserId);

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
    const { name, title, firstName, lastName, gender, birthDate, userId } = req.body;
    
    try {
        // Enforce one tree limit for non-admins
        if (userId) {
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (user && user.globalRole !== 'ADMIN') {
                const ownerCount = await prisma.treePermission.count({
                    where: { userId, level: 'OWNER' }
                });
                if (ownerCount >= 1) {
                    return res.status(400).json({ success: false, message: 'Du kannst nur einen Stammbaum besitzen.' });
                }
            }
        }

        const tree = await prisma.tree.create({ data: { name, title } });

        // If userId is provided, create OWNER permission
        if (userId) {
            await prisma.treePermission.create({
                data: {
                    treeId: tree.id,
                    userId,
                    level: 'OWNER'
                }
            });
        }

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
            const fname = m.path;
            if (fname) {
                const baseDir = fname.startsWith('users/') ? STORAGE_ROOT : MEDIA_ROOT;
                const fullPath = path.join(baseDir, fname);
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
                            mediaLinks: { include: { media: true } },
                            noteLinks: { include: { note: true } },
                            citations: { include: { source: true } },
                            associations: { include: { associated: { include: { names: { where: { isPrimary: true } } } } } }
                        }
                    },
                    facts: {
                        include: {
                            place: true,
                            noteLinks: { include: { note: true } },
                            citations: { include: { source: true } },
                            associations: { include: { associated: { include: { names: { where: { isPrimary: true } } } } } }
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
                    events: {
                        include: {
                            place: true,
                            mediaLinks: { include: { media: true } },
                            noteLinks: { include: { note: true } },
                            citations: { include: { source: true } },
                            associations: { include: { associated: { include: { names: { where: { isPrimary: true } } } } } }
                        }
                    },
                    familyMembers: { include: { person: true } },
                    mediaLinks: { include: { media: true } },
                    noteLinks: { include: { note: true } }
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

app.get('/api/tree/:tree/changelog', async (req, res) => {
    const { tree: treeName } = req.params;
    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false });

    const logs = await prisma.changeLog.findMany({
        where: { treeId: tree.id },
        include: { user: { select: { username: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50
    });

    res.json({ success: true, logs });
});

app.post('/api/tree/:tree/person', async (req, res) => {
    const { tree: treeName } = req.params;
    const { mode, id } = req.body;

    try {
        console.log('[API] POST /api/tree/%s/person called', treeName, {
            mode: mode || null,
            id: id || null,
            notesCount: Array.isArray(req.body?.notes) ? req.body.notes.length : 0,
            eventsNotes: Array.isArray(req.body?.events) ? req.body.events.map((e: any) => Array.isArray(e.notes) ? e.notes.length : 0) : []
        });
    } catch (e) {
        // ignore logging errors
    }
    try {
        const events = Array.isArray(req.body?.events) ? req.body.events : [];
        const eventsSummary = events.map((e: any, i: number) => ({
            idx: i,
            id: e?.id || null,
            type: e?.type || null,
            description: e?.description ? String(e.description).slice(0, 200) : null,
            notesCount: Array.isArray(e?.notes) ? e.notes.length : 0,
            notesPreview: (Array.isArray(e?.notes) ? e.notes : []).map((n: any) => (typeof n === 'string' ? String(n).slice(0,120) : String(n?.text || '').slice(0,120)))
        }));
        console.log('[API] incoming events summary:', JSON.stringify(eventsSummary, null, 2));
        if (Array.isArray(req.body?.notes)) {
            const topNotes = req.body.notes.slice(0,10).map((n: any) => (typeof n === 'string' ? String(n).slice(0,200) : { id: n?.id || null, text: String(n?.text || '').slice(0,200) }));
            console.log('[API] top-level notes preview (first 10):', JSON.stringify(topNotes, null, 2));
        }
    } catch (e) {
        // ignore
    }

    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false });

    if (mode === 'delete' && id) {
        const personToDelete = await prisma.person.findUnique({
            where: { treeId_gedcomId: { treeId: tree.id, gedcomId: id } }
        });

        if (personToDelete) {
            await prisma.person.delete({ where: { id: personToDelete.id } });
            await prisma.changeLog.create({
                data: {
                    treeId: tree.id,
                    action: 'DELETE',
                    entityType: 'PERSON',
                    entityId: personToDelete.id,
                    before: personToDelete as any,
                    summary: `Person ${id} gelöscht`
                }
            });
        }
        return res.json({ success: true });
    }

    // Für CREATE / UPDATE den alten Stand holen
    let beforeState = null;
    let action: 'CREATE' | 'UPDATE' = 'CREATE';
    if (id) {
        const existing = await prisma.person.findUnique({
            where: { treeId_gedcomId: { treeId: tree.id, gedcomId: id } },
            include: { names: true, events: true, facts: true }
        });
        if (existing) {
            beforeState = existing;
            action = 'UPDATE';
        }
    }

    const userId = req.body?.userId || (req as any).user?.id;
    const record = await GedcomManager.createPerson(prisma, tree.id, { ...req.body, currentUserId: userId });

    // Nach dem Speichern den neuen Stand für das Log holen
    const afterState = await prisma.person.findUnique({
        where: { id: record.id },
        include: { 
            names: true, 
            events: { include: { place: true, mediaLinks: { include: { media: true } }, citations: { include: { source: true } }, associations: { include: { associated: { include: { names: { where: { isPrimary: true } } } } } } } }, 
            facts: { include: { place: true, citations: { include: { source: true } }, associations: { include: { associated: { include: { names: { where: { isPrimary: true } } } } } } } } 
        }
    });

    await prisma.changeLog.create({
        data: {
            treeId: tree.id,
            action: action,
            entityType: 'PERSON',
            entityId: record.id,
            before: beforeState as any,
            after: afterState as any,
            summary: `Person ${req.body?.firstName || ''} ${req.body?.lastName || ''} ${action === 'CREATE' ? 'erstellt' : 'aktualisiert'}`.trim()
        }
    });

    res.json({ success: true, person: record });
});

app.delete('/api/tree/:tree/person/:id', async (req, res) => {
    try {
        const { id, tree: treeName } = req.params;
        const tree = await prisma.tree.findUnique({ where: { name: treeName } });

        const personToDelete = await prisma.person.findUnique({ where: { id } });
        if (personToDelete) {
            await prisma.changeLog.create({
                data: {
                    treeId: tree?.id || personToDelete.treeId,
                    action: 'DELETE',
                    entityType: 'PERSON',
                    entityId: id,
                    before: personToDelete as any,
                    summary: `Person ${personToDelete.gedcomId} gelöscht`
                }
            });
        }

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
    const { tree: treeName } = req.params;
    const data = req.body;

    try {
        const tree = await prisma.tree.findUnique({ where: { name: treeName } });
        if (!tree) return res.status(404).json({ success: false, message: 'Tree not found' });

        let beforeState = null;
        if (data.id) {
            beforeState = await prisma.family.findUnique({
                where: { treeId_gedcomId: { treeId: tree.id, gedcomId: data.id } },
                include: { familyMembers: { include: { person: { include: { names: true } } } }, events: true, noteLinks: { include: { note: true } } }
            });
        }

        const userId = req.body?.userId || (req as any).user?.id;
    const result = await GedcomManager.saveFamily(prisma, tree.id, { ...data, currentUserId: userId }, userId);

        if (result && !('deleted' in result)) {
            const familyAfter = await prisma.family.findUnique({
                where: { id: result.id },
                include: { 
                    familyMembers: { include: { person: { include: { names: true } } } }, 
                    events: { include: { place: true, mediaLinks: { include: { media: true } }, noteLinks: { include: { note: { include: { createdBy: { select: { id: true, username: true } } } } } }, citations: { include: { source: true } }, associations: { include: { associated: { include: { names: { where: { isPrimary: true } } } } } } } }, 
                    noteLinks: { include: { note: { include: { createdBy: { select: { id: true, username: true } } } } } } 
                }
            });

            const action = beforeState ? 'UPDATE' : 'CREATE';
            const husband = familyAfter?.familyMembers.find(m => m.role === 'SPOUSE' && m.person.sex === 'M')?.person;
            const wife = familyAfter?.familyMembers.find(m => m.role === 'SPOUSE' && m.person.sex === 'F')?.person;

            const hName = husband ? (husband.names[0]?.surname || husband.gedcomId) : '?';
            const wName = wife ? (wife.names[0]?.surname || wife.gedcomId) : '?';

            await prisma.changeLog.create({
                data: {
                    treeId: tree.id,
                    action: action,
                    entityType: 'FAMILY',
                    entityId: result.id,
                    before: beforeState as any,
                    after: familyAfter as any,
                    summary: `Familie ${hName} / ${wName} ${action === 'CREATE' ? 'erstellt' : 'aktualisiert'}`
                }
            });
        } else if (result && 'deleted' in result && beforeState) {
            await prisma.changeLog.create({
                data: {
                    treeId: tree.id,
                    action: 'DELETE',
                    entityType: 'FAMILY',
                    entityId: (beforeState as any).id,
                    before: beforeState as any,
                    summary: `Familie ${(beforeState as any).gedcomId} gelöscht`
                }
            });
        }

        res.json({ success: true, family: result });
    } catch (error: any) {
        console.error('Save family error:', error);
        const message = error?.message || 'Failed to save family';
        const isValidationError =
            message.includes('cannot be the same person') ||
            message.includes('cannot be added as child') ||
            message.includes('Referenced person(s) not found') ||
            message.includes('Family ID is required') ||
            message.includes('Family ID must use GEDCOM format');
        res.status(isValidationError ? 400 : 500).json({ success: false, message });
    }
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

app.get('/api/tree/:tree/place/:id', async (req, res) => {
    const { tree: treeName, id } = req.params;
    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false });

    const place = await prisma.place.findUnique({
        where: { id, treeId: tree.id },
        include: {
            parent: { select: { id: true, name: true } },
            translations: true,
            identifiers: true,
            noteLinks: {
                include: {
                    note: {
                        include: {
                            createdBy: { select: { id: true, username: true } }
                        }
                    }
                }
            }
        }
    });

    if (!place) return res.status(404).json({ success: false, message: 'Place not found' });

    res.json({
        success: true,
        place: {
            ...place,
                notes: (place.noteLinks || []).map((nl: any) => ({
                id: nl.note.id,
                text: nl.note.text,
                noteType: nl.note.noteType,
                privacyLevel: nl.note.privacyLevel,
                createdAt: nl.note.createdAt,
                updatedAt: nl.note.updatedAt,
                createdBy: nl.note.createdBy ? {
                    id: nl.note.createdBy.id,
                    username: nl.note.createdBy.username
                } : null
            }))
        }
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

    await prisma.changeLog.create({
        data: {
            treeId: tree.id,
            action: 'UPDATE',
            entityType: 'PLACE',
            entityId: target.id,
            summary: `Ort ${source.name} in ${target.name} zusammengeführt`
        }
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
        reassignToId,
        // Neue Felder
        form,
        phrase,
        level,
        lang,
        formTemplate,
        translations,
        identifiers,
        notes
    } = req.body;

    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false });

    const currentUserId = req.body?.userId || (req as any).user?.id;

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

                await prisma.changeLog.create({
                    data: {
                        treeId: tree.id,
                        action: 'DELETE',
                        entityType: 'PLACE',
                        entityId: placeToDelete.id,
                        before: placeToDelete as any,
                        summary: `Ort ${placeToDelete.name} gelöscht`
                    }
                });
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

        let beforeState = null;
        let action: 'CREATE' | 'UPDATE' = 'CREATE';
        let targetPlaceId: string | null = null;

        if (id) {
            beforeState = await prisma.place.findFirst({ where: { id, treeId: tree.id } });
            if (!beforeState) {
                return res.status(404).json({ success: false, message: 'Place not found.' });
            }
            const p = await prisma.place.update({
                where: { id: beforeState.id },
                data: {
                    name: name,
                    latitude: lat,
                    longitude: lng,
                    jurisdiction: jurisdiction || null,
                    historicNames: normalizedHistoricNames,
                    parentId: normalizedParentId,
                    form: form || null,
                    phrase: phrase || null,
                    level: level || 'CITY',
                    lang: lang || null,
                    formTemplate: formTemplate || null
                }
            });
            targetPlaceId = p.id;
            action = 'UPDATE';
        } else if (old_name && old_name !== name) {
            beforeState = await prisma.place.findFirst({
                where: { treeId: tree.id, name: old_name, parentId: null }
            });
            if (beforeState) {
                const p = await prisma.place.update({
                    where: { id: beforeState.id },
                    data: {
                        name: name,
                        latitude: lat,
                        longitude: lng,
                        jurisdiction: jurisdiction || null,
                        historicNames: normalizedHistoricNames,
                        form: form || null,
                        phrase: phrase || null,
                        level: level || 'CITY',
                        lang: lang || null,
                        formTemplate: formTemplate || null
                    }
                });
                targetPlaceId = p.id;
                action = 'UPDATE';
            }
        } else {
            const existingPlace = await prisma.place.findFirst({
                where: { treeId: tree.id, name: name, parentId: normalizedParentId }
            });
            if (existingPlace) {
                beforeState = existingPlace;
                const p = await prisma.place.update({
                    where: { id: existingPlace.id },
                    data: {
                        latitude: lat,
                        longitude: lng,
                        jurisdiction: jurisdiction || null,
                        historicNames: normalizedHistoricNames,
                        form: form || null,
                        phrase: phrase || null,
                        level: level || 'CITY',
                        lang: lang || null,
                        formTemplate: formTemplate || null
                    }
                });
                targetPlaceId = p.id;
                action = 'UPDATE';
            } else {
                const p = await prisma.place.create({
                    data: {
                        treeId: tree.id,
                        name: name,
                        historicNames: normalizedHistoricNames,
                        jurisdiction: jurisdiction || null,
                        parentId: normalizedParentId,
                        latitude: lat,
                        longitude: lng,
                        form: form || null,
                        phrase: phrase || null,
                        level: level || 'CITY',
                        lang: lang || null,
                        formTemplate: formTemplate || null
                    }
                });
                targetPlaceId = p.id;
                action = 'CREATE';
            }
        }
        if (targetPlaceId) {
            // Relations synchronisieren
            if (translations && Array.isArray(translations)) {
                await prisma.placeTranslation.deleteMany({ where: { placeId: targetPlaceId } });
                for (const tr of translations) {
                    if (!tr.name) continue;
                    await prisma.placeTranslation.create({
                        data: {
                            placeId: targetPlaceId,
                            name: tr.name,
                            lang: tr.lang || '',
                            form: tr.form || null,
                            dateStart: tr.dateStart ? new Date(tr.dateStart) : null,
                            dateEnd: tr.dateEnd ? new Date(tr.dateEnd) : null,
                            dateType: tr.dateType || 'EXACT'
                        }
                    });
                }
            }

            if (identifiers && Array.isArray(identifiers)) {
                await prisma.identifier.deleteMany({ where: { placeId: targetPlaceId } });
                for (const iden of identifiers) {
                    if (!iden.value) continue;
                    await prisma.identifier.create({
                        data: {
                            treeId: tree.id,
                            placeId: targetPlaceId, // Direkte Relation nutzen wenn möglich
                            entityType: 'PLACE',
                            entityId: targetPlaceId,
                            value: iden.value,
                            type: iden.type || 'OTHER'
                        }
                    });
                }
            }

            if (notes && Array.isArray(notes)) {
                await prisma.noteLink.deleteMany({ where: { placeId: targetPlaceId } });
                for (const noteData of notes) {
                    const isString = typeof noteData === 'string';
                    const noteText = isString ? noteData : (noteData?.text || '');
                    if (!noteText.trim()) continue;

                    const noteType = isString ? 'OTHER' : (noteData?.noteType || 'OTHER');
                    const pLevel = (!isString && noteData?.isPrivate) ? 'PRIVATE' : 'PUBLIC';
                    
                    let note;
                    if (!isString && noteData?.id && !noteData.id.startsWith('note-')) {
                        note = await prisma.sharedNote.findUnique({ where: { id: noteData.id } });
                        if (note) {
                            note = await prisma.sharedNote.update({
                                where: { id: note.id },
                                data: { text: noteText, noteType, privacyLevel: pLevel as any }
                            });
                        }
                    }
                    
                    if (!note) {
                        note = await prisma.sharedNote.create({
                            data: {
                                treeId: tree.id,
                                text: noteText,
                                noteType,
                                privacyLevel: pLevel as any,
                                userId: currentUserId || null
                            }
                        });
                    }
                    
                    await prisma.noteLink.create({
                        data: {
                            treeId: tree.id,
                            placeId: targetPlaceId,
                            noteId: note.id
                        }
                    });
                }
            }
        }

        if (targetPlaceId) {
            const afterState = await prisma.place.findUnique({ where: { id: targetPlaceId } });
            await prisma.changeLog.create({
                data: {
                    treeId: tree.id,
                    action: action,
                    entityType: 'PLACE',
                    entityId: targetPlaceId,
                    before: beforeState as any,
                    after: afterState as any,
                    summary: `Ort ${name} ${action === 'CREATE' ? 'erstellt' : 'aktualisiert'}`
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

app.get('/api/tree/:tree/source', async (req, res) => {
    const { tree: treeName } = req.params;
    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false });

    const sources = await prisma.source.findMany({
        where: { treeId: tree.id },
        include: {
            repository: { select: { id: true, name: true } },
            _count: { select: { citations: true, mediaLinks: true, noteLinks: true } }
        },
        orderBy: { title: 'asc' }
    });

    res.json({
        success: true,
        sources: sources.map(s => ({
            id: s.id,
            title: s.title,
            shortTitle: s.shortTitle,
            author: s.author,
            publication: s.publication,
            repositoryId: s.repositoryId,
            repositoryName: s.repository?.name || null,
            usageCount: s._count.citations + s._count.mediaLinks + s._count.noteLinks
        }))
    });
});

app.get('/api/tree/:tree/source/:id', async (req, res) => {
    const { tree: treeName, id } = req.params;
    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false });

    const source = await prisma.source.findFirst({
        where: { id, treeId: tree.id },
        include: {
            repository: { select: { id: true, name: true } },
            noteLinks: {
                include: {
                    note: {
                        include: {
                            createdBy: { select: { id: true, username: true } }
                        }
                    }
                }
            }
        }
    });

    if (!source) return res.status(404).json({ success: false, message: 'Source not found' });

    res.json({
        success: true,
        source: {
            ...source,
            notes: (source.noteLinks || []).map((nl: any) => ({
                id: nl.note.id,
                text: nl.note.text,
                noteType: nl.note.noteType,
                privacyLevel: nl.note.privacyLevel,
                createdAt: nl.note.createdAt,
                updatedAt: nl.note.updatedAt,
                createdBy: nl.note.createdBy ? {
                    id: nl.note.createdBy.id,
                    username: nl.note.createdBy.username
                } : null
            }))
        }
    });
});

app.get('/api/tree/:tree/source/:id/usage', async (req, res) => {
    const { tree: treeName, id } = req.params;
    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false, message: 'Tree not found' });

    const source = await prisma.source.findFirst({ where: { id, treeId: tree.id } });
    if (!source) return res.status(404).json({ success: false, message: 'Source not found' });

    const citations = await prisma.citation.findMany({
        where: { sourceId: id },
        include: {
            person: { include: { names: { where: { isPrimary: true }, take: 1 } } },
            family: true,
            event: { include: { person: { include: { names: { where: { isPrimary: true }, take: 1 } } }, family: true } },
            fact: { include: { person: { include: { names: { where: { isPrimary: true }, take: 1 } } }, family: true } },
            media: true,
            note: true,
            association: { include: { person: { include: { names: { where: { isPrimary: true }, take: 1 } } } } }
        },
        orderBy: { dateText: 'desc' }
    });

    const personLabel = (p: any) =>
        p ? `${p.names?.[0]?.given || ''} ${p.names?.[0]?.surname || ''}`.trim() || p.gedcomId || p.id : null;

    res.json({
        success: true,
        usage: {
            citations: citations.map(c => {
                let context = 'Unknown';
                let contextLabel = 'Unknown';
                let entityId = null;
                let entityType = null;

                if (c.person) { 
                    context = 'Person'; 
                    contextLabel = personLabel(c.person); 
                    entityId = c.person.id;
                    entityType = 'person';
                }
                else if (c.family) { 
                    context = 'Family'; 
                    contextLabel = c.family.gedcomId || c.family.id; 
                    entityId = c.family.id;
                    entityType = 'family';
                }
                else if (c.event) { 
                    context = `Event (${c.event.type})`; 
                    contextLabel = personLabel(c.event.person) || c.event.family?.gedcomId || 'Unknown'; 
                    entityId = c.event.personId || c.event.familyId || null;
                    entityType = c.event.personId ? 'person' : (c.event.familyId ? 'family' : null);
                }
                else if (c.fact) { 
                    context = `Fact (${c.fact.type})`; 
                    contextLabel = personLabel(c.fact.person) || c.fact.family?.gedcomId || 'Unknown'; 
                    entityId = c.fact.personId || c.fact.familyId || null;
                    entityType = c.fact.personId ? 'person' : (c.fact.familyId ? 'family' : null);
                }
                else if (c.media) { 
                    context = 'Media'; 
                    contextLabel = c.media.title || c.media.path || c.media.id; 
                    entityId = c.media.id;
                    entityType = 'media';
                }
                else if (c.note) { 
                    context = 'Note'; 
                    contextLabel = c.note.text.substring(0, 30) + '...'; 
                    entityId = c.note.id;
                    entityType = 'note';
                }
                else if (c.association) { 
                    context = `Association (${c.association.role})`; 
                    contextLabel = personLabel(c.association.person); 
                    entityId = c.association.personId;
                    entityType = 'person';
                }

                return {
                    id: c.id,
                    context,
                    contextLabel,
                    entityId,
                    entityType,
                    page: c.page,
                    dateText: c.dateText,
                    confidence: c.confidence
                };
            }),
            totalLinks: citations.length
        }
    });
});

app.post('/api/tree/:tree/source/merge', async (req, res) => {
    const { tree: treeName } = req.params;
    const { sourceId, targetId } = req.body;
    if (!sourceId || !targetId || sourceId === targetId) {
        return res.status(400).json({ success: false, message: 'sourceId and targetId required and must differ' });
    }

    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false, message: 'Tree not found' });

    const [source, target] = await Promise.all([
        prisma.source.findFirst({ where: { id: sourceId, treeId: tree.id } }),
        prisma.source.findFirst({ where: { id: targetId, treeId: tree.id } })
    ]);
    if (!source || !target) return res.status(404).json({ success: false, message: 'Source or target not found' });

    await prisma.$transaction(async (tx) => {
        await tx.citation.updateMany({ where: { sourceId: source.id }, data: { sourceId: target.id } });
        await tx.noteLink.updateMany({ where: { sourceId: source.id }, data: { sourceId: target.id } });
        await tx.mediaLink.updateMany({ where: { sourceId: source.id }, data: { sourceId: target.id } });
        await tx.source.delete({ where: { id: source.id } });
    });

    res.json({ success: true });
});

app.post('/api/tree/:tree/source', async (req, res) => {
    const { tree: treeName } = req.params;
    const { id, title, shortTitle, author, publication, repositoryId, mode, reassignToId, notes, userId: bodyUserId } = req.body;
    const currentUserId = bodyUserId || (req as any).user?.id;

    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false });
    const treeId = tree.id;
    
    try {
        if (mode === 'delete' && id) {
            const sourceToDelete = await prisma.source.findFirst({ where: { id, treeId: tree.id } });
            if (sourceToDelete) {
                const [citationCount, mediaLinkCount, noteLinkCount] = await Promise.all([
                    prisma.citation.count({ where: { sourceId: sourceToDelete.id } }),
                    prisma.mediaLink.count({ where: { sourceId: sourceToDelete.id } }),
                    prisma.noteLink.count({ where: { sourceId: sourceToDelete.id } })
                ]);
                const totalLinks = citationCount + mediaLinkCount + noteLinkCount;

                if (totalLinks > 0 && !reassignToId) {
                    return res.status(409).json({
                        success: false,
                        message: 'Source is still in use. Provide reassignToId or merge first.',
                        usage: { citationCount, mediaLinkCount, noteLinkCount, totalLinks }
                    });
                }

                if (reassignToId) {
                    const target = await prisma.source.findFirst({ where: { id: reassignToId, treeId: tree.id } });
                    if (!target) return res.status(400).json({ success: false, message: 'Invalid reassignToId' });
                    if (target.id === sourceToDelete.id) return res.status(400).json({ success: false, message: 'reassignToId must differ from deleting source' });

                    await prisma.$transaction(async (tx) => {
                        await tx.citation.updateMany({ where: { sourceId: sourceToDelete.id }, data: { sourceId: target.id } });
                        await tx.noteLink.updateMany({ where: { sourceId: sourceToDelete.id }, data: { sourceId: target.id } });
                        await tx.mediaLink.updateMany({ where: { sourceId: sourceToDelete.id }, data: { sourceId: target.id } });
                        await tx.source.delete({ where: { id: sourceToDelete.id } });
                    });
                } else {
                    await prisma.source.delete({ where: { id: sourceToDelete.id } });
                }
            }
            return res.json({ success: true });
        }

        if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

        const data = {
            title,
            shortTitle: shortTitle || null,
            author: author || null,
            publication: publication || null,
            repositoryId: repositoryId || null
        };

        let resultSource;
        if (id) {
            const existing = await prisma.source.findFirst({ where: { id, treeId: tree.id } });
            if (!existing) return res.status(404).json({ success: false, message: 'Source not found' });
            resultSource = await prisma.source.update({ where: { id }, data });
        } else {
            resultSource = await prisma.source.create({
                data: { ...data, treeId: tree.id }
            });
        }

        // Processing Notes (Standardized)
        if (notes && Array.isArray(notes)) {
            await prisma.noteLink.deleteMany({ where: { sourceId: resultSource.id } });
            await this.processSharedNotes(prisma, tree.id, notes, { sourceId: resultSource.id }, currentUserId);
        }

        res.json({ success: true });
    } catch (error: any) {
        console.error('Source save error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- Repository API ---

app.get('/api/tree/:tree/repository', async (req, res) => {
    const { tree: treeName } = req.params;
    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false });

    const repos = await prisma.repository.findMany({
        where: { treeId: tree.id },
        include: { _count: { select: { sources: true } } },
        orderBy: { name: 'asc' }
    });

    res.json({
        success: true,
        repositories: repos.map(r => ({
            id: r.id,
            name: r.name,
            address: r.address,
            phone: r.phone,
            email: r.email,
            website: r.website,
            sourceCount: r._count.sources
        }))
    });
});

app.post('/api/tree/:tree/repository', async (req, res) => {
    const { tree: treeName } = req.params;
    const { id, name, address, phone, email, website, mode } = req.body;

    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) return res.status(404).json({ success: false });

    try {
        if (mode === 'delete' && id) {
            const repo = await prisma.repository.findFirst({ where: { id, treeId: tree.id } });
            if (repo) {
                // Unlink sources before deleting
                await prisma.source.updateMany({ where: { repositoryId: id }, data: { repositoryId: null } });
                await prisma.repository.delete({ where: { id: repo.id } });
            }
            return res.json({ success: true });
        }

        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

        const data = {
            name,
            address: address || null,
            phone: phone || null,
            email: email || null,
            website: website || null,
        };

        if (id) {
            const existing = await prisma.repository.findFirst({ where: { id, treeId: tree.id } });
            if (!existing) return res.status(404).json({ success: false, message: 'Repository not found' });
            await prisma.repository.update({ where: { id }, data });
        } else {
            await prisma.repository.create({ data: { ...data, treeId: tree.id } });
        }

        res.json({ success: true });
    } catch (error: any) {
        console.error('Repository save error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
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
        sources: await prisma.source.count({ where: { treeId: tree.id } }),
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
        const engine = new GedcomImportEngine(prisma);
        const result = await engine.runImport(tree.id, req.file.path, req.file.originalname);

        // Datei nach Import löschen
        fs.unlinkSync(req.file.path);

        res.json({ success: true, importId: result.importId });
    } catch (error: any) {
        console.error('Import error:', error);
        // Auch bei Fehler löschen
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
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

        // --- GLOBAL STATS (for the whole tree, ignoring the current filter/search) ---
        const allMediaForStats = await prisma.media.findMany({
            where: { treeId: treeId as string },
            select: { mediaType: true, mimeType: true, links: { select: { id: true } } }
        });
        const stats = {
            total: allMediaForStats.length,
            fotos: allMediaForStats.filter(m => m.mediaType === 'PHOTO' || (!m.mediaType && m.mimeType?.startsWith('image/'))).length,
            docs: allMediaForStats.filter(m => ['DOCUMENT', 'RECORD'].includes(m.mediaType as string) || (!m.mediaType && ['application/pdf', 'text/plain'].includes(m.mimeType as string))).length,
            unlinked: allMediaForStats.filter(m => !m.links || m.links.length === 0).length
        };

        if (search) {
            const searchOr = [
                { title: { contains: search as string, mode: 'insensitive' } },
                { path: { contains: search as string, mode: 'insensitive' } },
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
                },
                citations: true,
                identifiers: true,
                noteLinks: { include: { note: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        // --- Helper for filename extraction ---
        const getFileName = (m: any) => {
            if (m.path) return m.path;
            if (m.remoteUrl) {
                if (m.remoteUrl.startsWith('http')) return null;
                // If it's an absolute path, we take the basename for server lookup
                return path.basename(m.remoteUrl);
            }
            return null;
        };

        // --- Sync/Pruning Logic ---
        const validMedia = [];
        const orphanedIds: string[] = [];

        for (const item of media) {
            let fileFound = true;
            const fname = getFileName(item);

            if (fname && fname !== 'Unbenannt') {
                // Determine the correct base directory: 
                // files starting with 'users/' are relative to STORAGE_ROOT
                // others (orphans/legacy) are relative to MEDIA_ROOT
                const baseDir = (item.path && item.path.startsWith('users/')) ? STORAGE_ROOT : MEDIA_ROOT;
                const fullPath = path.join(baseDir, fname);
                // If the file does NOT exist in the uploads directory, it's a "ghost"
                // (Unless it's a remote URL, which getFileName returns null for)
                if (!fs.existsSync(fullPath)) {
                    fileFound = false;
                }
            } else if (!item.remoteUrl || item.remoteUrl === 'Unbenannt') {
                // No filename and no remote URL
                fileFound = false;
            } else if (!item.remoteUrl.startsWith('http')) {
                // It's a non-web remoteUrl that didn't yield a filename
                fileFound = false;
            }

            if (fileFound) {
                validMedia.push(item);
            } else {
                console.log(`[server]: Identified ghost media entry: ${item.id} (Filename: ${fname}, Remote: ${item.remoteUrl})`);
                orphanedIds.push(item.id);
            }
        }

        // We only delete if they are both missing AND have no links AND no custom GEDCOM ID
        // (Pruning should be very conservative for imported data)
        const deadIds = media
            .filter(m => orphanedIds.includes(m.id) && (!m.links || m.links.length === 0) && !m.gedcomId)
            .map(m => m.id);

        if (deadIds.length > 0) {
            console.log(`[server]: Pruning ${deadIds.length} dead media entries (missing file, unlinked, no GEDCOM ID)`);
            await prisma.media.deleteMany({
                where: { id: { in: deadIds } }
            });
        }

        // The remaining orphaned ones (missing but linked) are kept but flagged
        // NEW: We only keep them if they are NOT imported (gedcomId === null)
        // because imported ghosts (77 images!) are annoying the user.
        const finalMedia = validMedia.concat(
            media
                .filter(m => orphanedIds.includes(m.id) && !deadIds.includes(m.id))
                .filter(m => !m.gedcomId) // Hide imported ghosts
                .map(m => ({ ...m, fileMissing: true }))
        );

        let orphanFiles: any[] = [];
        if (type === 'UNLINKED') {
            const knownFileNames = new Set(
                validMedia
                    .map((m: any) => m.path)
                    .filter((f: any) => typeof f === 'string' && f.length > 0)
            );

            const filesOnDisk = fs.readdirSync(MEDIA_ROOT).filter((f) => {
                const full = path.join(MEDIA_ROOT, f);
                return fs.statSync(full).isFile();
            });

            orphanFiles = filesOnDisk
                .filter((f) => !knownFileNames.has(f))
                .map((f) => {
                    const full = path.join(MEDIA_ROOT, f);
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
                        path: f,
                        remoteUrl: `/uploads/${f}`,
                        mimeType,
                        mediaType,
                        filesize: Math.min(Number.MAX_SAFE_INTEGER, stats.size),
                        links: [],
                        orphanFile: true,
                        createdAt: stats.birthtime ?? stats.mtime
                    };
                });
        }
        res.json({ success: true, media: [...finalMedia, ...orphanFiles], stats });
    } catch (error: any) {
        console.error('Fetch media error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/media/adopt-orphan', async (req, res) => {
    try {
        const { treeId, path: filePath, title, mediaType } = req.body;
        if (!treeId || !filePath) {
            return res.status(400).json({ success: false, message: 'treeId and path required' });
        }
        if (filePath.includes('..') || path.isAbsolute(filePath)) {
            return res.status(400).json({ success: false, message: 'Invalid filePath' });
        }

        const fullPath = path.join(MEDIA_ROOT, filePath);
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ success: false, message: 'File not found on disk' });
        }

        const existing = await prisma.media.findFirst({
            where: { treeId, path: filePath }
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
                path: filePath,
                remoteUrl: `/uploads/${filePath}`,
                mimeType,
                filesize: Math.min(Number.MAX_SAFE_INTEGER, stats.size)
            }
        });

        res.json({ success: true, media });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/media/orphan-file', async (req, res) => {
    try {
        const { path: filePath } = req.body;
        console.log('[server]: DELETE /api/media/orphan-file request with path:', filePath);
        
        if (!filePath || typeof filePath !== 'string') {
            return res.status(400).json({ success: false, message: 'path required' });
        }
        
        if (filePath.includes('..') || path.isAbsolute(filePath)) {
            return res.status(400).json({ success: false, message: 'Invalid filePath (security)' });
        }

        const fullPath = path.join(MEDIA_ROOT, filePath);
        if (!fs.existsSync(fullPath)) {
            console.warn('[server]: File not found for orphan deletion:', fullPath);
            return res.status(404).json({ success: false, message: 'File not found on disk' });
        }

        fs.unlinkSync(fullPath);
        console.log('[server]: Successfully deleted orphan file:', filePath);
        res.json({ success: true });
    } catch (error: any) {
        console.error('[server]: Orphan file deletion error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/media/upload', upload.single('file'), async (req, res) => {
    let sessionDir = '';
    try {
        const file = req.file;
        const { treeId, title, mediaType, userId } = req.body;
        console.log(`[server]: POST /api/media/upload - treeId: ${treeId}, userId: ${userId}, title: ${title}`);

        if (!file || !treeId || !userId) {
            return res.status(400).json({ success: false, message: 'File, treeId and userId required' });
        }

        // Check if tree and user actually exist to avoid P2003
        const tree = await prisma.tree.findUnique({ where: { id: treeId } });
        if (!tree) {
            return res.status(400).json({ success: false, message: `tree_not_found: ${treeId}` });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            // Detailed message for development context
            return res.status(401).json({ 
                success: false, 
                message: 'user_not_found', 
                detail: `User ID ${userId} does not exist. Your session might be stale. Please log out and log in again.` 
            });
        }

        // 1. Session Verzeichnis
        const sessionId = crypto.randomUUID();
        sessionDir = path.join(TEMP_DIR, sessionId);
        fs.mkdirSync(sessionDir, { recursive: true });

        // 2. User-ID formatieren
        const formattedUserId = MediaService.formatUserId(userId);

        // 3. Ordnerstruktur
        const userPath = path.join(USERS_DIR, formattedUserId);
        const originalsDir = path.join(userPath, 'originals', 'v1');
        const thumbsDir = path.join(userPath, 'thumbs');
        const mediumDir = path.join(userPath, 'medium');
        [originalsDir, thumbsDir, mediumDir].forEach(dir => fs.mkdirSync(dir, { recursive: true }));

        // 4. Validierung
        const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (!allowedExts.includes(ext)) {
            throw new Error('invalid_mime');
        }

        let width = 0, height = 0;
        const isImage = file.mimetype.startsWith('image/');
        if (isImage) {
            const dims = await MediaService.validateImage(file);
            width = dims.width;
            height = dims.height;
        }

        // 5. Virus Scan (Mock)
        // 6. Deduplizierung (Optional, übersprungen für nun)

        // 8. Datei umbenennen (UUID)
        const uuid = crypto.randomUUID().replace(/-/g, '');
        const filename = `${uuid}${ext}`;
        const relativePath = path.join('users', formattedUserId, 'originals', 'v1', filename);
        const targetPath = path.join(STORAGE_ROOT, relativePath);

        // 9. Original speichern + EXIF strip
        if (isImage) {
            await MediaService.stripExifAndSave(file.path, targetPath);
        } else {
            fs.copyFileSync(file.path, targetPath);
        }

        // 12. DB Eintrag
        const media = await prisma.media.create({
            data: {
                treeId,
                userId,
                title: title || file.originalname,
                mediaType: mediaType || (isImage ? 'PHOTO' : 'DOCUMENT'),
                path: relativePath,
                mimeType: file.mimetype,
                filesize: file.size,
                dimensions: width && height ? `${width}x${height}` : null,
                fileFormat: ext.replace('.', ''),
                version: 1,
                isCurrent: true
            }
        });

        // 13. Varianten Erzeugung (hier synchron für Einfachheit, sollte async sein)
        if (isImage || ext === '.pdf') {
            await MediaService.generateVariants(media.id);
        }

        // Cleanup temp file
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true });

        res.json({ success: true, media });
    } catch (error: any) {
        console.error('Upload error:', error);
        if (sessionDir && fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true });
        res.status(400).json({ success: false, message: error.message });
    }
});

app.get('/api/media/file/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { variant } = req.query;

        // 1. Try DB lookup
        const media = await prisma.media.findUnique({
            where: { id },
            include: { variants: true }
        });

        if (media) {
            let filePath = media.path;
            let mimeType = media.mimeType;

            if (variant) {
                const v = media.variants.find(v => v.variant === variant);
                if (v && v.path) {
                    filePath = v.path;
                    mimeType = v.mimeType;
                }
            }

            if (!filePath) return res.status(404).send('File not found');
            const fullPath = path.join(STORAGE_ROOT, filePath);
            if (!fs.existsSync(fullPath)) return res.status(404).send('File missing on disk');

            res.setHeader('Content-Type', mimeType || 'application/octet-stream');
            return fs.createReadStream(fullPath).pipe(res);
        }

        // 2. Fallback: Lookup in MEDIA_ROOT (for orphans or direct filename access)
        // Ensure path safety
        if (id.includes('..') || path.isAbsolute(id)) {
            return res.status(400).send('Invalid file path');
        }

        const orphanPath = path.join(MEDIA_ROOT, id);
        if (fs.existsSync(orphanPath)) {
            const ext = path.extname(id).toLowerCase();
            const mimeType = ext === '.pdf' ? 'application/pdf'
                           : ['.jpg', '.jpeg'].includes(ext) ? 'image/jpeg'
                           : ext === '.png' ? 'image/png'
                           : ext === '.webp' ? 'image/webp'
                           : 'application/octet-stream';
            
            res.setHeader('Content-Type', mimeType);
            return fs.createReadStream(orphanPath).pipe(res);
        }

        res.status(404).send('Not found');
    } catch (e) {
        console.error('[server]: File serving error:', e);
        res.status(500).send('Server error');
    }
});

app.patch('/api/media/:id/crop', async (req, res) => {
    try {
        const { x, y, width, height } = req.body;
        const media = await prisma.media.update({
            where: { id: req.params.id },
            data: {
                cropX: x,
                cropY: y,
                cropWidth: width,
                cropHeight: height
            }
        });

        console.log(`[server]: Cropping media ${req.params.id} to ${x},${y} ${width}x${height}`);
        await MediaService.generateVariants(media.id);
        res.json({ success: true, media });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
});

app.delete('/api/media/:id/crop', async (req, res) => {
    try {
        const media = await prisma.media.update({
            where: { id: req.params.id },
            data: {
                cropX: null,
                cropY: null,
                cropWidth: null,
                cropHeight: null
            }
        });

        await MediaService.generateVariants(media.id);
        res.json({ success: true, media });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
});

app.get('/api/media/:id', async (req, res) => {
    try {
        const media = await prisma.media.findUnique({
            where: { id: req.params.id },
            include: {
                links: true,
                citations: true,
                identifiers: true,
                noteLinks: { include: { note: true } }
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
        const { title, mediaType, notes, identifiers, citations } = req.body;
        const mediaId = req.params.id;

        const result = await prisma.$transaction(async (tx) => {
            const currentMedia = await tx.media.findUnique({
                where: { id: mediaId },
                select: { treeId: true }
            });
            if (!currentMedia) throw new Error('Media not found');
            const treeId = currentMedia.treeId;

            // 1. Basic fields
            const updatedMedia = await tx.media.update({
                where: { id: mediaId },
                data: { title, mediaType }
            });

            // 2. Identifiers
            if (identifiers !== undefined) {
                await tx.identifier.deleteMany({ where: { mediaId } });
                if (Array.isArray(identifiers) && identifiers.length > 0) {
                    for (const iden of identifiers) {
                        if (!iden.value) continue;
                        await tx.identifier.create({
                            data: {
                                treeId,
                                mediaId,
                                entityId: mediaId,
                                entityType: 'MEDIA',
                                type: iden.type || null,
                                value: iden.value
                            }
                        });
                    }
                }
            }

            // 3. Notes (Standardized)
            if (notes !== undefined) {
                // Remove old links
                await tx.noteLink.deleteMany({ where: { mediaId } });
                if (Array.isArray(notes)) {
                    for (const noteData of notes) {
                        const isString = typeof noteData === 'string';
                        const text = isString ? noteData.trim() : (noteData.text || '').trim();
                        if (!text) continue;

                        const sharedNote = await tx.sharedNote.create({
                            data: {
                                treeId,
                                text,
                                noteType: isString ? 'OTHER' : (noteData.noteType || 'OTHER'),
                                privacyLevel: (!isString && noteData.isPrivate) ? 'PRIVATE' : 'PUBLIC',
                                researchStatus: 'OPEN' // Default for now
                            }
                        });
                        await tx.noteLink.create({
                            data: {
                                treeId,
                                mediaId,
                                noteId: sharedNote.id
                            }
                        });
                    }
                }
            }

            // 4. Citations
            if (citations !== undefined) {
                await tx.citation.deleteMany({ where: { mediaId } });
                if (Array.isArray(citations)) {
                    for (const cit of citations) {
                        if (!cit.sourceId) continue;
                        await tx.citation.create({
                            data: {
                                treeId,
                                mediaId,
                                sourceId: cit.sourceId,
                                page: cit.page || null
                            }
                        });
                    }
                }
            }

            return updatedMedia;
        });

        res.json({ success: true, media: result });
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
        const fname = media.path;
        if (fname) {
            const baseDir = (fname.startsWith('users/') || fname.includes('/originals/')) ? STORAGE_ROOT : MEDIA_ROOT;
            const fullPath = path.join(baseDir, fname);
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        }

        await prisma.media.delete({ where: { id: req.params.id } });

        await prisma.changeLog.create({
            data: {
                treeId: media.treeId,
                action: 'DELETE',
                entityType: 'MEDIA',
                entityId: media.id,
                before: media as any,
                summary: `Medium ${media.title} gelöscht`
            }
        });

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

async function analyzeInvalidFamilyIds(treeId: string) {
    const families = await prisma.family.findMany({
        where: { treeId },
        include: {
            familyMembers: {
                include: { person: true }
            }
        }
    });

    const signatureToFamilies = new Map<string, typeof families>();
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

    const invalidFamilies = families.filter(f => !GedcomManager.isGedcomXref(f.gedcomId || ''));
    const invalidIds = invalidFamilies.map(f => f.id);
    const duplicateCleanupCandidates: Array<{ canonicalId: string; deleteIds: string[]; signature: string }> = [];

    for (const [signature, grouped] of signatureToFamilies.entries()) {
        if (grouped.length < 2) continue;
        const canonical = grouped.find(f => GedcomManager.isGedcomXref(f.gedcomId || ''));
        if (!canonical) continue;
        const deleteIds = grouped
            .filter(f => f.id !== canonical.id && !GedcomManager.isGedcomXref(f.gedcomId || ''))
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

app.get('/api/tree/:tree/diagnostics', async (req, res) => {
    try {
        const { tree: treeName } = req.params;
        const tree = await prisma.tree.findUnique({ where: { name: treeName } });
        if (!tree) return res.status(404).json({ success: false, message: 'Tree not found' });

        const { invalidIds, duplicateCleanupCandidates } = await analyzeInvalidFamilyIds(tree.id);

        const errors = [
            ...invalidIds.map((id) => ({
                id: `family-id-${id}`,
                type: 'FAMILY',
                line: 0,
                code: 'FAMILY_ID_INVALID',
                message: `Family with invalid ID format detected: ${id}`,
                explanation: 'Family IDs should use GEDCOM-like xref format such as @F123@.',
                content: id
            })),
            ...duplicateCleanupCandidates.map((c) => ({
                id: `family-dup-${c.canonicalId}`,
                type: 'FAMILY',
                line: 0,
                code: 'FAMILY_DUPLICATE_INVALID_ID',
                message: `Duplicate family candidates for canonical ${c.canonicalId}`,
                explanation: `Invalid-id duplicates: ${c.deleteIds.join(', ')}`,
                content: c.signature
            }))
        ];

        res.json({
            success: true,
            errors,
            meta: {
                invalidFamilyIds: invalidIds,
                duplicateCleanupCandidates
            }
        });
    } catch (error: any) {
        console.error('Diagnostics error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/tree/:tree/family/cleanup-invalid-ids', async (req, res) => {
    try {
        const { tree: treeName } = req.params;
        const { dryRun = true } = req.body || {};
        const tree = await prisma.tree.findUnique({ where: { name: treeName } });
        if (!tree) return res.status(404).json({ success: false, message: 'Tree not found' });

        const { invalidIds, duplicateCleanupCandidates } = await analyzeInvalidFamilyIds(tree.id);
        const deleteIds = Array.from(new Set(duplicateCleanupCandidates.flatMap(c => c.deleteIds)));

        if (!dryRun && deleteIds.length > 0) {
            await prisma.family.deleteMany({
                where: { treeId: tree.id, id: { in: deleteIds } }
            });
        }

        res.json({
            success: true,
            dryRun: !!dryRun,
            invalidFamilyIds: invalidIds,
            duplicateCleanupCandidates,
            deleteIds,
            deletedCount: dryRun ? 0 : deleteIds.length
        });
    } catch (error: any) {
        console.error('Cleanup invalid family IDs error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/tree/:tree/family/delete-invalid-ids', async (req, res) => {
    try {
        const { tree: treeName } = req.params;
        const { ids } = req.body || {};
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: 'ids array is required' });
        }

        const tree = await prisma.tree.findUnique({ where: { name: treeName } });
        if (!tree) return res.status(404).json({ success: false, message: 'Tree not found' });

        const requestedIds = ids.map((x: any) => String(x || '').trim()).filter(Boolean);
        const existing = await prisma.family.findMany({
            where: { treeId: tree.id, id: { in: requestedIds } },
            select: { id: true, gedcomId: true }
        });

        const deletable = existing
            .filter(f => !GedcomManager.isGedcomXref(f.gedcomId || ''))
            .map(f => f.id);

        let deletedCount = 0;
        if (deletable.length > 0) {
            const del = await prisma.family.deleteMany({
                where: { treeId: tree.id, id: { in: deletable } }
            });
            deletedCount = del.count;
        }

        const skipped = requestedIds.filter(id => !deletable.includes(id));

        res.json({
            success: true,
            requestedIds,
            deletedIds: deletable,
            deletedCount,
            skippedIds: skipped
        });
    } catch (error: any) {
        console.error('Delete invalid family IDs error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
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

    // Find persons with places in this tree
    const personsWithPlaces = await prisma.person.findMany({
        where: { treeId: tree.id },
        take: 50,
        include: {
            events: {
                where: { place: { latitude: { not: null }, longitude: { not: null } } },
                include: { place: true }
            },
            facts: {
                where: { place: { latitude: { not: null }, longitude: { not: null } } },
                include: { place: true }
            },
            names: { where: { isPrimary: true } },
            mediaLinks: {
                include: { media: true }
            }
        }
    });

    const persons = personsWithPlaces.filter(p => p.events.length > 0 || p.facts.length > 0).map((p: any) => {
        const primaryMedia = p.mediaLinks.find((ml: any) => ml.isPrimary)?.media || p.mediaLinks[0]?.media;
        return {
            id: p.id,
            gedcomId: p.gedcomId,
            firstName: p.names[0]?.given || '',
            lastName: p.names[0]?.surname || '',
            profileImageUrl: primaryMedia?.id || '',
            places: [
                ...p.events.map((e: any) => ({ name: e.place?.name || '', lat: e.place?.latitude, lng: e.place?.longitude })),
                ...p.facts.map((f: any) => ({ name: f.place?.name || '', lat: f.place?.latitude, lng: f.place?.longitude }))
            ]
        };
    });

    res.json({ success: true, markers, persons });
});

app.listen(port, () => {
    console.log(`[server]: Heritago GEDCOM-Compliant Backend running at http://localhost:${port}`);
});
