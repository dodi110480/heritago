import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
    console.log('--- Database Cleanup Started ---');

    // 1. Correct reversed roles in family 21e0025c-2098-4612-bbf6-ee8811bc5a73
    const fam1Id = '21e0025c-2098-4612-bbf6-ee8811bc5a73';

    // Find Gerda and Egon in this family
    const gerdaInFam = await prisma.familyMember.findFirst({
        where: { familyId: fam1Id, person: { names: { some: { given: 'Gerda' } } } }
    });
    const egonInFam = await prisma.familyMember.findFirst({
        where: { familyId: fam1Id, person: { names: { some: { given: 'Egon' } } } }
    });

    if (gerdaInFam && egonInFam) {
        console.log(`Fixing roles in family ${fam1Id}: Gerda -> WIFE, Egon -> HUSB`);
        // We need to avoid unique constraint violations if we update role directly
        // But the unique constraint is [familyId, individualId, role]
        // Swapping roles for different individuals is fine as long as the intermediate state doesn't clash.
        await prisma.familyMember.update({
            where: { id: gerdaInFam.id },
            data: { role: 'WIFE' }
        });
        await prisma.familyMember.update({
            where: { id: egonInFam.id },
            data: { role: 'HUSB' }
        });
    }

    // 2. Delete the redundant parent family 4702f81f-f2a9-45d6-8dc8-2c254d47a6e0
    const fam2Id = '4702f81f-f2a9-45d6-8dc8-2c254d47a6e0';
    const fam2 = await prisma.family.findUnique({ where: { id: fam2Id } });
    if (fam2) {
        console.log(`Deleting redundant family ${fam2Id}`);
        await prisma.family.delete({ where: { id: fam2Id } });
    }

    console.log('--- Database Cleanup Completed ---');
}

main()
    .catch(e => console.error('Cleanup error:', e))
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
