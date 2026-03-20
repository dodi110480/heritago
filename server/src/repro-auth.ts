import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function testPermissions(userId: string, treeName: string) {
    const tree = await prisma.tree.findUnique({ where: { name: treeName } });
    if (!tree) {
        console.log(`Tree ${treeName} not found`);
        return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        console.log(`User ${userId} not found`);
        return;
    }

    console.log(`Testing permissions for User: ${user.username} (${user.globalRole}) on Tree: ${tree.name}`);

    // Simulate treeAuth logic
    if (user.globalRole === 'ADMIN') {
        console.log('ADMIN Bypass would hit. Status: ALLOWED (OWNER)');
        return;
    }

    const permission = await prisma.treePermission.findUnique({
        where: { treeId_userId: { treeId: tree.id, userId: user.id } }
    });

    if (permission) {
        console.log(`Specific permission found: ${permission.level}. Status: ALLOWED`);
    } else {
        console.log('No specific permission found. Status: DENIED');
    }
}

async function runTests() {
  const users = await prisma.user.findMany();
  const dodi = users.find(u => u.username === 'Dodi');
  const dodi_low = users.find(u => u.username === 'dodi');
  const testuser = users.find(u => u.username === 'testuser');

  if (dodi) await testPermissions(dodi.id, 'aaa');
  if (dodi_low) await testPermissions(dodi_low.id, 'aaa');
  if (testuser) await testPermissions(testuser.id, 'aaa');
}

runTests()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
