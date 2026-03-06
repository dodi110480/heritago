const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const media = await prisma.media.findMany({
    where: { treeId: 'cm7v4i6z30001tt2c8tstx1r6' },
    select: { id: true, title: true, filePath: true, remoteUrl: true, _count: { select: { links: true } } }
  });
  console.log(`Total media: ${media.length}`);
  const unlinked = media.filter(m => m._count.links === 0);
  console.log(`Unlinked media: ${unlinked.length}`);
  const noFile = unlinked.filter(m => !m.filePath);
  console.log(`Unlinked with no filePath: ${noFile.length}`);
  
  const ghostExamples = noFile.slice(0, 3);
  console.log('Examples of ghost entries:', ghostExamples);
}

main().catch(console.error).finally(() => prisma.$disconnect());
