const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.media.count({ where: { treeId: 'cm7v4i6z30001tt2c8tstx1r6' }});
  console.log('Total:', count);
  const unlinked = await prisma.media.findMany({ 
    where: { treeId: 'cm7v4i6z30001tt2c8tstx1r6', links: { none: {} } },
    select: { id: true, title: true, filePath: true, remoteUrl: true }
  });
  console.log('Unlinked:', unlinked.length);
  if(unlinked.length > 0) console.log(unlinked.slice(0, 3));
}

main().catch(console.error).finally(() => prisma.$disconnect());
