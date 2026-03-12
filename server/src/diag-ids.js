const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tree = await prisma.tree.findUnique({ where: { name: 'dddd' } });
  if (!tree) {
    console.log('Tree dddd not found');
    return;
  }
  console.log('Tree ID:', tree.id);

  const person = await prisma.person.findFirst({
    where: { treeId: tree.id },
    include: { names: true }
  });
  console.log('Sample Person:', {
    id: person.id,
    gedcomId: person.gedcomId,
    name: person.names[0]?.full
  });

  const family = await prisma.family.findFirst({
    where: { treeId: tree.id },
    include: { events: true }
  });
  console.log('Sample Family:', {
    id: family.id,
    gedcomId: family.gedcomId,
    eventsCount: family.events.length
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
