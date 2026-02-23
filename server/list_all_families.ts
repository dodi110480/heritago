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
    const families = await prisma.family.findMany({
        where: { tree: { name: 'TestTreeV2' } },
        include: {
            members: {
                include: {
                    person: {
                        include: { names: true }
                    }
                }
            }
        }
    });

    console.log(`--- All Families in TestTreeV2 ---`);
    for (const fam of families) {
        console.log(`Family ID: ${fam.id} (GEDCOM: ${fam.gedcomId})`);
        const husband = fam.members.find(m => m.role === 'HUSB');
        const wife = fam.members.find(m => m.role === 'WIFE');
        const children = fam.members.filter(m => m.role === 'CHIL');

        if (husband) {
            console.log(`  Husband: ${husband.person.names[0]?.full} (${husband.person.gedcomId})`);
        }
        if (wife) {
            console.log(`  Wife: ${wife.person.names[0]?.full} (${wife.person.gedcomId})`);
        }
        if (children.length > 0) {
            console.log(`  Children:`);
            for (const child of children) {
                console.log(`    - ${child.person.names[0]?.full} (${child.person.gedcomId})`);
            }
        }
        console.log('-------------------------------------------');
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => {
        prisma.$disconnect();
        pool.end();
    });
