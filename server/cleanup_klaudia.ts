import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function cleanup() {
    console.log('Starting cleanup for Klaudia Müller...');

    // 1. Swap roles for Klaudia and John
    const klaudiaMemberId = 'd5496ab5-c16d-4ff9-a51d-a749ea0ec8b4';
    const johnMemberId = '374a6783-e7b6-460d-bc99-b25264780da5';

    await prisma.familyMember.update({
        where: { id: klaudiaMemberId },
        data: { role: 'WIFE' }
    });
    console.log('Updated Klaudia role to WIFE.');

    await prisma.familyMember.update({
        where: { id: johnMemberId },
        data: { role: 'HUSB' }
    });
    console.log('Updated John role to HUSB.');

    // 3. Fix Mathilde (F) and Günter (M) roles
    // Mathilde = 5e83e79b-a7be-4c2f-91fc-6705e78c5f04, Günter = f3417d0c-9e27-4b24-af0d-cbc3a3e33775
    // Family: ed8e298e-82d3-4220-9b50-a8a5e23c2ff1
    await prisma.familyMember.updateMany({
        where: { familyId: 'ed8e298e-82d3-4220-9b50-a8a5e23c2ff1', individualId: '5e83e79b-a7be-4c2f-91fc-6705e78c5f04' },
        data: { role: 'WIFE' }
    });
    await prisma.familyMember.updateMany({
        where: { familyId: 'ed8e298e-82d3-4220-9b50-a8a5e23c2ff1', individualId: 'f3417d0c-9e27-4b24-af0d-cbc3a3e33775' },
        data: { role: 'HUSB' }
    });
    console.log('Corrected Mathilde (WIFE) and Günter (HUSB) roles.');

    // 4. Fix Manuela (F) and Baby Doe (M) roles
    // Manuela = 78511565-b816-4c22-ad90-965a165297b1, Baby Doe = ec3546e5-52c1-4469-8daa-604b0927db9a
    // Family: 0d0b1e3f-d9fb-4aaf-ba16-fbbd04bb6b99
    await prisma.familyMember.updateMany({
        where: { familyId: '0d0b1e3f-d9fb-4aaf-ba16-fbbd04bb6b99', individualId: '78511565-b816-4c22-ad90-965a165297b1' },
        data: { role: 'WIFE' }
    });
    await prisma.familyMember.updateMany({
        where: { familyId: '0d0b1e3f-d9fb-4aaf-ba16-fbbd04bb6b99', individualId: 'ec3546e5-52c1-4469-8daa-604b0927db9a' },
        data: { role: 'HUSB' }
    });
    console.log('Corrected Manuela (WIFE) and Baby Doe (HUSB) roles.');

    // 2. Delete empty parent family for Klaudia
    const emptyFamId = 'aaac6c2d-accd-4e95-8501-e0556a193b54';

    // Delete members first
    await prisma.familyMember.deleteMany({
        where: { familyId: emptyFamId }
    });
    console.log('Deleted members of empty family.');

    // Delete family
    await prisma.family.delete({
        where: { id: emptyFamId }
    });
    console.log('Deleted empty family.');

    console.log('Cleanup finished.');
}

cleanup()
    .catch(e => console.error(e))
    .finally(async () => {
        await pool.end();
    });
