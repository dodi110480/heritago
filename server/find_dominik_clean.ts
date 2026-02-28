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
    const person = await prisma.person.findFirst({
        where: {
            names: {
                some: {
                    given: { equals: 'Dominik', mode: 'insensitive' },
                    surname: { equals: 'Sperlich', mode: 'insensitive' }
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

    if (person) {
        console.log("--- PERSON DATA ---");
        console.log(`ID: ${person.gedcomId}`);
        console.log(`Name: ${person.names.map(n => n.value).join(', ')}`);
        console.log(`Geschlecht: ${person.sex}`);
        console.log("Ereignisse:");
        person.events.forEach(e => {
            console.log(` - ${e.type}: ${e.dateText || 'Unbekannt'} in ${e.place?.name || 'Unbekannt'}`);
        });
        console.log("Eltern:");
        person.parentRelationships.filter(r => r.type === 'parent').forEach(r => {
            if (r.parent) {
                console.log(` - ${r.parent.names[0]?.value} (${r.parent.gedcomId})`);
            }
        });
        console.log("Kinder:");
        person.childRelationships.filter(r => r.type === 'parent').forEach(r => {
            if (r.child) {
                console.log(` - ${r.child.names[0]?.value} (${r.child.gedcomId})`);
            }
        });
        console.log("Partner:");
        // Spouses are trickier in this schema, often via childRelationships with type 'spouse'
        person.childRelationships.filter(r => r.type === 'spouse').forEach(r => {
            if (r.child) {
                console.log(` - ${r.child.names[0]?.value} (${r.child.gedcomId})`);
            }
        });
        person.parentRelationships.filter(r => r.type === 'spouse').forEach(r => {
            if (r.parent) {
                console.log(` - ${r.parent.names[0]?.value} (${r.parent.gedcomId})`);
            }
        });

    } else {
        console.log("Dominik Sperlich nicht gefunden.");
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
