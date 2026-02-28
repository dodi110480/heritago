import { PrismaClient } from '@prisma/client';
import { GedcomManager } from './src/index';

const prisma = new PrismaClient();

async function test() {
    const tree = await prisma.tree.findFirst();
    if (!tree) return console.log("No tree found");

    const person = await prisma.person.findFirst({ include: { names: true } });
    if (!person) return console.log("No person found");

    console.log(`Testing with person: ${person.names[0]?.value} (${person.gedcomId})`);

    const mockData = {
        id: person.gedcomId,
        firstName: person.names[0]?.given,
        lastName: person.names[0]?.surname,
        gender: person.sex,
        families: [
            {
                spouseId: '@I_NON_EXISTENT@', // Testing non-existent
                children: []
            }
        ]
    };

    try {
        const result = await GedcomManager.createPerson(prisma, tree.id, mockData);
        console.log("Success:", result.gedcomId);
    } catch (e) {
        console.error("Failed:", e);
    }
}

test();
