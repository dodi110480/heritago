require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clean() {
  console.log('Connecting to DB to clean up ghost media...');
  const res = await prisma.$executeRawUnsafe(`
    DELETE FROM "Media" 
    WHERE "treeId"='cm7v4i6z30001tt2c8tstx1r6' 
      AND (SELECT COUNT(*) FROM "MediaLink" WHERE "MediaLink"."mediaId" = "Media"."id") = 0
      AND "filePath" IS NULL;
  `);
  console.log(`Deleted ${res} records using Raw SQL.`);
  
  // Also delete ones with extensions that don't match typical files if they are orphaned
  const mediaList = await prisma.media.findMany({
    where: { treeId: 'cm7v4i6z30001tt2c8tstx1r6' },
    select: { id: true, filePath: true, _count: { select: { links: true } } }
  });
  
  const ghostIds = mediaList
     .filter(m => m._count.links === 0 && (!m.filePath || m.filePath === 'Unbenannt' || !m.filePath.includes('.')))
     .map(m => m.id);
     
  console.log(`Found ${ghostIds.length} more ghost IDs.`);
  
  if (ghostIds.length > 0) {
    const res2 = await prisma.media.deleteMany({
      where: { id: { in: ghostIds } }
    });
    console.log(`Deleted ${res2.count} ghost records.`);
  }
}

clean().catch(console.error).finally(() => prisma.$disconnect());
