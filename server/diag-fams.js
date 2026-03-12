const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tree = await prisma.tree.findUnique({ where: { name: 'dddd' } });
  if (!tree) {
    console.log('Tree dddd not found');
    return;
  }
  
  const families = await prisma.family.findMany({
    where: { treeId: tree.id },
    include: { events: true, familyMembers: true }
  });
  
  console.log(`Found ${families.length} families in tree dddd`);
  families.forEach(f => {
    console.log(`Family ${f.id} (GEDCOM: ${f.gedcomId}): ${f.events.length} events, ${f.familyMembers.length} members`);
  });
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
