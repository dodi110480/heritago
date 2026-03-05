import { PrismaClient } from '@prisma/client';

async function test() {
    const prisma = new PrismaClient();
    try {
        console.log('Identifier keys:', Object.keys(prisma.identifier || {}));
        console.log('Import person keys:', Object.keys(prisma.importPerson || {}));
        console.log('GedcomXrefMap keys:', Object.keys(prisma.gedcomXrefMap || {}));
    } catch (e) {
        console.error('Error accessing prisma models:', e);
    } finally {
        await prisma.$disconnect();
    }
}

test();
