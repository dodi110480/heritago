import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function seed() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter } as any);

    try {
        const dodi = await prisma.user.create({
            data: {
                username: 'Dodi',
                password: 'heritago123'
            }
        });
        console.log('User Dodi created:', dodi.id);
    } catch (e: any) {
        console.log('User might already exist or error:', e.message);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}
seed();
