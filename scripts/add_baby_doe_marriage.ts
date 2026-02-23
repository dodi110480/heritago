import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../server/.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
    const tree = await prisma.tree.findUnique({ where: { name: 'TestTreeV2' } });
    if (!tree) {
        console.error('Tree TestTreeV2 not found');
        return;
    }

    // Find Baby Doe
    const babyDoe = await prisma.individual.findUnique({
        where: { treeId_gedcomId: { treeId: tree.id, gedcomId: '@I3@' } }
    });

    if (!babyDoe) {
        console.error('Baby Doe not found');
        return;
    }

    // Find family with spouse
    const familyMember = await prisma.familyMember.findFirst({
        where: { individualId: babyDoe.id, role: { in: ['HUSB', 'WIFE'] } },
        include: { family: true }
    });

    if (!familyMember) {
        console.error('Family for Baby Doe not found');
        return;
    }

    const familyId = familyMember.familyId;

    // Add marriage event
    await prisma.event.create({
        data: {
            famOwnerId: familyId,
            type: 'MARR',
            dateText: '15 JAN 2020'
        }
    });

    console.log('Added marriage event (15 JAN 2020) to family of Baby Doe');
}

main().catch(console.error).finally(() => prisma.$disconnect());
