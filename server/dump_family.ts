import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
    const individuals = await prisma.individual.findMany({
        include: {
            names: true,
            families: {
                include: {
                    family: {
                        include: {
                            members: {
                                include: {
                                    person: {
                                        include: {
                                            names: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    console.log('--- Individuals and their Family Connections ---');
    individuals.forEach(indi => {
        const primaryName = indi.names.find(n => n.isPrimary)?.full || indi.names[0]?.full || 'Unknown';
        console.log(`Person: ${primaryName} (ID: ${indi.id}, GEDCOM: ${indi.gedcomId}, TreeID: ${indi.treeId})`);

        indi.families.forEach(fm => {
            console.log(`  Role: ${fm.role} in Family ID: ${fm.familyId}`);
            console.log(`  Family Type: ${fm.family.type}`);
            console.log(`  Members:`);
            fm.family.members.forEach(m => {
                const mName = m.person.names.find(n => n.isPrimary)?.full || m.person.names[0]?.full || 'Unknown';
                console.log(`    - ${mName} as ${m.role}`);
            });
        });
        console.log('');
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
