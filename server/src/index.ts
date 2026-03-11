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

import { MEDIA_ROOT } from './config';

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
app.use('/api/system', systemRoutes());

// Specific Tree Sub-Routes (most specific first)
app.use('/api/tree/:tree/place', placeRoutes(prisma));
app.use('/api/tree/:tree/source', sourceRoutes(prisma));
app.use('/api/tree/:tree/repository', repositoryRoutes(prisma));
app.use('/api/tree/:tree/search', searchRoutes(prisma));

// General Tree & GEDCOM Routes
app.use('/api/tree', gedcomRoutes(prisma));
app.use('/api', treeRoutes(prisma));

// Health & Info
app.get('/api/health', (req, res) => res.json({ status: 'ok', stack: 'TS/Postgres' }));

// --- Global Error Handler ---
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(`[GlobalError] ${req.method} ${req.originalUrl}:`, err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Ein unerwarteter Serverfehler ist aufgetreten.',
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});

app.listen(port, () => {
    console.log(`[server]: Heritago GEDCOM-Compliant Backend running at http://localhost:${port}`);
});
