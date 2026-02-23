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
    const trees = await prisma.tree.findMany({
        include: {
            _count: {
                select: { individuals: true, families: true }
            }
        }
    });

    console.log('--- Trees Summary ---');
    trees.forEach(t => {
        console.log(`Tree: ${t.name} (ID: ${t.id})`);
        console.log(`  Individuals count: ${t._count.individuals}`);
        console.log(`  Families count: ${t._count.families}`);
    });

    const totalIndis = await prisma.individual.count();
    console.log(`\nTotal Individuals in DB: ${totalIndis}`);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
