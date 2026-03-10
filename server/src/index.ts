import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import { authRoutes } from './routes/auth.routes';
import { personRoutes } from './routes/person.routes';
import { familyRoutes } from './routes/family.routes';
import { mediaRoutes } from './routes/media.routes';
import { gedcomRoutes } from './routes/gedcom.routes';
import { searchRoutes } from './routes/search.routes';
import { treeRoutes } from './routes/tree.routes';
import { placeRoutes } from './routes/place.routes';
import { sourceRoutes } from './routes/source.routes';
import { repositoryRoutes } from './routes/repository.routes';
import { systemRoutes } from './routes/system.routes';

dotenv.config();

const app = express();

// --- STORAGE CONFIGURATION ---
export let STORAGE_ROOT = '/var/heri/media';
try {
    if (!fs.existsSync(STORAGE_ROOT)) {
        fs.mkdirSync(STORAGE_ROOT, { recursive: true });
    }
} catch (e) {
    console.warn(`[server]: Could not use /var/heri/media (permission denied). Using local fallback.`);
    STORAGE_ROOT = path.join(__dirname, '../media-storage');
}

export const USERS_DIR = path.join(STORAGE_ROOT, 'users');
export const MEDIA_ROOT = path.join(STORAGE_ROOT, 'uploads');
export const TEMP_DIR = path.join(STORAGE_ROOT, 'temp');

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
export const upload = multer({ storage });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);
const port = process.env.PORT || 3000;

app.use(cors({
    origin: (origin, callback) => {
        callback(null, true);
    },
    credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(MEDIA_ROOT));

// --- Auth & User Seed ---
async function ensureDefaultUser() {
    const dodi = await prisma.user.findUnique({ where: { username: 'Dodi' } });
    if (!dodi) {
        await prisma.user.create({
            data: {
                username: 'Dodi',
                email: 'admin@heritago.de',
                password: 'heritago123', 
                globalRole: 'ADMIN',
                isEmailVerified: true
            }
        });
        console.log('[server]: Default user Dodi created');
    }
}
ensureDefaultUser().catch(console.error);

// --- Routes ---
app.use('/api/auth', authRoutes(prisma));
app.use('/api/person', personRoutes(prisma));
app.use('/api/family', familyRoutes(prisma));
app.use('/api/media', mediaRoutes(prisma));
app.use('/api/tree', gedcomRoutes(prisma));
app.use('/api/tree/:tree/search', searchRoutes(prisma));
app.use('/api', treeRoutes(prisma));
app.use('/api/tree/:tree/place', placeRoutes(prisma));
app.use('/api/tree/:tree/source', sourceRoutes(prisma));
app.use('/api/tree/:tree/repository', repositoryRoutes(prisma));
app.use('/api/system', systemRoutes());

// Health & Info
app.get('/api/health', (req, res) => res.json({ status: 'ok', stack: 'TS/Postgres' }));

app.listen(port, () => {
    console.log(`[server]: Heritago GEDCOM-Compliant Backend running at http://localhost:${port}`);
});
