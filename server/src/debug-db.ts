import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const users = await prisma.user.findMany({
    include: {
      permissions: {
        include: {
          tree: true
        }
      }
    }
  });
  console.log('Users and Permissions:');
  console.log(JSON.stringify(users, null, 2));

  const trees = await prisma.tree.findMany({
    include: {
        permissions: true
    }
  });
  console.log('Trees and Permissions:');
  console.log(JSON.stringify(trees, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
