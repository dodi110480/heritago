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
    console.log('--- Fixing Genealogical Inconsistencies in TestTreeV2 ---');

    const tree = await prisma.tree.findUnique({
        where: { name: 'TestTreeV2' }
    });

    if (!tree) {
        console.log('Tree TestTreeV2 not found');
        return;
    }

    const treeId = tree.id;

    // 1. Update Birth Dates
    const updates = [
        { gedcomId: '@I1771656660659@', date: 'ABT 1850', label: 'Günter Doe' },
        { gedcomId: '@I1771678072588@', date: 'ABT 1855', label: 'Mathilde Hugel' },
        { gedcomId: '@I1771671954479@', date: 'ABT 1878', label: 'Egon Ganter' },
        { gedcomId: '@I1771655924160@', date: 'ABT 1880', label: 'Gerda Doe' }
    ];

    for (const update of updates) {
        const indi = await prisma.individual.findUnique({
            where: { treeId_gedcomId: { treeId, gedcomId: update.gedcomId } },
            include: { events: true }
        });

        if (indi) {
            const birthEvent = indi.events.find((e: any) => e.type === 'BIRT');
            if (birthEvent) {
                await prisma.event.update({
                    where: { id: birthEvent.id },
                    data: { dateText: update.date }
                });
                console.log(`Updated birth for ${update.label}`);
            } else {
                await prisma.event.create({
                    data: {
                        type: 'BIRT',
                        dateText: update.date,
                        indiOwnerId: indi.id
                    }
                });
                console.log(`Created birth for ${update.label}`);
            }
        } else {
            console.log(`Individual ${update.label} (${update.gedcomId}) not found`);
        }
    }

    // 2. Link John Doe as son of Günter Doe and Mathilde Hugel
    // John Doe @I1@
    // Günter/Mathilde family: ed8e298e-82d3-4220-9b50-a8a5e23c2ff1
    const john = await prisma.individual.findUnique({
        where: { treeId_gedcomId: { treeId, gedcomId: '@I1@' } }
    });
    const gunterMathildeFamId = 'ed8e298e-82d3-4220-9b50-a8a5e23c2ff1';

    if (john) {
        const existingMember = await prisma.familyMember.findUnique({
            where: {
                familyId_individualId_role: {
                    familyId: gunterMathildeFamId,
                    individualId: john.id,
                    role: 'CHIL'
                }
            }
        });

        if (!existingMember) {
            await prisma.familyMember.create({
                data: {
                    familyId: gunterMathildeFamId,
                    individualId: john.id,
                    role: 'CHIL'
                }
            });
            console.log('Linked John Doe as child of Günter Doe and Mathilde Hugel');
        } else {
            console.log('John Doe is already linked as child in that family');
        }
    } else {
        console.log('John Doe (@I1@) not found');
    }

    console.log('--- Fixes Completed ---');
}

main()
    .catch(e => console.error(e))
    .finally(() => {
        prisma.$disconnect();
        pool.end();
    });
