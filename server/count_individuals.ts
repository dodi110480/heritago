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
    const tree = await prisma.tree.findUnique({ where: { name: 'TestTreeV2' } });
    if (!tree) {
        console.log('Tree TestTreeV2 not found');
        return;
    }
    const count = await prisma.individual.count({ where: { treeId: tree.id } });
    console.log('--- DATABASE COUNT ---');
    console.log('Individuals in TestTreeV2:', count);
    console.log('--- END ---');
}

main().catch(console.error).finally(() => {
    prisma.$disconnect();
    pool.end();
});
