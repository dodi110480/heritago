import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function run() {
  const f = await p.fact.findMany({ take: 5 });
  console.log("Facts:", f);
  const e = await p.event.findMany({ where: { type: { in: ['OCCU', 'RESI'] } }, take: 5 });
  console.log("Events as facts:", e);
}
run();
