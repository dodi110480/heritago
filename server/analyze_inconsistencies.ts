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
    // We fetch everything related to TestTreeV2 to have a full picture
    const tree = await prisma.tree.findUnique({
        where: { name: 'TestTreeV2' },
        include: {
            individuals: {
                include: {
                    names: true,
                    events: true,
                    families: {
                        include: {
                            family: {
                                include: {
                                    members: {
                                        include: {
                                            person: {
                                                include: {
                                                    names: true,
                                                    events: true // Critical for the fix
                                                }
                                            }
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

    if (!tree) {
        console.log('Tree TestTreeV2 not found');
        return;
    }

    console.log(`--- Analysis of ${tree.name} ---`);

    for (const indi of tree.individuals) {
        const primaryName = indi.names.find(n => n.isPrimary)?.full || indi.names[0]?.full || 'Unknown';
        const birthEvent = indi.events.find(e => e.type === 'BIRT');
        const birthDate = birthEvent?.dateText || 'Unknown';

        console.log(`Person: ${primaryName} (${indi.gedcomId})`);
        console.log(`  Birth: ${birthDate}`);

        // Families where this person is a child (Parents)
        const parentFamilies = indi.families.filter(fm => fm.role === 'CHIL');
        for (const pf of parentFamilies) {
            const father = pf.family.members.find(m => m.role === 'HUSB');
            const mother = pf.family.members.find(m => m.role === 'WIFE');

            if (father) {
                const fName = father.person.names.find(n => n.isPrimary)?.full || father.person.names[0]?.full || 'Unknown';
                console.log(`    Father: ${fName} (${father.person.gedcomId})`);
            }
            if (mother) {
                const mName = mother.person.names.find(n => n.isPrimary)?.full || mother.person.names[0]?.full || 'Unknown';
                console.log(`    Mother: ${mName} (${mother.person.gedcomId})`);
            }
        }

        // Families where this person is a spouse/parent
        const spouseFamilies = indi.families.filter(fm => fm.role === 'HUSB' || fm.role === 'WIFE');
        for (const sf of spouseFamilies) {
            const spouseRole = sf.role === 'HUSB' ? 'WIFE' : 'HUSB';
            const spouse = sf.family.members.find(m => m.role === spouseRole);
            const children = sf.family.members.filter(m => m.role === 'CHIL');

            if (spouse) {
                const sName = spouse.person.names.find(n => n.isPrimary)?.full || spouse.person.names[0]?.full || 'Unknown';
                console.log(`    Spouse (${sf.role}): ${sName} (${spouse.person.gedcomId})`);
            }

            if (children.length > 0) {
                console.log(`    Children in this family:`);
                for (const child of children) {
                    const cName = child.person.names.find(n => n.isPrimary)?.full || child.person.names[0]?.full || 'Unknown';
                    const cBirthEvent = child.person.events.find(e => e.type === 'BIRT');
                    console.log(`      - ${cName} (${child.person.gedcomId}, Birth: ${cBirthEvent?.dateText || 'Unknown'})`);
                }
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
