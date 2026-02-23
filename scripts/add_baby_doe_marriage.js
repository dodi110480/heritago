const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../server/.env') });

const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    const treeName = 'TestTreeV2';
    const tree = await prisma.tree.findUnique({ where: { name: treeName } });

    if (!tree) {
        console.error('Tree not found:', treeName);
        return;
    }

    // Find Baby Doe
    const babyDoe = await prisma.individual.findFirst({
        where: { treeId: tree.id, gedcomId: '@I3@' }
    });

    if (!babyDoe) {
        console.error('Baby Doe not found');
        return;
    }

    // Find family membership
    const membership = await prisma.familyMember.findFirst({
        where: { individualId: babyDoe.id, role: { in: ['HUSB', 'WIFE'] } }
    });

    if (!membership) {
        console.error('No family found for Baby Doe');
        return;
    }

    // Add marriage event
    const event = await prisma.event.create({
        data: {
            famOwnerId: membership.familyId,
            type: 'MARR',
            dateText: '15 JAN 2020'
        }
    });

    console.log('Successfully added marriage event for Baby Doe:', event.id);
}

main().catch(console.error).finally(() => prisma.$disconnect());
