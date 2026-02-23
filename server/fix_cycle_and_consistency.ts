import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
    console.log('--- STARTING DATABASE CLEANUP ---');

    // 1. Find Egon Ganter and Günter Doe in TestTreeV2
    const tree = await prisma.tree.findUnique({ where: { name: 'TestTreeV2' } });
    if (!tree) {
        console.error('Tree TestTreeV2 not found');
        return;
    }

    const egon = await prisma.individual.findUnique({ where: { treeId_gedcomId: { treeId: tree.id, gedcomId: '@I1771671954479@' } } });
    const guenter = await prisma.individual.findUnique({ where: { treeId_gedcomId: { treeId: tree.id, gedcomId: '@I1771656660659@' } } });

    if (!egon || !guenter) {
        console.error('Egon or Guenter not found');
        return;
    }

    // 2. Locate the family where Guenter is wrongly a child of Egon
    // Family @F1771672062986_362@: Husband Egon, Child Guenter
    const wrongMembership = await prisma.familyMember.findFirst({
        where: {
            individualId: guenter.id,
            role: 'CHIL',
            family: {
                gedcomId: '@F1771672062986_362@',
                treeId: tree.id
            }
        }
    });

    if (wrongMembership) {
        console.log(`Deleting wrong membership: Guenter Doe as child in Family ${wrongMembership.familyId}`);
        await prisma.familyMember.delete({ where: { id: wrongMembership.id } });
        console.log('SUCCESS: Cycle resolved.');
    } else {
        console.log('No wrong membership found. Cycle already resolved or IDs changed.');
    }

    // 3. Optional: Verify John Doe's Primary Image
    const john = await prisma.individual.findUnique({
        where: { treeId_gedcomId: { treeId: tree.id, gedcomId: '@I1@' } },
        include: { media: { include: { media: true } } }
    });

    if (john) {
        const primary = john.media.find(m => m.isPrimary);
        console.log(`John Doe primary media found: ${!!primary}`);
    }

    console.log('--- CLEANUP FINISHED ---');
}

main().catch(console.error).finally(() => {
    prisma.$disconnect();
    pool.end();
});
