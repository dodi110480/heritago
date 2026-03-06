import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function clean() {
  console.log('Fetching media...');
  const mediaList = await prisma.media.findMany({
    where: { treeId: 'cm7v4i6z30001tt2c8tstx1r6' },
    select: { id: true, filePath: true, _count: { select: { links: true } } }
  });
  
  const ghostIds = mediaList
     .filter(m => m._count.links === 0 && (!m.filePath || !m.filePath.includes('.')))
     .map(m => m.id);
     
  console.log(`Found ${ghostIds.length} ghost IDs without file paths looking like files.`);
  
  if (ghostIds.length > 0) {
    const res = await prisma.media.deleteMany({
      where: { id: { in: ghostIds } }
    });
    console.log(`Deleted ${res.count} records.`);
  }
}

clean().catch(console.error).finally(() => prisma.$disconnect());
