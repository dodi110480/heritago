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
    const tree = await prisma.tree.findUnique({
        where: { name: 'TestTreeV2' },
        include: {
            individuals: {
                include: { names: true }
            }
        }
    });

    if (!tree) {
        console.log('Tree TestTreeV2 not found');
        return;
    }

    console.log(`--- Individuals in TestTreeV2 (Total: ${tree.individuals.length}) ---`);
    tree.individuals.forEach((indi, idx) => {
        const primaryName = indi.names.find(n => n.isPrimary)?.full || indi.names[0]?.full || 'Unknown';
        console.log(`${idx + 1}. ${primaryName} (${indi.gedcomId})`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(() => {
        prisma.$disconnect();
        pool.end();
    });
