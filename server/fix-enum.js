const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    await prisma.$executeRawUnsafe("UPDATE \"Event\" SET type = 'OTHER' WHERE type = 'EVEN'");
    await prisma.$executeRawUnsafe("UPDATE \"Event\" SET type = 'OTHER' WHERE type NOT IN ('BIRT', 'CHR', 'DEAT', 'BURI', 'MARR', 'DIV', 'RESI', 'CENS', 'OCCU', 'EDUC', 'EMIG', 'IMMI', 'NATU', 'MILI', 'WILL', 'PROB', 'OTHER')");
    console.log("Updated EVEN and unknown types in Event to OTHER");

    await prisma.$executeRawUnsafe("UPDATE \"Fact\" SET type = 'OTHER' WHERE type NOT IN ('OCCUPATION', 'EDUCATION', 'RELIGION', 'NATIONALITY', 'TITLE', 'RESIDENCE', 'PROPERTY', 'MILITARY_SERVICE', 'DESCRIPTION', 'OTHER')");
    console.log("Updated unknown types in Fact to OTHER");
}

main().catch(console.error).finally(() => prisma.$disconnect());
