import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const people = await prisma.individual.findMany({
        where: {
            names: {
                some: {
                    OR: [
                        { given: { contains: 'Karl-Heinz', mode: 'insensitive' } },
                        { given: { contains: 'Manuela', mode: 'insensitive' } }
                    ]
                }
            }
        },
        include: {
            names: true,
            families: {
                include: {
                    family: {
                        include: {
                            members: {
                                include: {
                                    individual: {
                                        include: { names: true }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    console.log(JSON.stringify(people, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
