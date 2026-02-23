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
    const individuals = await prisma.individual.findMany({
        where: {
            OR: [
                { names: { some: { given: { contains: 'Egon' }, surname: { contains: 'Ganter' } } } },
                { names: { some: { given: { contains: 'Günter' }, surname: { contains: 'Doe' } } } }
            ]
        },
        include: {
            names: true,
            families: {
                include: {
                    family: {
                        include: {
                            members: {
                                include: {
                                    person: {
                                        include: { names: true }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    console.log('--- INDIVIDUALS AND FAMILIES ---');
    for (const ind of individuals) {
        const primaryName = ind.names.find((n: any) => n.isPrimary) || ind.names[0];
        console.log(`\nPerson: ${primaryName.given} ${primaryName.surname} (${ind.gedcomId})`);
        console.log('Memberships:');
        for (const membership of ind.families) {
            const fam = membership.family;
            console.log(`  Family ${fam.gedcomId} as ${membership.role}`);
            for (const m of fam.members) {
                const mName = m.person.names.find((n: any) => n.isPrimary) || m.person.names[0];
                console.log(`    - ${mName.given} ${mName.surname} (${m.role})`);
            }
        }
    }
    console.log('\n--- END ---');
}

main().catch(console.error).finally(() => {
    prisma.$disconnect();
    pool.end();
});
