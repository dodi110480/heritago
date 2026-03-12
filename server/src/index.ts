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
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';

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
import { treeAuth } from './middleware/treeAuth';
import { devAuth } from './middleware/devAuth';
import { authJwt } from './middleware/authJwt';

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
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(cookieParser());
app.use(authJwt(prisma));
app.use(devAuth(prisma));
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`[REQUEST] ${req.method} ${req.url}`);
        next();
    });
}
app.use('/uploads', express.static(MEDIA_ROOT));

// --- Auth & User Seed ---
async function ensureDefaultUser() {
    const dodi = await prisma.user.findUnique({ where: { username: 'Dodi' } });
    if (!dodi) {
        const hashedPassword = await bcrypt.hash('heritago123', 12);
        await prisma.user.create({
            data: {
                username: 'Dodi',
                email: 'admin@heritago.de',
                password: hashedPassword, 
                globalRole: 'ADMIN',
                isEmailVerified: true
            }
        });
        console.log('[server]: Default user Dodi created with hashed password');
    }
}
ensureDefaultUser().catch(console.error);

// --- Routes ---
app.use('/api/auth', authRoutes(prisma));
app.use('/api/admin', authRoutes(prisma));
// Removed unscoped person routes; use tree-scoped routes only
app.use('/api/family', familyRoutes(prisma));
// Removed unscoped media routes; use tree-scoped routes only
app.use('/api/system', systemRoutes());

// Tree-scoped routes middleware
const treeScope = treeAuth(prisma);

// Specific Tree Sub-Routes (most specific first)
app.use('/api/tree/:tree/person', treeScope, personRoutes(prisma));
app.use('/api/tree/:tree/family', treeScope, familyRoutes(prisma));
app.use('/api/tree/:tree/place', treeScope, placeRoutes(prisma));
app.use('/api/tree/:tree/media', treeScope, mediaRoutes(prisma));
app.use('/api/tree/:tree/source', treeScope, sourceRoutes(prisma));
app.use('/api/tree/:tree/repository', treeScope, repositoryRoutes(prisma));
app.use('/api/tree/:tree/search', treeScope, searchRoutes(prisma));

// General Tree & GEDCOM Routes
app.use('/api', treeRoutes(prisma));
app.use('/api/tree/:tree', treeScope, gedcomRoutes(prisma));

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
