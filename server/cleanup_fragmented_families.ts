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
    console.log("Suche nach fragmentierten Familien...");

    // 1. Finde alle Personen, die in mehreren Familien als Parent (spouse) gelistet sind
    const persons = await prisma.person.findMany({
        include: {
            childRelationships: {
                where: { type: 'spouse' },
                include: { family: true }
            },
            names: true
        }
    });

    for (const p of persons) {
        if (p.childRelationships.length > 1) {
            // Person ist in mehreren Familien
            const families = p.childRelationships.map(r => r.family).filter(Boolean);

            // Check if one family has no other spouse and another family has a spouse
            const familyDetails = [];
            for (const fam of families) {
                const spouses = await prisma.relationship.findMany({
                    where: { familyId: fam!.id, type: 'spouse' },
                    include: { parent: { include: { names: true } } }
                });
                const children = await prisma.relationship.findMany({
                    where: { familyId: fam!.id, role: 'child' }
                });
                familyDetails.push({ fam, spouses, children });
            }

            // Fragmentierung erkennnen: Eine Familie hat Kinder & nur 1 Parent, andere Familie hat 2 Parents
            const withChildren = familyDetails.find(fd => fd.children.length > 0 && fd.spouses.length === 1);
            const withBothParents = familyDetails.find(fd => fd.spouses.length === 2);

            if (withChildren && withBothParents && withChildren.fam.id !== withBothParents.fam.id) {
                console.log(`\nFRAGMENTIERUNG GEFUNDEN bei ${p.names[0]?.value} (${p.gedcomId}):`);
                console.log(` - Familie A (Kinder): ${withChildren.fam.id} (${withChildren.children.length} Kinder)`);
                console.log(` - Familie B (2 Parents): ${withBothParents.fam.id}`);

                const otherParent = withBothParents.spouses.find(s => s.parentId !== p.id);
                console.log(` - Fehlender Partner in A: ${otherParent?.parent?.names[0]?.value}`);

                // DRY RUN
                console.log(" > Empfehlung: Partner in Familie A verschieben und Familie B löschen.");
            }
        }
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
