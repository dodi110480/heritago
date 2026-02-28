import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
    const people = await prisma.person.findMany({
        where: {
            names: {
                some: {
                    OR: [
                        { given: { contains: 'Dominik', mode: 'insensitive' } },
                        { surname: { contains: 'Sperlich', mode: 'insensitive' } }
                    ]
                }
            }
        },
        include: {
            names: true,
            events: {
                include: {
                    place: true
                }
            },
            parentRelationships: {
                include: {
                    parent: {
                        include: { names: true }
                    },
                    family: true
                }
            },
            childRelationships: {
                include: {
                    child: {
                        include: { names: true }
                    },
                    family: true
                }
            }
        }
    });

    console.log(JSON.stringify(people, null, 2));
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
