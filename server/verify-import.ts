import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { GedcomImportEngine } from './src/import-phases/GedcomImportEngine.service';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

async function verify() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter } as any);

    console.log('--- Verifying GEDCOM Import with New Schema ---');

    try {
        // 1. Setup Test Tree
        const user = await prisma.user.findFirst();
        if (!user) throw new Error('No user found');

        const tree = await prisma.tree.create({
            data: {
                name: 'Import Test ' + new Date().toISOString()
            }
        });

        await prisma.treePermission.create({
            data: {
                treeId: tree.id,
                userId: user.id,
                level: 'OWNER'
            }
        });
        console.log(`Created test tree: ${tree.id} with owner ${user.id}`);

        // 2. Run Import
        const engine = new GedcomImportEngine(prisma);
        const gedcomPath = path.join(__dirname, 'test-import.ged');

        const result = await engine.runImport(tree.id, gedcomPath, 'test-import.ged');
        console.log('Import result:', result);

        // 3. Verify Data
        const persons = await prisma.person.findMany({ where: { treeId: tree.id } });
        console.log(`Persons created: ${persons.length}`);

        const families = await prisma.family.findMany({ where: { treeId: tree.id } });
        console.log(`Families created: ${families.length}`);

        const events = await prisma.event.findMany({ where: { treeId: tree.id } });
        console.log(`Events created: ${events.length}`);

        const identifiers = await prisma.identifier.findMany({ where: { treeId: tree.id } });
        console.log(`Identifiers created: ${identifiers.length}`);
        identifiers.forEach(id => {
            console.log(` - ID: ${id.value} (Type: ${id.type}, Entity: ${id.entityType})`);
        });

        const dates = events.map(e => ({ type: e.type, min: e.minDate, max: e.maxDate }));
        console.log('Event dates calculated:', dates);

        // Block 1 Verification
        console.log('--- Block 1: Naming & Restrictions Verification ---');
        const person1 = await prisma.person.findFirst({
            where: { gedcomId: '@I1@', treeId: tree.id },
            include: { names: true }
        });
        console.log(`Person @I1@ restriction: ${person1?.restrictionNotice}`);
        console.log(`Person @I1@ name types: ${person1?.names.map(n => n.type).join(', ')}`);

        const family1 = await prisma.family.findFirst({
            where: { gedcomId: '@F1@', treeId: tree.id }
        });
        console.log(`Family @F1@ restriction: ${family1?.restrictionNotice}`);

        const block1Passed = person1?.restrictionNotice === 'CONFIDENTIAL' &&
            family1?.restrictionNotice === 'PRIVACY' &&
            person1?.names.some(n => n.type === 'BIRTH');

        if (persons.length === 2 && families.length === 1 && identifiers.length >= 3 && block1Passed) {
            console.log('\x1b[32m%s\x1b[0m', 'SUCCESS: Import verification passed (including Block 1)!');
        } else {
            console.log('\x1b[31m%s\x1b[0m', 'FAILURE: Data count mismatch or Block 1 verification failed');
            if (!block1Passed) console.log('Block 1 failed: Check restrictionNotice and name types');
        }

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

verify();
