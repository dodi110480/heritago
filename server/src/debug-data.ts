import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
    const trees = await prisma.tree.findMany();
    console.log('Trees:', JSON.stringify(trees, null, 2));
    
    const users = await prisma.user.findMany({
        select: { id: true, username: true, globalRole: true }
    });
    console.log('Users:', JSON.stringify(users, null, 2));

    const permissions = await prisma.treePermission.findMany();
    console.log('Permissions:', JSON.stringify(permissions, null, 2));

    const personCounts = await prisma.person.groupBy({
        by: ['treeId'],
        _count: { _all: true }
    });
    console.log('Person Counts:', JSON.stringify(personCounts, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
